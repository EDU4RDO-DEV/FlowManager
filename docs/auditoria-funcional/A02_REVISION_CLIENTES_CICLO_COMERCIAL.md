# A02 — Revisión de clientes y ciclo comercial hasta el cobro

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Modalidad:** revisión estática, solo lectura

## 1. Resumen ejecutivo

Se reconstruyeron estáticamente los flujos de clientes, catálogos comerciales, precios y bonificaciones, ventas de contado y crédito, pagos, cuentas por cobrar, talonarios y FEL desde los consumidores frontend encontrados hasta las rutas, validaciones, servicios y modelos Prisma. Se inspeccionaron también los efectos de anulación de ventas y pagos, y las dependencias con movimientos de inventario y sesiones de ruta.

La implementación contiene un flujo integrado de venta: valida cliente y condición de crédito cuando corresponde, calcula precios y bonificaciones, registra detalle y pago, actualiza existencias, crea cuentas por cobrar para ventas al crédito y puede invocar FEL. Los pagos posteriores recalculan el estado y saldo a partir de pagos no anulados. Sin embargo, la cobertura comercial no es uniforme: la asignación de tipo de cliente no está conectada al CRUD de clientes, varios campos de tipo de crédito no tienen efecto comercial demostrado, hay una transición de anulación de pagos de contado que deja saldo fuera de cartera, y las fronteras entre FEL y SQL no son atómicas.

Se documentan **9 hallazgos**:

- **2 confirmados estáticamente**, **4 parcialmente comprobados** y **3 con requisito de negocio pendiente**.
- **2 de severidad alta**, **4 media** y **3 pendientes de verificación**.
- No se identificó evidencia suficiente para clasificar un hallazgo como crítico.

La auditoría queda **parcialmente completa**: los recorridos estáticos principales se realizaron, pero no se verificaron datos de SQL Server, concurrencia real, integración fiscal, consumidores externos ni varias decisiones de negocio. No se ejecutaron pruebas ni operaciones comerciales.

## 2. Alcance y exclusiones

### Incluido

- Clientes, datos de `Entidad` relacionados con su uso comercial y operaciones de alta, consulta, actualización, anulación y restauración.
- Tipos de cliente, condiciones de crédito, tipos de crédito, reglas de precio y reglas de bonificación.
- Ventas, proformas expuestas por el contrato de API, talonarios, pagos y cuentas por cobrar.
- Estados de pago y deuda, abonos, cancelación/anulación de pagos y anulaciones de venta.
- Integración FEL desde el servicio comercial, examinada estáticamente y sin invocar al proveedor.
- Dependencias comerciales con inventario, sesiones de ruta, permisos y comisiones, hasta el límite necesario para identificar su consumidor y grupo responsable.

### Excluido

- Cálculo interno de existencias, bitácora/kardex y corrección de reversas de inventario: responsabilidad A03.
- Asignación logística, operación de rutas/sesiones, vehículos y seguimiento de entregas: responsabilidad A04.
- Cálculo de comisiones y planilla: responsabilidad A05.
- Configuración empresarial y credenciales FEL, workflows remotos n8n e integración externa más allá del punto de llamada comercial: responsabilidad A06.
- Autenticación, sesiones y reglas generales de autorización: responsabilidad A01.
- Reportes, dashboards, gráficas, KPI y analítica.

## 3. Arquitectura comercial encontrada

1. Las páginas Next.js en `frontend/app/clients/` y `frontend/app/sales/` invocan servicios por dominio en `frontend/services/`, que usan la instancia Axios compartida.
2. Express monta `/api/clients`, `/api/client-catalog`, `/api/commercial-rules`, `/api/ventas`, `/api/credits` y `/api/talonarios` detrás de `requireAuth`; las rutas de dominio aplican `requireModulePermission`.
3. Los controladores validan parámetros y payloads con esquemas Zod, llaman servicios de dominio y traducen errores a respuestas HTTP.
4. Los servicios persisten con Prisma en SQL Server. La creación de venta agrupa venta, líneas, pagos, salidas de inventario, cuenta por cobrar y, cuando se requiere factura, el resultado FEL dentro de una transacción `Serializable`. Los abonos y anulaciones de pago usan transacciones, pero no solicitan explícitamente ese nivel de aislamiento.
5. `credit.service.ts` no mantiene un libro de pagos independiente: deriva el abonado de `PagoVenta` y delega altas/anulaciones a `sale.service.ts`.
6. `sale.service.ts` también consulta `RutaSesion`, modifica stock y bitácora, y llama a FEL. Estos cruces no convierten a A02 en responsable de auditar los módulos completos de A03, A04 o A06.

