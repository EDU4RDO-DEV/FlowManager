# Decisiones de negocio pendientes

Este documento convierte en preguntas concretas las políticas que los informes A01–A06 dejan abiertas. No responde por el negocio ni transforma la ausencia de una regla en un defecto confirmado. Resolver solo mediante personas autorizadas; anotar decisión, responsable y fecha antes de usarla como requisito de implementación.

## Identidad, acceso y sesiones — A01

1. Al salir desde la UI, ¿se revoca solo la sesión actual o todas las sesiones del usuario? ¿Qué UX se espera si el servidor no confirma revocación?
2. ¿La anulación de usuario debe bloquear inmediatamente todas las peticiones ya autenticadas y revocar refresh/access de todas sus sesiones, o se acepta que access caduque por TTL?
3. Al anular un rol, ¿sus permisos dejan de autorizar de inmediato? ¿Debe exigirse reasignación de usuarios y qué efecto tiene restaurar el rol?
4. ¿Cuál es el procedimiento autorizado para que el primer usuario sea administrador: registro, seed separado, asignación manual u otro? ¿Cuándo puede volver a usarse registro si no hay usuarios activos?
5. ¿Cuál es la política de contraseña (mínimo, máximo, complejidad) y debe ser idéntica en registro, alta administrativa, edición, cambio y restablecimiento?
6. ¿Cambiar o restablecer una contraseña invalida otras sesiones?
7. ¿En cuánto tiempo deben surtir efecto una reasignación/degradación/elevación de rol y los permisos cambiados en sesiones activas?
8. ¿Una renovación de refresh simultánea desde pestañas debe aceptar una sola solicitud, devolver éxito a todas o coordinar las pestañas?
9. ¿Restaurar una sesión anulada debe volver a habilitar los refresh/access previos no vencidos, o solo restaurar el registro y requerir autenticación nueva?

## Clientes, crédito, ventas, pagos, talonarios y FEL comercial — A02

1. ¿Todo cliente debe tener tipo asignado? ¿Qué consumidores/procedimientos externos pueden asignarlo actualmente y qué ocurre mientras el tipo sea nulo?
2. ¿Qué significa cada campo de `TipoCredito`: plazo de vencimiento, incremento porcentual, requisito de camión y condiciones? ¿Cuándo es obligatorio y cómo se determina el límite monetario, vigencia y comportamiento de tipos inactivos?
3. Si se anula un pago de una venta de contado, ¿se reabre una deuda/cuenta por cobrar, se trata como devolución de efectivo, se anula la venta completa o se requiere otro proceso? ¿Quién lo autoriza y qué documento lo registra?
4. ¿Se aceptan abonos paralelos a una misma venta? ¿Qué respuesta debe recibir una solicitud que excede saldo una vez confirmada otra operación?
5. ¿Qué protocolo se requiere si FEL acepta una emisión/anulación y después falla SQL, o si hay timeout sin certeza del resultado remoto? ¿Cómo reconciliar/reintentar sin duplicar comprobante?
6. ¿Cambiar `RequiereFactura` después de crear una venta debe emitir, programar reintento, quedar prohibido o ser una acción independiente? ¿Existen consumidores externos de la ruta PATCH?
7. ¿Se permite retroceder `UltimoUtilizado` de un talonario? ¿Cuál es el proceso de corrección/anulación y el alcance único del correlativo frente a ventas históricas?
8. ¿Qué representa `PROFORMA`? ¿Reserva stock, acepta pago inicial, genera CxC o FEL? ¿Cómo y quién autoriza su conversión a venta?
9. ¿Está permitido enviar precio manual? ¿Quién puede sobrescribirlo, con qué límites/aprobación, descuentos, redondeo y tratamiento de error al resolver el precio por tipo de cliente?
10. ¿Qué transiciones de venta/pago/cartera constituyen una cancelación, devolución o reversa y cómo se concilian con inventario y efecto fiscal?

## Compras, inventario, movimientos, envases y unidades — A03

1. ¿Qué regla de concurrencia debe regir cuando dos compras, ajustes, ventas o movimientos de envase operan el mismo item? ¿Qué operación debe ganar/rechazarse y cómo se previene doble reversa?
2. ¿La factura debe ser única por proveedor? ¿La unicidad cubre compras anuladas/restauradas? ¿Cómo se asigna y reutiliza `NumeroCompra` y cuál es su ámbito?
3. Al anular/restaurar compra, ¿debe revertirse/recalcularse costo promedio considerando compras/ventas posteriores? ¿Cómo se resuelven costos históricos?
4. ¿Qué unidades y precisión se permiten para existencia, compra, ajuste, consumo y envase? ¿Se necesitan conversiones o reglas de redondeo?
5. ¿Se exige trazabilidad por lote, fecha de vencimiento, retención o retiro? ¿Qué procesos crean/consumen lotes?
6. ¿Un movimiento de envase debe relacionarse a venta, pedido o ruta/sesión? ¿Qué representa `RutaFirma` y cuándo debe capturarse?
7. ¿La estructura BOM es meramente catálogo o tiene una fórmula/versión efectiva? No inferir cantidad de producción ni consumo hasta contar con requisito autorizado.

## Rutas, entregas, flota y gastos vehiculares — A04

