# Implementación A02 — Clientes y ciclo comercial hasta el cobro

**Fecha:** 2026-10-12 (UTC-06:00)
**Rama:** `developer` (sin cambio de rama)
**HEAD al inicio de la implementación:** `6ff179676294c572347c38f2a6c1107a4adf1534`
**Base indicada por la auditoría:** `27f59fa024a804c468c434cfd504baa0b865a362`
**Entorno:** cambios locales, pruebas unitarias con dobles de Prisma y validaciones estáticas; no se confirmó SQL Server aislado.

## 1. Resumen de cambios

- Se habilitó la asignación opcional de un tipo de cliente existente y activo desde el alta y edición de clientes. El backend valida la referencia; la interfaz permite dejarla sin clasificar y mantiene visible una asignación antigua cuyo tipo ya no esté activo. No se impuso que todos los clientes deban tener tipo.
- Los abonos ahora se ejecutan en una transacción `Serializable`. Los conflictos de serialización de Prisma (`P2034`) se devuelven como HTTP 409 en las rutas de pago de ventas y de créditos. No se reintentan automáticamente las solicitudes.
- La edición del cursor de talonario ya no permite retroceder el valor actual ni dejarlo por debajo del mayor correlativo ya asignado a una venta. La escritura compara el cursor leído para detectar una reserva concurrente; el conflicto se comunica con HTTP 409.
- La validación frontend de pago al contado compara los importes a dos decimales, en concordancia con el contrato backend y la escala monetaria persistida, en vez de permitir un margen fijo de `0.0001`.
- Se añadieron pruebas unitarias negativas y de regresión. La revisión complementaria actualizó el esquema Prisma y añadió una migración versionada; no se alteraron migraciones históricas, seeds, dependencias, archivos de bloqueo ni datos.
- En la revisión complementaria se constató que `NumeroVenta` se asigna secuencialmente mediante `MAX + 1`, pero no estaba protegido por una restricción única de base de datos. Se añadió `UQ_Venta_NumeroVenta` y una migración versionada con preflight que se detiene si ya hay números duplicados. La migración no se ejecutó.
- No se modificaron operaciones de FEL, reversas de pagos de contado, proformas o selección de precio manual: sus reglas continúan pendientes de decisión humana.

## 2. Estado de `AUD-A02-001` a `AUD-A02-009`

| ID | Estado | Evidencia y alcance |
|---|---|---|
| `AUD-A02-001` | **corregido con validación limitada** | El contrato de cliente acepta `idTipoCliente` opcional/nulo; el servicio valida que una asignación nueva corresponda a un tipo activo y lo persiste/devuelve. Las pantallas de alta y edición permiten seleccionarlo o quitarlo. Pruebas mock cubren alta, referencia inactiva y eliminación de la asignación. No se confirmó si todos los clientes deben clasificarse ni si hay consumidores externos que asignen ese campo. |
| `AUD-A02-002` | **pendiente de decisión de negocio** | Sin cambios. No se calculó vencimiento, incremento ni restricción logística desde `TipoCredito`: no está definido el significado de esos campos, los límites ni el tratamiento de tipos inactivos. |
| `AUD-A02-003` | **pendiente de decisión de negocio** | Sin cambios. Crear una CxC o reabrir deuda al anular un pago de contado podría atribuir una deuda sin decidir cómo se trata el efectivo recibido. La política de anulación/reembolso/cartera debe definirse antes de cambiar los estados. |
| `AUD-A02-004` | **parcial** | La transacción de `createSalePayment` ahora usa aislamiento `Serializable`; las rutas de ventas y créditos responden HTTP 409 a `P2034`, sin repetir automáticamente el pago. La prueba unitaria verifica la solicitud de aislamiento y se conservan los casos secuenciales de saldo. No se reprodujo la carrera en SQL Server. La deduplicación de reintentos con resultado incierto y la política de referencias repetidas siguen pendientes de decisión. |
| `AUD-A02-005` | **pendiente de decisión de negocio** | Sin cambios en emisión/anulación FEL. Se necesita acordar reconciliación y reintentos ante respuesta fiscal exitosa, timeout incierto o fallo SQL. No se contactó al proveedor ni se ejecutó operación fiscal. |
| `AUD-A02-006` | **pendiente de decisión de negocio** | Sin cambios. No se vinculó `PATCH RequiereFactura` a emisión: se debe decidir si el cambio emite, agenda reintento o está prohibido, y confirmar consumidores externos. |
| `AUD-A02-007` | **corregido con validación limitada** | El servicio rechaza retroceso respecto al cursor actual y respecto al máximo `NumeroProForma` ya asignado a ese talonario. La actualización usa comparación del cursor esperado para no sobrescribir una reserva concurrente; el endpoint reporta HTTP 409 para ese conflicto. Pruebas mock cubren retroceso, número histórico y colisión concurrente. No se inspeccionaron ventas ni correlativos existentes en una base desplegada y no se añadió una restricción de esquema. |
| `AUD-A02-008` | **pendiente de decisión de negocio** | Sin cambios. No se alteraron los efectos de `PROFORMA` ni se creó conversión; faltan reglas sobre stock, pago, CxC, talonario, FEL y autorización de conversión. |
| `AUD-A02-009` | **pendiente de decisión de negocio** | Sin cambios. El precio manual y el fallback del formulario no se modificaron: hacen falta política de roles, límites, descuentos, redondeo y errores de resolución antes de determinar qué precio debe prevalecer. |

