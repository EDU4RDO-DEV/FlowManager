# A03 — Revisión de inventario, compras, proveedores y envases retornables

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Modalidad:** revisión estática, solo lectura

## 1. Resumen ejecutivo

Se reconstruyeron los flujos principales de productos, compras de inventario y gastos, ajustes, kardex, proveedores y envases retornables desde sus pantallas/servicios frontend hasta rutas, validadores, controladores, servicios y modelos Prisma. También se siguieron los puntos de integración con ventas, gastos vehiculares/mantenimiento, comisiones, calidad y la estructura de producto.

La implementación persiste en transacciones los cambios normales de stock y sus filas de bitácora. Las anulaciones/restauraciones de compras, ajustes y envases aplican movimientos compensatorios; la anulación de una compra de inventario se rechaza si el stock actual no alcanza para retirar la cantidad original. Sin embargo, el código no hace explícita la serialización/idempotencia de varias escrituras concurrentes. También comprueba duplicidad de factura y calcula el número interno de compra antes de insertar, sin una unicidad declarada en el esquema versionado. Estos riesgos están demostrados estáticamente, pero requieren una prueba aislada para verificar su comportamiento efectivo en SQL Server.

Se registran **2 hallazgos nuevos, ambos parcialmente comprobados y de severidad ALTA**. No se encontró evidencia suficiente para declarar un hallazgo crítico. Los demás puntos de costo promedio, precisión, relaciones de envases y requisitos de uso de lotes se mantienen como cuestiones pendientes; no se elevan a defectos sin una regla de negocio aprobada.

La auditoría queda **parcialmente completa**: los flujos principales están examinados en código, pero no se consultó una base de datos, no se ejecutaron pruebas ni se confirmaron reglas de negocio, aislamiento efectivo, consumidores externos o efectos operativos.

## 2. Alcance y exclusiones

### Incluido

- Catálogo de productos/insumos y categorías `ENVASE`, `INSUMO`, `PRODUCTO_TERMINADO` y `MATERIA_PRIMA`.
- Existencia, costo promedio y precio de venta; entradas, salidas, ajustes y bitácora.
- Compras de inventario, gastos registrados como compra y sus detalles.
- Proveedores y su relación con `Entidad`.
- Préstamos, devoluciones, saldos y anulaciones/restauraciones de envases.
- Estructuras de producto en el límite necesario para distinguirlas de fabricación.
- Integraciones con ventas y los grupos A01, A02, A04, A05 y A06, sin auditar su lógica propietaria.

### Excluido

- Reportes, gráficas, dashboards, KPI y analítica, incluidos los módulos bajo `backend/src/modules/reports/`.
- Autenticación y política general de permisos (A01); cálculo comercial de ventas/pagos (A02); operación logística de rutas (A04); cálculo de planilla/comisiones (A05); lógica de calidad, configuración de empresa e integración n8n/FEL (A06).
- Consultas de SQL Server, operaciones CRUD, movimientos reales, seeds, migraciones, scripts SQL, llamadas a servicios externos, builds y pruebas.

## 3. Arquitectura y modelos examinados

Flujo principal observado:

`frontend/app/*` → `frontend/services/*` → router Express montado en `backend/src/app.ts` → `requireAuth` y permiso de módulo → controlador → validador Zod → servicio → transacción/consultas Prisma → modelos de `backend/prisma/schema.prisma`.

Rutas revisadas: `/api/products`, `/api/adjustments`, `/api/inventory-log`, `/api/product-structure`, `/api/compras`, `/api/providers` y `/api/envases`. Los routers de productos, ajustes, bitácora, compras, proveedores y envases se montan con autenticación y permisos por módulo. A01 conserva la responsabilidad sobre el comportamiento general de esos guards.

Modelos examinados: `InventarioItem`, `AjusteInventario`, `BitacoraInventario`, `Compra`, `DetalleCompra`, `DetalleGasto`, `Proveedor`, `Entidad`, `EstructuraProducto`, `MovimientoEnvase`, `EnvaseClienteSaldo`; se consultaron también las relaciones `DetalleVenta`, `Venta`, `ReglaComision`, `GastoVehiculo`, `MantenimientoVehiculo` y `ControlCalidadAgua`.