## 4. Mapa de los flujos examinados

### Cliente y condiciones comerciales

`frontend/app/clients/{page,create/page,edit/[id]/page}.tsx` → `frontend/services/clients.service.ts` → `/api/clients` → `client.routes.ts` y `client.controller.ts` → `client.validators.ts` → `client.service.ts` → `Entidad` y `Cliente`.

El cliente comercial usa datos de `Entidad`; venta consulta nombre y NIT, y el endpoint de precios lee `Cliente.IdTipoCliente`. El CRUD encontrado no incluye ese campo en sus DTOs, validadores, alta o actualización. Las condiciones de crédito tienen endpoints propios en `/api/client-catalog`; los tipos de crédito, reglas de precio y bonificación se exponen en `/api/commercial-rules`.

### Venta de contado y al crédito

`frontend/app/sales/create/page.tsx` → `frontend/services/sales.service.ts::createSale` → `POST /api/ventas` → `sale.routes.ts` → `createSaleController` / `createSaleSchema` → `sale.service.ts::createSale` → Prisma.

El servicio obtiene cliente activo; para crédito exige una condición habilitada, no anulada y vigente. Resuelve precios por tipo de cliente, genera bonificaciones automáticas, valida cantidades y stock, calcula el total y exige que el pago inicial de contado sea exactamente igual al total. En crédito permite un abono inicial que no exceda el total y crea `CuentaPorCobrar`. En ambos casos registra las líneas y los movimientos de inventario relacionados.

### Pagos, abonos y cartera

El detalle de venta carga venta y pagos; `POST /api/ventas/:id/pagos` y los endpoints equivalentes de `/api/credits` terminan en `createSalePayment`. El servicio lee la venta, suma pagos válidos, rechaza un importe superior al saldo, crea `PagoVenta`, recalcula `EstadoPago` y sincroniza una cuenta por cobrar existente. Anular un pago lo marca anulado y vuelve a recalcular. La cartera calcula abonado desde pagos no anulados y limita saldos negativos a cero.

### Talonarios

El formulario de venta permite seleccionar un talonario opcional. Al crear la venta, el servicio reserva el correlativo con una actualización condicional dentro de la transacción. La administración permite editar rango y `UltimoUtilizado`; esa edición no consulta las ventas previas asociadas al talonario.

### Devoluciones, anulación y FEL

No se encontró un flujo comercial específico de devolución parcial/completa ni una conversión de proforma a venta. La anulación de venta revierte líneas de stock, anula pagos y cuenta por cobrar en SQL y, si la venta tenía datos FEL, primero solicita la anulación fiscal. La emisión fiscal se llama durante la transacción de creación; su respuesta se persiste en campos de la venta.

## 5. Hallazgos

### AUD-A02-001 — El tipo de cliente no puede asignarse por los flujos de administración encontrados

- **Estado:** parcialmente comprobado.
- **Severidad:** MEDIO.
- **Flujo afectado:** cliente → regla de precio → venta.
- **Evidencia:** el modelo `Cliente` tiene `IdTipoCliente` opcional (`backend/prisma/schema.prisma`, modelo `Cliente`). Sin embargo, `createClientSchema` / `updateClientSchema`, los tipos `CreateClientPayload` / `UpdateClientPayload`, `toClientDto`, `createClient` y `updateClient` no reciben, devuelven ni escriben ese campo (`backend/src/validators/client.validators.ts`, `backend/src/services/client.service.ts`, `frontend/types/clients.ts`, `frontend/services/clients.service.ts`). La página de venta lee el listado de clientes sin asignar una clase (`frontend/app/sales/create/page.tsx`). En cambio, `resolveApplicablePrice` usa `IdTipoCliente` para buscar `ReglaPrecioCliente` y cae a `InventarioItem.PrecioVenta` cuando el tipo es nulo (`backend/src/services/sale.service.ts::resolveApplicablePrice`, `resolveSalePrice` y `createSale`).
- **Causa:** el modelo de precios por tipo existe y es consumido por ventas, pero no se encontró una operación frontend/API de clientes que conecte el tipo con un cliente. La búsqueda de consumidores frontend encontró el tipo solo en el DTO de venta, no como asignación de cliente.
- **Impacto y consecuencias:** los clientes administrados por los formularios encontrados no pueden participar en precios diferenciados por tipo mediante ese flujo; las reglas solo son aplicables a clientes que ya tengan el vínculo por otra vía no comprobada.
- **Dependencias / responsable:** A02; no se asigna defecto a A01/A03/A04. Posibles cargas externas o datos preexistentes quedan fuera de la evidencia disponible.
- **Comprobación pendiente:** confirmar si existe un consumidor externo o procedimiento autorizado que asigne el tipo y si todo cliente debe clasificarse.