## 3. Archivos modificados y justificación

### Backend

| Archivo | Justificación |
|---|---|
| [`backend/src/validators/client.validators.ts`](../../backend/src/validators/client.validators.ts) | Aceptar la clasificación opcional en altas y actualizaciones, admitiendo `null` para quitarla. |
| [`backend/src/controllers/client.controller.ts`](../../backend/src/controllers/client.controller.ts) | Pasar la clasificación al servicio y devolver un error de referencia inválida/inactiva como 404, sin éxito aparente. |
| [`backend/src/services/client.service.ts`](../../backend/src/services/client.service.ts) | Validar tipos activos dentro de la transacción, persistir el identificador y exponerlo en el DTO. Una asignación inactiva ya existente se puede conservar sin reenviarla como una nueva asignación. |
| [`backend/src/services/sale.service.ts`](../../backend/src/services/sale.service.ts) | Solicitar aislamiento `Serializable` para aplicar abonos y conservar el rechazo de pagos superiores al saldo observado. |
| [`backend/src/controllers/sale.controller.ts`](../../backend/src/controllers/sale.controller.ts) | Convertir conflictos de serialización de pagos/ventas y colisiones de `NumeroVenta` en HTTP 409. |
| [`backend/src/controllers/credit.controller.ts`](../../backend/src/controllers/credit.controller.ts) | Mantener la misma respuesta HTTP 409 para pagos iniciados desde la superficie de créditos. |
| [`backend/src/services/talonario.service.ts`](../../backend/src/services/talonario.service.ts) | Rechazar retrocesos del cursor/historial y proteger la edición con comparación del cursor vigente. |
| [`backend/src/controllers/talonario.controller.ts`](../../backend/src/controllers/talonario.controller.ts) | Exponer conflictos de edición concurrente como HTTP 409. |
| [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) | Declarar único el número interno secuencial de venta. |
| [`backend/prisma/migrations/20261012073000_a02_unique_venta_numero/migration.sql`](../../backend/prisma/migrations/20261012073000_a02_unique_venta_numero/migration.sql) | Crear el índice único versionado; abortar sin modificar datos si hay números de venta duplicados. No se ejecutó. |
| [`backend/src/tests/client-a02.service.spec.ts`](../../backend/src/tests/client-a02.service.spec.ts) | Cubrir asignación de tipo activo, rechazo de tipo inactivo y retirada de asignación con Prisma simulado. |
| [`backend/src/tests/estados-catalogos.validators.spec.ts`](../../backend/src/tests/estados-catalogos.validators.spec.ts) | Cubrir los valores opcional, nulo, válido e inválido para la clasificación. |
| [`backend/src/tests/sale-cxc.service.spec.ts`](../../backend/src/tests/sale-cxc.service.spec.ts) | Afirmar que el registro del abono pide aislamiento `Serializable`, además de cubrir sobrepago y pago exacto. |
| [`backend/src/tests/talonario.service.spec.ts`](../../backend/src/tests/talonario.service.spec.ts) | Cubrir retroceso, cursor menor que numeración histórica y conflicto de comparación concurrente. |

