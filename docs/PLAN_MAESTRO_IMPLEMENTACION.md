# PLAN MAESTRO DE IMPLEMENTACIÓN — INDUSTRIAS BASAN

**Documento rector de referencia:** [docs/ESPECIFICACION_FUNCIONAL_MAESTRA_BASAN.md](./ESPECIFICACION_FUNCIONAL_MAESTRA_BASAN.md)
**Punto de partida verificado:** rama `developer`, commit `ca38c82417753b3ecd147dfcc57d2042caccb8b5` (30-10-2026). Árbol de trabajo limpio salvo el nuevo archivo de especificación.
**Naturaleza de este documento:** planificación técnica. No se modificó código, base de datos, configuración ni dependencias para producirlo.
**Estado:** ninguno de los 7 entregables solicitados existía previamente en el repositorio; no hay duplicación que resolver.
**Revisión de consistencia (30-10-2026):** se corrigieron 7 puntos de coherencia entre este documento, [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md) y [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md): decisión bloqueante faltante en Fase 2 (`D-DIST-07`), justificación explícita de `D-CAJA-04` como no bloqueante, coherencia entre `Jornada`/`RutaSesion`/`RelevoVehiculo`/`TransferenciaVehiculo`/`CajaSesion`, mecanismo de no duplicidad de movimientos de caja, tratamiento de cobros de crédito/anulaciones/reversiones, corrección de una dependencia circular en la matriz de tareas y la nueva clasificación de alcance (primera entrega funcional vs. mejoras diferibles). No se modificó código, esquema, SQL ni configuración; no se ejecutó ninguna migración; no se asumió ninguna decisión de negocio no aprobada.
**Actualización por restricción de tiempo (30-10-2026):** el negocio confirmó que no hay disponibilidad para preparar un entorno SQL Server aislado separado; la implementación trabajará directamente sobre la base de datos existente. Este plan y sus anexos se actualizaron en consecuencia: se sustituyó toda referencia a "entorno aislado"/"SQL Server desechable" por un protocolo de respaldo verificado, datos de prueba controlados dentro de la misma base y una lista explícita de tablas protegidas (ventas, pagos, créditos, documentos FEL), detallado en la nueva sección "Protocolo de operación sobre la base de datos existente" (sección 9, antes de las fases). No se eliminó ningún requerimiento de la especificación ni se asumió ninguna decisión de negocio adicional; donde la decisión es necesaria se añadió a [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md) (`D-BASE-01` a `D-BASE-05`).

---

## 1. Resumen ejecutivo

Se releyó íntegramente la especificación maestra y se contrastó contra el código actual, verificando directamente (no solo repitiendo la auditoría previa) los archivos críticos: [schema.prisma](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/prisma/schema.prisma), [route-inventory.service.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/route-inventory.service.ts), [logistics.service.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/logistics.service.ts), [production.service.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/production.service.ts), [sale.service.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/sale.service.ts), [auth.middleware.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/middlewares/auth.middleware.ts), [role-permission.validators.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/validators/role-permission.validators.ts) y [rbac.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/lib/rbac.ts), más un muestreo de 55 páginas frontend y 63 archivos de prueba backend.

**El repositorio no cambió respecto a la auditoría previa** (mismo commit `ca38c82`); lo que cambia en esta fase es que ahora se dispone de un documento rector formal (la especificación) y de verificación línea por línea de los puntos que antes eran "no se pudo confirmar".

Hallazgo más importante de esta revisión, con evidencia nueva y precisa: **el modelo actual de `RutaSesion` bloquea explícitamente, por código, los tres escenarios obligatorios de distribución de la especificación (sección 5.4)**:

- Escenario A (reabastecimiento): `createRouteDispatch` rechaza un segundo despacho con el mensaje literal `"La sesión ya tiene un despacho confirmado"` ([route-inventory.service.ts:378-382](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/route-inventory.service.ts)).
- Escenario B (sustitución de vehículo): `updateRutaSesion` rechaza cambiar `IdVehiculo`/`IdUsuarioChofer`/`IdUsuarioVendedor`/`FechaSesion`/`KmInicial` en cuanto existe un despacho o una venta, con el mensaje `"No se puede modificar la asignación de una sesión con operaciones registradas"` ([logistics.service.ts:1009-1021](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/logistics.service.ts)).
- Escenario C (transferencia entre vehículos): no existe modelo, ruta, controlador ni servicio de transferencia general; solo existen transferencias de buckets de envase y la conciliación de devolución a planta.

Esto no es una deficiencia menor de UX: es una **restricción estructural explícita** que impide hoy, por diseño, exactamente lo que la especificación exige como obligatorio. El diseño técnico de distribución (sección 4 de este plan y el documento dedicado) parte de este hecho verificado, no de una suposición.

El resto del sistema —catálogo de productos (categoría + propiedades independientes), compras, ventas con vínculo a sesión de ruta, envases retornables, producción por orden, permisos persistidos por rol— está implementado y debe **conservarse y extenderse**, no reconstruirse. Esto es consistente con el principio rector de la especificación.

### Primera intervención técnica recomendada

**No es programar directamente ninguna de las fases funcionales.** La primera intervención técnica recomendada es la **Fase 1 (línea base y decisiones de negocio)**, en particular:

1. Confirmar que el esquema Prisma versionado corresponde a la base SQL Server realmente desplegada (no se verificó en ninguna auditoría previa ni en esta).
2. Obtener resolución formal de las decisiones de negocio bloqueantes listadas en [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md), especialmente las de jornada/custodia (distribución) y apertura/cierre de caja, porque **cualquier diseño de esquema para distribución o caja que se programe sin esas respuestas tiene alto riesgo de tener que rehacerse**.
3. **Verificar el estado de la base de datos existente y disponer de un respaldo completo y verificado como restaurable**, y definir la estrategia de datos de prueba controlados sobre esa misma base. El negocio confirmó que no hay disponibilidad para preparar un entorno SQL Server aislado separado; por tanto, esta verificación de respaldo sustituye al criterio anterior de "entorno aislado" como condición previa a cualquier cambio (ver sección 9, "Protocolo de operación sobre la base de datos existente").

Después de la Fase 1, la siguiente intervención de mayor impacto es el **diseño de distribución (Fase 2)**, porque caja (Fase 3) y buena parte de los reportes (RF-12/13) dependen conceptualmente de cómo se resuelva jornada/vehículo/custodia.

