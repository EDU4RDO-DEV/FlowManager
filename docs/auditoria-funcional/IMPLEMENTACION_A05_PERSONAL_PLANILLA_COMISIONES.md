# Implementación A05 — Personal, planilla y comisiones

**Fecha:** 2026-10-12 (UTC-06:00)
**Rama:** `developer` (sin cambio)
**HEAD al inicio:** `0a735061ab61a84c3d73894d2d29ce71d5d929ad`
**Commit base de auditoría:** `27f59fa024a804c468c434cfd504baa0b865a362`
**Entorno:** implementación local; no se confirmó una instancia SQL Server aislada.

## 1. Resumen

Se mejoraron la validación individual del roster, la vigencia de la previsualización, la trazabilidad persistida de las comisiones, las correcciones de borradores y el historial de planillas anuladas. El flujo mensual sigue usando únicamente los estados existentes `BORRADOR` y `CERRADA`; no se añadieron aprobación ni pago.

La migración y las pruebas no se ejecutaron contra una base de datos. El cálculo y la persistencia se probaron con dobles de Prisma; la migración requiere revisión y aplicación posterior en una instancia SQL Server desechable antes del despliegue.

Los siete identificadores originales de A05 se conservan sin cambios:

| ID original | Estado de implementación | Evidencia y límite |
|---|---|---|
| `AUD-A05-001` — Una sola configuración asignada y ausencia de reglas por grupo de productos | **parcial** | Se conserva la compatibilidad con una configuración que ya admite reglas para varios productos y tipos. El cálculo selecciona exactamente una regla por producto y cantidad; reglas solapadas producen un bloqueo explícito, no una prioridad implícita. No se añadieron grupos ni asignación de varias configuraciones: hace falta definir qué representa un grupo y cómo resolver conflictos entre reglas. |
| `AUD-A05-002` — Una sola ficha incompleta puede bloquear la previsualización y generación de todo el período | **corregido con validación limitada** | La previsualización devuelve problemas identificados por empleado y producto para vínculo ausente, configuración ausente/anulada, reglas ausentes/solapadas, importes inválidos y planilla ya existente. Generar queda bloqueado mientras haya validaciones. Pruebas de servicio usan Prisma simulado; la elegibilidad real del roster sigue pendiente de política. |
| `AUD-A05-003` — La previsualización puede quedar obsoleta y no es requisito para generar | **corregido con validación limitada** | La UI invalida la previsualización al cambiar período, persona o ajustes. Se muestra el desglose completo de los resultados calculados y `Generar` exige una previsualización vigente sin bloqueos. El backend recalcula y compara una huella del resultado antes de persistirlo; una diferencia exige volver a revisar. No es un mecanismo de autorización criptográfica. La verificación fue de código, tipos y pruebas unitarias, no de interacción autenticada en navegador. |
| `AUD-A05-004` — La instantánea de importes no conserva las fuentes de atribución de la comisión | **corregido con validación limitada** | Los detalles nuevos guardan configuración/regla, banda de cantidad, fórmula aplicada, base e importe. Una tabla hija guarda cada detalle de venta considerado y una instantánea de venta, pago, sesión, fecha, chofer/vendedor, usuario atribuido, rol, cantidad y precio. Los registros históricos previos a la migración quedan con esos campos nulos/sin fuentes; no se reconstruyeron por inferencia. No hubo prueba de persistencia SQL Server. |
| `AUD-A05-005` — La clave única permite solo una planilla anulada por empleado y período | **corregido con validación limitada** | Se reemplaza la unicidad que incluía `Anulado` por un índice único filtrado de SQL Server para una sola planilla activa por empleado/período. Las planillas anuladas pueden conservar múltiples versiones. La migración no se ejecutó en una base y debe verificarse contra el esquema desplegado. |
| `AUD-A05-006` — Actualizar un borrador solo para cambiar observaciones puede eliminar ajustes y recalcular importes | **corregido con validación limitada** | Un PATCH que omite `ajustes` conserva importes, comisiones, trazas y ajustes existentes, y no vuelve a leer ventas o reglas. Enviar explícitamente `ajustes: []` sí reemplaza los ajustes del borrador y recalcula sus totales desde los importes ya persistidos; no recalcula comisiones. Cubierto con prueba unitaria mock. |
| `AUD-A05-007` — El mismo ajuste de período se aplica a todos los empleados seleccionados | **pendiente de decisión de negocio** | No se cambió el contrato existente: el mismo conjunto de ajustes se aplica a cada persona seleccionada. La UI ahora lo advierte antes de previsualizar. Falta confirmar si los ajustes son globales, individuales o ambos. |

## 2. Reglas de comisión y trazabilidad

