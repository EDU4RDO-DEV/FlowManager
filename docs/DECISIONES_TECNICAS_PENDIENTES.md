# DECISIONES TÉCNICAS Y DE NEGOCIO PENDIENTES — INDUSTRIAS BASAN

**Referencia:** [PLAN_MAESTRO_IMPLEMENTACION.md](./PLAN_MAESTRO_IMPLEMENTACION.md). Este documento consolida las 13 decisiones ya listadas en [ESPECIFICACION_FUNCIONAL_MAESTRA_BASAN.md](./ESPECIFICACION_FUNCIONAL_MAESTRA_BASAN.md) (sección 22) con las decisiones técnicas adicionales identificadas al contrastar la especificación contra el código real. No se duplica texto: donde la especificación ya formuló la pregunta, se referencia y se añade únicamente la implicación técnica nueva detectada en esta revisión.

**Regla de uso:** ninguna de estas decisiones debe resolverse por inferencia del código ni asumirse automáticamente. Cada una debe registrarse con responsable y fecha antes de iniciar la fase de implementación que depende de ella.

**Actualización por restricción de tiempo (30-10-2026):** el negocio confirmó que no hay disponibilidad para preparar un entorno SQL Server aislado; la implementación trabajará directamente sobre la base de datos existente. Se agregó la sección "Operación sobre la base de datos existente" (`D-BASE-01` a `D-BASE-06`), que ahora es el bloqueante más temprano de todo el plan.

---

## Operación sobre la base de datos existente (sin entorno aislado)

| # | Decisión pendiente | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-BASE-01 (nueva) | ¿Quién autoriza el respaldo, y con qué frecuencia/criterio se exige repetir la **prueba de restauración real** (no solo la verificación de integridad) antes de autorizar un cambio? ¿Dónde se almacena el respaldo y cómo se restaura en caso de fallo? | Generar un respaldo, verificar su integridad (checksum/`RESTORE VERIFYONLY`) y comprobar que es restaurable son tres pasos distintos (ver T-F1-BASE-05); un checksum válido no demuestra que el respaldo sea restaurable. Ninguna auditoría previa verificó un procedimiento de restauración real documentado | T-F1-BASE-05; transitivamente, toda tarea que module código o datos |
| D-BASE-02 (nueva) | ¿Qué mecanismo se usará para los datos de prueba controlados dentro de la misma base (convención de nombre/marca, cliente o producto de prueba dedicado, o transacción con reversión manual) sin contaminar reportes, comisiones o documentos FEL? | Sin un mecanismo explícito, una prueba de concurrencia o de integración podría dejar registros de prueba mezclados con datos reales en reportes (`dashboard.service.ts`), planilla (`planilla-mensual.service.ts`) o FEL | T-F1-BASE-02, T-F2-DIST-06, T-F4-INV-02 |
| D-BASE-03 (nueva) | ¿Qué constituye una "modificación masiva" prohibida frente a un cambio incremental aceptable? ¿Existe un umbral de filas u operación que distinga ambos casos? | La restricción del negocio prohíbe "modificaciones masivas", pero no define el límite; sin un criterio explícito, cada tarea de la matriz debe asumir el límite más conservador (cambios aditivos de esquema, sin reescritura de filas existentes) hasta que se defina | T-F1-BASE-06; toda tarea que proponga un cambio de esquema |
| D-BASE-04 (nueva) | ¿Quién tiene autoridad para aprobar la ejecución de un script SQL ya revisado antes de aplicarlo sobre la base de producción? | No existe hoy un procedimiento de aprobación documentado para migraciones; `prisma-migrate.js` ejecuta los comandos que se le indiquen, sin un paso de aprobación humana separado verificado en esta revisión | T-F1-BASE-06 |
| D-BASE-05 (nueva) | ¿Se ratifica la lista de tablas protegidas propuesta (`Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar`, `SolicitudPagoIdempotente`, `ReservaProforma`, `DevolucionComercial`, `Talonario`, campos FEL de `Venta`) o debe ampliarse (por ejemplo, ¿`MovimientoEnvase`/`EnvaseClienteSaldo` también deben protegerse por representar saldos históricos de cliente)? | La lista se derivó del esquema ya verificado en esta planificación; el negocio puede considerar que otros registros históricos (planilla, créditos de proveedor) también requieren el mismo nivel de protección | T-F1-BASE-07; toda tarea marcada con la regla de alto en la matriz |
| D-BASE-06 (nueva) | ¿Debe deshabilitarse o restringirse aún más la vía de escape `FLOWMANAGER_SQLSERVER_INTEGRATION=1`, que permite ejecutar las pruebas de integración existentes contra una base llamada literalmente `FlowManager` (en vez de `FlowManager_Test`)? | Verificado directamente en `route-flow.sqlserver.integration.spec.ts` y `sale-payment.rollback.integration.spec.ts`: ambas aceptan esta variable como permiso explícito para correr contra una base nombrada `FlowManager`. Si esa variable se activara por error sobre la conexión real, una prueba de integración escribiría sobre la base existente | [PLAN_PRUEBAS_INTEGRALES.md](./PLAN_PRUEBAS_INTEGRALES.md), sección 0 |