### AUD-A02-002 — Los parámetros de tipo de crédito no tienen efecto operativo demostrado

- **Estado:** requisito de negocio pendiente.
- **Severidad:** PENDIENTE DE VERIFICACIÓN.
- **Flujo afectado:** autorización de crédito, vencimiento, cálculo de importe y logística asociada.
- **Evidencia:** `TipoCredito` almacena `PlazoDias`, `IncrementoPorcentual`, `RequiereCamion` y `Condiciones` (`backend/prisma/schema.prisma`, modelo `TipoCredito`). `commercial-rule.service.ts` los crea, actualiza y mapea al DTO. `getClienteCondicionCreditoVigente` solo consulta el ID del tipo y la condición; al crear `CuentaPorCobrar`, `sale.service.ts::createSale` guarda los IDs aplicados, total, estado y liquidación, pero no asigna `FechaVencimiento`. En `credit.service.ts` se lee y devuelve `FechaVencimiento`, sin calcularla. El rastreo estático en servicios comerciales no encontró consumidores que apliquen porcentaje o requisito de camión. Tampoco se encontró una interfaz frontend para administrar estos catálogos.
- **Causa observada:** los campos de configuración se persisten y algunos se devuelven por API, pero no afectan una decisión/cálculo comercial en los consumidores examinados. La condición de crédito vigente tampoco filtra explícitamente el estado `Activo/Anulado` del `TipoCredito` relacionado.
- **Impacto y consecuencias:** no se demuestra vencimiento derivado del plazo, incremento aplicado a precio/deuda ni validación de camión para una venta; tampoco se ha confirmado la política esperada al desactivar un tipo ya asignado.
- **Dependencias / responsable:** A02 es responsable de la causa comercial; si `RequiereCamion` representa una restricción de asignación de vehículo o ruta, A04 debe validar la semántica logística sin duplicar este hallazgo.
- **Comprobación pendiente:** negocio debe especificar el significado, obligatoriedad y efecto de cada campo, incluidos límites de crédito (no se encontró un límite monetario de cliente en el modelo/flujo revisado), vigencia y tratamiento de tipos desactivados. No se afirma que exista un requisito incumplido sin esa definición.

### AUD-A02-003 — Anular un pago de contado puede dejar saldo fuera de cuentas por cobrar

- **Estado:** confirmado estáticamente.
- **Severidad:** ALTO.
- **Flujo afectado:** venta de contado → anulación de pago → saldo/cartera.
- **Evidencia:** `createSale` exige pago exacto en contado y crea `CuentaPorCobrar` solo cuando `CondicionPago === 'CREDITO'` (`backend/src/services/sale.service.ts::createSale`). `anulateSalePayment` permite anular un pago activo de cualquier venta, recalcula el estado y llama `syncCuentaPorCobrarFromSale`; esa función retorna sin acción si no encuentra una cuenta por cobrar (`sale.service.ts::anulateSalePayment`, `syncCuentaPorCobrarFromSale`). El contrato de administración de ventas histórico dice que contado no debe quedar con saldo salvo regla explícita (`docs/auditoria/paso-16-administracion-ventas.md`, regla de estados).
- **Causa:** el flujo de reversa de pago no distingue una venta de contado ni genera/abre una cuenta por cobrar cuando el saldo reaparece.
- **Impacto y consecuencias:** después de anular el pago de contado, la venta puede pasar a `PENDIENTE` y mostrar saldo; no hay `CuentaPorCobrar` asociada para incluirlo en cartera. La anulación contable del pago tampoco demuestra que se haya devuelto físicamente el dinero.
- **Dependencias / responsable:** A02 (pago y cartera). A03 solo debe revisar una eventual consecuencia de inventario si se decide revertir la venta completa; no es la causa de este hallazgo.
- **Comprobación pendiente:** añadir una comprobación aislada de pago de contado anulado y de conciliación entre venta, saldo y cartera; confirmar el tratamiento autorizado del dinero recibido/anulado.

### AUD-A02-004 — Abonos concurrentes pueden evaluar el mismo saldo pendiente

