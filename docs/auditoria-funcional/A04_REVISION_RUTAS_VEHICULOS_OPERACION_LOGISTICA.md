# A04 — Auditoría funcional de rutas, vehículos y operación logística

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Modalidad:** revisión estática, solo lectura  
**Estado:** parcialmente completa como auditoría estática; sin validación de una instancia desplegada

## 1. Resumen ejecutivo

Se siguieron los flujos de administración de rutas y vehículos, sesiones de ruta, asignación de chofer/vendedor, kilometraje, gastos vehiculares, mantenimiento y los puntos de conexión con ventas, entregas, planilla y envases. La cadena observada comprende páginas Next.js y servicios frontend, routers Express, guards de permiso, validadores Zod, controladores, servicios Prisma y modelos del esquema.

La operación de flota y sesiones está implementada, con validaciones de referencias activas, conflicto de vehículo por fecha, kilometraje mínimo por estado y sincronización derivada del estado del vehículo. Sin embargo, se encontraron brechas entre capas y riesgos de coherencia:

- La pantalla de alta comercial siempre crea la venta con entrega `PENDIENTE`. Aunque la API backend admite cambiar el estado, el servicio frontend no ofrece la operación de actualización de venta y no se encontró una interfaz de confirmación/seguimiento de entrega. `PARCIAL` es solo un estado: no se encontró detalle de cantidades entregadas, incidencias ni fecha/responsable efectivo.
- La reserva de disponibilidad del vehículo es un chequeo previo a la escritura, no una operación atómica; una carrera concurrente puede asignar el mismo vehículo a más de una sesión activa en la misma fecha.
- La sesión cerrada sigue siendo editable. Sus referencias de vendedor, chofer y fecha son leídas dinámicamente por planilla/comisiones, por lo que una edición posterior cambia la atribución que ve ese consumidor. Si ello debe prohibirse o requerir una corrección auditada es una decisión pendiente de negocio.
- Al cambiar un gasto de `PAGADO` a `PENDIENTE`, el servicio no limpia `FechaPago`; el registro puede conservar una fecha de pago incompatible con su estado actual.
- El selector de empleados de la UI usa `idUsuario` (usuario que registró al empleado) como alternativa cuando falta `idUsuarioVinculado`; el backend solo acepta una cuenta enlazada laboralmente, por lo que algunas opciones visibles no se pueden asignar.

Se registran **5 hallazgos**: uno de severidad **ALTA**, tres **MEDIOS** y uno **PENDIENTE DE VERIFICACIÓN**. No hay evidencia suficiente para declarar un hallazgo crítico. La posibilidad de asignación simultánea es una inferencia estática de la secuencia de consultas/escrituras, no una carrera reproducida en SQL Server.

No se consultó SQL Server ni se ejecutaron pruebas, builds, operaciones CRUD, cierres, anulaciones, cargas, migraciones, seeds o llamadas externas. Los resultados describen el código del commit indicado, no datos desplegados ni el comportamiento de integraciones remotas.

## 2. Punto de partida, documentación y continuidad

Se comprobó la raíz Git `D:\Universidad Mariano Gálvez\FlowManager`, rama `developer`, HEAD `27f59fa024a804c468c434cfd504baa0b865a362` y estado inicial `## developer...origin/developer` más `?? docs/auditoria-funcional/`. La carpeta no seguida y sus documentos ya existían; se conservaron sin limpiar ni sobrescribir. La ruta de este informe y las rutas candidatas de resultados se comprobaron inexistentes antes de crearlo.

Se leyeron los documentos de coordinación `00`–`10`, incluidos el contrato, el plan maestro y `09_MATRIZ_CONTINUIDAD_AUDITORIAS.md`, además del informe A01 original, su revisión del 2026-10-12 y los informes A02 y A03. La matriz confirma que no existía informe A04 previo ni bitácora especializada de logística.

Cruces conservados:

- **A01:** los routers logísticos dependen del middleware general de autenticación y permisos; A01 conserva la responsabilidad por fallas raíz de sesión, identidad o política RBAC general. Esta revisión solo registra guards específicos del módulo `logistica`. No se duplica ningún ID `AUD-A01-*`.
- **A02:** `Venta` es el registro comercial que puede referenciar `RutaSesion`; A02 conserva ventas, pagos, facturación y sus efectos comerciales. A04 sigue únicamente el vínculo de entrega/ruta, sin reauditar precio, cobro ni FEL.
- **A03:** el informe A03 confirma que los movimientos de envases no tienen relación directa con `RutaSesion`; `MovimientoEnvase.IdVenta` es opcional y la UI de envases no lo envía. A04 no presume una integración operativa de envases con rutas o entregas.
- **A05:** `planilla-mensual.service.ts` consume asignaciones de `RutaSesion`; A04 documenta el efecto de cambios de sesión y deja la política de cálculo/atribución a A05.
- Las bitácoras técnicas históricas no se trataron como requisitos vigentes. Reportes, dashboards, gráficas, indicadores, KPI y analítica permanecieron excluidos.

