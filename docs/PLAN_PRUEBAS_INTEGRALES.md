# PLAN DE PRUEBAS INTEGRALES — INDUSTRIAS BASAN

**Referencia:** [PLAN_MAESTRO_IMPLEMENTACION.md](./PLAN_MAESTRO_IMPLEMENTACION.md), Fase 7. Ninguna prueba descrita aquí se ejecutó; este documento es exclusivamente de planificación.
**Regla obligatoria (actualizada por restricción de tiempo del negocio):** el negocio confirmó que no hay disponibilidad para preparar un entorno SQL Server aislado separado; las pruebas que requieran persistencia se ejecutarán **directamente sobre la base de datos existente**, bajo el protocolo descrito en la sección 0. Ninguna prueba debe crear, modificar, eliminar o reconstruir ventas, pagos, créditos o documentos FEL reales. Toda prueba que necesite tocar una tabla protegida debe, antes de ejecutarse, presentar el riesgo y una alternativa segura conforme a la regla de alto del protocolo transversal ([PLAN_MAESTRO_IMPLEMENTACION.md](./PLAN_MAESTRO_IMPLEMENTACION.md), sección 9).

---

## 0. Protocolo de datos de prueba y protección de tablas sensibles (nuevo, por restricción de tiempo)

Este protocolo sustituye, en todo este documento, cualquier mención anterior a "entorno SQL Server aislado" o "datos sintéticos en una base desechable".

1. **Preferencia por pruebas unitarias con mocks.** La mayoría de las 63 pruebas backend existentes ya usan mocks de Prisma/HTTP, no una base real. Toda prueba nueva que pueda validarse sin persistencia (reglas de negocio, cálculos, validadores) debe seguir ese patrón; es la opción de menor riesgo y no requiere ningún cambio de protocolo.
2. **Patrón real ya verificado en las dos pruebas de integración existentes (corrección de esta revisión).** Se leyó directamente el código de `route-flow.sqlserver.integration.spec.ts` y `sale-payment.rollback.integration.spec.ts`; **ninguna de las dos envuelve toda la prueba en una transacción que se revierte al finalizar** (corrige una afirmación incorrecta de una versión anterior de este documento). El patrón real, verificado línea por línea, es:
   - Ambas se ejecutan solo si `ROUTE_SQLSERVER_INTEGRATION=1` (opt-in explícito, no corren por defecto).
   - Ambas exigen que la base conectada se llame literalmente `FlowManager_Test`, o bien exigen una segunda variable de entorno explícita (`FLOWMANAGER_SQLSERVER_INTEGRATION=1`) para permitir ejecutarse contra una base llamada `FlowManager`. **Riesgo identificado en esta revisión:** esta segunda variable es una vía de escape que, si se activa por error sobre la conexión real de producción, permitiría que una prueba de integración escriba sobre la base existente. Se documenta como decisión pendiente (`D-BASE-06`).
   - Ambas mockean explícitamente los efectos externos antes de cualquier operación: `route-flow.sqlserver.integration.spec.ts` mockea `../services/notification.service` **y** `../services/fel.service`; `sale-payment.rollback.integration.spec.ts` mockea `../services/notification.service` (no invoca FEL porque crea la venta de prueba con `RequiereFactura: false`, evitando deliberadamente ese camino).
   - Ambas **crean registros reales persistentes** (commits reales, no una transacción abierta y revertida) y los eliminan explícitamente con `deleteMany` dentro de un `afterAll`, en orden inverso a sus dependencias de clave foránea.
   - **Riesgo real de este patrón (a mitigar, no a ignorar):** si el proceso de prueba falla o se interrumpe antes de que el `afterAll` se ejecute, los registros de prueba quedan huérfanos en la base real, incluidas tablas protegidas en el caso de `sale-payment.rollback.integration.spec.ts` (crea `Venta`, `DetalleVenta`, `CuentaPorCobrar`, `PagoVenta` reales, aunque nunca llega a emitir FEL). Esto es exactamente lo que el protocolo de esta sección busca prevenir.
   - **Regla para pruebas nuevas sobre tablas protegidas (más estricta que el patrón heredado):** siempre que el servicio bajo prueba acepte un cliente de transacción (`Prisma.TransactionClient`, patrón ya usado por `runSerializableTransaction` en `route-inventory.service.ts`/`production.service.ts`/`adjustment.service.ts`), la prueba debe invocar la función interna con una transacción propia de la prueba y revertirla explícitamente al finalizar (`ROLLBACK`, nunca `COMMIT`), en vez de depender de un `afterAll` con `deleteMany`. Si la función solo existe como servicio público que abre y cierra su propia transacción (como ocurre en el patrón heredado), debe mantenerse el enfoque de creación real + `afterAll` con limpieza explícita, pero debe añadirse una verificación adicional (consulta de "huérfanos conocidos" por el prefijo de nombre de prueba) que se ejecute de forma independiente del `afterAll`, para detectar y limpiar registros que hayan sobrevivido a un fallo de la prueba.
   - **Mocking de efectos externos obligatorio, sin excepción, independientemente de si la escritura en base de datos se revierte o no:** ninguna prueba debe emitir FEL real, enviar notificaciones reales ni disparar webhooks reales. `fel.service.ts` y `notification.service.ts` (que a su vez invoca `n8n-webhook.client.ts`) deben mockearse explícitamente en toda prueba nueva que ejercite un camino de código capaz de invocarlos, siguiendo el patrón ya usado en las dos pruebas existentes. Revertir una transacción de base de datos **no deshace** una llamada HTTP externa ya realizada; son dos protecciones independientes y ambas son obligatorias.