### Frontend

| Archivo | Justificación |
|---|---|
| [`frontend/types/clients.ts`](../../frontend/types/clients.ts) | Incluir el tipo opcional en DTOs/payloads y tipar el catálogo usado por el selector. |
| [`frontend/services/clients.service.ts`](../../frontend/services/clients.service.ts) | Leer los tipos de cliente activos mediante el endpoint existente. |
| [`frontend/app/clients/_components/client-form-card.tsx`](../../frontend/app/clients/_components/client-form-card.tsx) | Mostrar selector opcional y conservar visualmente el identificador que ya estuviera asignado a un tipo inactivo. |
| [`frontend/app/clients/create/page.tsx`](../../frontend/app/clients/create/page.tsx) | Cargar el catálogo, incluir la selección opcional en la creación y comunicar un fallo de carga. |
| [`frontend/app/clients/edit/[id]/page.tsx`](../../frontend/app/clients/edit/[id]/page.tsx) | Cargar/mostrar la clasificación existente y permitir cambiarla o quitarla en la edición. |
| [`frontend/app/sales/create/page.tsx`](../../frontend/app/sales/create/page.tsx) | Alinear la validación de contado con el redondeo de dos decimales aplicado por el backend, evitando tolerancia fija y permitiendo detectar sobrepago antes del envío. |

## 4. Pruebas ejecutadas y resultados exactos

1. Desde `backend/`:

   ```text
   npm test -- src/tests/client-a02.service.spec.ts src/tests/sale-cxc.service.spec.ts src/tests/talonario.service.spec.ts src/tests/estados-catalogos.validators.spec.ts
   ```

   **Resultado final:** 4 archivos aprobados, 19 pruebas aprobadas, 0 fallidas.

2. Desde `backend/`:

   ```text
   npm run build
   ```

   **Resultado:** aprobado; `tsc` terminó y se copiaron las plantillas de reportes al directorio de build.

3. Desde `frontend/`:

   ```text
   npx tsc --noEmit
   ```

   **Resultado:** aprobado, sin errores de tipos.

4. ESLint local sobre los cinco archivos frontend de clientes modificados (`client-form-card.tsx`, páginas de alta/edición, `clients.service.ts` y `types/clients.ts`).

   **Resultado:** aprobado, sin salida de errores.

5. ESLint local sobre `frontend/app/sales/create/page.tsx`.

   **Resultado:** falló con dos errores `react-hooks/set-state-in-effect` en las líneas 269 y 286. La revisión del diff confirmó que ambas líneas están fuera del hunk modificado; son llamadas preexistentes a `setBonusPreview` y `setNitConsultaError`. No se modificaron como parte de A02.

6. Desde `backend/`:

   ```text
   prisma validate
   ```

   **Resultado:** esquema Prisma válido. Esta comprobación no se conecta a SQL Server ni ejecuta la migración.

7. `git diff --check`.

   **Resultado:** aprobado, sin errores de whitespace.

**Iteración de pruebas:** una ejecución intermedia de la nueva prueba de concurrencia del talonario falló porque la expectativa no contó una consulta de validación de nombre. Se corrigió la prueba para aislar la carrera de cursor/rango; la ejecución final indicada arriba pasó. El intento inicial de `npm test` desde la raíz falló porque el monorepo no tiene `package.json` raíz; se ejecutó correctamente desde `backend/`. El adaptador genérico de pruebas no detectó los archivos Vitest; la validación se realizó con el runner definido por el proyecto.

