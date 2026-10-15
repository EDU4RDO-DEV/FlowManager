# Plan de auditorías especializadas paralelas

## Preparación común

Todos los grupos deben usar el mismo commit y leer primero:

- [00_RESUMEN_GENERAL.md](./00_RESUMEN_GENERAL.md)
- [01_INVENTARIO_MODULOS.md](./01_INVENTARIO_MODULOS.md)
- [03_MAPA_DEPENDENCIAS.md](./03_MAPA_DEPENDENCIAS.md)
- [04_ZONAS_COMPARTIDAS_Y_RIESGOS.md](./04_ZONAS_COMPARTIDAS_Y_RIESGOS.md)
- [06_CONTRATO_DE_AUDITORIA.md](./06_CONTRATO_DE_AUDITORIA.md)

Propuesta de seis grupos. Las asignaciones son unidades de investigación, no autorización de modificar archivos compartidos. Todos los grupos pueden consultar módulos vecinos para seguir un flujo, pero deben respetar un solo responsable primario por hallazgo.

## A01 — Identidad, acceso y sesiones

- **Módulos asignados:** autenticación, usuarios, roles, permisos y sesiones.
- **Alcance:** login/refresh/logout, asignaciones usuario-entidad/rol, permisos persistidos, guards backend/frontend, alta inicial y cambios de contraseña/sesiones.
- **Archivos y áreas:** `backend/src/routes/auth.routes.ts`, `user.routes.ts`, `role.routes.ts`, `session.routes.ts`; correspondientes controllers/services/validators; `auth.middleware.ts`, `role-permission.service.ts`; `frontend/app/(auth)/`, `users/`, `roles/`, `sessions/`, `frontend/lib/auth*`, `frontend/lib/rbac.ts`, componentes de auth.
- **Dependencias a consultar:** empleados y entidad; todas las rutas que exigen permisos; catálogo RBAC de Prisma y SQL. No auditar el comportamiento de los dominios consumidores salvo el control de acceso.
- **Límites/excluidos:** no auditar procesos de negocio de ventas, compras o planilla; no cambiar permisos, roles ni datos.
- **Entregables:** hallazgos sobre flujos de autenticación/autorización con evidencia de API y UI; inventario de endpoints, casos no cubiertos y discrepancias entre código/UI/catálogo.
- **Conflictos potenciales:** archivos comunes de middleware, claves de permiso y almacenamiento de auth. Coordinar si un hallazgo involucra otro módulo.
- **Finalización:** revisar todos los archivos listados de auth/RBAC, anotar los pendientes y probar/seguir documentalmente los flujos sin generar tokens/efectos en producción; completar contrato común.

## A02 — Clientes y ciclo comercial hasta el cobro

- **Módulos asignados:** clientes y catálogos de cliente/crédito; ventas/proformas; pagos; cuentas por cobrar; talonarios; precios/bonificaciones; FEL.
- **Alcance:** ciclo cliente → venta → pago/cartera → factura, reglas de condición comercial, numeración y anulaciones relacionadas.
- **Archivos y áreas:** `client.*`, `client-catalog.*`, `commercial-rule.*`, `sale.*`, `credit.*`, `talonario.*`, `fel.service.ts`; `frontend/app/clients/`, `frontend/app/sales/`, servicios y tipos relacionados; modelos Cliente, Venta, PagoVenta, CuentaPorCobrar, Talonario, reglas comerciales.
- **Dependencias a consultar:** M03 de inventario para stock; M04 de logística para RutaSesion; M05 de personal/comisiones; M06 de empresa/FEL config. Notificar cruces a los grupos dueños.
- **Límites/excluidos:** no auditar reportes ni dashboard; no emitir/anular comprobantes reales; no alterar reglas comerciales ni saldos.
- **Entregables:** diagramas de flujos venta/cobro/anulación, evidencia de transiciones y validaciones, requisitos pendientes para reglas fiscales/comerciales.
- **Conflictos potenciales:** `sale.service.ts`, pagos, CuentaPorCobrar, cliente/condición, RBAC y FEL son superficies compartidas. Solo este grupo registra el hallazgo raíz de venta/cobro y referencia dependencias.
- **Finalización:** seguir lectura/operaciones de alta, pago, crédito y anulación hasta sus efectos de inventario/FEL, registrar los límites no comprobados y cumplir el contrato.

## A03 — Inventario, compras, proveedores y envases

- **Módulos asignados:** inventario/productos, ajustes, kardex, estructura de producto, compras/gastos, proveedores y envases retornables.
- **Alcance:** catálogo de productos/insumos, stock, trazas, entradas de compra, gastos, préstamos/devoluciones de envases y saldo.
- **Archivos y áreas:** `product.*`, `adjustment.*`, `inventory-log.*`, `product-structure.*`, `purchase.*`, `provider.*`, `envase.*`; `inventory-movement.service.ts`; pantallas inventory, purchases, providers, envases; modelos InventarioItem, Compra/detalles, Proveedor, BitacoraInventario, AjusteInventario, EstructuraProducto, MovimientoEnvase, EnvaseClienteSaldo.
- **Dependencias a consultar:** ventas y descuentos a stock (A02); clientes/ventas para envases (A02); calidad si requisitos de control se vinculan a lotes (no demostrado).
- **Límites/excluidos:** estructura de producto no equivale a implementación de producción; fabricación se registra como pendiente y se comunica al grupo A06. Reportes de inventario quedan excluidos.
- **Entregables:** mapa de entradas/salidas/reversas, datos maestros involucrados, pruebas/reglas existentes y dependencias hacia venta/cliente.
- **Conflictos potenciales:** `inventory-movement.service.ts`, `InventarioItem`, `BitacoraInventario`, `Compra` y movimientos de envase. No modificar estos elementos.
- **Finalización:** investigar consumidores y operaciones de anulación/restauración, no declarar uso huérfano por búsqueda simple y listar código no revisado.