3. **Datos de prueba claramente marcados.** Cuando una prueba deba dejar algún registro persistente (por ejemplo, para verificar un flujo de varios pasos que no puede envolverse en una sola transacción), debe usar entidades identificables como de prueba (convención de nombre a definir en `D-BASE-02`, por ejemplo clientes/productos/vehículos con un prefijo reservado) y un script de limpieza explícito, revisado antes de ejecutarse, que las elimine al finalizar.
4. **Tablas protegidas: nunca se escriben con datos de prueba sin reversión garantizada.** `Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar`, `SolicitudPagoIdempotente`, `ReservaProforma`, `DevolucionComercial`, `Talonario` y los campos FEL de `Venta` (lista de `T-F1-BASE-07`) solo admiten escritura de prueba bajo el patrón reforzado del punto 2 (transacción revertida cuando sea posible, o creación real con limpieza por `afterAll` **y** verificación independiente de huérfanos cuando no lo sea); nunca con un commit real sin ambas protecciones.
5. **Respaldo verificado como precondición.** Ninguna prueba de integración contra la base existente se ejecuta sin que `T-F1-BASE-05` esté completa **en sus tres pasos** (generado, integridad verificada y restauración comprobada con éxito); un respaldo con solo la integridad verificada no es condición suficiente.
6. **Regla de alto.** Si, al diseñar una prueba concreta, se concluye que no es posible validarla sin escribir de forma persistente sobre una tabla protegida sin ambas protecciones del punto 2, la prueba se detiene y se presenta el riesgo y una alternativa segura (por ejemplo, validar solo con mocks, o restringir el alcance de la prueba) antes de continuar.

---

## 1. Inventario de pruebas backend ya existentes (63 archivos `*.spec.ts`, verificado directamente)