---

## 2. Qué se verificó de nuevo en esta revisión (no asumido de la auditoría anterior)

| Área | Verificación directa realizada | Resultado |
|---|---|---|
| Estado del repositorio | `git log`, `git status`, `git diff --stat` contra el commit de la auditoría previa | Sin cambios de código; solo se agregó la especificación. |
| Único despacho por sesión | Lectura completa de `createRouteDispatch` | Confirmado: bloqueo explícito por mensaje de error, no solo inferencia. |
| Bloqueo de reasignación de sesión | Lectura completa de `updateRutaSesion` | Confirmado: bloqueo explícito cuando existen `DespachoRuta` o `Venta` activos. |
| Transferencia entre vehículos | Búsqueda de modelos/servicios en `schema.prisma` y `src/services` | Confirmado negativo: no existe. |
| Reserva de vehículo por fecha | Lectura de `assertVehicleAvailableForSession` | Confirmado: validación previa dentro de transacción serializable, no una restricción única declarada en el esquema. |
| Producción: cantidad real/merma | Lectura completa de `createProductionOrder` y `confirmProductionOrder` | Confirmado: la entrada a inventario usa `CantidadProducir` (planificada), no una cantidad real separada; no existe campo de merma. |
| Cambio de receta entre alta y confirmación | Lectura de la revalidación de receta en `confirmProductionOrder` | Confirmado: se revalida la receta activa completa; el consumo usa el snapshot de la orden, no la receta recalculada. |
| Caja | Búsqueda de modelos/rutas/controladores/servicios con nombres `Caja`/`Arqueo`/`CierreCaja`/`MovimientoCaja` | Confirmado negativo: no existe ningún artefacto de caja. |
| Clave RBAC de caja | Lectura de `rbacModuleKeys` (backend) y `AppModuleKey`/`ALL_MODULES` (frontend) | Confirmado negativo: no existe clave `caja` en ninguno de los dos catálogos. |
| `not-configured` en RBAC | Lectura completa de `evaluatePersistedPermission` y `requireModulePermission` | Confirmado: `not-configured` **no** es un bypass; solo `allow` deja pasar, cualquier otro resultado responde 403. |
| Bootstrap de administrador | Búsqueda de usos de `requireBootstrapOrModulePermission` | Confirmado: se usa **únicamente** en `POST /api/auth/register`; no es un bypass general del sistema. |
| Guards de página frontend | Grep de `RequireAuth` en las 55 páginas de `frontend/app` | 32 páginas con `moduleKey`+`action`, 20 solo con sesión, 3 sin `RequireAuth` directo. |
| Corrección de un falso positivo | Lectura de `frontend/app/purchases/gastos/page.tsx` | Es un re-export de `../page` (`/purchases`), que sí está protegida con `compras:read`. **No es una página desprotegida**; se descarta como hallazgo. |
| Defecto de `EstadoPago`/`FechaPago` | Lectura completa de `updateGastoVehiculo` | Confirmado: al revertir `PAGADO → PENDIENTE` no se limpia `FechaPago`. |
| Saldo de envases por cliente | Lectura de `registrarPrestamoEnvase`/`registrarDevolucionEnvase` | Confirmado: patrón lectura-cálculo-escritura (`saldoAnterior`/`saldoNuevo`), dependiente de la transacción serializable envolvente para su corrección ante concurrencia. |
| Pruebas existentes | Inventario de los 63 archivos `*.spec.ts` | Confirmado: no existen pruebas de caja, transferencia general entre vehículos, reabastecimiento múltiple ni sustitución de vehículo/personal con operaciones activas — porque esas funcionalidades no existen todavía. |
| Componentes de ayuda contextual | Búsqueda en `frontend/components` | Existe base reutilizable parcial (`ConfirmActionDialog`, `ui/popover.tsx`, `ui/sonner.tsx`) pero no existe tooltip ni helper de campo reutilizable. |

Estas verificaciones sustituyen o refinan los hallazgos "no se pudo confirmar" de la auditoría anterior; donde coinciden, se cita la evidencia más reciente.

---

## 3. Alcance funcional cubierto en esta planificación

Siguiendo la especificación, se cubren los siete documentos solicitados:

1. **PLAN_MAESTRO_IMPLEMENTACION.md** (este documento): resumen, fases, diseño de producción, plan de seguridad y plan de UX.
2. [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md): tareas concretas por fase/módulo.
3. [MAPA_DEPENDENCIAS_MODULOS.md](./MAPA_DEPENDENCIAS_MODULOS.md): servicios compartidos y efectos secundarios.
4. [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md): propuesta técnica de distribución.
5. [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md): propuesta técnica de caja.
6. [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md): pruebas por módulo y tipo.
7. [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md): decisiones de negocio y técnicas que deben resolverse antes de programar.

El diseño técnico de producción (sección 6 del encargo) y el plan de seguridad (sección 7) y de experiencia de usuario (sección 8) no tienen un archivo dedicado en la lista de siete entregables; se documentan **íntegramente en este archivo** (secciones 6, 7 y 8 más abajo) y se referencian desde la matriz de tareas.

---

## 4. Diseño técnico de distribución (resumen)

El diseño completo, con comparación detallada contra `RutaSesion` y justificación de qué se reutiliza, está en [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md). Resumen de la propuesta:

- **Reutilizar** `Ruta`, `RutaSesion`, `DespachoRuta`/`Detalle`, `DevolucionRuta`/`Detalle`, `AjusteRuta`, `GastoVehiculo` y el servicio de movimientos de inventario/envases (`inventory-movement.service.ts`) como base. Ninguno de estos modelos se duplica.
- **Extender** `DespachoRuta` para permitir múltiples registros activos por sesión (eliminando el bloqueo de "un solo despacho"), en vez de crear un modelo paralelo de despacho.
- **Introducir** un concepto explícito de continuidad de custodia (relevo, `RelevoVehiculo`) como una operación transaccional que cierra la responsabilidad del vehículo saliente y abre la del entrante, en lugar de permitir editar directamente los campos de asignación de `RutaSesion`. Esta operación es puramente de inventario/custodia: no genera movimientos de caja (ver sección 5) y su diseño debe decidir explícitamente, junto con el negocio, a qué vendedor se atribuye para efectos de comisión cada venta posterior al relevo (`D-DIST-07`), porque `planilla-mensual.service.ts` hoy lee el vendedor activo de la sesión en el momento de la consulta, no un histórico por venta.
- **Introducir** un modelo nuevo y justificado de transferencia general de inventario entre vehículos (`TransferenciaVehiculo`, con origen, destino, confirmación), porque no existe ninguna estructura equivalente reutilizable; las transferencias de envase (`transferEnvaseBucket`) son un patrón de referencia pero no cubren productos comerciales ni confirmación de recepción. Al igual que el relevo, es una operación de inventario que **no genera movimientos de caja**. **Mientras `EstadoConfirmacion = PENDIENTE`, la cantidad transferida no es disponible en ningún vehículo** (descontada del origen, no incrementada en destino hasta confirmar); la creación de la transferencia debe validar y descontar la disponibilidad del origen dentro de la misma transacción serializable, para que dos transferencias simultáneas desde el mismo origen no puedan sobreasignar existencias — criterio de aceptación obligatorio del MVP, detallado en [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md), sección 4.1.
- **Decisión pendiente antes de diseñar el esquema final:** si "jornada" debe ser una entidad nueva que agrupe varias `RutaSesion` (una por vehículo/tramo) o si basta con extender `RutaSesion` con un identificador de jornada compartido. Ver [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md#distribución). Esta misma decisión (`D-DIST-01`) condiciona la cardinalidad de `CajaSesion` descrita en la sección 5; no deben resolverse por separado.

---

## 5. Diseño técnico de caja (resumen)

El diseño completo está en [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md). Resumen:

- **No se duplican** `PagoVenta`, `CuentaPorCobrar` ni `GastoVehiculo`. La caja se diseña como una capa de conciliación que **referencia** esos registros por id, no que los copia.
- Se propone un modelo `CajaSesion` (apertura/cierre, fondo inicial, efectivo contado/entregado, diferencia, responsables) vinculado a `RutaSesion`, y un modelo `MovimientoCaja` que registra cada entrada/salida con referencia a su origen (`IdPagoVentaOrigen`, `IdGastoVehiculoOrigen`, u otro).
- **Resolución de `Monto` (ambigüedad corregida en esta revisión):** el campo `Monto` de `MovimientoCaja` es una **fotografía inmutable** tomada al crear el movimiento, igual al patrón de snapshot ya usado en otras partes del esquema (`DespachoRutaDetalle.NombreSnapshot`, `DetalleOrdenProduccion.CantidadTotal`); es la fuente de verdad del cálculo de efectivo esperado, no se recalcula desde `PagoVenta`/`GastoVehiculo` en cada lectura. La referencia por id existe solo para trazabilidad/auditoría. Detalle en [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md), sección 4.2.
- **Coherencia con el diseño de distribución (sección 4):** la cardinalidad de `CajaSesion` respecto a `RutaSesion` (1:1 o 1:N) **depende de la misma decisión pendiente sobre `Jornada`** (D-DIST-01); no se fija aquí de forma independiente. `RelevoVehiculo` y `TransferenciaVehiculo` son, por diseño, operaciones exclusivamente de inventario/custodia física y **no generan ningún `MovimientoCaja` por sí mismas** — un traslado de mercadería entre vehículos no es un ingreso ni un egreso de efectivo, consistente con la regla de la especificación de no confundir transferencias con ventas (sección 17.6).
- **No duplicidad de movimientos de caja:** cada `MovimientoCaja` debe referenciar su origen (`PagoVenta` o `GastoVehiculo`) mediante **índices únicos filtrados** (no una restricción `@unique` estándar de Prisma, que en SQL Server solo admite un valor `NULL`); el procedimiento de implementación vía SQL manual en la migración, y su conservación frente a futuras introspecciones de Prisma, se detallan en [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md), sección 4.3.
- **Tratamiento de cobros de crédito y reversiones:** debe distinguirse explícitamente una venta cobrada en efectivo del cobro de una deuda anterior (regla ya exigida por la especificación, sección 10.3), y queda pendiente de decisión de negocio (`D-CAJA-06`) cómo clasificar el abono inicial que puede registrarse en el momento de crear una venta a crédito. Toda anulación de un `PagoVenta` o reversión de un `GastoVehiculo` (incluida la corrección de T-F3-CAJA-04) debe propagarse como una anulación simétrica del `MovimientoCaja` asociado (nunca un borrado físico), con la política exacta de cascada pendiente en `D-CAJA-07` (ver T-F3-CAJA-09).
- Se identificó y se documenta como prerrequisito técnico un defecto puntual en `updateGastoVehiculo` (no limpia `FechaPago` al revertir `PAGADO → PENDIENTE`) que debe corregirse antes de usar ese campo como fuente de cálculo de caja. Esta corrección (T-F3-CAJA-04) es independiente del resto del módulo de caja y puede aplicarse aunque la construcción de `CajaSesion`/`MovimientoCaja` se difiera a una fase posterior (ver sección 9).
- Se requiere agregar la clave de módulo RBAC `caja` (no existe hoy en ninguno de los dos catálogos de permisos) siguiendo el patrón ya usado para `despacho` y `produccion`, sin modificar el mecanismo de roles configurables.
- Se deja fuera de alcance, salvo decisión de negocio en contrario, el gasto administrativo (`DetalleGasto` vía `Compra.EsGasto`), porque no está vinculado a `RutaSesion` y no tiene campos de estado de pago. Esta exclusión (`D-CAJA-04`) tiene un comportamiento por defecto seguro y **no bloquea** el inicio del diseño de caja.

---

## 6. Diseño técnico de producción

### 6.1. Punto de partida verificado

`OrdenProduccion` y `DetalleOrdenProduccion` ([schema.prisma:635-668](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/prisma/schema.prisma)) ya implementan: producto terminado, cantidad planificada (`CantidadProducir`), snapshot de receta (`NombreSnapshot`, `CantidadPorUnidad`, `CantidadTotal`, `UnidadMedidaSnapshot`), usuario responsable (`IdUsuario`/`IdUsuarioModificador`/`IdUsuarioAnulador`), fechas de auditoría y estados `PENDIENTE`/`FABRICADA`/`CANCELADA`. `confirmProductionOrder` ([production.service.ts:364-580](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/services/production.service.ts)) ya es transaccional, revalida la receta activa, bloquea doble confirmación (`existingMovements` sobre `BitacoraInventario` con `TipoDocumento: 'PROD'`) y registra consumo e ingreso en `BitacoraInventario`.

### 6.2. Qué falta, con ubicación exacta de la extensión necesaria

| Requerimiento de la especificación (sección 7.2) | Estado verificado | Extensión propuesta |
|---|---|---|
| Identificación de lote | No existe campo | Agregar `NumeroLote`/`CodigoLote` (string) a `OrdenProduccion`. Política de numeración: pendiente de decisión de negocio (ver sección 22.10 de la especificación). |
| Cantidad realmente producida | No existe; `confirmProductionOrder` usa `order.CantidadProducir` para la entrada a inventario (línea ~531-544) | Agregar `CantidadProducidaReal` (float) a `OrdenProduccion`, capturado en la confirmación; la entrada a inventario debe usar este valor, no el planificado. |
| Consumo real por componente | No existe; el consumo siempre usa `detail.CantidadTotal` (snapshot planificado) | Agregar `CantidadConsumidaReal` a `DetalleOrdenProduccion`, opcional en la confirmación (si no se captura, se asume igual al planificado, preservando el comportamiento actual). |
| Merma | No existe ningún campo ni movimiento de merma | Agregar `CantidadMerma`/`MotivoMerma` (a nivel de orden o de detalle, según decisión de negocio) y, si corresponde, un movimiento de inventario específico para producto mermado, reutilizando `registerInventoryMovement`. |
| Fecha operacional distinta de fecha de registro | No existe; solo hay `FechaRegistro`/`FechaModificacion`/`FechaAnulacion` (auditoría) | Agregar `FechaProduccion` (date) si el negocio confirma que debe diferenciarse del momento de registro en el sistema. |
| Responsable de ejecución (si distinto del que confirma) | Cubierto parcialmente: `IdUsuario` (alta) e `IdUsuarioModificador` (confirmación) ya existen | No requiere cambio salvo que el negocio exija un tercer responsable de "ejecución física" distinto de quien digita la confirmación. |
| Comportamiento ante receta modificada | Ya implementado: revalida receta activa completa, rechaza si cambia la unidad del producto terminado o de un componente | Decidir explícitamente la política (no es un defecto, es un comportamiento que debe ratificarse o ajustarse): ¿debe seguir rechazando, o debe permitir confirmar con el snapshot ignorando el cambio posterior de receta? Ver decisión pendiente en [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md#producción). |
| Movimientos transaccionales | Ya cumplido: toda la confirmación corre dentro de `runSerializableTransaction` | Mantener el mismo patrón al añadir movimientos de merma. |
| Operación simplificada (no exigir registro unidad por unidad) | Ya cumplido: la orden opera por lote/cantidad total, no por unidad | Conservar; no se debe introducir un registro más granular que contradiga este principio. |

### 6.3. Compatibilidad

Todos los campos propuestos son **aditivos** (nuevas columnas nullable/opcionales). No se requiere eliminar ni renombrar campos existentes de `OrdenProduccion` o `DetalleOrdenProduccion`, y el comportamiento actual (cantidad real = cantidad planificada si no se captura una diferente) puede preservarse como valor por defecto para no romper flujos existentes.

---

## 7. Plan de seguridad

### 7.1. Qué ya existe y debe conservarse

- Roles configurables con permisos persistidos por módulo/acción (`RolPermiso`, `ModuloSistema`, `AccionSistema`), administrados desde [role.routes.ts](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/routes/role.routes.ts) y la UI de [role-permissions-card.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/app/roles/_components/role-permissions-card.tsx). **No se reemplaza.**
- `requireModulePermission` deniega con 403 cualquier resultado que no sea `allow`, incluido `not-configured` ([auth.middleware.ts:267-286](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/middlewares/auth.middleware.ts)). Esto es correcto y debe mantenerse como principio al añadir el módulo `caja` y cualquier endpoint de distribución nuevo.
- `requireBootstrapOrModulePermission` solo se usa en `POST /api/auth/register` ([auth.routes.ts:22](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/backend/src/routes/auth.routes.ts)) y únicamente permite registro abierto mientras no exista un rol `Administrador` con un usuario activo. No es un bypass general; debe documentarse como procedimiento de instalación, no corregirse como si fuera un defecto.

### 7.2. Qué debe revisarse (sin reemplazar el sistema de roles)

| Tarea | Evidencia | Acción propuesta |
|---|---|---|
| Homologar guards frontend | 20 de 55 páginas usan `RequireAuth` solo con sesión, sin `moduleKey` (inventario CRUD, logística general, envases, proveedores, empleados, calidad, `my-payroll`) | Añadir `moduleKey`+`action` coincidente con la clave backend real del endpoint que consume cada página. No crear claves nuevas sin verificar que ya existan en `rbacModuleKeys`. |
| Verificar correspondencia frontend/backend | `frontend/lib/rbac.ts` y `backend/src/validators/role-permission.validators.ts` tienen el mismo conjunto de 18 claves hoy | Antes de agregar `caja`, confirmar que se agrega en ambos catálogos a la vez; de lo contrario el guard de frontend o el de backend quedarán desalineados. |
| Pruebas de autorización para funcionalidad nueva | No existen pruebas de autorización para caja/transferencia/relevo porque no existen los endpoints | Añadir especificaciones de autorización (permitido/denegado) como parte del mismo cambio que introduce cada endpoint nuevo, siguiendo el patrón de `module-endpoints-rbac.spec.ts` y `auth-a01.middleware.spec.ts`. |
| Auditoría de operaciones sensibles nuevas | Las anulaciones actuales (compra, ajuste, venta, despacho, devolución) ya registran `IdUsuarioAnulador`/`FechaAnulacion`/motivo | Replicar el mismo patrón de auditoría para anulaciones de caja, transferencia y relevo; no inventar un mecanismo de auditoría paralelo. |
| Corregir falso positivo descartado | `/purchases/gastos/page.tsx` es un re-export protegido, no una página desprotegida | No se requiere acción; se documenta para que no se repita como hallazgo en futuras auditorías. |

### 7.3. Principio rector

Ninguna tarea de este plan debe introducir un segundo mecanismo de autorización. Todo endpoint o página nuevos deben usar `requireModulePermission`/`RequireAuth` con las claves existentes de módulo/acción, extendiendo el catálogo solo cuando el módulo funcional sea genuinamente nuevo (como `caja`).

---

## 8. Plan de experiencia de usuario

### 8.1. Inventario de lo que ya existe (verificado, no asumido)

| Elemento propuesto por la especificación | Equivalente ya existente | Ubicación |
|---|---|---|
| `ActionConfirmation` / `OperationWarning` | `ConfirmActionDialog`, genérico y parametrizable (título, descripción, etiquetas, loading, `onConfirm`) | [confirm-action-dialog.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/components/confirm-action-dialog.tsx) |
| Infraestructura para `InfoTooltip` | Wrapper Radix de popover ya disponible, pero sin componente de tooltip construido sobre él | [components/ui/popover.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/components/ui/popover.tsx), [components/ui/dialog.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/components/ui/dialog.tsx) |
| `OperationFeedback` | Wrapper global de Sonner con iconos por severidad, montado en el layout raíz | [components/ui/sonner.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/components/ui/sonner.tsx), [app/layout.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/app/layout.tsx) |
| `FieldHelper` | No existe; los formularios son ad-hoc por página | [product-form-card.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/app/inventory/_components/product-form-card.tsx) y equivalentes de clientes/empleados/proveedores |
| `ModuleHelp` | No existe un patrón reutilizable; hay textos de ayuda ad-hoc dentro de páginas puntuales | [payroll/page.tsx](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/app/payroll/page.tsx) (líneas con instrucciones inline) |
| Iconografía consistente | `lucide-react` se usa de forma directa en toda la aplicación, sin wrapper central | `frontend/package.json`, múltiples páginas |
| Guía de componentes | Existe configuración de estilo (`components.json`) y una carpeta `components/ui/` con primitivas reutilizables | [components.json](/D:/Universidad%20Mariano%20G%C3%A1lvez/FlowManager/frontend/components.json) |

### 8.2. Estrategia (reutilizar antes de crear)

1. **No crear una librería de ayuda paralela.** `InfoTooltip`, `FieldHelper`, `ModuleHelp`, `OperationWarning`, `ActionConfirmation` y `OperationFeedback` deben construirse como capas delgadas sobre los primitivos ya existentes en `components/ui/` (`popover`, `dialog`, `sonner`) y sobre `ConfirmActionDialog`.
2. **Orden de construcción recomendado:**
   - Primero `components/ui/tooltip.tsx` (no existe; es la única pieza de infraestructura realmente faltante) para soportar `InfoTooltip`.
   - Luego `FieldHelper` como un pequeño componente de texto bajo campo, consumido opcionalmente por los formularios existentes sin reescribirlos.
   - Luego `OperationFeedback` como una función delgada que envuelve `toast` de Sonner con mensajes homologados.
   - `ActionConfirmation`/`OperationWarning` como alias o extensión tipada de `ConfirmActionDialog`, no un componente nuevo desde cero.
3. **Diccionario de términos único** (jornada, sesión, despacho, reabastecimiento, transferencia, retorno, caja, envase, merma, conciliación) que se aplique literalmente igual en todos los módulos que lo mencionen, para evitar explicaciones contradictorias (regla 9 de la sección 14.4 de la especificación).
4. **Nivel de ayuda aprobado: intermedio** (ya definido por la especificación, sección 14.1); no se diseñan textos extensos ni un sistema de documentación en línea separado.
5. Cada tarea de incorporación de ayuda contextual a un módulo específico (ver [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md), fase F6) debe hacerse **después** de que ese módulo tenga su funcionalidad definitiva, para no redactar ayuda sobre un flujo que todavía va a cambiar (por ejemplo, no documentar ayuda de "despacho único" si se va a reemplazar por múltiples despachos).

---

## 9. Fases de implementación

Se conservan las 7 fases de la especificación (sección 18), con tareas concretas remitidas a [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md).

### Protocolo de operación sobre la base de datos existente (aplica a todas las fases)

El negocio confirmó que no hay disponibilidad para preparar un entorno SQL Server aislado separado: **la implementación trabajará directamente sobre la base de datos existente.** Esto no relaja ningún criterio de seguridad de datos del plan original; lo traslada a reglas operativas concretas que reemplazan toda mención anterior de "entorno aislado" en este documento y sus anexos:

1. **Respaldo verificado en tres pasos distintos (T-F1-BASE-05):** antes de ejecutar cualquier cambio de esquema o dato, deben completarse, en orden y sin saltar ninguno: (a) **generar** el respaldo completo; (b) **verificar su integridad** (checksum/tamaño/fecha o `RESTORE VERIFYONLY`); (c) **comprobar la restauración** ejecutando una restauración real sobre una base distinta. Un checksum válido (paso b) **no** demuestra que el respaldo sea restaurable; ningún cambio se autoriza hasta completar el paso (c) con éxito.
2. **Tablas y campos protegidos (T-F1-BASE-07):** por evidencia directa del esquema ya verificado en esta planificación, se consideran protegidos `Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar`, `SolicitudPagoIdempotente`, `ReservaProforma`, `DevolucionComercial`, `Talonario`, y los campos FEL de `Venta` (`AutorizacionFel`, `NumeroFel`, `SerieFel`, `QrFel`, `RutaPdfFel`, `FechaEmisionFel`, `RutaPdfFelAnulacion`, `FechaAnulacionFel`, `NitFacturado`). Ninguna tarea de este plan debe modificar, eliminar o reconstruir estas tablas ni sus registros históricos.
3. **Regla de alto obligatorio:** si una tarea de la matriz, al ejecutarse, requiere tocar código o datos de las tablas protegidas, debe **detenerse antes de implementar** y presentarse primero el riesgo identificado junto con una alternativa segura, para aprobación explícita. Esta regla se aplica incluso a cambios aparentemente menores.
4. **Scripts SQL revisables (T-F1-BASE-06):** todo cambio de esquema se prepara primero como script revisable (por ejemplo, `prisma migrate diff` sin aplicar), se somete a revisión humana y solo se ejecuta manualmente tras aprobación explícita. No se ejecutan migraciones destructivas ni modificaciones masivas de datos.
5. **Datos de prueba controlados y reversibles; efectos externos siempre simulados.** Las pruebas que requieran persistencia se ejecutan preferentemente como pruebas unitarias con mocks (la mayoría de las 63 existentes ya siguen este patrón). Para pruebas de integración contra la base real: se verificó directamente que las dos existentes (`route-flow.sqlserver.integration.spec.ts`, `sale-payment.rollback.integration.spec.ts`) **no** usan una transacción revertida al finalizar —crean registros reales y los eliminan con `deleteMany` en `afterAll`—, pero sí mockean `fel.service.ts`/`notification.service.ts` en todo momento. Para pruebas nuevas sobre tablas protegidas se exige el patrón reforzado: transacción propia revertida cuando el servicio lo permita, o el patrón heredado de creación+limpieza más una verificación independiente de huérfanos cuando no sea posible; y, sin excepción, mockear FEL/notificaciones/webhooks (revertir la base de datos no deshace una llamada HTTP externa ya realizada). Ninguna prueba debe alterar ventas, pagos, créditos o documentos FEL reales. Detalle completo en [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md), sección 0.
6. **Cambios incrementales:** se prioriza extender el esquema con columnas/tablas nuevas opcionales (como ya proponían los diseños de distribución y caja) sobre alterar o reemplazar estructuras existentes.

Las tareas nuevas T-F1-BASE-05, T-F1-BASE-06 y T-F1-BASE-07 (detalladas en la matriz) operacionalizan este protocolo y se incorporan al grupo indispensable de la primera entrega.

### Fase 1 — Línea base y decisiones de negocio

- **Objetivo:** tener una base técnica y de negocio confiable antes de diseñar cambios de esquema, y un respaldo verificado antes de cualquier modificación sobre la base de datos existente.
- **Problema que resuelve:** ninguna auditoría (incluida esta) verificó la base SQL Server desplegada; varias decisiones de negocio de las que depende el diseño siguen sin resolver; no hay disponibilidad para un entorno aislado separado, por lo que se requiere un protocolo explícito de seguridad de datos sobre la base existente.
- **Tareas:** ver F1 en la matriz, incluidas las nuevas T-F1-BASE-05 (respaldo verificado), T-F1-BASE-06 (scripts SQL revisables) y T-F1-BASE-07 (lista de tablas protegidas y regla de alto).
- **Archivos involucrados:** `backend/prisma/schema.prisma`, `Base de Datos - FlowManager.sql`, `backend/prisma/migrations/*`, `backend/scripts/prisma-migrate.js`.
- **Riesgos:** diseñar sobre un esquema que no coincide con el desplegado; ejecutar un cambio sin respaldo verificado sobre datos reales de producción.
- **Dependencias:** ninguna (es la fase inicial).
- **Criterios de aceptación:** esquema confirmado contra despliegue real; respaldo completo verificado como restaurable; lista de tablas protegidas ratificada; estrategia de datos de prueba controlados documentada; decisiones bloqueantes de [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md) resueltas y documentadas con responsable y fecha.
- **Pruebas necesarias:** ninguna de código; verificación documental, de infraestructura y de integridad del respaldo.

### Fase 2 — Diseño de distribución

- **Objetivo:** modelo funcional de distribución aprobado que soporte los tres escenarios obligatorios.
- **Problema que resuelve:** los bloqueos confirmados de despacho único y de reasignación de sesión (sección 1 de este documento).
- **Tareas:** ver F2 en la matriz y el detalle completo en [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md). Según la [clasificación de alcance](./MATRIZ_TAREAS_TECNICAS.md#clasificación-de-alcance-primera-entrega-funcional-mvp-vs-mejoras-diferibles) propuesta en esta revisión, T-F2-DIST-01/02/03/04/05/08/09 son indispensables para la primera entrega; T-F2-DIST-06/07 pueden diferirse.
- **Archivos involucrados:** `backend/prisma/schema.prisma`, `backend/src/services/route-inventory.service.ts`, `backend/src/services/logistics.service.ts`, `backend/src/routes/logistics.routes.ts`, `frontend/app/logistics/**`, `frontend/services/logistics.service.ts`.
- **Riesgos:** ver [MAPA_DEPENDENCIAS_MODULOS.md](./MAPA_DEPENDENCIAS_MODULOS.md) (ventas, planilla/comisiones y envases consumen `RutaSesion`).
- **Dependencias:** Fase 1 (decisión de jornada vs. sesión, `D-DIST-01`) y, para el diseño del relevo específicamente, la política de atribución de comisión ante cambio de personal (`D-DIST-07`, incorporada en esta revisión como bloqueante de Fase 2 junto con `D-DIST-01` a `D-DIST-06`).
- **Criterios de aceptación:** los escenarios A, B y C de la especificación (sección 5.4) se pueden completar de principio a fin sobre la base de datos existente, usando datos de prueba claramente marcados y reversibles (sin crear ventas, pagos o documentos FEL reales). Ninguna de las tareas indispensables de esta fase modifica `Venta`, `PagoVenta`, `CuentaPorCobrar` ni campos FEL (verificado: T-F2-DIST-02/03/05 solo *leen* `Venta` para validar reglas existentes, no la modifican); por tanto, esta fase no activa por sí sola la regla de alto del protocolo de la sección 9, salvo que la implementación concreta decida lo contrario. **Dos criterios adicionales, obligatorios y no diferibles, incorporados en esta revisión:** (a) mientras una `TransferenciaVehiculo` esté `PENDIENTE`, la cantidad transferida no debe contabilizarse como disponible ni en el vehículo de origen ni en el de destino (ver [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md), sección 4.1); (b) la prueba de concurrencia de transferencias (dos solicitudes simultáneas desde el mismo origen no pueden sobreasignar existencias) debe pasar explícitamente antes de dar por completa esta fase, sin que esto implique reincorporar T-F2-DIST-06.
- **Pruebas necesarias:** ver [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md), bloque distribución.

### Fase 3 — Caja y conciliación financiera

- **Objetivo:** control financiero por vehículo y jornada.
- **Problema que resuelve:** ausencia total de flujo de caja (confirmado negativo en esta revisión).
- **Tareas:** ver F3 en la matriz y [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md). Esta revisión incorporó T-F3-CAJA-09 (reversión en cascada de movimientos de caja) para precisar el tratamiento de anulaciones y cobros de crédito; según la clasificación de alcance, toda la Fase 3 se propone como diferible a una fase posterior salvo T-F3-CAJA-04 (corrección puntual de `GastoVehiculo`, indispensable e independiente del resto).
- **Archivos involucrados:** nuevo `backend/src/services/caja.service.ts` (propuesto), `backend/prisma/schema.prisma`, `backend/src/validators/role-permission.validators.ts`, `frontend/lib/rbac.ts`, nuevas páginas bajo `frontend/app/caja/` (propuesto).
- **Riesgos:** duplicar información ya existente en `PagoVenta`/`CuentaPorCobrar`/`GastoVehiculo` si no se diseña como capa de referencia; ver en la sección 5 el mecanismo de unicidad e idempotencia propuesto para evitarlo. **Riesgo elevado por protocolo de datos (sección 9):** `PagoVenta` y `CuentaPorCobrar` están en la lista de tablas protegidas; cualquier tarea de esta fase que proponga leer o escribir sobre ellas (T-F3-CAJA-02, T-F3-CAJA-03, T-F3-CAJA-09) debe detenerse y presentar el riesgo/alternativa antes de implementarse, conforme a la regla de alto obligatorio. `T-F3-CAJA-04` es la excepción: solo modifica `GastoVehiculo`, que no es una tabla protegida.
- **Dependencias:** Fase 2 (si el cierre de caja se ata a la sesión/jornada de distribución, `D-DIST-01`) y Fase 1 (decisión de política de apertura/cierre, `D-CAJA-01/02/03`, más `D-CAJA-06`/`D-CAJA-07` sobre clasificación de cobros y reversiones, incorporadas en esta revisión; también `D-BASE-02`/`D-BASE-05` sobre datos de prueba y alcance de tablas protegidas). `D-CAJA-04` (alcance de `DetalleGasto`) **no** bloquea el inicio de esta fase, según se documenta explícitamente en [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md).
- **Criterios de aceptación:** se puede abrir, registrar movimientos, arquear y cerrar una caja de sesión usando datos de prueba controlados sobre la base existente (nunca ventas o pagos reales), con efectivo esperado calculado según la fórmula de la especificación (sección 10.3), y con reversión correcta ante anulación de un pago o gasto origen.
- **Pruebas necesarias:** ver plan de pruebas, bloque caja.

### Fase 4 — Inventario y logística complementaria

- **Objetivo:** trazabilidad completa de mercadería una vez resuelta la distribución.
- **Problema que resuelve:** devolución comercial sin materialización física garantizada; saldo de envases dependiente de patrón lectura-cálculo-escritura.
- **Tareas:** ver F4 en la matriz.
- **Archivos involucrados:** `backend/src/services/commercial-return.service.ts`, `backend/src/services/envase.service.ts`, `backend/src/services/adjustment.service.ts`.
- **Riesgos:** cambios aquí afectan ventas, envases y planilla/comisiones simultáneamente (ver mapa de dependencias). **Riesgo elevado por protocolo de datos (sección 9):** `DevolucionComercial` está en la lista de tablas protegidas y referencia `Venta`; `T-F4-INV-01` debe detenerse y presentar riesgo/alternativa antes de implementarse.
- **Dependencias:** Fase 2 (algunos ajustes de ruta dependen del modelo final de despacho/jornada).
- **Criterios de aceptación:** una devolución comercial siempre resulta en un movimiento físico consistente o en un estado explícito de pendiente visible para el usuario; prueba de concurrencia de saldo de envases documentada.
- **Pruebas necesarias:** ver plan de pruebas, bloques inventario y envases.

### Fase 5 — Producción y fabricación

- **Objetivo:** control de producción adaptado a la operación real (lote, cantidad real, consumo real, merma).
- **Problema que resuelve:** ver sección 6 de este documento.
- **Tareas:** ver F5 en la matriz.
- **Archivos involucrados:** `backend/prisma/schema.prisma` (modelos `OrdenProduccion`/`DetalleOrdenProduccion`), `backend/src/services/production.service.ts`, `backend/src/validators/production.validators.ts`, `frontend/app/production/page.tsx`, `frontend/services/production.service.ts`.
- **Riesgos:** bajo, porque todos los cambios son aditivos sobre un flujo que ya es transaccional y funcional.
- **Dependencias:** Fase 1 (decisión sobre política de receta modificada y numeración de lote).
- **Criterios de aceptación:** se puede crear una orden, confirmar con cantidad real distinta de la planificada, registrar consumo real y merma, y verificar el movimiento de inventario resultante, usando datos de prueba controlados sobre la base existente. Ninguna tarea de esta fase toca tablas protegidas (`OrdenProduccion`/`DetalleOrdenProduccion` no son ventas, pagos, créditos ni documentos FEL).
- **Pruebas necesarias:** ver plan de pruebas, bloque producción.

### Fase 6 — Seguridad y experiencia de usuario

- **Objetivo:** plataforma consistente, comprensible y segura.
- **Problema que resuelve:** guards de frontend inconsistentes (20 páginas); ausencia de componentes de ayuda contextual reutilizables.
- **Tareas:** ver F6 en la matriz y secciones 7 y 8 de este documento.
- **Archivos involucrados:** `frontend/components/require-auth.tsx`, las 20 páginas identificadas, `frontend/components/ui/*`, `frontend/components/confirm-action-dialog.tsx`.
- **Riesgos:** bajo por página individual; requiere revisión sistemática para no dejar páginas sin homologar.
- **Dependencias:** ninguna estricta; puede avanzar en paralelo a F2-F5 por página/módulo ya estable.
- **Criterios de aceptación:** cada página operativa declara `moduleKey`+`action` coincidente con su endpoint; existe al menos `InfoTooltip`, `FieldHelper` y `OperationFeedback` como componentes reutilizables documentados.
- **Pruebas necesarias:** ver plan de pruebas, bloque seguridad y UX.

### Fase 7 — Validación integral

- **Objetivo:** sistema validado mediante pruebas reproducibles antes de su despliegue, trabajando sobre la base de datos existente conforme al protocolo de la sección 9.
- **Problema que resuelve:** ninguna de las fases anteriores se da por completa sin pruebas reproducibles.
- **Tareas:** ver [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md) íntegro.
- **Dependencias:** todas las fases anteriores relevantes al módulo bajo prueba; respaldo verificado (T-F1-BASE-05) vigente antes de ejecutar cualquier prueba que escriba en la base.
- **Criterios de aceptación:** los escenarios mínimos de prueba de la especificación (sección 20) se ejecutan y documentan usando datos de prueba controlados y reversibles sobre la base existente, sin alterar ventas, pagos, créditos o documentos FEL reales.

---

## 10. Qué puede avanzar en paralelo y qué requiere secuencia

- **Pueden avanzar en paralelo:** homologación de guards frontend (F6), diseño de producción (F5) y preparación de línea base (F1), porque no comparten esquema ni bloquean entre sí.
- **Requiere secuencia estricta:** F2 (distribución) antes de F3 (caja), porque el diseño de caja de este plan ata la apertura/cierre a la sesión/jornada de distribución. Si F2 cambia la forma de `RutaSesion`/jornada, el diseño de `CajaSesion` debe revisarse.
- **Requiere secuencia estricta:** F1 antes de F2 y F3, porque ambas dependen de decisiones de negocio no resueltas (jornada vs. sesión; política de apertura/cierre de caja).
- **F4 depende parcialmente de F2:** los ajustes de ruta (`AjusteRuta`) hoy tienen una restricción de unicidad por sesión/artículo que puede necesitar revisión si F2 introduce múltiples despachos.
- **Corrección de redacción (esta revisión):** la tarea T-F1-BASE-04 (clave RBAC `caja`) quedaba redactada con una dependencia ambigua ("Aprobación de F3"), que podía leerse como circular frente a T-F3-CAJA-05/06 (que dependen de T-F1-BASE-04). Se corrigió en la matriz: T-F1-BASE-04 es un prerrequisito técnico *para* F3, no una tarea que depende *de* F3; su único condicionante real es la decisión de negocio de proceder con el módulo de caja. Se revisó el resto de las 42 tareas de la matriz y no se encontraron otras dependencias circulares.
- **Alcance propuesto de primera entrega (nuevo en esta revisión):** la [clasificación de alcance](./MATRIZ_TAREAS_TECNICAS.md#clasificación-de-alcance-primera-entrega-funcional-mvp-vs-mejoras-diferibles) de la matriz de tareas propone que la primera entrega funcional cubra únicamente la Fase 1 y la Fase 2 (distribución) más dos tareas puntuales de bajo riesgo (T-F3-CAJA-04 y T-F6-SEG-04), dejando caja, producción avanzada y la homologación general de seguridad/UX como mejoras de una fase posterior. Esta propuesta no elimina ningún requerimiento de la especificación maestra ni resuelve ninguna decisión de negocio por sí misma; queda sujeta a ratificación (`D-ALCANCE-01`).
- **Restricción de tiempo sobre entorno de pruebas (nuevo):** el negocio confirmó que no hay disponibilidad para un entorno SQL Server aislado; toda la secuencia anterior se mantiene sin cambios de orden, pero ahora **ninguna fase puede iniciar su implementación hasta que T-F1-BASE-05 (respaldo verificado) esté completa**, condición transversal más estricta que las dependencias previas de fase. Esto no altera qué puede avanzar en paralelo entre sí, pero sí añade un prerrequisito común a todo el plan (ver sección 9, "Protocolo de operación sobre la base de datos existente"). Se verificó además que las tareas indispensables de la primera entrega (F2 distribución) no leen ni escriben directamente sobre tablas protegidas (ventas/pagos/créditos/FEL) salvo lecturas de validación ya existentes en el código, por lo que el MVP propuesto sigue siendo viable bajo esta restricción.

---

## 11. Resumen de entregables y dónde encontrar cada tema

| Tema solicitado en el encargo | Dónde está documentado |
|---|---|
| Revisión de la especificación y contraste con el código | Secciones 1-2 de este documento |
| Matriz de implementación | [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md) |
| Mapa de dependencias | [MAPA_DEPENDENCIAS_MODULOS.md](./MAPA_DEPENDENCIAS_MODULOS.md) |
| Diseño técnico de distribución | Sección 4 (resumen) + [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md) (completo) |
| Diseño técnico de caja | Sección 5 (resumen) + [DISENO_TECNICO_CAJA.md](./DISENO_TECNICO_CAJA.md) (completo) |
| Diseño técnico de producción | Sección 6 (completo, no tiene archivo dedicado) |
| Plan de seguridad | Sección 7 (completo, no tiene archivo dedicado) |
| Plan de experiencia de usuario | Sección 8 (completo, no tiene archivo dedicado) |
| Plan de pruebas | [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md) |
| Priorización por fases | Sección 9 de este documento |
| Decisiones pendientes | [DECISIONES_TECNICAS_PENDIENTES.md](./DECISIONES_TECNICAS_PENDIENTES.md) |

---

## 12. Conclusión

Industrias Basan cuenta con una base funcional real en catálogo, inventario, compras, ventas, envases y producción que debe conservarse. La brecha crítica verificada con evidencia de código es **estructural, no cosmética**: el modelo actual de sesión de ruta impide por diseño los tres escenarios de distribución que la empresa necesita, y no existe ningún artefacto de caja. Estas dos áreas (distribución y caja) deben abordarse primero y en ese orden, después de resolver las decisiones de negocio pendientes.

Esta revisión de consistencia precisó, además, que **distribución y caja no deben confundirse en urgencia**: distribución resuelve un bloqueo activo sobre una operación que la empresa ya intenta realizar; caja amplía una capacidad hoy ausente pero cubierta manualmente. Por ello se propone —sujeto a ratificación (`D-ALCANCE-01`)— que la primera entrega funcional se concentre en distribución, dejando caja como el siguiente incremento inmediato. Producción, seguridad y experiencia de usuario pueden avanzar con cambios aditivos de menor riesgo, en paralelo, sin alterar esta secuencia.

Dado que no hay disponibilidad para un entorno SQL Server aislado, la implementación trabajará directamente sobre la base de datos existente bajo el protocolo descrito en la sección 9: respaldo verificado como restaurable antes de cualquier cambio, scripts SQL revisables (nunca migraciones automáticas ni destructivas), una lista explícita de tablas protegidas (ventas, detalles, pagos, créditos y documentos FEL) con regla de alto obligatorio, y datos de prueba controlados y reversibles. Esta restricción no cambia el orden de las fases ni el alcance propuesto del MVP, pero sí convierte el respaldo verificado en la condición previa más estricta de todo el plan.

**No se ha programado nada.** Este documento y sus seis anexos son exclusivamente de análisis y planificación, conforme a la autorización recibida.