Las pruebas de A02 aquí reportadas usan dobles controlados; no prueban concurrencia real ni realizan escrituras de base de datos.
No se encontraron archivos de pruebas frontend para los formularios de clientes/ventas; la interfaz se validó con TypeScript y ESLint, con la limitación preexistente indicada para la página de ventas.

## 5. Defectos corregidos y limitaciones de validación

**Corregidos en código/modelo:** falta de asignación administrativa del tipo de cliente; posibilidad de retroceder el cursor comercial y sobrescribir una reserva por una actualización concurrente; lectura/escritura de saldo de abonos sin aislamiento serializable explícito; falta de protección de base de datos contra números internos de venta repetidos.

**Limitaciones:** no se verificó que SQL Server estuviera aislado/desechable, así que no se ejecutaron integraciones ni carreras dinámicas ni la migración. El preflight de `UQ_Venta_NumeroVenta` protege los datos existentes al aplicarla, pero su estado real de duplicados no se consultó. Los dobles no certifican semántica de aislamiento del motor desplegado, estado real de correlativos, clientes existentes, catálogo activo, configuración FEL ni consistencia histórica de cartera. La falta de idempotencia de pagos ante reintentos de red no queda resuelta; requiere definir una clave o regla de deduplicación.

No se ejecutaron pruebas que requieran Prisma/SQL Server, migraciones, seeds, operaciones CRUD sobre datos, pagos, anulaciones comerciales, cierres financieros, FEL o servicios externos.

## 6. Reglas comerciales que requieren decisión humana

1. Si todo cliente debe tener tipo, qué pasa con clientes sin clasificación y qué procesos externos asignan el tipo.
2. Significado y efectos de `PlazoDias`, `IncrementoPorcentual`, `RequiereCamion`, `Condiciones`, límites monetarios y tipos inactivos.
3. Tratamiento de una anulación de pago de contado: deuda/CxC, devolución de efectivo, anulación de venta y autorizaciones.
4. Si se requieren pagos idempotentes, rechazo de referencias repetidas y el resultado esperado para la operación perdedora de una carrera.
5. Protocolo fiscal de reconciliación si FEL confirma y falla SQL, si la respuesta remota es incierta o si falla la anulación local.
6. Efecto esperado al cambiar `RequiereFactura` después de crear la venta y consumidores de esa ruta.
7. Procedimiento administrativo autorizado para corregir un talonario; la implementación impide reutilizar números mediante retroceso normal.
8. Semántica de proforma y su conversión autorizada a venta.
9. Precio manual: roles, límites, descuentos, redondeo y comportamiento ante error de resolución.
10. Tratamiento de venta/pago/cartera ante devoluciones y reversas, según la decisión pendiente del documento de decisiones.

Las cuestiones de negocio bloquean solo los cambios dependientes; no bloquean las correcciones técnicas independientes implementadas.

## 7. Dependencias con inventario, logística, autenticación y FEL

- **Inventario / A03:** `sale.service.ts` conserva sus efectos actuales de inventario. No se cambiaron movimientos, reversas, kardex ni su esquema; cualquier prueba futura de alta/anulación de venta requiere fixtures sintéticos y coordinación A03.
- **Logística / A04:** no se alteró `RutaSesion` ni se interpretó `RequiereCamion`; el significado de ese campo y su vínculo con vehículo/sesión quedan pendientes.
- **Autenticación / A01:** no se modificaron middleware, guards, sesiones ni `frontend/lib/api.ts`. Los endpoints de clientes/catálogos, pagos y talonarios continúan sujetos a sus controles existentes.
- **FEL / A06:** no se modificó configuración, transporte, emisión, anulación ni notificación; no se invocó FEL/n8n. La recuperación de efectos fiscales requiere diseño conjunto A02/A06 y simulador.
- **Planilla / A05:** no se cambiaron estados o importes consumidos por comisiones; nuevas reglas comerciales pueden tener impacto posterior y deben coordinarse antes de cambiar esos contratos.