## 4. Mapa de los flujos funcionales

### Productos y existencia

- La UI de inventario utiliza `frontend/services/products.service.ts` y el API `/api/products`. `product.controller.ts` valida el cuerpo y llama a `product.service.ts`.
- `createProduct` valida proveedor y datos de producto, persiste `Existencia: 0` y registra en la misma transacción una fila inicial `PRD` con cantidad cero. No hay alta de stock inicial desde el formulario.
- `updateProduct` permite cambiar categoría, proveedor, costo promedio, precio e imagen, pero no modifica `Existencia`. La existencia se altera mediante compras, ajustes, ventas y operaciones de envases.
- La disponibilidad consultada por los consumidores es la existencia almacenada. No se encontró campo/modelo de reserva o stock disponible separado.
- `CostoPromedio` se muestra/edita en el flujo de producto y se recalcula al registrar una compra de inventario. Las categorías se restringen mediante Zod; no se encontró entidad de unidad de medida ni un factor de conversión.

### Compra de inventario y gasto

`frontend/app/purchases/create/page.tsx` y `frontend/app/purchases/_components/purchase-form-dialog.tsx` cargan proveedores y productos, validan cantidades/costos positivos y llaman `frontend/services/purchases.service.ts::createPurchase`. La ruta `POST /api/compras` valida mediante `createPurchaseSchema` y delega en `purchase.service.ts::createPurchase`.

- La compra guarda proveedor, usuario, factura, fecha, observaciones y un tipo `EsGasto`.
- Para compra de inventario se crean los detalles y, por cada línea, se actualizan existencia y costo promedio ponderado y se registra `COM` en `BitacoraInventario`, dentro de una transacción Prisma.
- Para compra clasificada como gasto se escriben `DetalleGasto`; ese camino no modifica `InventarioItem`.
- La anulación resta del stock la cantidad de cada detalle, crea una fila compensatoria `COMAN`, anula detalles y compra en la misma transacción. Si la existencia es insuficiente, la transacción no se completa.
- La restauración vuelve a sumar cantidades, registra `COMRES` y reactiva compra/detalles dentro de una transacción.
- Los gastos pueden listarse, agregarse, actualizarse, anularse y restaurarse por endpoints subordinados a la compra. `createPurchaseExpense` comprueba que la compra esté activa y sea gasto. No se encontró persistencia de pago a proveedor ni contabilización financiera dentro de este flujo.

### Ajustes, kardex y reversas

La página dedicada de ajustes usa `frontend/services/adjustments.service.ts`. El backend acepta líneas de entrada/salida; las cantidades deben ser positivas. `createAdjustment` valida el stock, registra cada ajuste, cambia existencia y crea `AJ` dentro de una transacción. Anular/restaurar ajusta el stock y agrega movimientos compensatorios `AJAN`/`AJRE` en la transacción.

`inventory-log.service.ts` lista `BitacoraInventario`, con filtros por item, tipo, documento y estado. De forma predeterminada muestra filas no anuladas. El helper `registerInventoryMovement` inserta el saldo anterior, cantidad, signo y saldo nuevo recibidos del llamador; el helper no recalcula ni compara por sí mismo esos valores.

### Proveedores

`provider.service.ts` crea una fila `Entidad` y una fila `Proveedor` en una transacción, y actualiza ambas dentro de otra. Las compras y productos relacionan el proveedor por `IdProveedor`; `GastoVehiculo` y `MantenimientoVehiculo` también pueden referenciarlo. El formulario y DTO exponen datos de entidad; la UI del proveedor no presenta todos los campos opcionales que el backend acepta (por ejemplo, segundo teléfono, sexo y fecha de nacimiento). No se concluye que sean campos huérfanos: se comparten en `Entidad`, se persisten y algunos se devuelven por API.

### Envases retornables