- **Estado:** parcialmente comprobado; no reproducido dinámicamente.
- **Severidad:** MEDIO.
- **Flujo afectado:** abonos concurrentes a una misma venta/cuenta por cobrar.
- **Evidencia:** `createSalePayment` abre una transacción sin nivel de aislamiento explícito, calcula el saldo, compara `input.monto` con ese saldo y después inserta `PagoVenta` (`backend/src/services/sale.service.ts::createSalePayment`). No hay actualización condicional sobre un saldo reservado ni clave de idempotencia. La creación de ventas sí fija explícitamente `Serializable`, a diferencia de este flujo. `backend/src/tests/sale-cxc.service.spec.ts` prueba el rechazo secuencial de un sobrepago y un pago completo, pero no una carrera concurrente.
- **Causa:** lectura del saldo y escritura del pago no están protegidas por un mecanismo de concurrencia declarado por la operación.
- **Impacto y consecuencias:** dos solicitudes que lean el mismo saldo antes de que la otra confirme podrían registrar en conjunto más que el saldo pendiente; los DTOs limitan el saldo mostrado a cero, mientras el total abonado podría superar el original.
- **Dependencias / responsable:** A02; SQL Server y la transacción de pago. No se atribuye una causa de inventario o autenticación.
- **Comprobación pendiente:** prueba con dos pagos sincronizados contra una base desechable para confirmar el aislamiento efectivo y comprobar saldo, estado y suma persistida. No se ejecutó.

### AUD-A02-005 — FEL y persistencia SQL no comparten una transacción compensable

- **Estado:** parcialmente comprobado; proveedor no contactado.
- **Severidad:** ALTO.
- **Flujo afectado:** emisión y anulación FEL vinculadas a una venta.
- **Evidencia:** `sale.service.ts::createSale` llama `emitFelInvoice` desde dentro de la transacción Prisma y luego guarda autorización, número, serie, QR, PDF y fecha (`backend/src/services/sale.service.ts`, `createSale`). `fel.service.ts::emitFelInvoice` puede llamar `postFelSoap` para enviar el documento. En anulación, `sale.service.ts::anulateSale` invoca `anulateFelInvoice` antes de iniciar la transacción SQL que anula venta, pagos, líneas y cuenta por cobrar. Si SQL falla después de una respuesta fiscal exitosa, el proveedor no participa en el rollback de SQL; en la emisión, un fallo SQL posterior tampoco deshace el documento ya emitido.
- **Causa:** operación externa irreversible y persistencia local están secuenciadas en lados distintos, sin estado intermedio/reconciliación compensatoria demostrado.
- **Impacto y consecuencias:** puede quedar un documento fiscal emitido sin venta confirmada en SQL o una venta local activa cuyo documento fiscal ya fue anulado. La respuesta HTTP por sí sola no representa una reconciliación persistida.
- **Dependencias / responsable:** A02 es responsable de la coordinación venta-FEL; A06 debe revisar configuración/protocolo externo, no duplicar la causa comercial. No se leyeron valores de entorno ni credenciales.
- **Comprobación pendiente:** prueba de fallos con proveedor simulado y SQL desechable, cubriendo respuesta FEL exitosa seguida de rollback SQL, timeout con resultado remoto incierto y fallo SQL después de anulación fiscal. No contactar al proveedor real.

### AUD-A02-006 — Cambiar `RequiereFactura` después de crear la venta no inicia emisión

- **Estado:** parcialmente comprobado.
- **Severidad:** MEDIO.
- **Flujo afectado:** actualización de venta y estado de facturación.
- **Evidencia:** la ruta `PATCH /api/ventas/:id` llega a `updateSale`; esta acepta y persiste `RequiereFactura` (`backend/src/validators/sale.validators.ts::updateSaleSchema`, `backend/src/services/sale.service.ts::updateSale`). En cambio, `emitFelInvoice` solo se invoca en `createSale` cuando el valor enviado al crear es verdadero. La actualización no emite documento, no cambia campos FEL ni registra estado/reintento.
- **Causa:** el campo configurable expresa una necesidad, pero la operación de actualización no está conectada con el flujo de emisión. No se encontró servicio frontend que invoque esta ruta; el hallazgo describe la superficie backend disponible, no un flujo UI probado.
- **Impacto y consecuencias:** un consumidor de la API puede marcar una venta como sujeta a factura sin generar ni persistir información FEL; el estado fiscal queda sin una transición posterior demostrada.
- **Dependencias / responsable:** A02, con A06 para contratos/configuración FEL. No se duplican hallazgos de A01.
- **Comprobación pendiente:** confirmar si la ruta tiene consumidores externos y si modificar la bandera debe emitir, programar un reintento o estar prohibido después de la creación.