- No se duplicó una capacidad ya existente: una configuración puede tener múltiples reglas de producto, incluso con tipos de cálculo diferentes. Se verificaron las fórmulas de porcentaje sobre venta y monto por unidad.
- Cada línea fuente de venta se procesa una sola vez por empleado mediante su ID de detalle. Si la misma cuenta vinculada figura como chofer y vendedor, la fuente se conserva una vez con atribución `AMBOS`.
- Una banda seleccionada queda registrada junto con el ID de regla/configuración y los valores efectivamente aplicados. Los solapamientos o faltantes de reglas producen validaciones por persona/producto y bloquean la generación; no se elige la regla “más cercana” ni se acumulan reglas.
- Los empleados siguen vinculados a una sola configuración. No se añadió una relación empleado–varias configuraciones ni un catálogo de grupos porque no está definido si los grupos equivalen a categorías, listas manuales u otra entidad, ni qué precedencia o acumulación debe aplicarse. Las configuraciones actuales mantienen su estructura.
- La elegibilidad comercial conserva la regla vigente: líneas no anuladas/no bonificadas de ventas pagadas (`PAGADO`/`PAGADA`), asignadas por usuario a una sesión no anulada y por fecha de sesión dentro del período. La huella y la fotografía reflejan esos datos tal como se leyeron al calcular; no redefinen cuándo nace o se revierte una comisión.

## 3. Flujo mensual de planilla

- La selección de mes ahora presenta los nombres de los meses y el año explícito; la revisión identifica período, cantidad calculada, validaciones y estado destino `BORRADOR`.
- La previsualización muestra todos los empleados calculados, importes de sueldo base, comisión, bonos, viáticos, descuentos y líquido, con desglose de reglas/productos y ajustes. Ya no limita la vista a cuatro personas.
- Los problemas aparecen como mensajes por empleado y concepto; los datos inválidos o sin regla no se convierten silenciosamente en comisión cero. Una planilla activa existente para ese período también bloquea el lote.
- Al generar, el servidor valida que la huella de la revisión coincida con un nuevo cálculo; las restricciones y verificaciones de duplicidad impiden repetir una generación activa. Los conflictos de unicidad se traducen a HTTP 409.
- El panel aclara que los ajustes actuales se aplican a cada persona seleccionada. Se añadió confirmación antes del cierre y se indica que cerrar vuelve inmutable la planilla, pero no aprueba ni paga.
- Las planillas `CERRADA` siguen siendo inmutables. No se implementaron reapertura, aprobación, pago ni edición de sesiones cerradas.

## 4. Cambios de esquema y migración

**Limitación comprobada:** el detalle actual conserva importes agregados por producto, pero no referencia la regla aplicada ni las líneas/atribuciones que formaron su base; además, la clave única `(IdEmpleado, Mes, Anio, Anulado)` admite solo una fila anulada por período.

Se modificó `backend/prisma/schema.prisma` y se creó `backend/prisma/migrations/20261012080000_a05_payroll_provenance_history/migration.sql`:

1. `PlanillaDetalleComision` incorpora IDs de configuración/regla y la banda aplicada, todos nulos para detalles históricos existentes.
2. `PlanillaDetalleComisionFuente` almacena una fila por detalle de venta incluido, con los valores de venta, pago y atribución capturados al generar. Las referencias de origen se guardan como valores de snapshot; no dependen de que ventas o sesiones sigan sin cambios para explicar un cierre anterior.
3. Se elimina la restricción única previa por estado y se crea un índice único filtrado de SQL Server (`Anulado = 0`) para conservar una sola versión activa y permitir múltiples anuladas.
4. La relación opcional a `ReglaComision` evita borrar físicamente una regla que ya tenga detalles de planilla. Los servicios existentes anulan reglas de forma lógica.

No se modificaron migraciones históricas. La migración SQL no se aplicó y no se ejecutaron seeds ni escrituras. El índice filtrado se define en SQL Server porque el modelo Prisma conserva el índice no único de consulta y no declara el filtro como `@@unique`.

## 5. Archivos modificados

| Archivo | Motivo |
|---|---|
| `backend/prisma/schema.prisma` | Modelar procedencia/bandas de comisión y quitar la unicidad incompatible con varias anulaciones históricas. |
| `backend/prisma/migrations/20261012080000_a05_payroll_provenance_history/migration.sql` | Migración revisable para snapshots, referencia de regla e índice único filtrado. |
| `backend/src/services/planilla-mensual.service.ts` | Prevalidar empleados/reglas, calcular una sola regla aplicable, capturar procedencia, vincular generación al preview y hacer PATCH parcial sin recalcular comisiones. |
| `backend/src/controllers/planilla-mensual.controller.ts` | Responder conflictos de unicidad/revisión obsoleta con HTTP 409 y mensajes accionables. |
| `backend/src/validators/planilla-mensual.validators.ts` | Exigir el ID de previsualización en solicitudes de generación. |
| `backend/src/tests/planilla-mensual.service.spec.ts` | Cubrir porcentajes, monto por unidad, deduplicación, validaciones, solapamientos, huella, persistencia simulada y PATCH parcial. |
| `frontend/types/payroll.ts` | Tipar diagnósticos, huella y datos de procedencia. |
| `frontend/app/payroll/page.tsx` | Guiar selección/revisión/generación, mostrar resultados y errores completos, invalidar preview obsoleto y confirmar cierre. |
| `docs/auditoria-funcional/IMPLEMENTACION_A05_PERSONAL_PLANILLA_COMISIONES.md` | Registrar cambios, estado de hallazgos, validación y decisiones pendientes. |