`frontend/app/envases/page.tsx` carga clientes, productos categoría `ENVASE`, movimientos y saldos. La UI presenta préstamo/devolución y envía cliente, item, cantidad y observaciones. El servicio backend valida categoría y cliente; en préstamo descuenta existencia y aumenta `EnvaseClienteSaldo`; en devolución comprueba el saldo, aumenta existencia y lo disminuye. Ambas operaciones crean `MovimientoEnvase` y una fila de bitácora en transacciones.

La anulación/restauración modifica el movimiento, el saldo del cliente y el stock, e inserta una nueva fila compensatoria. El modelo permite `IdVenta` opcional y el API valida que la venta corresponda al cliente, pero el formulario actual no envía `IdVenta`. El modelo no contiene un vínculo a `RutaSesion`.

## 5. Hallazgos

### AUD-A03-001 — Las operaciones concurrentes pueden dejar existencia y bitácora divergentes

- **Módulo:** inventario, compras, ajustes y envases. **Responsable primario:** A03.
- **Funcionalidad afectada:** actualización/reversa de stock y registro del kardex.
- **Descripción:** varias operaciones leen existencias, calculan un valor absoluto nuevo y luego actualizan el item y escriben el movimiento. No se declara aislamiento serializable ni se usa una actualización condicional/aritmética que garantice que el valor leído siga vigente. En ajustes, el mapa de stock se carga antes de abrir la transacción; en préstamos/devoluciones de envases el item también se lee antes de la transacción. En compras el item se lee dentro de la transacción, pero el código no declara el aislamiento ni una condición de concurrencia.
- **Evidencia técnica:**
  - `backend/src/services/adjustment.service.ts::createAdjustment` (aprox. 188–303) obtiene `itemsInventario` antes de la transacción, construye `txStockMap`, calcula la nueva existencia y la escribe como valor absoluto junto con `registerInventoryMovement`.
  - `backend/src/services/envase.service.ts::registrarPrestamoEnvase` y `registrarDevolucionEnvase` (aprox. 215–379) cargan el item y validan stock antes de la transacción; dentro de ella escriben `Existencia` calculada a partir de ese valor. Anulación/restauración también leen el movimiento antes de la transacción.
  - `backend/src/services/purchase.service.ts::createPurchase`, `anulatePurchase` y `restorePurchase` (aprox. 383–722) combinan una transacción de escritura de stock/bitácora con lecturas/cambios sin condición explícita de versión o estado.
  - `backend/prisma/schema.prisma::InventarioItem` almacena `Existencia` como `Float`; `BitacoraInventario` almacena cada saldo anterior/nuevo, sin una restricción declarada de secuencia.
- **Flujo actual comprobado:** las transacciones agrupan el cambio de stock y la inserción de bitácora, pero las lecturas/calculaciones no están protegidas de forma explícita frente a otra operación sobre el mismo item. Si dos operaciones usan la misma existencia inicial, ambas pueden escribir resultados derivados de ese mismo valor y registrar secuencias que no reflejan el saldo final persistido. Una repetición concurrente de una reversa también requiere comprobar que el estado del documento se reclame una sola vez.
- **Flujo esperado y fundamento:** una operación de inventario debería preservar la secuencia consistente de existencia, documento y movimiento. El requisito técnico de concurrencia no está especificado en la documentación de negocio; el riesgo nace de la escritura basada en valores leídos previamente.
- **Consecuencia:** posible pérdida de una entrada/salida o doble reversa, disponibilidad incorrecta y diferencia entre existencia y kardex, con efectos en compras, ventas y envases.
- **Severidad:** **ALTO**, por el posible impacto en datos operativos centrales; la ocurrencia en el entorno y bajo su aislamiento SQL efectivo no está comprobada.
- **Dependencias:** A02 por ventas y sus anulaciones; A04 por operaciones logísticas asociadas a envases; A01 solo por permisos de acceso, no por la causa del hallazgo.
- **Propuesta (no implementada):** acordar estrategia de concurrencia por operación (actualización atómica condicionada, control de versión/estado o aislamiento/locks apropiados) y mantener la escritura del movimiento en la misma transacción.
- **Pruebas recomendadas:** con SQL Server aislado/desechable, sincronizar dos compras/ajustes/préstamos sobre el mismo item y dos anulaciones/restauraciones del mismo documento; verificar resultado stock, saldo de envases, estados y cronología completa del kardex.
- **Estado:** **parcialmente comprobado**. La secuencia de lecturas y escrituras está confirmada estáticamente; no se ejecutó una carrera ni se verificó el aislamiento de la base.