---


## Distribución

| # | Decisión pendiente (especificación 22.1-22.5) | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-DIST-01 | Política de inicio y finalización de una jornada | Determina si se crea el modelo `Jornada` (sección 4.1 de [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md)) o si basta con extender `RutaSesion`. Es la decisión de mayor impacto de esquema de todo este plan. | T-F2-DIST-01 y, en cascada, T-F2-DIST-02 a 09, T-F3-CAJA-01 |
| D-DIST-02 | Tratamiento de jornadas que continúan después de un cambio de vehículo | Determina si `RelevoVehiculo` cierra la `RutaSesion` saliente por completo o la deja en un estado intermedio "en relevo" | T-F2-DIST-03 |
| D-DIST-03 | Responsabilidad de inventario durante relevos | Determina si existe un periodo de responsabilidad compartida entre el vehículo saliente y el entrante, o si la transferencia debe completarse antes de habilitar ventas en el vehículo entrante | T-F2-DIST-03, T-F2-DIST-04 |
| D-DIST-04 | Autorización de transferencias | Determina si `TransferenciaVehiculo` requiere aprobación previa de un encargado o si cualquier chofer/vendedor con permiso `despacho:create` puede iniciarla | T-F2-DIST-04, T-F6-SEG-04 |
| D-DIST-05 | Confirmación de recepción de transferencias | El tratamiento del inventario mientras está `PENDIENTE` ya quedó resuelto como regla técnica (no disponible en ningún vehículo; ver [DISENO_TECNICO_DISTRIBUCION.md](./DISENO_TECNICO_DISTRIBUCION.md), sección 4.1). Lo que permanece pendiente es el flujo de autorización: ¿puede rechazarse una transferencia ya en tránsito? ¿hay un límite de tiempo para confirmar? | T-F2-DIST-04 |
| D-DIST-06 (nueva) | Verificado: ¿un segundo despacho sobre la misma sesión requiere que la devolución anterior esté cerrada, o puede despacharse mientras hay una devolución pendiente de conciliar? | El código actual (`createRouteReturn`) permite solo una devolución activa por sesión; con múltiples despachos debe decidirse si cada despacho tiene su propia devolución o si la devolución es acumulativa por sesión | T-F2-DIST-02, T-F2-DIST-05 |
| D-DIST-07 (nueva) | Verificado: ¿la comisión de una venta registrada después de un relevo se atribuye al vendedor que originó la venta o al que estaba activo en la sesión al momento del cierre de planilla? | `planilla-mensual.service.ts` lee `IdUsuarioVendedor` de la sesión activa en el momento de la consulta, no un histórico por venta | T-F2-DIST-03 (diseño de relevo debe decidir si "congela" el vendedor por venta) |

## Caja