## 3. Alcance examinado y arquitectura

### Incluido

- Creación, listado, actualización, anulación y restauración de rutas y sesiones.
- Relación entre `RutaSesion`, ruta, vehículo, usuario-chofer, usuario-vendedor, ventas y gastos.
- Disponibilidad de vehículos, estados operativos y sincronización de estados.
- Kilometraje inicial/final, gastos vehiculares y mantenimiento.
- Relación entre venta, estado de entrega y sesión logística, hasta el límite necesario para identificar la integración existente.
- Relación con empleados/usuarios, permisos, planilla y envases como dependencias.

### Excluido

- Cálculo comercial de venta, cobro, inventario, crédito y FEL (A02/A03).
- Cálculo de comisiones y planilla (A05), salvo confirmar el consumo de las asignaciones de ruta.
- Autenticación y política RBAC general (A01), salvo constatar la protección declarada por los routers.
- Consulta a base de datos, ejecución de operaciones, archivos subidos reales, workflows externos y consumidores fuera del repositorio.
- Reportes, dashboards, indicadores, analítica y visualizaciones.

### Flujo técnico observado

`frontend/app/logistics/*` → `frontend/services/logistics.service.ts` → Express monta ambos routers bajo `/api/logistics` → `requireAuth` → `requireModulePermission('logistica', acción)` → controlador → validador Zod → servicio → Prisma → SQL Server.

El router de ventas usa `/api/ventas` y permisos `ventas:*`; sus operaciones comerciales pertenecen a A02. El resultado de `PEDIDO_ENTREGADO` y el evento `VEHICULO_NO_DISPONIBLE` se envían mediante `notification.service.ts` al cliente n8n. El envío está demostrado en código; recepción, workflow y efecto remoto no se verificaron.

## 4. Flujos funcionales y evidencia

### 4.1 Pedidos, asignación a ruta y entrega

No se encontró un modelo `Pedido` separado: el flujo visible usa `Venta`, cuyo esquema contiene `IdRutaSesion`, `EstadoEntrega`, `LugarEntrega` y `FechaEntregaEsperada`.

1. `frontend/app/sales/create/page.tsx` ofrece seleccionar una sesión de ruta opcional y un lugar de entrega; al llamar `createSale` fija `estadoEntrega: "PENDIENTE"`. No ofrece selección de `fechaEntregaEsperada` en el formulario revisado.
2. `frontend/services/sales.service.ts::createSale` envía `POST /api/ventas`.
3. `sale.routes.ts` exige `ventas:create`; `createSaleSchema` admite `PENDIENTE`, `EN_RUTA`, `ENTREGADO` o `PARCIAL`.
4. `sale.service.ts::createSale` rechaza una sesión no existente/anulada y una sesión `CERRADA`; persiste `Venta.IdRutaSesion`, el estado, lugar y fecha esperada junto con la venta. Las demás reglas de venta e inventario quedan bajo A02/A03.
5. Después del commit, el servicio emite `PEDIDO_CREADO`. El evento remoto no constituye confirmación de despacho o entrega.
6. El backend ofrece `PATCH /api/ventas/:id` bajo `ventas:update`; `updateSale` acepta cualquier estado del enum mientras la venta todavía no esté `ENTREGADO`. Al cambiar a `ENTREGADO` persiste el estado y emite `PEDIDO_ENTREGADO`. La búsqueda de consumidores frontend encontró creación/lectura/filtros de venta, pero no un método que invoque este PATCH ni una pantalla logística de pedidos/confirmación.

El modelo no contiene una marca de tiempo de entrega efectiva, cantidades entregadas por línea, responsable de entrega ni entidad de incidencias. `PARCIAL` no tiene detalle cuantitativo; no se encontró estado de entrega fallida. La fecha expuesta es esperada, no efectiva. La ruta/sesión tampoco mantiene una lista propia de pedidos asignados: la relación es opcional desde cada `Venta`.

### 4.2 Rutas, sesiones y ciclo de vida