### AUD-A03-002 — La verificación de factura y la numeración de compra no son atómicas

- **Módulo:** compras. **Responsable primario:** A03.
- **Funcionalidad afectada:** identificación de compra y protección contra doble registro de una factura de proveedor.
- **Descripción:** `createPurchase` consulta si ya existe la factura activa para un proveedor y calcula `NumeroCompra` como máximo más uno antes de iniciar la transacción que inserta la compra. La tabla `Compra` no declara unicidad para `(IdProveedor, NumeroFactura)` ni para `NumeroCompra` en el esquema Prisma, la migración inicial o el SQL maestro revisados. Dos solicitudes simultáneas pueden superar la misma comprobación y persistir facturas repetidas; también pueden calcular el mismo número interno. En compras de inventario, cada alta crea además sus movimientos de stock.
- **Evidencia técnica:**
  - `backend/src/services/purchase.service.ts::validateNumeroFacturaDisponible` y `getNextNumeroCompra` (aprox. 95–116) son consultas separadas que ocurren antes de la transacción.
  - `backend/src/services/purchase.service.ts::createPurchase` (aprox. 383–400) invoca ambas y luego abre `$transaction` para crear la compra y sus detalles/efectos.
  - `backend/prisma/schema.prisma::Compra` (aprox. 134–153), `backend/prisma/migrations/20260928205241_init/migration.sql` y `Base de Datos - FlowManager.sql` declaran los campos `NumeroCompra` y `NumeroFactura`, sin índice único correspondiente en esos archivos.
  - `backend/src/tests/purchase.service.spec.ts` contiene una comprobación secuencial de rechazo de factura duplicada; no cubre solicitudes concurrentes.
- **Flujo actual comprobado:** una validación de duplicidad existe para llamadas secuenciales; no hay una reserva/idempotency key ni unicidad declarada que cierre la ventana entre la consulta y la escritura.
- **Flujo esperado y fundamento:** el servicio reporta expresamente error cuando ya existe una factura activa del mismo proveedor. La unicidad funcional en concurrencia y el alcance de reutilización de `NumeroCompra` deben corresponder a esa regla; no se consultó la base desplegada.
- **Consecuencia:** una factura puede registrarse más de una vez y causar entradas duplicadas de inventario; números internos repetidos dificultarían identificar compras en UI/operación.
- **Severidad:** **ALTO**, por la posibilidad de duplicar una operación de compra y sus efectos en stock.
- **Dependencias:** A04 consume proveedores en gastos de vehículos/mantenimiento; la corrección futura debe coordinar el modelo/esquema compartido, sin duplicar auditorías de proveedores o logística.
- **Propuesta (no implementada):** definir el alcance de unicidad del número interno y proteger en persistencia la unicidad de factura/proveedor, además de manejar explícitamente el conflicto de concurrencia.
- **Pruebas recomendadas:** en base aislada, enviar simultáneamente dos solicitudes idénticas por proveedor/factura y dos compras distintas que compitan por el siguiente `NumeroCompra`; comprobar que solo se persistan las identidades permitidas y que stock/kardex no se duplique.
- **Estado:** **parcialmente comprobado**. El chequeo previo y ausencia de unicidad en las definiciones versionadas están comprobados; no se validó SQL desplegado ni se reprodujo concurrencia.

## 6. Campos, opciones y configuraciones sin uso demostrado