| # | Decisión pendiente (especificación 22.6-22.8) | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-CAJA-01 | Política de apertura y cierre de caja | Determina si `CajaSesion` es obligatoria para toda `RutaSesion` o solo para las que manejan efectivo; determina también la cardinalidad respecto a `Jornada` si D-DIST-01 adopta ese modelo | T-F3-CAJA-01 |
| D-CAJA-02 | Responsables de arqueo y entrega de efectivo | Determina qué acción/permiso RBAC distingue "registrar movimiento" de "autorizar cierre" | T-F3-CAJA-05, T-F3-CAJA-06 |
| D-CAJA-03 | Tratamiento de diferencias de caja | Determina si una diferencia bloquea el cierre hasta justificarse, o si se permite cerrar con diferencia pendiente de investigación posterior | T-F3-CAJA-05 |
| D-CAJA-04 (nueva) | Verificado: ¿el gasto administrativo (`DetalleGasto` vía `Compra.EsGasto`) debe incluirse alguna vez en algún cálculo de caja (por ejemplo, una caja general de planta, distinta de la caja por vehículo)? | Hoy `DetalleGasto` no tiene `IdRutaSesion` ni campos de estado de pago; incluirlo requeriría cambios de esquema adicionales no contemplados en el diseño actual. **Esta decisión NO bloquea el inicio de la Fase 3**: por defecto `DetalleGasto` queda excluido del cálculo de efectivo esperado (T-F3-CAJA-08), que es un comportamiento seguro y reversible; si el negocio decide incluirlo más adelante, es una ampliación posterior del cálculo, no un rediseño del modelo de `CajaSesion`/`MovimientoCaja`. | T-F3-CAJA-08 (no bloquea T-F3-CAJA-01/02/03/05/06) |
| D-CAJA-05 (nueva) | Verificado: ¿debe existir una caja de planta (no asociada a ningún vehículo) para ventas directas de mostrador? | La especificación (sección 9.2.5) menciona "ventas directas deben afectar la ubicación de inventario correspondiente"; no se especifica si también requieren apertura/cierre de caja propia | T-F3-CAJA-01 (cardinalidad de `CajaSesion`) |
| D-CAJA-06 (nueva) | Verificado: cuando se registra el abono inicial de una venta a crédito en el momento de crearla, ¿se clasifica como "venta cobrada en efectivo" (parte del día) o como "cobro de crédito" (porque ya existe `CuentaPorCobrar`)? ¿Debe tratarse distinto de un abono posterior sobre una cuenta por cobrar de un periodo anterior? | `sale.service.ts` ya permite un abono inicial en venta a crédito que no exceda el total, registrado como `PagoVenta` en la misma operación que crea la `CuentaPorCobrar`; el diseño de `MovimientoCaja` (tipo `VENTA_CONTADO` vs `COBRO_CREDITO`) necesita una regla explícita para clasificar este caso sin ambigüedad y sin duplicar el ingreso | T-F3-CAJA-02, T-F3-CAJA-03 |
| D-CAJA-07 (nueva) | Verificado: ¿la reversión de un `MovimientoCaja` ante la anulación de su `PagoVenta`/`GastoVehiculo` origen, o ante la corrección de `GastoVehiculo.EstadoPago` de `PAGADO` a `PENDIENTE` (defecto de T-F3-CAJA-04), debe ser automática (cascada) o debe exigir una acción manual de conciliación por un responsable de caja? | Ninguna estructura actual define este comportamiento porque `MovimientoCaja` no existe; sin una regla explícita, una anulación de pago/gasto podría dejar un movimiento de caja "huérfano" que ya no corresponde a ningún origen activo, duplicando o inflando el efectivo esperado | T-F3-CAJA-02, T-F3-CAJA-09 |

## Producción

| # | Decisión pendiente (especificación 22.9-22.11) | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-PROD-01 | Criterios para registrar mermas de producción | Determina si la merma es un campo a nivel de orden completa o por componente/producto terminado, y si requiere clasificación (merma de proceso vs. merma de producto terminado) | T-F5-PROD-04 |
| D-PROD-02 | Identificación y numeración de lotes | Determina el formato de `NumeroLote`/`CodigoLote` y si debe ser único globalmente o por producto/fecha | T-F5-PROD-01 |
| D-PROD-03 | Tratamiento de órdenes pendientes cuando cambia una receta | El código actual ya revalida la receta activa completa al confirmar y rechaza si cambió la unidad de un componente o del producto terminado (`confirmProductionOrder`, verificado línea por línea). Debe **ratificarse** si este comportamiento ya implementado es el deseado, o si debe cambiar a permitir confirmar siempre con el snapshot original | T-F5-PROD-05 |
| D-PROD-04 (nueva) | Verificado: ¿la cantidad real producida puede ser mayor que la planificada (sobreproducción), o solo igual o menor? | Afecta la validación de `CantidadProducidaReal` en `confirmProductionOrder` | T-F5-PROD-02 |
| D-PROD-05 (nueva) | Verificado: cuando el producto terminado es un envase retornable, ¿la merma se clasifica como envase dañado (bucket `DANADO`) o como pérdida de producto? | `confirmProductionOrder` ya tiene un camino especial para productos retornables (llenado de buckets PLANTA); la merma debe decidir a qué bucket/estado se asigna | T-F5-PROD-04 |

## Seguridad y permisos

| # | Decisión pendiente | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-SEG-01 (nueva) | ¿Las 20 páginas sin `moduleKey` identificadas deben protegerse todas con la misma prioridad, o hay páginas (ej. `/analytics`, sin clave de módulo evidente) que requieren primero definir a qué módulo pertenecen? | `/analytics` no tiene una clave RBAC evidente en `rbac.ts`; debe decidirse si usa `resumen`, una clave nueva, o se considera de solo lectura general | T-F6-SEG-01 |
| D-SEG-02 (nueva) | ¿Debe crearse una acción RBAC específica "autorizar diferencia" para caja, o reutilizar `update`? | Afecta el diseño del permiso de T-F3-CAJA-05/06 | T-F3-CAJA-06, D-CAJA-02 |

## Ajustes e inventario