- La UI de `frontend/app/logistics/routes/page.tsx` administra rutas y sesiones mediante operaciones create/update/anular/restaurar. La sesión se crea/editable en un mismo formulario con estado seleccionable `PROGRAMADA`, `EN_CURSO` o `CERRADA`; no son comandos separados de inicio/cierre.
- `POST/PATCH/DELETE /api/logistics/rutas/.../sesiones...` usan guards de `logistica:create/update/delete`; los validadores restringen estados, IDs y fechas.
- `createRutaSesion` requiere ruta activa, usuarios activos con empleado vinculado, vehículo elegible y kilometraje compatible con el estado.
- `updateRutaSesion` puede cambiar ruta, vehículo, chofer, vendedor, fecha, kilómetros y estado sin una prohibición específica para sesiones `CERRADA` ni comprobación de ventas/gastos asociados.
- Para `CERRADA`, `ensureSessionKilometers` exige `KmInicial` y `KmFinal` y que el final no sea menor que el inicial. Para `EN_CURSO` exige inicial. La regla no compara lecturas entre sesiones del mismo vehículo ni contra un odómetro del vehículo.
- Anular una sesión marca `Anulado=true` y fuerza `Estado='CERRADA'`, sin exigir `KmFinal`; después recalcula la disponibilidad del vehículo. Restaurar determina estado por `KmFinal`: si existe, restaura como `CERRADA`; en caso contrario, `PROGRAMADA`. No preserva explícitamente el estado anterior.
- `deleteRuta` impide anular una ruta con sesiones activas `PROGRAMADA` o `EN_CURSO`. `deleteVehiculo` también impide anular una unidad con esas sesiones activas. No se encontró bloqueo equivalente para sesiones asociadas a ventas o gastos.

La implementación admite cambiar estados, pero no define una máquina de transiciones que limite la secuencia permitida. No se asume que una sesión cerrada deba reabrirse: la conveniencia de editar una sesión cerrada, reactivarla o restaurar una anulada requiere una regla de negocio.

### 4.3 Vehículos, empleados y asignaciones

- La UI de vehículos guarda placa/marca/modelo/color/estado. Backend normaliza placa y comprueba unicidad entre vehículos activos.
- Una sesión referencia un vehículo y dos usuarios. `validateEmpleadoVinculado` exige usuario activo y empleado activo con `Empleado.IdUsuarioVinculado` igual al usuario asignado.
- La verificación de disponibilidad busca sesiones no anuladas `PROGRAMADA`/`EN_CURSO` para el mismo vehículo y la misma fecha; el estado manual `MANTENIMIENTO` o `NO_DISPONIBLE` bloquea asignaciones. No se encontró comprobación equivalente para doble asignación del mismo chofer/vendedor.
- `syncVehicleStateBySessions` deriva `EN_RUTA` si hay sesión `EN_CURSO`, en otro caso `DISPONIBLE`, salvo estados manuales `MANTENIMIENTO`/`NO_DISPONIBLE`. La actualización del registro de sesión y esa sincronización son escrituras separadas, no una transacción conjunta.
- La UI obtiene `listEmployees()` y usa el mismo conjunto para chofer y vendedor. No filtra por `PuestoTrabajo`; ese campo es texto libre y la validación backend solo comprueba el vínculo activo, no un tipo laboral formal.

### 4.4 Gastos, kilometraje y mantenimiento

- `GastoVehiculo` se relaciona con `RutaSesion`, usuario y, opcionalmente, proveedor. La UI y API permiten registrar/editar monto, método, número de vale, referencia, estado de pago e imagen; el backend filtra por ruta/sesión y estado.
- Al crear, `PAGADO` recibe la fecha enviada o la fecha actual; `PENDIENTE` persiste fecha nula. El formulario de gastos no captura `FechaPago`.
- El endpoint de imagen es un `POST` protegido por `logistica:read`; `uploadVehicleExpenseImage` utiliza almacenamiento en disco (`uploads/vehicles`). No se consultó la política empresarial para saber si un permiso de solo lectura debe permitir esta escritura de archivo.
- No se encontró vínculo de `GastoVehiculo` con cuentas por pagar, pago contable o el módulo de compras. No se presume que su clasificación de gasto sea la misma que la de compras.
- `MantenimientoVehiculo` guarda vehículo, proveedor opcional, usuario, tipo preventivo/correctivo, descripción, fecha, costo, estado `PROGRAMADO/REALIZADO/CANCELADO`, próximo mantenimiento, observaciones e imagen. Un mantenimiento `REALIZADO` exige costo. Alta/edición/anulación/restauración no sincronizan el estado de `Vehiculo` ni las sesiones; `assertVehicleAvailableForSession` consulta el estado del vehículo, no el calendario de mantenimientos. No se halló recordatorio/consumidor operativo para `ProximoMantenimiento`.
- Kilometraje está almacenado en `RutaSesion` y validado únicamente dentro de la propia sesión. `Vehiculo` no guarda odómetro acumulado y no se encontró regla que ordene o compare kilometrajes de varias sesiones.