| Campo/funcionalidad | Evidencia observada | Evaluación |
|---|---|---|
| Categorías de `InventarioItem` | `product.validators.ts`, formulario y consumidores validan/usan `ENVASE`, `INSUMO`, `PRODUCTO_TERMINADO` y `MATERIA_PRIMA`; reglas comerciales consumen productos y categorías. | Uso demostrado. La categoría no define unidad, trazabilidad por lote ni un flujo de fabricación. |
| `Existencia` / disponibilidad | Compras, ventas, ajustes y envases consultan o actualizan el mismo campo; no se encontró reserva ni otra cantidad “disponible”. | La disponibilidad observada equivale a existencia persistida; requisitos sobre stock reservado no están documentados. |
| `CostoPromedio` | Se crea/edita en producto y se recalcula en alta de compra; se incluye en DTO y en validaciones de precio de producto terminado. | Uso demostrado. La anulación/restauración de compra modifica stock pero no recalcula el promedio; determinar con negocio si se exige reversar el costo ponderado, especialmente si hubo consumos posteriores. No se clasifica como defecto sin esa regla. |
| Precisión de cantidades | `Existencia`, `Cantidad` y cantidades de detalle son `Float`. Algunas operaciones redondean a dos decimales y las de compras/ajustes no aplican el mismo redondeo en cada suma/resta. | Regla de precisión y unidades mínimas pendiente de definición. No se encontró unidad de medida ni conversión en modelos/validadores revisados. |
| Lotes/caducidad | No se encontró modelo de lote ni campos de lote/fecha de vencimiento vinculados a `InventarioItem` o `DetalleCompra`. | Trazabilidad por lote no demostrada en el esquema ni en los flujos examinados. Las opciones de ajuste “merma por vencimiento” y “daño” solo clasifican el motivo; no prueban lotes ni control de calidad. |
| `MovimientoEnvase.IdVenta` | Campo opcional; el servicio acepta y valida relación venta-cliente. La página actual no envía `idVenta`. | Uso parcial: API/modelo lo permiten, pero no se demostró asociación desde la UI. Confirmar si el préstamo/devolución debe asociarse a venta, pedido o sesión de ruta. |
| `MovimientoEnvase.RutaFirma` | Persistido y aceptado por el validador; no se observó control de firma/captura en la página de envases revisada. | Consumidor funcional de firma no demostrado; confirmar si representa una firma requerida o solo un recurso opcional histórico. |
| `EstructuraProducto` | API y UI de estructura leen/escriben componentes y cantidades requeridas; no se observó un proceso de producción que consuma la estructura y actualice stock. | BOM/estructura confirmada; orden de producción, consumo de materia prima, lote y alta de producto terminado pendientes para A06. |
| Datos de `Entidad` para proveedores | El backend valida, persiste y serializa nombre, contacto, NIT/DPI e imagen; la UI de proveedor presenta una selección de esos campos. | No se declara ningún campo huérfano. Uso en validación fiscal, cuentas por pagar o compras fuera del monorepo no comprobado. |

## 7. Consistencia entre existencias, movimientos y bitácora

- Las operaciones ordinarias revisadas escriben stock y `BitacoraInventario` con el mismo `tx` Prisma. Esto respalda atomicidad ante fallo dentro de cada transacción, pero no certifica consistencia ante concurrencia ni contra los datos de SQL Server.
- Compras de inventario producen `COM`; anulación y restauración registran `COMAN`/`COMRES`. Ajustes producen `AJ` y reversas `AJAN`/`AJRE`. Préstamos/devoluciones producen `ENVPR`/`ENVDEV`; sus reversas generan `ENVAN`/`ENVRE`. Los movimientos de venta se generan en `sale.service.ts` y se enlazan con la operación comercial revisada por A02.
- Los caminos de compra y ajuste representan reversas con nuevas entradas compensatorias. La fila original de bitácora permanece como movimiento histórico activo, por lo que la existencia de ambas filas no es por sí sola duplicación. El endpoint de bitácora muestra los movimientos no anulados, incluidas las filas compensatorias.
- Hay una discrepancia con la bitácora histórica `docs/auditoria/paso-11-pruebas-flujo-stock-bitacora.md`, que describe anular/restaurar una referencia `AJ` al revertir un ajuste. El código actual de `adjustment.service.ts` registra `AJAN`/`AJRE` y no llama a `anulateInventoryMovementByReference`/`restoreInventoryMovementByReference`; los helpers sí se usan en la anulación/restauración del marcador `PRD` de producto. La intención de usar un libro append-only o marcar el original como anulado no está definida en un requisito vigente, por lo que queda para aclaración y no se crea un hallazgo adicional.
- Las pruebas unitarias inspeccionadas verifican algunos cambios y movimientos simulados, pero no ejecutan/reconcilian una secuencia real de saldo contra kardex.