## A04 — Rutas, vehículos y operación logística

- **Módulos asignados:** rutas, sesiones, vehículos, gastos vehiculares y mantenimiento.
- **Alcance:** asignación de vendedor/chofer/vehículo, estados de ruta, kilometraje, gastos y mantenimiento.
- **Archivos y áreas:** `logistics.*`, `maintenance.*`; rutas `/api/logistics`; `frontend/app/logistics/`; modelos Ruta, RutaSesion, Vehiculo, GastoVehiculo, MantenimientoVehiculo.
- **Dependencias a consultar:** A02 para ventas/entregas asociadas a RutaSesion y comisiones; A03 por productos/envases transportados. Evitar duplicar su análisis.
- **Límites/excluidos:** no analizar dashboards de ruta o reportes; no asumir que estados documentados cubren toda la operativa empresarial.
- **Entregables:** mapa de estados y vínculos comprobados, ruta de gastos/mantenimiento e interrogantes sobre cierre/liquidación.
- **Conflictos potenciales:** RutaSesion y datos de usuario afectan ventas y planilla; reportar referencias cruzadas, no emitir conclusiones aisladas.
- **Finalización:** rastrear alta/cambio/cierre/anulación/restauración desde endpoint a persistencia y documentar evidencia pendiente.

## A05 — Personal, planilla y comisiones

- **Módulos asignados:** empleados, configuración/reglas de comisiones y planilla mensual.
- **Alcance:** vínculo empleado/usuario/entidad, cálculo por período, ajustes, previsualización, generación y cierre de planilla.
- **Archivos y áreas:** `employee.*`, `planilla-mensual.*`, `planilla-comision.*`; pantallas `frontend/app/employees/`, `payroll/`, `commissions/`; modelos Empleado, PlanillaMensual, PlanillaDetalleComision, PlanillaDetalleAjuste, ConfiguracionComision, ReglaComision.
- **Dependencias a consultar:** A02 para venta/detalle y estados que alimentan comisiones; A04 para vendedor/chofer y RutaSesion. Las consultas externas se siguen solo hasta comprobar el contrato de datos.
- **Límites/excluidos:** no recalcular períodos con datos productivos ni cerrar planillas; no declarar correcta una fórmula sin fuente de negocio.
- **Entregables:** evidencia de entradas y reglas codificadas, campos de cálculo/ajustes y discrepancias con requisitos disponibles.
- **Conflictos potenciales:** `planilla-mensual.service.ts`, reglas de comisión y cualquier cambio en atributos de Venta/RutaSesion/Empleado. No editar.
- **Finalización:** listar las fuentes de cada cálculo observado, períodos y restricciones, y separar fórmula implementada de expectativa pendiente.

## A06 — Calidad, empresa y áreas sin flujo demostrado

- **Módulos asignados:** control de calidad, configuración de empresa y verificación del estado de producción/integraciones compartidas.
- **Alcance:** registros/validaciones de calidad y su trazabilidad; campos/lectura de empresa; confirmar límites de la pantalla de producción, BOM, FEL config y n8n sin auditar servicios de los grupos dueños.
- **Archivos y áreas:** `quality.*`, `company.*`, `frontend/app/quality/`, `frontend/app/company/`, `frontend/app/production/page.tsx`, `backend/src/services/fel.service.ts` (solo config si no asignado a A02), notificaciones y documentación de integración.
- **Dependencias a consultar:** A02 para uso de configuración FEL; A03 para item/estructura de producto; documentación técnica de n8n. No asumir que servicios externos estén configurados.
- **Límites/excluidos:** dashboards/reportes; no probar FEL contra producción ni cambiar empresa, webhook o datos; no declarar producción como defecto sin requisitos y evidencia de alcance.
- **Entregables:** inventario de controles de calidad y empresa; discrepancias/campos sin propósito documentado; clasificación explícita de producción e integración como confirmado/parcial/pendiente.
- **Conflictos potenciales:** configuración compartida de empresa/FEL y servicios de notificación. Coordinación obligatoria antes de atribuir un hallazgo fiscal o externo.
- **Finalización:** demostrar qué está conectado en código, revisar requisitos disponibles y registrar lo que no pudo verificarse con causa.

## Protocolo para cruces de responsabilidad

- El módulo asignado es el dueño del hallazgo primario; registrar módulos consumidores y enlaces a evidencia, no duplicar hallazgos.
- Si el hallazgo toca una superficie compartida (`schema.prisma`, middleware RBAC, movimiento de inventario, transacción de venta, Axios/auth, configuración FEL), notificar al coordinador y a cada grupo afectado.
- Un grupo puede leer módulos ajenos para reconstruir un flujo, pero no ampliar su alcance a una segunda auditoría completa sin acuerdo del coordinador.
- El hallazgo se consolida por consecuencia funcional, no por archivo o por cada consumidor.

## Condiciones para iniciar la fase paralela

1. Acordar commit/hash de referencia y ventana de trabajo de solo lectura.
2. Confirmar que cada grupo acepta el contrato de [06_CONTRATO_DE_AUDITORIA.md](./06_CONTRATO_DE_AUDITORIA.md).
3. Nombrar coordinador de identificadores de hallazgos y responsable de superficies compartidas.
4. Confirmar con negocio los requisitos no contenidos en el repositorio y proporcionar esos documentos a los grupos.
5. Excluir explícitamente reports/dashboard/analytics en cada instrucción especializada.