### 4.5 Envases retornables y consumidores posteriores

A03 documenta préstamo/devolución y saldos por cliente/item, con `MovimientoEnvase.IdVenta` opcional no enviado por su UI. El esquema no relaciona `MovimientoEnvase` con `RutaSesion`; en los flujos A04 examinados no se encontró traslado, entrega o devolución de envases atribuidos a sesión, vehículo o responsable logístico. La relación con una venta por consumo/salida es distinta de un vínculo operativo de retorno a ruta. La integración de envases con logística no se considera demostrada; su necesidad queda pendiente de negocio.

El consumidor posterior comprobado más relevante es `planilla-mensual.service.ts::calculateEmployeePayroll`: selecciona ventas pagadas y detalles no anulados cuyo `RutaSesion` activa cae dentro del período, y toma como asignado al empleado que coincide con `IdUsuarioChofer` o `IdUsuarioVendedor`. Por tanto, fecha y asignaciones de la sesión afectan qué ventas encuentra el cálculo de planilla. Este informe no evalúa si sus criterios comerciales son correctos.

## 5. Hallazgos

### AUD-A04-001 — La entrega no tiene un flujo de confirmación conectado a la UI logística

- **Módulo primario:** logística/entregas; dependencia comercial A02.
- **Funcionalidad:** seguimiento de pedido y transición a entregado.
- **Descripción:** la UI de creación siempre registra la venta con `PENDIENTE`. La API backend ofrece actualización de `EstadoEntrega`, pero no se encontró un servicio frontend que invoque el `PATCH /api/ventas/:id`, ni una página logística para operar esa transición. El enum permite `EN_RUTA`, `ENTREGADO` y `PARCIAL`, pero no se encontró persistencia por línea de cantidades entregadas, fecha/responsable efectivos o incidencia asociada.
- **Evidencia técnica:**
  - **UI/código:** `frontend/app/sales/create/page.tsx` envía `estadoEntrega: "PENDIENTE"` y permite asociar una sesión (`idRutaSesion`); no captura fecha real ni resultado de entrega.
  - **API:** `backend/src/routes/sale.routes.ts` define `PATCH /:id` con `ventas:update`; `backend/src/validators/sale.validators.ts::updateSaleSchema` acepta los cuatro estados.
  - **Servicio:** `backend/src/services/sale.service.ts::updateSale` persiste el estado y llama `notifyPedidoEntregado` cuando se envía `ENTREGADO`, pero no existe operación de entrega por producto, cantidades parciales o incidencia.
  - **Cliente:** `frontend/services/sales.service.ts` expone creación, consulta, pagos y anulación; no expone `updateSale`. La búsqueda en páginas/servicios frontend encontró el campo de estado en el formulario de creación y filtros, no una llamada de transición.
  - **Esquema:** `backend/prisma/schema.prisma::Venta` contiene estado, lugar y fecha esperada, pero no los datos operativos de entrega efectiva descritos arriba.
- **Flujo actual comprobado:** la venta puede asociarse opcionalmente a una sesión y se crea como pendiente; un cliente backend con permiso de actualización puede cambiar el estado y generar el evento `PEDIDO_ENTREGADO`. La interfaz local no completa ese recorrido.
- **Flujo esperado y fundamento:** no se encontró un requisito aprobado para secuencia de estados, confirmación, entrega parcial, incidencias ni evidencia de recepción. Se confirma la desconexión UI/API, no se inventan reglas sobre cuándo debe considerarse entregado.
- **Consecuencia:** el operador de la UI disponible no tiene un recorrido local demostrado para registrar despacho/entrega posterior; `PARCIAL` no representa cantidades y el evento remoto solo contiene número de venta y cliente.
- **Severidad:** **ALTA** por la falta de una interfaz operativa para cerrar el flujo logístico; limitada a los consumidores del monorepo.
- **Dependencias:** A02 (ciclo de venta); A01 (guards generales); n8n externo no verificado. A02 conserva las reglas de venta, pagos y factura.
- **Propuesta no implementada:** acordar el ciclo de entrega y los datos mínimos de confirmación con negocio; después conectar UI/API y definir validación idempotente y manejo de entrega parcial/incidencias según ese contrato.
- **Pruebas recomendadas:** prueba frontend/API aislada de pendiente → en ruta → entregado, prueba de parcial con detalle si se define, autorización, transición duplicada y error/fallo del evento remoto.
- **Estado:** **parcialmente comprobado**, confianza **9/10**. El contrato UI/API del repositorio está comprobado; consumidores externos no se verificaron.