### AUD-A02-007 — La edición del talonario permite retroceder el correlativo ya utilizado

- **Estado:** confirmado estáticamente.
- **Severidad:** MEDIO.
- **Flujo afectado:** reserva y unicidad de correlativos comerciales.
- **Evidencia:** `updateTalonario` acepta un `ultimoUtilizado` nuevo y `validateRange` solo comprueba que esté dentro del rango configurado; no exige que sea igual o mayor que el valor actual ni consulta ventas asociadas (`backend/src/services/talonario.service.ts::updateTalonario`, `validateRange`). La venta reserva el siguiente como `UltimoUtilizado + 1` (`backend/src/services/sale.service.ts::getAndReserveNextTalonarioCorrelativo`). `Venta.NumeroProForma` no tiene restricción única en el modelo Prisma (`backend/prisma/schema.prisma`, modelos `Talonario` y `Venta`). El antecedente comercial pide que el siguiente correlativo no duplique uno ya usado (`docs/auditoria/paso-16-administracion-ventas.md`).
- **Causa:** la administración permite reducir el cursor sin validar el historial del talonario ni imponer unicidad en el número guardado.
- **Impacto y consecuencias:** si el nuevo cursor queda antes de un número ya asignado a una venta del talonario, una venta posterior puede reservarlo de nuevo.
- **Dependencias / responsable:** A02; superficies compartidas `Talonario` y `Venta`. No se modifica el esquema ni se inspeccionaron datos desplegados.
- **Comprobación pendiente:** prueba unitaria/aislada que crea una venta con correlativo, retrocede el cursor y trata de reservar el número repetido; determinar además la política de corrección administrativa.

### AUD-A02-008 — La opción `PROFORMA` no tiene conversión demostrada y comparte los efectos de venta

- **Estado:** requisito de negocio pendiente.
- **Severidad:** PENDIENTE DE VERIFICACIÓN.
- **Flujo afectado:** proforma → venta, inventario, pagos, cartera y FEL.
- **Evidencia:** `createSaleSchema` acepta `tipoRegistro: 'VENTA' | 'PROFORMA'` y `numeroProForma`; sin embargo, `frontend/app/sales/create/page.tsx` envía siempre `tipoRegistro: "VENTA"`. No se encontró ruta de conversión de proforma. `sale.service.ts::createSale` no ramifica los efectos por `tipoRegistro`: registra líneas, movimientos de stock, pago inicial, CxC si es crédito y emite FEL si `requiereFactura`.
- **Causa:** la variante de registro se persiste, pero no se encontró un flujo diferenciado de proforma ni conversión explícita.
- **Impacto y consecuencias:** si `PROFORMA` representa una cotización sin compromiso, crearla por API puede producir efectos propios de una venta; si la semántica es distinta, no está demostrada por esta revisión.
- **Dependencias / responsable:** A02 para semántica comercial; A03 para cualquier efecto de stock si el negocio confirma que las proformas no deben modificar existencias.
- **Comprobación pendiente:** confirmar qué significa proforma, si debe reservar stock, aceptar pagos/factura y cuál es la transición autorizada a venta. No se ejecutó una proforma.

### AUD-A02-009 — El precio enviado por el cliente HTTP prevalece sobre el precio resuelto

- **Estado:** requisito de negocio pendiente.
- **Severidad:** PENDIENTE DE VERIFICACIÓN.
- **Flujo afectado:** regla de precio por tipo de cliente y total de venta.
- **Evidencia:** `sale.validators.ts` permite `precioUnitario` opcional y positivo; `createSale` prefiere `detail.precioUnitario` cuando está presente y solo resuelve `ReglaPrecioCliente` si falta (`backend/src/services/sale.service.ts::createSale`). El formulario hace editable el precio de cada línea y siempre lo envía. Al cambiar de cliente, el efecto frontend intenta recalcular, pero ante un error conserva el precio anterior; al agregar un producto, ante error de resolución usa el precio base y permite continuar (`frontend/app/sales/create/page.tsx`).
- **Causa:** la regla aplicada por el backend puede ser sustituida por el valor recibido del frontend, y el fallo de la consulta de precio no bloquea el registro.
- **Impacto y consecuencias:** un precio configurado puede no ser el usado en la venta; el cambio de cliente con error de recálculo puede conservar un precio asociado a la selección anterior.
- **Dependencias / responsable:** A02 para política de precio/descuento y autorización de overrides; no se clasifica como defecto hasta confirmar si el precio manual está permitido, para qué roles y con qué límites.
- **Comprobación pendiente:** requisito de negocio sobre precio manual, descuentos, autorización, redondeo y tratamiento de fallos de consulta; prueba aislada que contraste precio resuelto y precio enviado.

