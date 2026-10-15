# Plan priorizado para futura implementación

**Base:** informes A01–A06 al commit `27f59fa024a804c468c434cfd504baa0b865a362`; propuesta documental, no autorización de ejecución.  
**Principio:** el orden global propuesto no cambia severidad original. Primero se resuelven decisiones y verificaciones capaces de cambiar el diseño; no se implementa una conjetura comercial/financiera/fiscal por evidencia estática aislada.

## Criterios de orden

1. Potencial de pérdida o inconsistencia de datos/stock/saldos y exposición de permisos.
2. Impacto financiero o fiscal, con verificación segura previa.
3. Operaciones repetibles, numeración y concurrencia.
4. Dependencias técnicas compartidas y posibilidad de aceptar la corrección.
5. Requisito empresarial aprobado, datos sintéticos y ambiente aislado disponibles.

No se asigna “crítico” porque las fuentes no documentan evidencia de ese nivel. Las categorías “validar primero”, “decisión de negocio” y “diseño previo” son estados de planificación, no nuevas severidades.

## Fases y tareas propuestas

### Fase 0 — Preparar decisiones, entorno de prueba y línea base

| Tarea | IDs originales | Responsable primario | Dependencias | Prioridad y motivo | Criterio de salida / validación |
|---|---|---|---|---|---|
| Confirmar el esquema efectivo, entorno aislado y seguridad operacional antes de reproducir cualquier operación | A01-001–008, A02-003–007, A03-001/002, A04-002/003, A05-002/005/006/007, A06-002/003 | Coordinación técnica; responsables de dominio | Acceso a SQL Server desechable; esquema Prisma, migraciones y SQL maestro cotejados | Bloqueador previo: ninguna fuente verificó DB desplegada ni autoriza operaciones reales. | Ambiente desechable identificado sin secretos en informe; datos sintéticos; verificado que pruebas no contactan FEL/n8n/servicios productivos; baseline reproducible. |
| Decidir semánticas que afectan alcance/aceptación antes de diseñar correcciones financieras, fiscales o de políticas | A01-001–006/008; A02-002/003/005/006/008/009; A03-001/002; A04-001/003/004; A05-001/002/004/006/007; A06-005 | Dueño de negocio con A01–A06 por área | Preguntas agrupadas en [decisiones pendientes](./14_DECISIONES_NEGOCIO_PENDIENTES.md) | Bloqueador para cambios dependientes de política; evita codificar supuestos. | Respuesta autorizada por decisión, alcance/actor/estado documentado y criterios medibles. Los hallazgos sin política no pasan a implementación. |

### Fase 1 — Validar y planificar integridad de identidad y sesión

| Tarea agrupada por causa raíz | IDs originales | Responsable primario | Dependencias | Prioridad y justificación | Criterios de aceptación propuestos | Validación y bloqueos |
|---|---|---|---|---|---|---|
| Unificar el contrato de revocación de logout, anulación de usuario y rol, bootstrap, política de contraseña y propagación de cambios de rol | A01-001, A01-002, A01-003, A01-004, A01-005, A01-006, A01-008 | A01 | Decisiones de sesión/rol/bootstrap/contraseña; todas las rutas protegidas | Alta prioridad por acceso, autorización y disponibilidad; algunas decisiones de negocio son condición previa, no cambiar guard por hipótesis. | Tras la política aprobada: logout invalida alcance definido; cuenta/rol inactivo no mantiene acceso no permitido; bootstrap ejecutable según runbook; credenciales aceptadas por alta pasan login; latencia del cambio de rol cumple SLA; restauración coincide con semántica definida. | Tests de integración aislados de login/refresh/logout, usuarios/roles, restauración y rutas representativas de varios módulos. Bloqueo: política, acceso a DB sintética y no usar datos/cuentas reales. |
| Hacer la rotación concurrente de refresh coherente y probar pestañas/sesiones | A01-007 | A01 | Contrato de refresh y almacenamiento frontend | Alta técnica por sesiones que pueden fallar intermitentemente; evidencia de carrera aún no reproducida. | Toda renovación exitosa deja token utilizable según contrato; solicitud perdedora recibe resultado explícito; no quedan dos respuestas exitosas con un refresh descartado ambiguamente. | Carrera sincronizada en SQL Server desechable y prueba de cliente concurrente; bloquear si no puede controlarse reloj/fixtures. |

### Fase 2 — Proteger saldo, stock y operaciones repetidas

