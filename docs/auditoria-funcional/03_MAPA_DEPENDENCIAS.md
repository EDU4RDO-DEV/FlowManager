# Mapa de dependencias entre módulos

## Cómo leer este mapa

- **Comprobada:** existe referencia explícita en servicio, modelo, ruta o flujo de código observado.
- **Documentada:** descrita en documentación versionada, pero no se comprobó todo el comportamiento del flujo.
- **Pendiente:** hay indicios de relación o una expectativa funcional que requiere más evidencia.

Una dependencia técnica comprobada no confirma que el proceso cumpla su requisito de negocio. Las reglas esperadas que no cuentan con requisito/código suficiente deben registrarse como pendientes y confirmarse con el negocio.

## Matriz de dependencias

| Origen | Consumidor | Dato / vínculo | Mecanismo y evidencia técnica | Certeza | Riesgo de cambio sin coordinación |
|---|---|---|---|---|---|
| Autenticación / Usuario / Sesión | Rutas protegidas de todos los dominios | JWT, usuario y sesión activa | `auth.middleware.ts`; `app.ts` monta `requireAuth` en routers. | Comprobada | Un cambio de claim, sesión o token afecta toda la API y el refresh/logout del frontend. |
| Rol / módulo / acción | Rutas de dominio | Permiso `read/create/update/delete` | `role-permission.validators.ts`, `auth.middleware.ts`, `role-permission.service.ts`, modelos RBAC. | Comprobada | Divergencia entre claves backend, frontend, catálogo persistido y permisos desplegados puede bloquear/abrir operaciones. |
| Cliente / Entidad | Venta | Identidad, nombre/NIT y tipo de cliente | `sale.service.ts` busca cliente activo y datos de entidad; `Venta` se relaciona con `Cliente`. | Comprobada | Cambio a identidad/entidad afecta ventas, facturación, créditos, envases y búsquedas. |
| Cliente / condición / tipo de crédito | Cuenta por cobrar / Venta | Habilitación y vigencia; tipo aplicado | `sale.service.ts` consulta condición vigente; `CuentaPorCobrar` y relaciones de Prisma. | Comprobada | Cambios de vigencia afectan creación y estado de venta a crédito y la cartera. |
| Cliente / tipo de cliente / regla de precio | Venta | Precio aplicable por producto/cliente | Modelos `TipoCliente`, `ReglaPrecioCliente`; código de ventas incluye resolución de precios (`GET /api/ventas/precio`). | Comprobada a nivel de API/modelo; alcance completo de regla por verificar | Alterar prioridad, vigencia o fallback cambia montos y factura. |
| Regla de bonificación / producto | Venta / línea de detalle / FEL | Producto/quantidades bonificadas y líneas de venta | `ReglaBonificacion`, `DetalleVenta`; endpoint de previsualización `/api/ventas/bonificaciones/preview`; `fel.service.ts` trata líneas bonificadas. | Comprobada a nivel de entidades/endpoints; regla funcional requiere auditoría | Una regla inconsistente se replica en stock, total y documento fiscal. |
| Venta / DetalleVenta | Inventario / bitácora | Salidas de stock por venta y bonificación | `sale.service.ts` importa `registerInventoryMovement`; `inventory-movement.service.ts` registra `BitacoraInventario`; esquema relaciona líneas con items. | Comprobada | Cambios de formato de documento, anulación o cantidades pueden dejar desalineados stock y kardex. |
| Compra / DetalleCompra | Inventario / bitácora | Entradas de stock, cantidades y costos | `purchase.service.ts` importa `registerInventoryMovement`; compra referencia proveedor e items. | Comprobada | Debe coordinarse con inventario y ajuste/anulación/restauración. |
| Venta / pagos | Cuenta por cobrar | Total pagado, saldo y estado | `credit.service.ts` deriva abonado a partir de pagos válidos y delega altas/anulaciones a funciones de `sale.service.ts`; modelos `CuentaPorCobrar`, `PagoVenta`, `Venta`. | Comprobada | Cambios de exclusión/anulación afectan saldo, cierre de crédito y ventas. |
| Venta | FEL | Receptor, artículos, importes, autorización/serie/número y anulación | `sale.service.ts` importa `emitFelInvoice` y `anulateFelInvoice`; `fel.service.ts`; campos FEL de `Venta`; configuración documentada en `backend/README.md`. | Comprobada técnicamente; validez fiscal/configuración real por verificar | Cambios de venta o receptor pueden causar inconsistencias fiscales y efectos externos irreversibles. |
| Venta | Ruta / sesión de ruta / vendedor | Asociación y estado de ruta | `Venta` relaciona con `RutaSesion`; `sale.service.ts` valida que la sesión exista y no esté cerrada; `logistics.service.ts` gestiona sesión. | Comprobada | Cambios de estado, cierre o asignación de vendedor/chofer repercuten en ventas y comisiones. |
| RutaSesion / vehículo / proveedor | Gastos vehiculares y mantenimiento | Ruta, vehículo, proveedor, importe y estado de pago | `GastoVehiculo`, `MantenimientoVehiculo`, rutas de logística y mantenimiento. | Comprobada en modelos/API; regla contable/flujo de aprobación pendiente | Cambio de ids/estados afecta logística y posibles reportes (estos últimos excluidos). |
| Cliente / venta / item ENVASE | Movimiento de envase / saldo | Préstamo/devolución y saldo por cliente/item; venta opcional | `envase.service.ts` valida cliente/venta, categoría `ENVASE`; modelos `MovimientoEnvase`, `EnvaseClienteSaldo`. | Comprobada | Cambios en categoría, stock o referencia a venta pueden afectar simultáneamente inventario y saldo retornable. |
| Ventas / rutas / productos | Planilla / comisión | Venta/detalle, persona, período y regla comisionable | `planilla-mensual.service.ts` consulta estructuras de ventas/ruta; modelos de comisión y planilla. La bitácora `docs/auditoria/paso-16-administracion-ventas.md` también describe al servicio como consumidor de ventas. | Comprobada a nivel de código; criterios actuales de elegibilidad por verificar | Cambios en atributos/estados de venta y relación vendedor/chofer afectan cálculo de remuneración. |
| Eventos de venta/logística | n8n | Evento y datos serializados | `notification.service.ts` declara eventos; servicios invocan `send`; `n8n-webhook.client.ts` ejecuta HTTP. | Comprobada para envío backend; recepción/efecto remoto pendiente | Cambiar nombres/payloads rompe consumidores externos no incluidos en el repositorio. |
| Producto terminado / estructura de producto | Producción | Componentes/BOM sugerirían insumos y producto final | Modelo `EstructuraProducto`, endpoints `/api/product-structure` y pantalla placeholder `frontend/app/production/page.tsx`. | Relación esperada, no demostrada como flujo de producción | No implementar operaciones de fabricación suponiendo que el BOM sea un sistema de órdenes/lotes. |
| Empresa / configuración FEL | Venta / FEL | Datos del emisor, entorno y credenciales | `Empresa`, `company.service.ts`, `fel.service.ts`; variables documentadas en `backend/README.md`. | Parcial: campos y lectura de configuración existen; fuente exacta y valores desplegados por verificar | Cambio de configuración repercute en emisión fiscal; secretos deben coordinarse por canal seguro. |