## 6. Campos, opciones y configuraciones sin uso comercial demostrado

| Campo/opción | Definición y lecturas/escrituras examinadas | Consumidor observado | Evaluación |
|---|---|---|---|
| `Cliente.IdTipoCliente` | Prisma; no está en validadores, DTO o escrituras del CRUD cliente. | `sale.service.ts` lo lee al resolver precio; las reglas de precio se filtran por clase. | Uso parcial: se consume si está asignado, pero no se encontró cómo asignarlo por los flujos frontend/API de clientes. Véase `AUD-A02-001`. |
| `TipoCliente.Descripcion` | CRUD de `client-catalog.service.ts`, mapeo/DTO y esquema. No se encontró servicio/página frontend para el catálogo. | No se observó una decisión de precio o venta basada en descripción. | Metadato descriptivo sin consumidor comercial demostrado; no se declara sobrante sin confirmar su finalidad. |
| `TipoCredito.PlazoDias` | Esquema y CRUD de `commercial-rule.service.ts`. | Ningún cálculo de vencimiento en venta/crédito; la creación de CxC no establece `FechaVencimiento`. Ese dato se expone por DTO y aparece en código de reportes, excluido de esta auditoría. | Regla almacenada sin aplicación demostrada en el ciclo comercial; requiere requisito. |
| `TipoCredito.IncrementoPorcentual` | Esquema, validadores, CRUD y DTO. | No se halló lectura en cálculo de precio, total, interés o saldo comercial. | Uso de administración/mapeo, no de cálculo; significado empresarial pendiente. |
| `TipoCredito.RequiereCamion` | Esquema, validadores, CRUD y DTO. | La venta permite ruta/sesión opcional y valida que no esté cerrada, pero no consulta este campo. | Sin consumidor logístico/comercial demostrado; validar con A04 si implica una regla sobre ruta/vehículo. |
| `TipoCredito.Condiciones` | CRUD y DTO. | No se aplica a autorización o cálculo; es texto libre. | Parece información descriptiva; el contenido y su presentación no se pudieron validar. |
| `CuentaPorCobrar.FechaVencimiento` | Esquema; el DTO de crédito la lee. No se asigna al crear CxC en `sale.service.ts`. | Se encontró su uso en definiciones de reportes, excluidas; no se encontró enforcement de vencimiento en los servicios comerciales revisados. | Campo disponible pero no poblado por el flujo de alta examinado; no se puede inferir si existe carga externa o si el vencimiento es requisito. |
| `ReglaBonificacion.Prioridad` | Esquema, validación y CRUD; `buildAutoBonusDetails` ordena por prioridad ascendente. | Itera y añade todas las reglas elegibles; no selecciona una única regla por prioridad. | La prioridad ordena la aplicación pero no decide exclusividad. Confirmar si las bonificaciones deben acumularse o si una prioridad mayor debe desplazar otra. |
| `Entidad.Sexo`, `FechaNacimiento` | Se incluyen en el modelo/DTO del cliente y el servicio acepta esos campos. El formulario de cliente no los ofrece; venta usa nombre y NIT. | No se observó consumidor comercial posterior. | Datos personales sin uso comercial demostrado en los flujos examinados; la auditoría no decide si deben conservarse, si tienen uso fuera de este monorepo o si son requisito. |
| `TipoRegistro=PROFORMA` | Validador, esquema, DTO y campo persistido. | La creación común ejecuta las operaciones de venta; el formulario envía `VENTA`; no se halló conversión. | Estado funcional y semántica pendientes; véase `AUD-A02-008`. |
| `PagoVenta.NumeroReferencia`, `Banco`, `RutaFirma` | Validadores, UI, servicio y modelo. | Requeridos por método de pago cuando aplica; la ruta de archivo se guarda en el pago. | Uso observado; no se clasifican como huérfanos. |

La búsqueda de consumidores no se tomó por sí sola como evidencia de ausencia: para los campos anteriores se cotejaron definición Prisma, validadores, mapeo DTO, escrituras/lecturas en servicios, relaciones, UI y procesos indirectos identificados. Los consumidores externos y datos preexistentes no pueden determinarse desde el repositorio.