1. ¿Qué información acredita una entrega: persona, momento, ubicación, cantidad, evidencia, motivo de parcialidad o incidencia? ¿Qué roles ejecutan y corrigen cada transición?
2. ¿Qué estados/transiciones de sesión de ruta existen y qué significa cerrar, anular, restaurar o reabrir? ¿Puede editarse una sesión cerrada?
3. Si una sesión cerrada con ventas debe corregirse, ¿cómo conservar atribución histórica de empleado y período, quién aprueba y qué queda auditado?
4. ¿El mismo vehículo puede tener sesiones simultáneas en la misma fecha? ¿Hay restricciones equivalentes para chofer y vendedor? ¿Cómo se definen fecha/turno/zona de conflicto?
5. Al revertir un gasto `PAGADO` a `PENDIENTE`, ¿se limpia `FechaPago` o se conserva como historial? ¿Existe un registro/conciliación externa de pago al proveedor?
6. ¿Qué tipos de empleado pueden asignarse a chofer/vendedor? ¿Debe ocultarse todo empleado sin `IdUsuarioVinculado` o existe un procedimiento de vínculo anterior a asignación?
7. ¿Qué significa y quién actualiza el estado de vehículo cuando mantenimiento y sesiones activas difieren?

## Empleados, comisiones y planilla mensual — A05

1. ¿Qué empleados activos pertenecen a cada cálculo mensual? ¿Hay puestos sin comisión, ausencias, empleados incorporados/retirados a mitad de período o configuraciones sin regla?
2. ¿Se requiere realmente más de una configuración por empleado? Si sí, ¿qué significa configuración simultánea y cómo se decide precedencia?
3. ¿Qué constituye un grupo de productos para comisiones: categoría, lista configurable, familia u otro? ¿Reglas de producto y grupo se combinan, son alternativas o prevalece una? ¿Cómo se evita pagar dos veces la misma venta?
4. ¿Qué ventas son comisionables: estados de pago/entrega, fecha de venta o de ruta, anulaciones, abonos, devoluciones parciales y ventas sin sesión? ¿Qué fecha rige el período?
5. ¿Qué usuario/rol atribuye una venta al vendedor o chofer cuando sesión, empleado o vínculo cambian? ¿Deben congelarse esos datos al cierre de ruta o al generar planilla?
6. ¿Qué fuentes deben persistirse para explicar/reproducir una comisión (venta, detalle, regla/configuración, empleado, usuario, sesión, fecha efectiva)? ¿Cómo se corrigen cálculos ya cerrados?
7. ¿Una configuración de comisión anulada o sin regla debe bloquear todo el lote, producir cero, excluir al empleado o requerir resolución previa?
8. ¿Cuál es el proceso mensual requerido: quién prepara, valida, revisa, aprueba, genera y cierra? ¿Se permite generar sin preview? ¿Qué estados y bloqueos necesita el usuario?
9. ¿Los ajustes mensuales se aplican a una persona, a todas las seleccionadas o a un grupo? ¿Qué conceptos, signos, periodicidad y aprobaciones tienen?
10. ¿Al editar un borrador debe recalcular desde reglas/ventas actuales? ¿Los ajustes previos se conservan? ¿Qué hacer con planillas anuladas y cuántas versiones históricas admite cada período?

## Calidad, Empresa, FEL configurable, n8n y producción — A06

1. ¿El filtro de calidad debe aceptar solo año, solo mes y ambos, o rechazar combinaciones incompletas?
2. ¿Puede existir más de un control de calidad activo por fecha? ¿Qué significa restaurar y cómo se evita editar una medición después de validarla? ¿Se permite desvalidar/revalidar?
3. ¿Qué parámetros, unidades, rangos aceptables, frecuencia, calendario/no laborables, medidas y acciones se requieren para calidad? ¿Quién valida y qué registros bloquea?
4. ¿Las fechas “Inicio/Fin de vigencia FEL” son informativas, contractuales o controlan autorizar emisión? ¿Qué conducta se espera fuera del rango?
5. ¿Cuál es la fuente autorizada de configuración FEL (Empresa, entorno u otra) y qué reglas de transición/cambio de configuración aplican? Las pruebas futuras deben simular proveedor, no emitir comprobantes reales.
6. ¿Qué workflow n8n está vigente y qué eventos/payloads son contrato soportado? ¿La entrega de notificación es obligatoria, reintentable o solo informativa? ¿Qué rango de timeout se acepta?
7. **Producción/fabricación:** ¿Qué procesos existen y en qué secuencia (orden, preparación, ejecución, envasado, control, lote, liberación, cancelación/reproceso)? ¿Qué unidades, fórmulas, cantidades, rendimientos y desperdicios se aplican?
8. ¿Cómo se conectan órdenes/lotes con `EstructuraProducto`, consumos de materia prima, recepción de producto terminado, movimientos de stock/kardex y controles de calidad? ¿Qué trazabilidad, bloqueo, caducidad o retiro se exige?

La falta de respuesta a las preguntas de producción deja esa área como **especificación pendiente**; no es autorización para proponer fórmulas, cantidades, controles, envasado o reglas de fabricación.

## Cómo cerrar las decisiones

Para cada respuesta, guardar por el canal documental aprobado: pregunta/ID relacionado, responsable de negocio, decisión y fecha, alcance incluido/excluido, ejemplos o casos límite, actores/permisos, estados esperados y aprobador. Actualizar criterio de aceptación y plan de validación antes de implementar. Si una política permanece sin resolver, mantener el ítem bloqueado y no elegir un fallback implícito.