| # | Decisión pendiente (especificación 22.12) | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-INV-01 | Política de aprobación de ajustes de inventario | El código actual ya exige motivo y usuario en cada ajuste (`adjustment.service.ts`), pero no se identificó un paso de aprobación por un segundo usuario (doble validación); debe decidirse si se requiere | T-F4-INV-04 |
| D-INV-02 (nueva) | ¿La unicidad de `AjusteRuta` por sesión/artículo debe pasar a ser por despacho/artículo una vez que existan múltiples despachos? | Confirmado: `@@unique([IdRutaSesion, IdInventarioItem])` en el esquema actual asume un solo ajuste por artículo por sesión completa | T-F2-DIST-08, T-F4-INV-03 |
| D-INV-03 (nueva) | ¿La devolución comercial y su movimiento físico deben ser atómicos (una sola transacción) o pueden permanecer en etapas separadas con un estado visible de "pendiente"? | `createCommercialReturn` hoy crea el registro comercial sin garantizar el movimiento físico en la misma operación | T-F4-INV-01 |

## Reglas de alertas y notificaciones

| # | Decisión pendiente (especificación 22.13) | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-ALERT-01 | Reglas de alertas y notificaciones | No se identificó, en esta revisión, ningún motor de alertas configurable (`dashboard.service.ts` calcula métricas, pero no se verificó un mecanismo de umbrales/alertas); si se requieren alertas de caja, distribución o producción nuevas, deben diseñarse como parte de una fase posterior no cubierta en detalle por este plan | Fuera del alcance directo de F1-F7, pendiente de alcance futuro |

## Alcance de la primera entrega funcional (MVP)

| # | Decisión pendiente | Implicación técnica verificada en esta revisión | Bloquea |
|---|---|---|---|
| D-ALCANCE-01 (nueva) | ¿Se ratifica que la primera entrega funcional se limita a resolver los tres escenarios obligatorios de distribución (reabastecimiento, sustitución, transferencia) más la corrección puntual de `GastoVehiculo`, dejando caja, producción avanzada y la homologación general de seguridad/UX para una fase posterior? | [MATRIZ_TAREAS_TECNICAS.md](./MATRIZ_TAREAS_TECNICAS.md) (sección "Clasificación de alcance") propone esta separación como la agrupación técnicamente más defendible, pero es una propuesta sujeta a ratificación del negocio, no una decisión ya tomada | Define qué tareas se ejecutan en el primer incremento y cuáles quedan planificadas sin fecha |

---

## Resumen de decisiones bloqueantes para iniciar cada fase

| Fase | Decisiones que deben estar resueltas antes de iniciar el diseño de esquema definitivo |
|---|---|
| **Operación en producción (transversal, bloquea todo lo demás)** | D-BASE-01 (respaldo), D-BASE-02 (datos de prueba), D-BASE-03 (umbral de modificación masiva), D-BASE-04 (autoridad de aprobación de scripts), D-BASE-05 (ratificación de tablas protegidas), D-BASE-06 (escape hatch de pruebas de integración). Ninguna tarea que module código o datos puede iniciar su implementación hasta que D-BASE-01 esté resuelta. |
| Fase 2 (Distribución) | D-DIST-01, D-DIST-02, D-DIST-03, D-DIST-04, D-DIST-05, D-DIST-06, D-DIST-07 (atribución de comisión ante relevo; bloquea el diseño del servicio de relevo aunque no bloquee el modelo de `Jornada`) |
| Fase 3 (Caja) | D-CAJA-01, D-CAJA-02, D-CAJA-03, D-CAJA-05 (depende también de D-DIST-01), D-CAJA-06 (clasificación de abono inicial vs. cobro de crédito), D-CAJA-07 (política de reversión en cascada). **D-CAJA-04 NO bloquea** el inicio de la Fase 3: tiene un comportamiento por defecto seguro (excluir `DetalleGasto`) documentado en T-F3-CAJA-08. |
| Fase 5 (Producción) | D-PROD-01, D-PROD-02, D-PROD-03, D-PROD-04, D-PROD-05 |
| Fase 6 (Seguridad/UX) | D-SEG-01 (para la página `/analytics` específicamente; el resto de páginas ya tiene clave de módulo clara y no requiere decisión previa) |
| Fase 4 (Inventario complementario) | D-INV-01, D-INV-02, D-INV-03 |
| Alcance de entrega (transversal) | D-ALCANCE-01 — debe ratificarse antes de secuenciar el trabajo de implementación, no antes de terminar esta planificación |

Ninguna de estas decisiones se resolvió en este documento: se formulan explícitamente para que el negocio las responda antes de que la implementación comience, conforme a la regla fundamental de este encargo de no asumir automáticamente requisitos no especificados en el repositorio.