## 7. Relaciones entre ventas, crédito, pagos, deuda, inventario y facturación

- **Cliente → precio:** `Venta` conserva el cliente; `sale.service.ts` usa `Cliente.IdTipoCliente` para resolver regla vigente de `ReglaPrecioCliente`, con fallback al precio base. El DTO de venta devuelve tipo/nombre del cliente si existe.
- **Cliente → crédito:** `ClienteCondicionCredito` controla habilitación y vigencia; la venta al crédito persiste los IDs de condición/tipo en `CuentaPorCobrar`. No se observó aplicación de plazo, incremento porcentual o requisito de camión.
- **Venta → pago/deuda:** pagos válidos alimentan `EstadoPago` y saldo. CxC solo se crea en la rama de crédito; los estados se actualizan a `ACTIVO/PAGADO` y anulación de venta la marca anulada.
- **Bonificación → inventario/importe:** las reglas aplicables agregan líneas de bonificación con precio cero; su cantidad participa en las salidas de inventario pero no aumenta el total facturado.
- **Venta → talonario:** la reserva avanza `UltimoUtilizado` y guarda el correlativo en `NumeroProForma`; el número interno `NumeroVenta` se genera por separado.
- **Venta → inventario:** el servicio de venta actualiza existencias y registra movimientos durante alta/anulación. La consistencia interna del movimiento y sus reversas corresponde a A03 y no se certifica aquí.
- **Venta → ruta/entrega:** `IdRutaSesion` es opcional; A02 comprueba la consulta/validación superficial de sesión activa/no cerrada, no su ciclo logístico (A04).
- **Venta → FEL:** se persisten campos de respuesta FEL en `Venta`, pero no se encontró estado/reintento fiscal independiente ni reconciliación SQL/proveedor.
- **Comisiones:** ventas con ruta/estado/detalle son datos que el servicio de planilla puede consumir según el mapa de dependencias. El cálculo de comisiones pertenece a A05.

## 8. Dependencias con A01, A03 y A04

- **A01:** rutas comerciales montadas tras `requireAuth` y permisos por módulo/acción. No se auditó nuevamente la lógica general de sesiones/RBAC ni se crea un hallazgo duplicado de `AUD-A01-001` a `AUD-A01-008`. Si un permiso impide acceder a una operación comercial, la causa raíz pertenece a A01.
- **A03:** la venta registra salidas de inventario y la anulación vuelve a sumar cantidades mediante el servicio de movimientos. Cualquier error en existencias, bitácora o reversas tiene responsable A03; A02 conserva solo la referencia de que el proceso comercial invoca esas operaciones.
- **A04:** las ventas pueden asociarse a `RutaSesion`; la creación rechaza una sesión inexistente o cerrada. La exigencia de vendedor/chofer, camión, ciclo de ruta, entrega y estados logísticos corresponde a A04.
- **Cruces adicionales:** FEL/configuración externa, A06; comisiones y consumidores de datos de venta, A05. Los hallazgos raíz de precio, crédito, pagos, cartera, secuencias y venta/FEL comercial se asignan únicamente a A02.

## 9. Requisitos de negocio pendientes

1. ¿Qué campos de `TipoCredito` son reglas obligatorias? ¿`PlazoDias` debe calcular `FechaVencimiento`, `IncrementoPorcentual` debe afectar precio/saldo y `RequiereCamion` debe condicionar una ruta o vehículo?
2. ¿Existe un límite monetario de crédito por cliente? No se encontró uno en los modelos/servicios comerciales revisados.
3. ¿Debe desactivar/anular un tipo de crédito impedir nuevas ventas para condiciones previamente asociadas?
4. ¿Cómo se crea, asigna y mantiene el tipo de cliente? ¿Se espera que toda regla de precio se aplique a través de dicho tipo?
5. ¿Se permite modificar manualmente el precio unitario? ¿Qué rol, topes, auditoría y comportamiento ante fallo del precio resolver se requieren?
6. ¿Las reglas de bonificación con misma vigencia/rango se acumulan o `Prioridad` debe elegir una sola?
7. ¿Qué representa `PROFORMA` y cuáles son sus efectos permitidos sobre stock, pagos, CxC, talonario y FEL? ¿Cuál es el proceso de conversión?
8. ¿Cómo debe tratarse la anulación de un pago de contado: impedirla, reabrir saldo, devolver efectivo o crear deuda/cartera?
9. ¿Se requiere idempotencia de pagos o rechazo por referencia duplicada? ¿Cómo debe resolverse una carrera entre abonos?
10. ¿Qué estados y proceso de reintento/reconciliación fiscal se esperan si FEL confirma y la persistencia local falla, o si el resultado remoto es incierto?
11. ¿Puede cambiarse `RequiereFactura` después de crear una venta y qué operación emite el documento?
12. ¿Se permite retroceder `UltimoUtilizado` tras asignar correlativos? ¿Qué procedimiento controlado debe aplicarse a una corrección?
13. ¿Una anulación de venta con pagos efectivamente recibidos requiere devolución monetaria u otro registro financiero verificable?
14. ¿Qué consumidores externos usan endpoints comerciales/catálogos para los que no se encontró UI en este repositorio?