## 8. Compras, proveedores, lotes y envases

- **Compras:** hay alta, listado/detalle, gasto separado y anulación/restauración. No hay edición de líneas de compra de inventario observada. El total se calcula desde detalle; no se encontraron en este flujo impuestos, pagos a proveedor ni cuenta por pagar. El requisito contable correspondiente está pendiente.
- **Proveedor:** se valida que proveedor y entidad estén activos al crear compra o producto. Las compras conservan proveedor, factura y fecha; proveedor se enlaza además a gastos vehiculares/mantenimiento (dependencia A04). El uso posterior de datos tributarios no se confirmó.
- **Lotes:** no hay modelo ni relación que permita seguir un lote de compra a venta/consumo. No inferir el flujo a partir de estructuras de producto o del texto descriptivo de la página placeholder de producción.
- **Envases:** el saldo vigente se almacena en `EnvaseClienteSaldo`, con unicidad por cliente/item, y los movimientos conservan cantidades/saldos anterior/nuevo. Préstamo descuenta bodega y aumenta deuda de envase; devolución hace el inverso; las anulaciones/restauraciones aplican la inversa en ambos balances. No se encontraron operaciones diferenciadas de envase perdido/dañado ni una conciliación independiente que reconstruya el saldo desde todo el ledger.

## 9. Integración con ventas, devoluciones y anulaciones

- A02 confirma que `sale.service.ts` registra movimientos de salida al vender y que la anulación de venta repone cantidad. A03 verificó el uso del helper de movimiento como dependencia, pero no reaudita precio, total, pagos, crédito o factura.
- El modelo `MovimientoEnvase` declara que la venta/baja de un envase se resuelve por `InventarioItem` + `DetalleVenta` + `BitacoraInventario`; el módulo de envases maneja aparte préstamo/devolución al cliente. Esta separación está expresada en comentario de esquema y coincide con los endpoints observados.
- No se encontró flujo independiente de devolución parcial/completa de artículos vendidos dentro del alcance A03; A02 también deja ese flujo comercial como no encontrado. No se concluye que una devolución de venta sea requisito ni se duplica la auditoría comercial.
- `IdVenta` opcional del movimiento de envase no está conectado al formulario actual. Si el proceso requiere atribución por venta o ruta, su regla y coordinación con A02/A04 siguen pendientes.

## 10. Cruces con otras auditorías

| Grupo | Dependencia examinada | Tratamiento |
|---|---|---|
| **A02 — Ciclo comercial** | Ventas descuentan stock y su anulación lo repone; proformas, devoluciones y anulaciones son del flujo comercial. | Se consultó `A02_REVISION_CLIENTES_CICLO_COMERCIAL.md` y sus nueve hallazgos. Se referencia A02-003/004/005/008 cuando corresponde, sin duplicar hallazgos de pago, concurrencia de abonos, FEL o proforma. El hallazgo de consistencia/concurrencia de stock queda en A03. |
| **A04 — Logística** | `Proveedor` alimenta gasto vehicular y mantenimiento. El módulo de envases no tiene vínculo de ruta/sesión observado; tiene `IdVenta` opcional. | A04 debe verificar si entrega/ruta requiere registrar responsable, sesión o traslado de envases. La auditoría de rutas/vehículos no se realiza aquí. |
| **A05 — Planilla y comisiones** | `ReglaComision` referencia `InventarioItem`; los servicios de planilla consumen ventas/detalles. | Se registra el contrato de item como dependencia. No se revisaron fórmulas, elegibilidad ni cálculos de comisiones. |
| **A06 — Calidad y producción** | `ControlCalidadAgua` no tiene relación con `InventarioItem`; `EstructuraProducto` relaciona producto terminado con materia prima, sin movimientos de producción observados. | A06 debe confirmar requisito y estado real de fabricación/calidad por lote. Una categoría o BOM no demuestra producción operativa. |
| **A01 — Acceso y sesiones** | Endpoints de A03 usan `requireAuth` y guards `inventario`, `compras`, `proveedores` o `envases`. | Solo se registra como dependencia. No se auditan ni duplican hallazgos de autenticación/RBAC. |