| Bloque funcional | Archivos representativos | Qué cubren (según lectura directa) |
|---|---|---|
| Auth/RBAC | `auth-a01-bootstrap.spec.ts`, `auth-a01.controller.spec.ts`, `auth-a01.middleware.spec.ts`, `auth-a01.refresh.spec.ts`, `auth-rbac.spec.ts`, `module-endpoints-rbac.spec.ts`, `role-permission-matrix.spec.ts` | Bootstrap del primer administrador (incluida concurrencia), middleware de autenticación, rotación de tokens (incluida concurrencia), matriz de permisos por módulo/acción |
| Inventario/ajustes | `adjustment.service.spec.ts`, `inventory-log.validators.spec.ts`, `inventory-reports.spec.ts` | Ajustes de inventario (incluidos envases vacíos/llenos), validadores de bitácora, reporte de movimientos |
| Compras | (archivos de compras no desglosados en el muestreo, existen pruebas de servicio) | Totales de compra, agrupación de gastos |
| Ventas/créditos/pagos | `client-a02.service.spec.ts`, `commercial-catalog-routes.spec.ts`, `commercial-return.service.spec.ts`, `credit.service.spec.ts`, `payment.validators.spec.ts`, `sale-payment.rollback.integration.spec.ts` | Clientes, catálogo comercial, devolución comercial, crédito, validadores de pago, **rollback transaccional de pago de venta (integración)** |
| Producción | `production.spec.ts`, `product-structure.service.spec.ts`, `product-structure.validators.spec.ts`, `product.service.spec.ts`, `product.validators.spec.ts` | Consumo de insumos, existencias, transacciones de producción, estructura/BOM |
| Logística/rutas/despacho/devolución | `logistics.service.spec.ts`, `logistics.validators.spec.ts`, `logistics-employee-options.spec.ts`, `logistics-session-concurrency.spec.ts`, `maintenance.service.spec.ts`, `route-flow.sqlserver.integration.spec.ts`, `route-inventory.controller.spec.ts`, `route-inventory.service.spec.ts`, `route-inventory.validators.spec.ts` | Sincronización de estado de vehículo, **concurrencia de reserva de vehículo/sesión**, **flujo completo de ruta contra SQL Server real** (creación, carga, despacho, operación, recepción), endpoints y validadores de inventario de ruta |
| Envases | `envase.service.spec.ts`, `product-returnable-balances.controller.spec.ts` | Préstamo, devolución, saldos y trazabilidad de envases retornables |
| Planilla/comisiones | `planilla-mensual.service.spec.ts`, `sale-transition-notifications.spec.ts` | Cálculo de planilla mensual, efectos de transición de venta en notificaciones/comisiones |
| Calidad | `quality.service.spec.ts`, `quality.validators.spec.ts` | Controles de pH/cloro |
| FEL | `company.validators.spec.ts`, `fel-service.spec.ts`, `fel-transport.spec.ts`, `image-signature.spec.ts`, `talonario.service.spec.ts` | Respuestas del proveedor FEL, transporte SOAP, firmas, talonarios |
| Reportes | `dashboard.service.spec.ts`, `dashboard.validators.spec.ts`, `inventory-reports.spec.ts`, `report-pdf-templates.spec.ts`, `reports-registry.spec.ts`, `n8n-webhook.client.spec.ts` | Métricas de dashboard, plantillas PDF, registro de reportes, envío a n8n |
| Transacciones/concurrencia | `serializable-transaction.spec.ts`, `auth-a01-bootstrap.spec.ts`, `auth-a01.refresh.spec.ts`, `logistics-session-concurrency.spec.ts`, `estados-catalogos.validators.spec.ts` | Comportamiento de transacciones serializables y conflictos |

**Clasificación de integración (verificada):** `route-flow.sqlserver.integration.spec.ts` y `sale-payment.rollback.integration.spec.ts` son las únicas identificadas con conexión real a SQL Server condicionada; el resto (60 archivos) son unitarias o con mocks de Prisma/HTTP. Ambas ya mockean `notification.service.ts` (y la primera también `fel.service.ts`) y usan creación real + limpieza explícita por `afterAll`, no una transacción revertida (ver sección 0, punto 2, para el detalle verificado y las protecciones adicionales exigidas a las pruebas nuevas).