## 10. Limitaciones de validación

- No se conectó a SQL Server ni se consultaron filas, configuraciones desplegadas, reglas activas, secuencias o datos de clientes.
- No se ejecutaron pruebas, builds, scripts, migraciones, seeds ni operaciones CRUD. Se inspeccionaron estáticamente `backend/src/tests/sale-cxc.service.spec.ts`, `backend/src/tests/talonario.service.spec.ts` y pruebas comerciales relacionadas; sus resultados no se consideran ejecutados en esta auditoría.
- No se probó concurrencia de pagos ni rollback con SQL Server.
- No se contactó al proveedor FEL, no se emitió/anuló documento, no se consultó un NIT y no se inspeccionaron valores de entorno, certificados o credenciales.
- No se verificaron consumidores fuera del monorepo, datos manuales o procesos operativos.
- Se identificaron lecturas de `FechaVencimiento` en módulos de reportes, pero esos módulos quedaron excluidos; no se auditó ni se usó esa evidencia para afirmar comportamiento analítico.
- La revisión de logística, inventario, permisos y comisiones se limitó a los puntos de integración de venta; sus procesos internos quedan pendientes para A04, A03, A01 y A05, respectivamente.
- Las pruebas pendientes que involucren escrituras requieren base SQL Server aislada/desechable, fixtures sintéticos, proveedor FEL simulado y verificación previa de que no hay servicios externos reales habilitados.

## 11. Cobertura alcanzada y trabajo pendiente

| Superficie | Evidencia estática revisada | Pendiente |
|---|---|---|
| Clientes | páginas/listados/alta/edición, servicio frontend, tipos, ruta, controlador, validador, servicio y modelo relacionado | asignación de tipo, datos desplegados y consumidores externos |
| Condiciones y reglas | rutas/controladores/validadores/servicios de catálogo y reglas; consultas de precio, crédito y bonificación | UI de mantenimiento, requisitos de vigencia/prioridad y efectividad de reglas con datos reales |
| Venta contado/crédito | formulario, servicio API, rutas, controlador, validación, creación, cálculo, pago inicial, cuenta por cobrar y modelo | pruebas aisladas de end-to-end y condiciones de negocio |
| Pagos/deuda | detalle de venta, pago parcial/completo, anulación, cálculo de estados, `credit.service.ts` y prueba inspeccionada | carreras concurrentes, anulación contado y saldo/cartera |
| Talonarios | pantalla/servicio frontend de venta, rutas, controlador, validador, servicio, persistencia y prueba inspeccionada | duplicación por retroceso de cursor y política de corrección |
| Anulaciones | secuencia de anulación de venta/pago y actualización de entidades relacionadas | devolución física/contable, rollback SQL y cruces A03/FEL |
| FEL | llamada comercial, persistencia de respuesta, anulación y transporte estáticos | proveedor simulado, reintentos, errores reales y reconciliación, sin llamar al proveedor real |
| Integraciones cruzadas | invocaciones de inventario y referencia/validación de sesión de ruta | auditoría raíz A03/A04, y comisión A05 |

**Conclusión:** A02 está **parcialmente completa** como auditoría estática. La cadena principal de venta y cobro está trazada y las limitaciones relevantes están documentadas, pero no se puede certificar consistencia operativa contra una instancia, concurrencia, ejecución de FEL, semántica de proformas, reglas de crédito ni política de ajustes de precio sin validación aislada y confirmación del negocio.

**Integridad:** no se modificaron código, configuración, dependencias, esquema, migraciones ni datos. No se realizaron operaciones comerciales o fiscales. El único archivo creado para esta ejecución es este informe; no se hizo commit ni se prepararon cambios.