### AUD-A04-002 — La comprobación de vehículo disponible no reserva la asignación atómicamente

- **Módulo primario:** sesiones y flota.
- **Funcionalidad:** prevenir asignaciones simultáneas del mismo vehículo.
- **Descripción:** `assertVehicleAvailableForSession` consulta conflictos activos para vehículo/fecha y después `createRutaSesion` crea la sesión en una llamada Prisma separada. En actualización también se hace la lectura/validación antes de la escritura. No se declara una unicidad o reserva persistida equivalente. Dos solicitudes concurrentes podrían pasar el mismo chequeo y asignar el vehículo a sesiones activas distintas en la misma fecha.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/logistics.service.ts::assertVehicleAvailableForSession` consulta sesiones existentes en estado `PROGRAMADA`/`EN_CURSO`.
  - **Código:** `createRutaSesion` llama al chequeo y luego a `prisma.rutaSesion.create`; `updateRutaSesion` llama al chequeo y luego `prisma.rutaSesion.update`, sin transacción de reserva/serialización.
  - **Esquema:** `RutaSesion` no declara una restricción compuesta de disponibilidad por vehículo/fecha.
  - **Pruebas:** `backend/src/tests/logistics.service.spec.ts` revisa sincronización de estado/notificaciones, no la carrera de asignación.
- **Flujo actual comprobado:** solicitudes secuenciales se validan contra sesiones activas existentes; no se comprobó la intercalación simultánea ni el nivel de aislamiento SQL efectivo.
- **Flujo esperado y fundamento:** el propio código intenta impedir que un vehículo tenga más de una sesión activa en una fecha; el riesgo se limita a concurrencia. No se afirma que la regla incluya chofer/vendedor, cuyas asignaciones simultáneas requieren especificación.
- **Consecuencia:** potencial vehículo asignado a dos recorridos para la misma fecha, con `Vehiculo.Estado` derivado de si existe alguna sesión en curso, no de exclusividad garantizada.
- **Severidad:** **MEDIO**.
- **Dependencias:** SQL Server/Prisma y estado sincronizado de `Vehiculo`. Causa A04, no duplicar los hallazgos A03 sobre inventario ni A01 sobre sesiones de usuario.
- **Propuesta no implementada:** elegir una estrategia transaccional/atómica compatible con la regla real de concurrencia y traducir conflictos al error de dominio existente.
- **Pruebas recomendadas:** en SQL Server desechable, sincronizar dos altas/ediciones para el mismo vehículo y fecha y comprobar que solo una asignación activa persista.
- **Estado:** **parcialmente comprobado**, confianza **8/10**. La ventana de lectura-escritura se confirma por código; la carrera no se reprodujo.

### AUD-A04-003 — La edición de una sesión cerrada puede cambiar la atribución de ventas a planilla

- **Módulo primario:** sesiones de ruta; consumidor A05.
- **Funcionalidad:** conservación de asignaciones/fecha usadas por ventas ya registradas.
- **Descripción:** el servicio no bloquea actualizaciones de sesiones `CERRADA` ni exige que estén libres de ventas. La edición puede sustituir chofer, vendedor, fecha, ruta o vehículo. El cálculo de planilla consulta la sesión relacionada en vivo y usa `IdUsuarioChofer`, `IdUsuarioVendedor` y `FechaSesion`; no se observó una instantánea de esos datos en la venta.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/logistics.service.ts::updateRutaSesion` lee el estado actual, pero admite guardar estado y asignaciones nuevas sin un guard de sesión cerrada ni consulta de ventas asociadas.
  - **Código:** `backend/src/services/planilla-mensual.service.ts::calculateEmployeePayroll` filtra ventas por `Venta.RutaSesion.FechaSesion` y compara el empleado con los usuarios de chofer/vendedor de la sesión.
  - **Esquema:** `Venta.IdRutaSesion` relaciona la venta con la sesión; no hay copia de la asignación en `Venta`.