**Confirmado negativo (no existen, porque las funcionalidades tampoco existen):**

- Ninguna prueba de caja/arqueo.
- Ninguna prueba de transferencia general vehículo-a-vehículo.
- Ninguna prueba de reabastecimiento múltiple en una misma sesión (`adjustment.service.spec.ts` prueba múltiples líneas de **ajuste** de inventario, no de despacho).
- Ninguna prueba de sustitución de vehículo/personal con operaciones activas (`logistics-session-concurrency.spec.ts` cubre reservas concurrentes de vehículo, no sustitución).

---

## 2. Pruebas requeridas por fase y tipo

### Fase 2 — Distribución

| Tipo | Prueba | Módulo backend objetivo |
|---|---|---|
| Unitaria | `createRouteDispatch` acepta un segundo despacho activo en la misma sesión cuando está `EN_CURSO`, y rechaza uno sobre una sesión `CERRADA` | `route-inventory.service.ts` (nuevo comportamiento) |
| Unitaria | `getRouteAvailableQuantities` suma correctamente dos despachos activos sin duplicar cantidades | `route-inventory.service.ts` |
| Unitaria | Mientras `TransferenciaVehiculo.EstadoConfirmacion = PENDIENTE`, la cantidad transferida no es disponible ni en el origen (ya descontada) ni en el destino (aún no incrementada); al confirmar, se incrementa en destino; al rechazar/anular, se reintegra al origen | Nuevo `route-transfer.service.ts`, extensión de `loadRouteInventory` (T-F2-DIST-05) |
| Integración | Flujo completo del Escenario A (carga inicial → ventas → devolución parcial → segundo despacho → ventas → cierre) contra la base de datos existente. **Toca `Venta` (tabla protegida) al simular las ventas del escenario:** debe envolverse en una transacción propia de la prueba que se revierte al finalizar siempre que las funciones de servicio invocadas acepten un cliente de transacción (patrón reforzado de la sección 0, punto 2); si no es posible, usar creación real con limpieza por `afterAll` más verificación independiente de huérfanos, igual que el patrón heredado de `route-flow.sqlserver.integration.spec.ts` (que ya mockea `fel.service.ts`/`notification.service.ts`, mocking que debe conservarse) | Extensión de `route-flow.sqlserver.integration.spec.ts` |
| Transaccional | Confirmar que el relevo de vehículo (`RelevoVehiculo`) y la transferencia asociada ocurren en una sola transacción serializable; una falla a mitad de camino no deja inventario "huérfano" | Nuevo `route-handoff.service.ts` |
| Concurrencia | **Criterio de aceptación obligatorio del MVP, no diferible (incorporado en esta revisión):** dos solicitudes simultáneas de transferencia desde el mismo vehículo origen por una cantidad que en conjunto excede el disponible: solo una debe prosperar, ninguna debe sobreasignar existencias ni dejar inventario negativo. No requiere reincorporar T-F2-DIST-06 (que cubre un problema distinto: reserva de vehículo por fecha) | Nuevo `route-transfer.service.ts` |
| Autorización | Verificar permisos `logistica`/`despacho` (o la clave que se decida) para transferencia y relevo, casos permitido y denegado | Nuevo, siguiendo patrón de `module-endpoints-rbac.spec.ts` |
| Regresión | Confirmar que el flujo de despacho único actual (sesión que solo despacha una vez) sigue funcionando sin cambios de comportamiento observable para el usuario | Extensión de `route-inventory.service.spec.ts` existente |
| Proceso completo | Escenario B (sustitución) y Escenario C (transferencia parcial) de la especificación (sección 20), de principio a fin | Nuevo, con datos de prueba controlados (vehículos/sesiones marcados) sobre la base existente, dentro de transacción revertida cuando el servicio lo permita (sección 0, punto 2) |

### Fase 3 — Caja