| Tarea agrupada por causa raíz | IDs originales | Responsable primario | Dependencias | Prioridad y justificación | Criterios de aceptación propuestos | Validación y bloqueos |
|---|---|---|---|---|---|---|
| Asegurar concurrencia/idempotencia de movimientos de inventario y reversas manteniendo stock, documento y kardex coherentes | A03-001 | A03 | A02 por venta/anulación; A04 por envases; estrategia de esquema/transacciones; concurrencia SQL real | Muy alta por riesgo a existencia y bitácora, pero la carrera depende de aislamiento SQL no reproducido. Confirmar antes de alterar operaciones. | Cada operación simultánea aceptada aplica una vez; existencia final equivale a secuencia auditada de movimientos; una reversa no se aplica dos veces; rollback no deja stock sin kardex ni viceversa. | Barreras para operaciones concurrentes sintéticas en DB desechable; prueba de compras/ajustes/envases/anulación/restauración y consumidores venta; sin CRUD productivo. |
| Proteger unicidad y secuencia de compras/factura de proveedor | A03-002 | A03 | A03-001; regla de unicidad aprobada; esquema y migraciones coordinadas | Alta por posible duplicación de compra e impacto en stock. No fijar alcance de unicidad del número interno sin negocio. | Dos peticiones idénticas no crean duplicados bajo regla aprobada; números internos se asignan sin colisión; conflicto devuelve respuesta no engañosa y no duplica stock/kardex. | Carrera de solicitudes idénticas y distintas en SQL aislado, revisión de constraints efectivos y flujo de error. Bloqueo: decidir scope/retención de facturas anuladas y numeración. |
| Definir corrección de saldo/cartera tras anulación de pago contado | A02-003 | A02 | A02-004; política del tratamiento del dinero; posibles efectos A03 solo si se anula venta | Alta financiera; no implementar generación de deuda o reembolso basándose solo en estática. | Venta/pago/CxC/cartera concilian según política aprobada al anular un pago contado; ningún saldo queda invisibilizado; auditoría conserva causa y monto. | Fixtures aislados, comprobar balance de pagos/saldo/cartera; aprobación contable/negocio previa. No ejecutar pagos. |
| Validar sobrepagos concurrentes y establecer reserva/aislamiento de abonos | A02-004 | A02 | A02-003 y CxC/pagos; aislamiento de SQL Server | Media-alta por saldo financiero; sospecha estática parcial. | Total de pagos aceptados no excede saldo autorizado conforme a política; solicitudes concurrentes tienen una respuesta explícita, saldo/estado coherentes e idempotencia definida. | Dos abonos sincronizados en DB aislada y comprobación de suma persistida. No pagar fondos reales. |
| Proteger reuso de correlativos comerciales | A02-007 | A02 | Regla de administración del talonario; ventas y esquema | Media por integridad de numeración; debe validarse antes de cambiar cursor. | Un número ya usado no se reserva de nuevo salvo proceso de corrección autorizado; conflicto se hace visible; asociación venta-talón consistente. | Caso sintético crear venta → editar cursor hacia atrás → nueva reserva; validar almacenamiento efectivo. |

### Fase 3 — Resguardar operación de rutas y atribución de planilla

| Tarea agrupada por causa raíz | IDs originales | Responsable primario | Dependencias | Prioridad y justificación | Criterios de aceptación propuestos | Validación y bloqueos |
|---|---|---|---|---|---|---|
| Confirmar y garantizar reserva única de vehículo por fecha/sesión | A04-002 | A04 | SQL Server, estado derivado de vehículo y regla de sesiones | Media-alta operativa; carrera inferida, sin reproducción. | Bajo solicitudes concurrentes solo queda asignación permitida según la regla aprobada; vehículo/sesión no divergen. | Dos altas/ediciones sincronizadas en DB aislada; no asumir exclusividad de chofer/vendedor. |
| Definir cierre/corrección de ruta y conservar atribución reproducible de comisiones | A04-003, A05-004 | A04 (sesión); A05 (snapshot de cálculo) | A02 Venta, fechas/períodos, reglas A05; decisión de cierre y corrección | Alta para trazabilidad de nómina futura; el informe no muestra recálculo automático de cierres ni autoriza política. | Cambios post-cierre siguen política auditable; cálculos de borrador reproducibles y detalle identificable con ventas/reglas/persona/sesión según diseño aprobado; planilla cerrada no cambia inadvertidamente. | Escenario sintético venta/sesión/preview/borrador/cierre y corrección; verificar cada estado separado. Bloqueo: decisión empresarial sobre sesiones y valores efectivos. |
| Conectar flujo de confirmación y estado de entrega en UI/API con contrato de operaciones | A04-001 | A04 para UX logística; A02 para estado comercial | Venta A02, asignación de ruta, n8n solo si se define como notificación | Alta operativa, pero necesita política de entrega; no derivar entregado de un webhook. | Estado de entrega accesible a usuario autorizado, transición y datos parciales/incidencias definidos; evidencia guardada y notificaciones no sustituyen estado transaccional. | Pruebas UI/API sintéticas por transiciones, parcial, repetición/fallo de notificación. Bloqueo: responsabilidades y datos mínimos de entrega. |
| Corregir selección de usuario vinculado de empleados en logística | A04-005 | A04 | A05 relación laboral, A01 identidad | Media; mapeo de UI/backend confirmado. | UI ofrece solo vínculo laboral válido o conduce primero a vinculación; usuario/empleado visible y enviado coinciden. | Fixtures de empleado vinculado y no vinculado; prueba de payload y respuesta API. |
| Establecer invariante de estado/fecha de pago para gasto vehicular | A04-004 | A04 | Decisión sobre historial de fechas; diferenciar gasto proveedor | Media; fecha no equivale necesariamente a pago contable. | Estado y fecha reflejan el contrato aprobado; si se requiere historial, queda evento explícito sin ambigüedad. | Pruebas transiciones con/sin fecha; no tocar pagos reales. |