- **Flujo actual comprobado:** una venta vinculada mantiene la misma FK a la sesión; si la fila de sesión cambia, una consulta posterior de planilla usa los valores actualizados. No se recalculó una planilla ni se verificó un período desplegado.
- **Flujo esperado y fundamento:** no se encontró requisito que defina si una sesión cerrada debe ser inmutable, corregible, reabrible o corregible con historial. No se declara defecto que una sesión cerrada no pueda reabrirse; la política de edición y el efecto retroactivo requieren decisión.
- **Consecuencia:** si se permite editar sin control, el empleado/período al que se atribuyen ventas puede cambiar para cálculos posteriores; no hay historial de versiones de asignación demostrado en el modelo revisado.
- **Severidad:** **PENDIENTE DE VERIFICACIÓN** hasta acordar la política de cierre/corrección con A05 y negocio.
- **Dependencias:** A05 (cálculo/criterio de comisión), A02 (venta, sin duplicar su lógica).
- **Propuesta no implementada:** definir inmutabilidad o un flujo de corrección versionado/auditable para sesiones consumidas por ventas y planilla.
- **Pruebas recomendadas:** con datos sintéticos y planilla aislada, vincular una venta, cerrar sesión, cambiar asignación/fecha y verificar el efecto; probar también la política de restauración tras anulación.
- **Estado:** mecánica de lectura/escritura **confirmada estáticamente**; si constituye defecto funcional queda pendiente, confianza **8/10**.

### AUD-A04-004 — Volver un gasto a pendiente conserva su fecha de pago anterior

- **Módulo primario:** gastos vehiculares.
- **Funcionalidad:** transición `PAGADO` ↔ `PENDIENTE`.
- **Descripción:** `updateGastoVehiculo` actualiza `EstadoPago`, pero solo cambia `FechaPago` si se envía explícitamente o si el estado entrante es `PAGADO` sin fecha (cuando asigna la fecha actual). Al cambiar a `PENDIENTE` no limpia la fecha previamente guardada. La UI sí permite editar el estado y no envía `fechaPago`.
- **Evidencia técnica:**
  - **Validador:** `backend/src/validators/logistics.validators.ts::updateGastoVehiculoSchema` permite cambiar estado y fecha independientemente; no valida la coherencia entre ellos.
  - **Servicio:** `backend/src/services/logistics.service.ts::updateGastoVehiculo` persiste `EstadoPago` por separado y solo asigna automáticamente `FechaPago` al pasar a `PAGADO`; no hay rama equivalente que la limpie para `PENDIENTE`.
  - **UI:** `frontend/app/logistics/expenses/page.tsx::save` envía `estadoPago`, pero el formulario no contiene fecha de pago.
  - **Esquema:** `GastoVehiculo` almacena `EstadoPago` y `FechaPago` como campos independientes.
- **Flujo actual comprobado:** después de un gasto pagado, una actualización a pendiente sin `fechaPago` puede dejar `EstadoPago='PENDIENTE'` con una fecha anterior no nula. No se realizaron escrituras reales.
- **Flujo esperado y fundamento:** la semántica de una fecha de pago al revertir el estado no está documentada; el dato contradictorio es observable y debe aclararse. La auditoría no determina si debe limpiarse o conservarse como historial.
- **Consecuencia:** filtros/consumidores que lean el estado y la fecha pueden interpretar de forma distinta si el gasto está saldado o pendiente.
- **Severidad:** **MEDIO**.
- **Dependencias:** solo modelo/API/UI de gastos logísticos; no se encontró un libro de pagos contables consumidor. A03 conserva la auditoría de gastos de compras.
- **Propuesta no implementada:** establecer invariantes entre estado, fecha y referencia de pago; si se requiere historial de pagos, conservarlo como evento separado y no inferirlo del estado actual.
- **Pruebas recomendadas:** pruebas de transición PAGADO→PENDIENTE y PENDIENTE→PAGADO, con y sin fecha, verificando estado y campos persistidos.
- **Estado:** inconsistencia de actualización **confirmada por código**, confianza **9/10**; política de historial pendiente.

### AUD-A04-005 — El selector de empleados usa la cuenta registradora cuando falta el vínculo del empleado