| Tipo | Prueba | Módulo backend objetivo |
|---|---|---|
| Unitaria | Cálculo de efectivo esperado con combinaciones de venta de contado, cobro de crédito, otro ingreso, gasto y otra salida, verificando que una venta a crédito sin pago no afecta el cálculo | Nuevo `caja.service.ts` |
| Unitaria | `updateGastoVehiculo` limpia `FechaPago` al revertir `PAGADO → PENDIENTE` (corrección de T-F3-CAJA-04) | `logistics.service.ts` |
| Transaccional | Apertura, registro de movimientos y cierre de caja en una misma sesión, verificando que el cierre calcula la diferencia correctamente y exige justificación si es distinta de cero | Nuevo `caja.service.ts` |
| Integración | Cierre de caja no afecta ni depende del estado del cierre de inventario de la misma sesión (y viceversa) | Nuevo, cruzando `caja.service.ts` y `route-inventory.service.ts` |
| Autorización | Permiso `caja:*` en todas las acciones (lectura, apertura, movimiento, cierre, autorización de diferencia), casos permitido y denegado | Nuevo, siguiendo patrón de `module-endpoints-rbac.spec.ts` |
| Proceso completo | Escenario de caja de la especificación (sección 20): abrir con fondo, ventas de contado, ventas a crédito, cobro de deuda anterior, gasto autorizado, cálculo de esperado, conteo, diferencia, cierre y entrega, consulta de resumen por vehículo | Nuevo. **Riesgo elevado:** este escenario requiere ventas/pagos/créditos de prueba, que son tablas protegidas; debe ejecutarse exclusivamente dentro de una transacción revertida al finalizar, o con mocks si la verificación no exige persistencia real, y presentar primero el riesgo/alternativa conforme a la regla de alto antes de implementarse |

### Fase 4 — Inventario y envases complementarios

| Tipo | Prueba | Módulo backend objetivo |
|---|---|---|
| Transaccional | Devolución comercial y su movimiento físico asociado (según la decisión de atomicidad de T-F4-INV-01) | `commercial-return.service.ts` |
| Concurrencia | Dos registros simultáneos de préstamo/devolución de envase sobre el mismo saldo de cliente, verificando que el resultado final es consistente con la suma secuencial esperada | `envase.service.ts` (extensión de `envase.service.spec.ts`) |
| Regresión | Ajustes de inventario y de ruta siguen funcionando igual tras los cambios de Fase 2 (unicidad de `AjusteRuta`) | Extensión de `adjustment.service.spec.ts` y `route-inventory.service.spec.ts` |

### Fase 5 — Producción

| Tipo | Prueba | Módulo backend objetivo |
|---|---|---|
| Unitaria | `confirmProductionOrder` acepta `CantidadProducidaReal` distinta de `CantidadProducir` y usa la real para la entrada a inventario | `production.service.ts` |
| Unitaria | Consumo real por componente se registra cuando se captura; si no se captura, usa el planificado (compatibilidad hacia atrás) | `production.service.ts` |
| Unitaria | Registro de merma genera su propio movimiento de inventario con `registerInventoryMovement`, sin afectar el movimiento de entrada del producto terminado | `production.service.ts` |
| Regresión | El comportamiento de rechazo ante cambio de receta activa (unidad distinta al snapshot) sigue funcionando igual tras agregar los nuevos campos | Extensión de `production.spec.ts` |
| Transaccional | Confirmación completa de una orden con lote, cantidad real, consumo real y merma en una sola transacción serializable, sin movimientos duplicados (`existingMovements` sigue bloqueando doble confirmación) | `production.service.ts` |
| Proceso completo | Escenario de producción de la especificación (sección 20): crear orden, conservar receta, producción real distinta de planificada, consumos reales, merma, confirmar, verificar movimientos, comprobar comportamiento ante cambio posterior de receta | Extensión de `production.spec.ts`, con datos de prueba controlados sobre la base existente (no toca tablas protegidas: `OrdenProduccion`/`DetalleOrdenProduccion` no son ventas, pagos, créditos ni FEL) |