### Fase 4 — Hacer segura la preparación mensual y las reglas de comisión

| Tarea agrupada por causa raíz | IDs originales | Responsable primario | Dependencias | Prioridad y justificación | Criterios de aceptación propuestos | Validación y bloqueos |
|---|---|---|---|---|---|---|
| Añadir prevalidación del roster y diagnóstico accionable antes del cálculo mensual | A05-002 | A05 | A01 vínculo usuario; A04 roles de ruta; regla de elegibilidad y asignaciones | Alta porque hoy una ficha incompleta puede bloquear lote completo; implementación depende de qué empleados se incluyen. | Antes de preview/generate se informa a quién incluye/excluye y causa; no se generan importes silenciosamente con configuración faltante o anulada. | Fixtures de empleado elegible, sin vínculo, sin comisión, config anulada/sin regla. Bloqueo: política de inclusión. |
| Vincular preview vigente con generación y facilitar revisión entendible de todos los importes | A05-003 + mejora funcional mensual solicitada | A05 | A02/04 datos consumidos; diseño UX y ciclo de aprobación | Alta por generar sin revisar preview actualizado; mejora visual/funcional no altera fórmula sin requisito. | Cualquier cambio invalida preview; generación referencia el resultado vigente revisado; usuario puede entender totales/desglose/validaciones/estados de toda la población a generar. | Prueba de interacción al cambiar parámetros/ajustes y de flujo preparación→revisión→confirmación; definición de aprobadores queda abierta. |
| Preservar y auditar ajustes al editar/recalcular borradores, y definir su alcance | A05-006, A05-007 | A05 | A05-003 flujo de preview; decisión de ajustes por persona o grupo | Media financiera; no cambiar importe de ajuste sin regla aprobada. | PATCH parcial no elimina ajustes por efecto colateral; aplicabilidad a cada empleado visible y conforme a política; historial y recálculo predecibles. | Casos sintéticos de observaciones solo, ajuste individual/global, cambio de parámetros y persistencia. Bloqueo: semántica de ajustes. |
| Permitir historial/recuperación de planillas de forma compatible con política de anulaciones | A05-005 | A05 | Esquema/migraciones; política de retención/auditoría | Media; clave permite solo una fila anulada por período en esquema versionado. | Ciclo de anulación, regeneración y nueva anulación respeta unicidad acordada, conserva historial y devuelve conflictos controlados. | Reproducir secuencia completa en DB aislada; cotejar esquema real antes de migración. |
| Diseñar evolución de configuración múltiple de comisión por empleado y producto/grupo | A05-001 + necesidad solicitada de comisiones múltiples | A05 | A03 catálogo/productos; A02 ventas; A04 asignaciones; definición de duplicidad | Diseño previo, no corrección confirmada. | Reglas compatibles y trazables, asignación sin dobles aplicaciones, grupos y precedencia definidos, migración de configuración singular con estrategia acordada. | Prototipo de escenarios/reglas aprobado por negocio; pruebas de matriz casos antes de migrar. No asumir acumulación o unidades. |

### Fase 5 — Calidad, Empresa, FEL y notificaciones