## 8. Riesgos de regresión y verificaciones pendientes

- Aislamiento `Serializable` puede provocar abortos/conflictos bajo concurrencia; se devuelve 409, sin reintentos automáticos. Hace falta comprobar en SQL Server aislado que el motor impida el sobrepago y que el cliente actualice el saldo antes de reintentar.
- No se incorporó idempotencia: si una solicitud ya confirmada pierde su respuesta y se reenvía, la operación podría duplicarse si todavía hay saldo y la política no impone una referencia única.
- La comparación optimista del talonario responde 409 si una reserva gana la carrera. Una futura prueba aislada debe verificar reserva/edición concurrentes en SQL Server y revisar los registros históricos antes de concluir que todos los correlativos existentes son únicos.
- La clasificación de cliente sigue siendo opcional por el modelo vigente. La prueba del servicio confirma validación contra tipos activos, pero no comprueba consumidores externos ni el comportamiento visual en navegador.
- La migración de unicidad de `NumeroVenta` debe ejecutarse primero en una base SQL Server desechable con datos sintéticos y debe confirmar su preflight. No está validada contra ninguna instancia.
- Permanecen pendientes las decisiones y verificaciones dinámicas de A02-002/003/005/006/008/009 y la deduplicación de reintentos de A02-004.
- La suite completa no se ejecutó; solo se seleccionaron los cuatro archivos de pruebas indicados. No se alteraron ni ocultaron resultados.

## 9. Confirmación de límites operativos

Se preservaron los informes originales y los documentos maestros 00–14. No se crearon commits ni se cambió de rama. Se modificó el esquema Prisma y se preparó una migración versionada, pero no se ejecutó ninguna migración o seed. No se escribieron datos compartidos ni se realizaron operaciones fiscales reales.

## 10. Revisión complementaria: modelo de datos y configuración dinámica

### Necesidad de esquema implementada

`Venta.NumeroVenta` se obtiene en `createSale` como el máximo actual más uno dentro de una transacción `Serializable`, lo que demuestra que el código lo trata como una secuencia interna global, pero el modelo/migración inicial no imponía unicidad. Se agregó `@unique(map: "UQ_Venta_NumeroVenta")` y un índice SQL Server versionado. El script revisa primero duplicados históricos y arroja un error explícito antes de crear el índice; no intenta corregir ni borrar ventas. El controlador responde 409 ante una colisión del índice y ante un conflicto serializable. La migración sigue sin ejecutar y su compatibilidad con los datos reales no está comprobada.

No se añadieron otras restricciones por estas razones:

- **Clasificación de cliente:** `Cliente.IdTipoCliente` ya es una FK nullable con índice. El modelo representa el comportamiento actual opcional; volverlo obligatorio carece de requisito aprobado. El FK garantiza existencia referencial, no que el tipo permanezca activo, condición que valida el servicio al asignar.
- **Pagos y saldos:** `PagoVenta.Monto` es `Decimal(10,2)` y tiene FK a `Venta`; `CuentaPorCobrar.IdVenta` es único. Los pagos no anulados son la fuente para derivar abonos/saldo, mientras `Venta.EstadoPago` y `CuentaPorCobrar.Estado` son valores de estado sincronizados por servicios transaccionales. La base no impone por sí sola que la suma de pagos no supere el total ni deduplica un reintento HTTP; definir clave de idempotencia o unicidad de referencias requiere la decisión A02 correspondiente. No se añadió un saldo duplicado.
- **Talonarios:** la relación venta-talón existe, pero el esquema no impone unicidad filtrada por talonario/correlativo. La ruta de servicio conserva cursor monotónico y actualización condicional. No se agregó una unicidad SQL: el ámbito de numeración, ventas históricas/anuladas y solapamiento entre talonarios requieren confirmación; un `@@unique` simple también afectaría ventas sin talonario/correlativo.
- **Proformas:** se almacenan en `Venta.TipoRegistro` (texto), sin entidad separada ni relación de conversión. No se alteró el modelo hasta decidir qué efectos y transiciones corresponden a una proforma.
- **Crédito:** plazo, incremento y requisito de camión ya están persistidos en `TipoCredito`; no hay fundamento para duplicarlos en `CuentaPorCobrar` o crear límites monetarios mientras su semántica y vigencia sigan abiertas. `FechaVencimiento` ya existe y es nullable.