- **Módulo primario:** formulario de sesiones logísticas; dependencia A05/A01 para el contrato de empleado/usuario.
- **Funcionalidad:** asignación de chofer y vendedor.
- **Descripción:** la UI forma las opciones con `item.idUsuarioVinculado ?? item.idUsuario`. En el DTO, `idUsuario` representa `Empleado.IdUsuario` (cuenta que registró al empleado); `idUsuarioVinculado` representa la cuenta asociada al trabajador. Si el vínculo es nulo, la pantalla ofrece la cuenta registradora y el nombre de la persona como si esa cuenta fuera el usuario asignable. El backend valida exclusivamente `IdUsuarioVinculado`, por lo que esa opción puede ser rechazada.
- **Evidencia técnica:**
  - **UI:** `frontend/app/logistics/routes/page.tsx::loadData` usa `idUsuarioVinculado ?? idUsuario` y ofrece la lista resultante tanto en el selector Chofer como Vendedor.
  - **DTO/esquema:** `backend/src/services/employee.service.ts::toEmployeeDto` devuelve ambos IDs con nombres distintos; `Empleado` declara `IdUsuario` y `IdUsuarioVinculado` como campos separados.
  - **Validación:** `backend/src/services/logistics.service.ts::validateEmpleadoVinculado` exige un `Empleado` activo cuyo `IdUsuarioVinculado` coincida con el ID recibido.
- **Flujo actual comprobado:** empleado sin cuenta vinculada → UI ofrece el usuario registrador → API busca un vínculo activo por `IdUsuarioVinculado` → puede rechazar con `Chofer/Vendedor no tiene empleado activo vinculado`. Si ese usuario registrador también está vinculado a otro empleado, la opción podría resolver a una identidad distinta del nombre presentado.
- **Flujo esperado y fundamento:** el contrato backend define el usuario vinculado como la identidad laboral; no se encontró fundamento para sustituirlo por el usuario que creó el registro.
- **Consecuencia:** opción visual engañosa y asignación fallida o, en caso de otra relación coincidente, atribución ambigua.
- **Severidad:** **MEDIO**.
- **Dependencias:** A05 para administración de empleados y A01 para identidad general; la causa concreta es el mapeo del selector logístico.
- **Propuesta no implementada:** ofrecer únicamente empleados con `idUsuarioVinculado` válido, o un flujo explícito de vinculación previo a asignar.
- **Pruebas recomendadas:** caso de lista con empleado vinculado y no vinculado; comprobar que las opciones y payloads solo contienen la identidad aceptada por el servicio.
- **Estado:** discrepancia de DTO/UI/backend **confirmada estáticamente**, confianza **9/10**.

## 6. Estados, datos y uso no demostrado

| Dato/estado | Uso observado | Evaluación |
|---|---|---|
| `RutaSesion.Estado` | Alta, edición, filtros, guard para venta nueva, derivación del estado del vehículo y selección al restaurar una sesión anulada. | Uso demostrado. No hay máquina de transición declarada; secuencia y política de edición de cerradas pendientes. |
| `RutaSesion.KmInicial/KmFinal` | El formulario permite capturarlos; el backend requiere valores según estado y compara ambos dentro de una sesión. | Uso demostrado localmente; odómetro acumulado/regla entre sesiones no demostrados. |
| Asignaciones chofer/vendedor | Persisten en `RutaSesion`; venta se asocia a sesión y planilla consulta esas asignaciones. | Uso demostrado. `PuestoTrabajo` no clasifica/valida roles de chofer/vendedor. |
| `Vehiculo.Estado` | Editado en pantalla; limita asignación si mantenimiento/no disponible; derivado de sesiones en curso excepto estados manuales. | Uso demostrado con fuentes manual y derivada coexistentes; cambios manuales no verifican sesiones activas y el mantenimiento no sincroniza ese estado. Política de precedencia pendiente. |
| `Ruta.IdUsuario` | Existe como campo opcional en Prisma, pero el alta/DTO de ruta observados no lo aceptan ni lo devuelven. | Uso no demostrado en A04; no declarar campo huérfano sin revisar SQL desplegado/consumidores externos. |
| `GastoVehiculo.FechaPago` | API acepta fecha; alta PAGADO usa fecha suministrada o actual; formulario no captura ni expone captura de fecha. | Uso parcial; necesidad de fechas históricas y significado tras reversión pendientes. |
| `GastoVehiculo.EstadoPago`/`MetodoPago`/`Monto` | Se persisten, se editan y se filtran/listan en la UI; no se encontró libro financiero posterior. | Uso local demostrado; conciliación contable/pago a proveedor fuera de evidencia. |
| `MantenimientoVehiculo.ProximoMantenimiento` | Formulario y API permiten persistirlo/editarlo. | Registro demostrado; recordatorio, bloqueo por calendario o consumidor posterior no demostrado. |
| `MantenimientoVehiculo.RutaImagen` | Esquema, validador y DTO lo contemplan. | No se encontró campo de carga/edición de imagen en la UI de mantenimiento revisada. Su uso por API externa no verificado. |
| `MovimientoEnvase` | A03 demuestra movimiento/saldo por cliente/item; `IdVenta` es opcional y su UI no lo envía. | No hay vínculo directo observado con sesión, ruta, vehículo o responsable de entrega. No se afirma que negocio requiera ese vínculo. |