| Tarea agrupada por causa raíz | IDs originales | Responsable primario | Dependencias | Prioridad y justificación | Criterios de aceptación propuestos | Validación y bloqueos |
|---|---|---|---|---|---|---|
| Asegurar integridad de registro diario de calidad en creación/restauración y validación/edición concurrente | A06-002, A06-003 | A06 | Esquema/SQL Server; comportamiento de anulados y revalidación | Media por integridad de control y aprobación; carreras no reproducidas. | No hay duplicidad activa para fecha según política; edición no puede alterar contenido validado sin transición/auditoría definida. | Carreras sincronizadas en DB aislada; verificar constraints y estados, nada en producción. |
| Alinear contratos de filtros de año/mes para calidad | A06-001 | A06 | Consumidores actuales/externos y API | Baja; rama de filtro confirmada, impacto UI no comprobado. | Parámetro parcial se aplica o se rechaza según contrato; tests de año, mes y ambos. | Unit + integración aislada; validar contratos consumidores. |
| Confirmar límite entre Empresa y emisión FEL y diseñar recuperación de efectos externos | A02-005, A02-006, A06-005 | A02 (venta/orquestación), A06 (configuración); coordinar conjuntamente | Decisiones fiscal/negocio; proveedor simulado; datos Empresa | Alta consecuencia fiscal, pero **no implementar por hipótesis estática**. | Fuentes de config, vigencias, cambio de bandera, emisión/anulación, rollback/reintento y resultado remoto incierto están explícitos y probados con simulador; comportamiento coincide con política aprobada. | No contactar proveedor real. Bloqueo obligatorio: negocio/contabilidad/fiscal y entorno aislado. |
| Validar configuración de timeout y estados de entrega n8n | A06-004 | A06 | Rango aprobado, eventos A02/A04 | Baja disponibilidad de notificación; no afecta transacción principal según informe. | Valores no válidos fallan explícitamente al cargar o enviar; timeout válido clasifica error; ningún error de webhook reportado como éxito. | Pruebas con `fetch` simulado/timer; no contactar workflow externo. |

### Fase 6 — Especificar producción antes de implementar

| Tarea | IDs originales relacionados (no defectos) | Responsable principal | Dependencias | Prioridad y justificación | Criterios de salida / bloqueos |
|---|---|---|---|---|---|
| Definir alcance de producción y fabricación, incluyendo órdenes, estados, consumo/recepción, lotes, trazabilidad, unidades, calidad, cancelación y vínculo a inventario | Sin ID de hallazgo; A03 estructura/BOM y A06 diagnóstico de placeholder | Negocio define proceso; A06 coordina, A03 valida impactos en stock | A03 `EstructuraProducto`; A06 calidad/Empresa; inventario, permisos, entidades y potencial FEL/ventas | Diseño previo; el flujo no está demostrado y no se debe etiquetar como defecto de una funcionalidad no especificada. | Especificación aprobada antes de diseñar schema/API/UI. No inferir fórmula, cantidad, control, rendimiento, envasado o regla de lotes. |

## Correcciones que pueden planificarse con evidencia suficiente

Pueden pasar a diseño técnico tras validar el entorno: alineación de validadores de contraseña (A01-005, condicionada solo al contrato de política); conexión de UI de logout a endpoint (A01-001, el alcance de revocación debe decidirse); diagnóstico del selector vinculado (A04-005); contrato de filtros A06-001; invalidación de preview A05-003. “Evidencia suficiente” no quita pruebas de aceptación ni autoriza escribir ahora.

## Correcciones que requieren validación técnica adicional

Concurrencia/atomía: A01-007, A02-004, A03-001/002, A04-002, A06-002/003. Integridad financiera/fiscal: A02-003/005/006/007. Trazabilidad/actualizaciones planilla: A05-004/005/006/007 y A04-003. Cada una requiere confirmar estado del motor, esquema desplegado, carreras controladas y fixtures; ninguna prueba debe tocar un ambiente operativo.

## Decisiones y mejoras que requieren diseño previo

- Política de sesión, roles, bootstrap y contraseña: A01-001–006/008.
- Semántica comercial/fiscal: A02-002/003/005/006/008/009, además de política de correlativos A02-007.
- Reglas de costo/stock, compras, unidad/lote/envases: A03 secciones de cuestiones pendientes.
- Entrega, cierre/corrección de ruta, gastos y alcance de usuario asignable: A04-001/003/004/005.
- Elegibilidad, grupo/acumulación de comisión, ajustes y aprobación mensual: A05-001/002/003/006/007.
- Validez de vigencia FEL, calidad y eventos remotos: A06-001–005.
- Producción: especificación completa requerida antes de proponer implementación integral.

## Bloqueos previos generales

1. No hay conexión/consulta de base desplegada ni ambiente SQL Server aislado verificado en estos informes.
2. No se comparó el esquema real, Prisma, migraciones y SQL maestro; no ejecutar migraciones hasta resolver autoridad.
3. No se inspeccionaron workflow n8n ni servicio FEL remoto; las pruebas deben ser simuladas.
4. Reglas de negocio/fiscal/planilla no disponibles o no confirmadas deben resolverse antes de cambiar comportamientos financieros.
5. Los informes no incluyen evidencia de pruebas ejecutadas durante esta consolidación; no declarar validaciones dinámicas.