### Fase 6 — Seguridad y experiencia de usuario

| Tipo | Prueba | Módulo objetivo |
|---|---|---|
| Autorización | Para cada página homologada en T-F6-SEG-01, verificar que el backend deniega (403) el endpoint correspondiente a un rol sin el permiso, y lo permite a un rol con el permiso | Extensión de `module-endpoints-rbac.spec.ts` |
| Regresión | Las 32 páginas que ya usan `moduleKey` correctamente no cambian de comportamiento | Verificación manual/E2E, sin automatización nueva obligatoria si no existe infraestructura E2E previa |
| Accesos directos | Intentar acceder directamente a una ruta protegida sin sesión y sin permiso, verificar redirección/, consistente con `RequireAuth`/`requireAuth` | Frontend: revisión de `require-auth.tsx`; backend: `auth-a01.middleware.spec.ts` |
| Auditoría | Verificar que las anulaciones de las nuevas operaciones (transferencia, relevo, movimiento de caja) registran `IdUsuarioAnulador`/`FechaAnulacion`/motivo igual que las operaciones existentes | Nuevo, por cada servicio nuevo |

---

## 3. Escenarios mínimos de prueba (copiados y operacionalizados de la especificación, sección 20)

La especificación ya define los escenarios mínimos obligatorios (distribución, caja, producción, envases, seguridad, experiencia de usuario). Este plan los **operacionaliza** asignándolos a los bloques de prueba de la sección 2 de este documento; no se duplica su redacción. Cada escenario debe ejecutarse:

1. Sobre la base de datos existente, conforme al protocolo de la sección 0 (respaldo verificado vigente, nunca contra ventas/pagos/créditos/FEL reales, y dentro de una transacción revertida cuando la prueba toque una tabla protegida).
2. Con datos de prueba claramente marcados y creados específicamente para la prueba (no reutilizar datos de otras pruebas para evitar contaminación de estado), limpiados explícitamente al finalizar si no pudieron envolverse en una transacción revertida.
3. Documentando el resultado (éxito/fallo) y, en caso de fallo, si es un defecto de la implementación nueva o una regla de negocio no resuelta.

---

## 4. Qué no se ejecuta en esta fase

Conforme a la autorización recibida para esta planificación:

- No se ejecutó `pnpm test`, `pnpm build`, ni ningún script de migración (`prisma:migrate:*`) durante la elaboración de este plan.
- No se modificó ningún archivo de prueba existente.
- No se creó ningún archivo de prueba nuevo; las pruebas descritas aquí son una especificación para la fase de implementación, no código entregado.

---

## 5. Criterio de salida de la Fase 7

La validación integral se considera completa cuando:

1. Todos los bloques de prueba de la sección 2 correspondientes a las fases ya implementadas pasan sobre la base de datos existente, conforme al protocolo de la sección 0, con el respaldo verificado (T-F1-BASE-05) vigente —en sus tres pasos: generado, integridad verificada y restauración comprobada— durante toda la ejecución.
2. **La prueba de concurrencia de transferencias entre vehículos (Fase 2) pasa explícitamente**, como criterio de aceptación obligatorio del MVP, confirmando que no se permite sobreasignar existencias entre dos transferencias simultáneas desde el mismo origen.
3. Los escenarios mínimos de la sección 3 se ejecutaron de principio a fin sin intervención manual para "saltar" un paso bloqueado, y sin dejar ningún registro de prueba persistente sin limpiar en una tabla protegida (verificado explícitamente, no solo asumido por la existencia de un `afterAll`).
4. Las 63 pruebas backend existentes siguen pasando (regresión), confirmando que ninguna funcionalidad previamente operativa se rompió.
5. Se documentó explícitamente cualquier escenario que no pudo probarse por falta de una decisión de negocio, remitiendo a [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md).