## 7. Preguntas de negocio y verificaciones pendientes

1. ¿Qué secuencia de entrega se autoriza (`PENDIENTE`, `EN_RUTA`, `PARCIAL`, `ENTREGADO`)? ¿Se requieren cantidades por producto, fecha efectiva, responsable, evidencia o motivo de no entrega?
2. ¿Una sesión puede cerrarse si mantiene ventas pendientes/parciales? ¿Qué significa operativamente `CERRADA` frente a sesión anulada/abandonada?
3. ¿Se permite editar asignaciones/fecha de una sesión cerrada? ¿Debe existir un historial o una operación de corrección? No se asume que una sesión cerrada deba reabrirse.
4. ¿La exclusividad por fecha aplica también a choferes y vendedores? ¿Una sesión es válida para todo el día o hay turnos/horas no modelados?
5. ¿Qué requisito define si `PuestoTrabajo` debe restringir asignaciones a chofer/vendedor? ¿Es obligatorio vincular un usuario antes de asignar al empleado?
6. ¿Un mantenimiento `PROGRAMADO` debe bloquear sesiones durante un período o cambiar el estado del vehículo? ¿Cómo prevalece frente a un recorrido `EN_CURSO`?
7. ¿El kilometraje debe ser monótono entre sesiones y cuál es su fuente inicial confiable? ¿Se permite corrección retroactiva?
8. ¿Qué significa revertir un gasto pagado a pendiente y debe conservarse fecha/referencia como historial? ¿Hay un consumidor financiero fuera del monorepo?
9. ¿Los envases retornables deben quedar asignados a pedido, cliente, ruta, vehículo o responsable? El código revisado no demuestra esa integración.
10. ¿La carga de comprobantes debe permitirse con `logistica:read`? El endpoint escribe un archivo en disco, aunque no modifica el registro del gasto.

## 8. Pruebas, limitaciones y cobertura

### Pruebas revisadas, no ejecutadas

- `backend/src/tests/logistics.service.spec.ts`: mocks de Prisma/notificaciones; cubre sincronización del estado de vehículo y evento de indisponibilidad, no asignación concurrente, cierres con ventas o kilometraje cruzado.
- `backend/src/tests/logistics.validators.spec.ts`: cubre límite de `numeroVale` compatible con `INT`; no cubre coherencia de estado/fecha de pago.
- `backend/src/tests/maintenance.service.spec.ts`: cubre costo obligatorio al marcar mantenimiento realizado y anulación/restauración.
- `backend/src/tests/sale-transition-notifications.spec.ts`: prueba el evento `PEDIDO_ENTREGADO`; no prueba una pantalla logística ni detalle de entrega.

No se ejecutaron porque no se necesitaba generar operaciones ni resultados de test para esta revisión estática; tampoco se consultó una base de datos aislada. Los tests anteriores se trataron solo como evidencia de cobertura, no como ejecución actual.

### Límites

- No se accedió a SQL Server; índices, datos, nivel de aislamiento, `FechaPago` real y estado de asignaciones desplegadas quedan sin comprobar.
- No se reprodujeron carreras de vehículos, fallos entre escritura de sesión y sincronización de vehículo, ni efectos de editar sesiones en una planilla.
- No se ejecutaron cargas de imágenes, operaciones CRUD, cierres, anulaciones/restauraciones o pruebas con servicios externos.
- El contrato/resultado de n8n, consumidores de APIs fuera del repositorio, operación de flota real y reglas empresariales no están disponibles en la evidencia consultada.
- Se excluyeron expresamente los módulos de reportes/dashboard/analítica incluso cuando las búsquedas generales los identificaron como consumidores.

**Conclusión:** A04 está parcialmente completa como revisión estática del código versionado. Se reconstruyeron las rutas de escritura y lectura y los principales cruces con ventas, planilla y envases, pero la semántica empresarial de entrega/cierre, disponibilidad simultánea, mantenimiento programado, kilometraje acumulado y liquidación de gastos requiere confirmación. No se modificó código, configuración ni datos. Este informe es el único archivo nuevo.