Los informes y documentos maestros A01–A04/00–14 presentes al inicio se conservaron. El informe A05 nuevo se creó tras comprobar que no existía. No se creó ningún commit ni se cambió de rama.

## 6. Pruebas y comprobaciones

Comprobaciones ejecutadas localmente:

- `npm test -- src/tests/planilla-mensual.service.spec.ts src/tests/sale-transition-notifications.spec.ts src/tests/logistics-session-concurrency.spec.ts src/tests/usuario-empleado-link.spec.ts` — **4 archivos, 20 pruebas aprobadas**.
- `npm run build` desde `backend` — **aprobado** (`tsc` y copia de plantillas).
- `npx prisma validate` desde `backend` — **aprobado**.
- `npm run prisma:generate` desde `backend` — **cliente Prisma 6.16.2 generado correctamente** después de detener el servidor backend local.
- `npx tsc --noEmit` desde `frontend` — **aprobado**.
- ESLint con `--rule 'react-hooks/set-state-in-effect: off'` sobre los dos archivos frontend modificados — **aprobado** para el resto de reglas.
- ESLint estándar sobre esos archivos — **falló por dos infracciones preexistentes** `react-hooks/set-state-in-effect` en `frontend/app/payroll/page.tsx` (llamada inicial a `loadData` y limpieza del detalle cuando no hay selección). No se cambiaron porque no son parte de A05 y el contrato pide evitar cambios ajenos.
- La revisión local de UI redirigió `/payroll` a `/login` con respuestas 401; no se utilizaron credenciales. No se pudo verificar visualmente la pantalla autenticada.

Las pruebas de servicio y el mapeo de escritura usan Prisma simulado; no demuestran persistencia real. No se ejecutó el build de producción del frontend ni una prueba de integración contra SQL Server. No se ejecutaron migraciones ni se consultaron datos productivos/compartidos.

## 7. Decisiones pendientes

Antes de desplegar o ampliar el modelo, confirmar:

1. Qué entidad define un grupo de productos y si un empleado debe poder combinar varias configuraciones. Si producto y grupo coinciden, o hay dos configuraciones aplicables, ¿se rechaza el conflicto, prevalece una regla o se acumulan comisiones?
2. Qué empleados entran en la planilla: persona activa sin comisión, configuración anulada o sin banda, fechas de contratación/salida, sueldo base sin comisión y exclusiones manuales. Por seguridad, hoy los casos sin datos/regla quedan identificados y bloquean la generación; no se asumió que deban excluirse ni cobrar solo sueldo.
3. Qué estados/fechas determinan comisión y período, cómo tratar anulaciones de pago/venta, devoluciones parciales y correcciones; y si dos personas distintas atribuidas como vendedor y chofer cobran ambas la comisión completa.
4. Si una sesión cerrada puede editarse/reabrirse/corregirse y cómo se versiona la atribución. El snapshot preserva lo que se calculó, pero previews y nuevos cálculos siguen leyendo la sesión vigente, conforme al comportamiento actual y a la decisión A04 pendiente.
5. Si ajustes de bono/viático/descuento son de lote, individuales o ambos. El flujo actual los aplica a cada empleado seleccionado y ahora lo hace visible; no se inventó una asignación por persona.
6. Si una planilla cerrada puede reabrirse o corregirse mediante una nueva versión. El código mantiene `CERRADA` inmutable y no implementa aprobación ni ejecución de pagos.

## 8. Dependencias y pasos previos al despliegue

- **A01:** se requiere `Empleado.IdUsuarioVinculado`; los empleados sin vínculo se muestran como bloqueos, sin alterar la identidad o autorización.
- **A02:** permanecen sin cambio los filtros de venta/pago que alimentan comisión; deben coordinarse las decisiones sobre anulaciones y devoluciones.
- **A03:** reglas y trazas identifican `InventarioItem`; no se creó un catálogo de grupos.
- **A04:** la fotografía guarda fecha de sesión y asignaciones actuales. `AUD-A04-003` sigue pendiente; no se bloqueó ni cambió la edición de sesiones cerradas.
- Antes de desplegar: comparar el esquema real con la restricción histórica, respaldar/inspeccionar la instancia aislada, revisar la migración SQL Server y probar generación, anulación repetida, restauración y consulta histórica. Confirmar clientes API externos que ahora deben enviar `previewId`.
- Aplicar migración y pruebas de persistencia únicamente en SQL Server aislado confirmado. La ejecución de migraciones, seeds y cambios en producción/compartida queda fuera de esta implementación.