## 11. Pruebas no ejecutadas y limitaciones

- No se consultó SQL Server ni se compararon esquema desplegado, índices, datos, aislamiento efectivo o configuración de transacciones.
- No se ejecutaron pruebas, builds, seeds, migraciones o SQL. Las pruebas inspeccionadas incluyen `backend/src/tests/purchase.service.spec.ts`, `adjustment.service.spec.ts` y `envase.service.spec.ts`; sus casos son evidencia estática, no resultados de esta sesión.
- No se reprodujeron carreras concurrentes, rollback SQL, recálculo de costo promedio, doble clic/reintento de API o reconciliación de saldos.
- No se hicieron compras, ajustes, entradas/salidas, préstamos/devoluciones, anulaciones ni restauraciones reales.
- No se inspeccionaron valores de entorno, certificados, credenciales, workflows externos ni bases desplegadas.
- Los documentos `docs/auditoria/paso-06`, `paso-07`, `paso-08`, `paso-10`, `paso-11`, `paso-13` y `paso-15` se trataron como historial técnico, no como requisitos vigentes. La matriz de continuidad advierte además que los nombres de migración referidos por pasos 13 y 15 tienen fechas futuras respecto a la comprobación anterior; no se ejecutaron ni se usaron como prueba de estado de base desplegada.
- Para validar los hallazgos se requiere una base SQL Server aislada/desechable, datos sintéticos, dos o más clientes concurrentes controlados y ausencia comprobada de integraciones externas activas.

## 12. Cobertura alcanzada y trabajo pendiente

| Área | Evidencia estática examinada | Pendiente |
|---|---|---|
| Productos/existencia | UI y servicio frontend, ruta/controlador/validador/servicio, categoría, costo y modelo Prisma | Unidad/precisión, costo promedio tras reversas y política de baja con stock |
| Compras/gastos | Formulario, API frontend, ruta/controlador/validador, servicio, compra/detalles/modelos y pruebas inspeccionadas | Concurrencia, unicidad en instancia desplegada y requisitos de contabilización |
| Ajustes/kardex | Formulario, servicios de ajuste y movimiento, listado de bitácora, modelo y pruebas inspeccionadas | Concurrencia, conciliación real y decisión sobre anulación histórica del movimiento original |
| Proveedores | Formulario, servicio frontend, ruta/controlador/validador, servicio y relación Entidad/Compra | Requisitos tributarios/financieros y usuarios fuera del monorepo |
| Envases | UI, servicio API, rutas/controlador/validador, servicio, ledger/saldo/modelos y pruebas inspeccionadas | Concurrencia, asociación requerida a venta/ruta, pérdidas/daños y conciliación independiente |
| Lotes/producción/calidad | Modelo/servicio de estructura, placeholder de producción, relaciones de inventario/calidad | Confirmación de proceso de lotes/fabricación y requisitos de calidad con A06 |

**Conclusión:** A03 está **parcialmente completa** como revisión estática. Se trazaron los flujos operativos principales y se registraron dos riesgos de concurrencia con causas diferenciadas. La validación del comportamiento concurrente, el estado real del esquema y las políticas sobre lotes, precisión, costo, envases y contabilidad requieren entorno aislado y confirmación técnica/empresarial.

**Integridad:** se preservaron los documentos previos no seguidos bajo `docs/auditoria-funcional/`. No se modificaron código, configuración, dependencias, esquema ni datos. Este informe es el único archivo creado para esta ejecución; no se ejecutaron pruebas ni se hizo commit.
