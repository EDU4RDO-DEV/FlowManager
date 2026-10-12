# Implementación A04 — Rutas, vehículos y operación logística

- **Fecha:** 2026-10-12 (UTC-06:00)
- **Rama:** `developer` (sin cambio)
- **HEAD comprobado al iniciar:** `1e2ce22bfad3752559f6a9574d72cb7ebf6e1583`
- **Commit de referencia de auditoría:** `27f59fa024a804c468c434cfd504baa0b865a362`
- **Entorno:** implementación local; builds y pruebas unitarias con dobles de Prisma. No se confirmó una instancia SQL Server aislada.

## 1. Resumen

Se implementaron las correcciones A04 que no requieren inventar reglas de negocio:

- Las operaciones de alta, edición, anulación y restauración de sesiones de ruta comprueban la disponibilidad del vehículo y escriben/sincronizan la sesión y el estado del vehículo dentro de transacciones `Serializable`.
- Los conflictos de serialización Prisma (`P2034`) de esas operaciones se devuelven como HTTP 409 con una indicación explícita de verificar el estado antes de reintentar; no se repiten automáticamente.
- El selector de chofer/vendedor solo utiliza `Empleado.IdUsuarioVinculado`. Ya no ofrece `Empleado.IdUsuario` —la cuenta registradora— como sustituto.

No se añadieron estados ni transiciones de entrega, no se cambió la política de edición/reapertura de sesiones cerradas y no se borraron fechas de pago anteriores. Los documentos consultados no definen las reglas necesarias para hacerlo con seguridad. No hubo cambios de esquema, migraciones, seeds ni escrituras en bases de datos.

## 2. Estado de los hallazgos A04

| ID original | Estado | Resultado y límites |
|---|---|---|
| `AUD-A04-001` — La entrega no tiene un flujo de confirmación conectado a la UI logística | **pendiente de decisión de negocio** | Se confirmó la desconexión entre la UI local y la actualización de `EstadoEntrega`. El backend admite los estados existentes, pero no hay una matriz de transiciones autorizada ni contrato aprobado para entregas parciales, incidencias, responsable o fecha efectiva. No se conectó una UI que permitiera saltos no definidos. |
| `AUD-A04-002` — La comprobación de vehículo disponible no reserva la asignación atómicamente | **corregido con validación limitada** | Alta, edición, anulación y restauración ahora ejecutan la lectura de conflictos, mutación de sesión y sincronización del vehículo dentro de transacciones `Serializable`. Se mapean abortos `P2034` a HTTP 409. Pruebas simuladas verifican el aislamiento y el rechazo de conflictos; no prueban concurrencia real ni bloqueos de SQL Server. |
| `AUD-A04-003` — La edición de una sesión cerrada puede cambiar la atribución de ventas a planilla | **pendiente de decisión de negocio** | Se conservó el comportamiento existente. No se sabe si una sesión cerrada debe ser inmutable, corregible, reabrible o modificable mediante historial. Bloquear edición o copiar atribuciones sin definir esa política afectaría ventas y planilla de manera no autorizada. |
| `AUD-A04-004` — Volver un gasto a pendiente conserva su fecha de pago anterior | **pendiente de decisión de negocio** | El servicio todavía puede conservar `FechaPago` al cambiar a `PENDIENTE`. No se cambió porque la documentación pregunta expresamente si la fecha debe borrarse o conservarse como historial; eliminarla podría destruir una fecha histórica válida y no existe un historial alternativo en este flujo. |
| `AUD-A04-005` — El selector de empleados usa la cuenta registradora cuando falta el vínculo del empleado | **corregido y verificado** | El selector excluye empleados sin vínculo y envía solo el usuario de `IdUsuarioVinculado`. Una prueba distingue la cuenta creadora de la vinculada; el backend ya valida la relación laboral por `IdUsuarioVinculado`. El build de frontend pasó. |

Los identificadores y títulos originales se conservan sin renombrar ni reutilizar.

## 3. Correcciones y evidencia

### Reserva transaccional del vehículo — `AUD-A04-002`

En `backend/src/services/logistics.service.ts`:

- `assertVehicleAvailableForSession` consulta conflictos activos y el estado del vehículo usando el cliente transaccional.
- `createRutaSesion`, `updateRutaSesion`, `deleteRutaSesion` y `restoreRutaSesion` leen/mutan dentro de una transacción con aislamiento `Serializable`.
- La sincronización en `syncVehicleStateBySessions` comparte esa transacción; una falla revierte tanto la mutación de sesión como la sincronización derivada.
- Las validaciones de ruta, usuario y empleado que dependen de una sesión leída en la transacción usan ese mismo cliente.

En `backend/src/controllers/logistics.controller.ts`, los cuatro controladores de sesión convierten un conflicto Prisma `P2034` en HTTP 409. No se agregaron reintentos automáticos; ante una operación concurrente, el consumidor debe consultar el estado antes de decidir reintentar.

La protección se basa en el aislamiento transaccional y en la lectura del predicado vehículo/fecha/estado activo dentro de la misma transacción. No se agregó restricción o índice de esquema: la condición de exclusividad depende de los estados activos actuales y debe validarse contra el esquema y los datos efectivos de SQL Server antes de considerar una restricción persistida.

### Identidad laboral en selector — `AUD-A04-005`

- Se añadió `frontend/lib/logistics-employee-options.ts`, que genera opciones solo a partir de `idUsuarioVinculado` positivo y conserva la deduplicación previa de usuarios.
- `frontend/app/logistics/routes/page.tsx` usa el helper; `idUsuario` ya no funciona como fallback.
- `backend/src/services/logistics.service.ts::validateEmpleadoVinculado` conserva `IdUsuarioVinculado` como fuente de verdad. No se cambió el modelo de identidad.

### Hallazgos no cambiados

- **Entrega:** `frontend/services/sales.service.ts` no ofrece la actualización de venta/entrega que existe en la API. `backend/src/services/sale.service.ts::updateSale` acepta los estados declarados, pero no implementa una máquina de transiciones. No se añadieron botones o llamadas de UI que permitan una transición arbitraria.
- **Sesión cerrada:** se dejó intacta la edición actual y el consumo dinámico de fecha/asignaciones de `RutaSesion` por `backend/src/services/planilla-mensual.service.ts`. La decisión corresponde coordinarla con A05 y negocio.
- **Fecha de pago:** `createGastoVehiculo` persiste `FechaPago` nula para gastos nuevos pendientes y genera una fecha al crear un gasto pagado; `updateGastoVehiculo` permite actualizar estado/fecha por separado. La regla para revertir un pago no está definida y no se borraron fechas.

## 4. Archivos modificados y motivo

- `backend/src/services/logistics.service.ts` — atomicidad de reserva, cambios de sesión y sincronización de estado del vehículo.
- `backend/src/controllers/logistics.controller.ts` — respuesta 409 explícita para conflictos de serialización en alta, edición, anulación y restauración de sesión.
- `backend/src/tests/logistics.service.spec.ts` — adapta el mock transaccional y verifica el aislamiento usado al anular una sesión.
- `backend/src/tests/logistics-session-concurrency.spec.ts` — verifica transacción serializable al crear, rechazo de reserva conflictiva y rechazo de edición conflictiva.
- `frontend/lib/logistics-employee-options.ts` — mapeo seguro de las opciones de personal a la cuenta vinculada.
- `frontend/app/logistics/routes/page.tsx` — conecta el selector al mapeo que excluye cuentas registradoras.
- `backend/src/tests/logistics-employee-options.spec.ts` — distingue expresamente ID creador e ID de usuario vinculado.
- `docs/auditoria-funcional/IMPLEMENTACION_A04_RUTAS_VEHICULOS_OPERACION_LOGISTICA.md` — este informe.

No se modificaron `backend/src/services/sale.service.ts`, `backend/src/services/inventory-movement.service.ts`, servicios de compras/envases, esquema Prisma, SQL maestro ni migraciones.

## 5. Cambios de esquema y migraciones

**Ninguno.** No se modificó `backend/prisma/schema.prisma`, no se creó una migración y no se ejecutaron migraciones. No se alteró ni ejecutó la migración A02 pendiente de validación `20261012073000_a02_unique_venta_numero`.

La protección de vehículo se implementó en la transacción de servicio, sin imponer unicidad adicional para estados cerrados/anulados ni extender exclusividad a choferes o vendedores. La comprobación real de bloqueos, predicados e índices requiere un SQL Server aislado.