## Flujos observados y cuestiones por comprobar

### Venta, cobro y cuenta por cobrar

El backend registra ventas con cliente, detalles, condición de pago, estado, pagos y posibles referencias a ruta/talonario. Las operaciones de crédito exponen cartera y reutilizan funciones de pago de venta; el servicio calcula abonado con pagos no anulados. La validación de habilitación crediticia aparece en `sale.service.ts`. La auditoría especializada debe confirmar consistencia de cálculos y transiciones con requisitos de negocio, no solo con los valores actuales del código.

### Venta e inventario

Ventas y compras importan el servicio común de movimiento de inventario. Ese helper crea entradas de bitácora y admite anular/restaurar movimientos por referencia. Confirmar durante la auditoría cuándo se actualiza la existencia, cómo se revierte y si cada camino mantiene la misma transacción; esta exploración no verificó todos los caminos de escritura.

### Compra y gasto

Las compras se asocian con proveedor y pueden tener detalle de inventario o detalle de gastos. El frontend presenta páginas de compra y gastos. La existencia de ambos tipos en `Compra` no demuestra que compartan reglas contables; investigar por separado los requisitos.

### Venta, entrega y ruta

La venta puede referir `RutaSesion`, y el servicio comprueba estado de sesión al operar. Logística administra vehículo, ruta, chofer/vendedor y estado de ruta. Confirmar quién puede crear/editar durante estados particulares y la relación exacta con entrega real.

### Venta y factura electrónica

Hay integración de emisión/anulación en código de servicio y campos FEL en `Venta`; el README especifica configuración sandbox/producción. Una prueba de presencia de endpoint no certifica integración real con un proveedor ni correspondencia con normativa vigente. No realizar emisiones reales durante la auditoría.

### Envases y clientes

El servicio valida que el item sea de categoría `ENVASE`, permite referencias opcionales a venta y expone movimientos/saldos. Las reglas de saldo, stock, devolución parcial, pérdida y conciliación no deben inventarse: marcar y preguntar cuando no exista evidencia.

### Producción

No se comprobó el flujo de `materia prima → orden/lote → producto terminado → inventario`. Solo se encontraron estructuras de producto en inventario y una página de producción-placeholder. Tratar el proceso como **pendiente de verificación**, no como funcionalidad implementada ni como defecto confirmado.

## Datos centrales y contratos a preservar

Los modelos más conectivos observados son `Usuario`, `Entidad`, `Cliente`, `InventarioItem`, `Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar`, `RutaSesion` y `Empleado`. Los servicios/contratos compartidos son `auth.middleware.ts`, `inventory-movement.service.ts`, `sale.service.ts`, los validadores de RBAC, el cliente Axios del frontend y el webhook n8n.

Antes de concluir sobre un campo, investigar consumidores directos e indirectos, includes/joins Prisma, servicios comunes, payloads frontend, cargas dinámicas y el script/esquema SQL. Una búsqueda textual simple no prueba que esté huérfano.