### Valores comerciales y constantes observados

| Valor o comportamiento | Evaluación |
|---|---|
| Métodos de pago `EFECTIVO`, `TRANSFERENCIA`, `CHEQUE`, `POS` | Están como enums de validación/API en venta y crédito. Son un catálogo de negocio potencialmente variable, pero no se encontró requisito de administrarlo dinámicamente. Se mantienen como contrato; decidir si el negocio necesita habilitar/añadir métodos sin despliegue. |
| Estados `CONTADO/CREDITO`, `PENDIENTE/PARCIAL/PAGADO`, estados de entrega y `VENTA/PROFORMA` | Son estados/transiciones persistidos que forman parte del flujo. No son parámetros numéricos de configuración y no deben convertirse en opciones arbitrarias; los efectos de `PROFORMA` siguen bloqueados por decisión. |
| Importes `Decimal(10,2)` y múltiples `toFixed(2)` | El redondeo monetario coincide con la escala almacenada, pero la moneda y regla exacta de redondeo no están documentadas aquí. No se inventó una política configurable. La precisión de cantidades también usa conversiones a dos decimales en partes del ciclo y requiere coordinación con A03 antes de cambiarla. |
| Tolerancia frontend `0.0001` para pago al contado | No era una regla comercial persistida: permitía una diferencia fija distinta del contrato backend. Se sustituyó por comparación de valores redondeados a 2 decimales, que coincide con `Decimal(10,2)` y la verificación existente del backend. |
| Bonificaciones: `Math.floor(cantidad / CantidadMinima)`, `Prioridad` predeterminada en 1 y acumulación de reglas aplicables | La cantidad mínima/bonificada y prioridad se persisten en `ReglaBonificacion`; la forma de acumular o seleccionar reglas es lógica fija. El informe ya registra la pregunta pendiente de precedencia/acumulación, por lo que no se alteró. |
| `TipoCredito.RequiereCamion` predeterminado en `false` | El valor se puede enviar y persiste; su significado operativo no está acordado. No se aplicó ni cambió el default. |
| FEL: fallback `AFILIACION_IVA='PEQ'`, `ESTABLECIMIENTO='1'` y resolución de tipo de documento | Son valores fiscales, no constantes puramente técnicas. Parte del contrato se puede configurar por entorno, pero los fallbacks/mapa de tipo DTE permanecen en código. No se cambiaron: A02/A06 deben confirmar fuente de verdad, afiliación y tratamiento de configuración ausente antes de hacerlos obligatorios o trasladarlos a Empresa. No se invocó FEL. |
| Límites Zod de longitud y valores HTTP/configuración de protocolo | Límites de representación/API y nombres de estados son validación técnica/contrato; no se identificó evidencia para volverlos parámetros comerciales. |

No se identificaron porcentajes de descuento/impuesto o límites de crédito adicionales quemados en las rutas A02 revisadas que pudieran cambiarse de forma segura sin una regla aprobada. Los valores fiscales y de crédito ya indicados requieren decisiones humanas, no una migración especulativa.

### Estado de validación de esquema/migración

- `prisma validate`: aprobado para el modelo actualizado.
- Migración creada: `20261012073000_a02_unique_venta_numero`; no ejecutada ni aplicada a una base.
- Sin conexión, inspección de duplicados, prueba de rollback ni verificación de SQL Server aislado.
- Pendiente: ejecutar la migración solo en un entorno desechable confirmado, comprobar que el preflight detecta duplicados sintéticos y verificar una inserción de números distintos/repetidos sin afectar datos compartidos.

Esta revisión se mantuvo en A02 y en su dependencia FEL A06; no continuó con A03.