## 6. Pruebas y validaciones ejecutadas

### Pruebas unitarias

Comando:

```text
npm --prefix backend test -- src/tests/logistics-session-concurrency.spec.ts src/tests/logistics.service.spec.ts src/tests/logistics.validators.spec.ts src/tests/logistics-employee-options.spec.ts src/tests/usuario-empleado-link.spec.ts src/tests/sale-transition-notifications.spec.ts
```

**Resultado:** 6 archivos aprobados, 21 pruebas aprobadas, 0 fallidas. Cubren reserva/edición conflictivas simuladas, el límite transaccional, selección de usuario vinculado, validación de vínculo laboral, validadores existentes y notificación de entrega existente.

### Build y lint

- `npm --prefix backend run build` — **aprobado** (`tsc` y copia de plantillas).
- `npm --prefix frontend run build` — **aprobado** (compilación y TypeScript de producción).
- `npm --prefix frontend run lint -- lib/logistics-employee-options.ts` — **aprobado**.
- `npm --prefix frontend run lint -- app/logistics/routes/page.tsx lib/logistics-employee-options.ts` — **falló por un error y emitió una advertencia en `page.tsx`**: regla `react-hooks/set-state-in-effect` en la llamada existente a `loadData()` dentro de `useEffect`, y `MapPinned` sin uso. `git show HEAD:frontend/app/logistics/routes/page.tsx` confirma que ambos fragmentos ya existían en HEAD antes de estos cambios; no se alteraron como parte de A04. El helper nuevo no presenta errores de lint.
- `git diff --check` — **aprobado**, sin errores de whitespace en cambios versionados.

El ejecutor de pruebas integrado no detectó archivos al recibir las rutas absolutas Windows; se ejecutó la suite focalizada con el comando Vitest del repositorio indicado arriba, que terminó correctamente.

## 7. Reglas de negocio pendientes

1. Definir estados/transiciones de entrega y quién puede ejecutarlos; decidir datos requeridos para parcialidad, incidencia, fecha efectiva y responsable.
2. Definir si una sesión cerrada admite edición, reapertura o corrección auditada, y cómo preservar la atribución que usan ventas y planilla.
3. Definir la semántica de `PAGADO` → `PENDIENTE`: si `FechaPago` se limpia o si debe preservarse en un historial de pagos separado.
4. Definir si chofer/vendedor deben ser exclusivos por fecha/turno. Esta implementación solo protege la regla ya presente para el vehículo.
5. Confirmar reglas sobre estado de vehículo cuando mantenimiento y sesiones activas difieren.

## 8. Dependencias, limitaciones y pasos previos al despliegue

- **A01:** no se modificó autenticación/RBAC. Las rutas siguen dependiendo de sus guards generales.
- **A02:** no se modificó el ciclo comercial ni la venta. La entrega requiere acordar con A02 la propiedad de `Venta.EstadoEntrega`; la prueba de notificación existente no acredita una entrega operativa.
- **A03:** no se cambiaron inventario, kardex, compras o envases. Se reutiliza el patrón `Serializable` ya empleado en A03; su validación real en SQL Server continúa pendiente.
- **A05:** `AUD-A04-003` sigue relacionado —sin duplicidad— con `AUD-A05-004`, sobre la procedencia de los cálculos de comisión. Coordinar cualquier futura política de cierre/corrección con A05.
- No se accedió a SQL Server, datos desplegados, n8n ni servicios externos. No se ejecutaron pruebas de integración, migraciones, seeds o escrituras.
- Las pruebas mock no demuestran que SQL Server serialice las lecturas de rango como se espera, que no haya interbloqueos ni cómo se manifiestan todos los errores de concurrencia. Antes del despliegue, probar altas/ediciones/restauraciones simultáneas para el mismo vehículo y fecha en una base desechable y comprobar que no se confirmen dos reservas incompatibles.
- Validar en entorno aislado que `P2034` se traduce a 409 en las rutas afectadas y que la interfaz refresca estado antes de reintentar.
- La prueba unitaria de opciones valida el mapeo que usa la UI, no una interacción de navegador con API real. La política para sesiones cerradas y pagos continúa siendo un bloqueo funcional independiente.

No se creó commit ni se cambió de rama. Los documentos de auditoría A01–A03 y demás archivos no seguidos preexistentes se conservaron.
