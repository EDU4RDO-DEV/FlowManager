# Paso 16 - Administración de Ventas

## Objetivo

Implementar el módulo **Administración de Ventas** de Industrias Basan como flujo comercial
completo (no como CRUD aislado), integrándose con la arquitectura existente: clientes,
inventario/bitácora, rutas/sesiones, crédito derivado, pagos, talonarios, FEL y comisiones.

Entrega **vertical por submódulo**: primero Ventas (back + front), luego Pagos, luego Talonarios.

---

## FASE 1 - Análisis de la implementación actual (COMPLETADO)

### Ya existe y se reutiliza sin cambios

- **Tablas de venta**: `Venta`, `DetalleVenta`, `PagoVenta`, `Talonario` ya definidas en
  `backend/prisma/schema.prisma` con todos los campos del alcance y relaciones a `Cliente`,
  `Usuario`, `RutaSesion`, `Talonario`, `InventarioItem`.
- **Inventario + bitácora**: `inventory-movement.service.ts` actualiza existencias y registra
  `BitacoraInventario` (patrón ya usado por Compras).
- **Rutas/sesiones**: `RutaSesion` con vendedor/chofer, vehículo y estados
  `PROGRAMADA / EN_CURSO / CERRADA` (`logistics.service.ts`).
- **Comisiones (integración pasiva ya resuelta)**: `planilla-mensual.service.ts` lee
  `DetalleVenta` filtrando por `Venta.Anulado=false`, `EstadoPago in PAID_STATES`,
  `EsBonificacion=false` y `RutaSesion` del vendedor/chofer del período.
  → **Ventas NO calcula comisiones**; solo debe poblar correctamente esos campos.
- **Patrones de código**: capas `service → controller → routes → validators (zod)`;
  autorización `requireModulePermission('modulo','accion')`; numeración correlativa
  `findFirst orderBy desc + 1`; borrado lógico `Anulado / IdUsuarioAnulador / FechaAnulacion`.
- **RBAC**: unión `BackendModuleKey` en `auth.middleware.ts`; falta agregar clave `ventas`.

### Vacíos reales detectados (se resuelven en Fase 3)

1. **Sin tabla de tipo de cliente ni reglas de precio.** `Cliente → Entidad` e `InventarioItem`
   tiene un único `PrecioVenta`. → Se creará estructura configurable (decisión aprobada).
2. **Sin tabla de reglas de bonificación por volumen.** Solo existe `DetalleVenta.EsBonificacion`.
   → Se creará motor de reglas configurable (decisión aprobada).
3. **Sin cuentas por cobrar y sin integración FEL.** El saldo se deriva
   (`Total − Σ pagos válidos`); FEL solo tiene campos de config en `Empresa` + ejemplos en
   `Info-Ecofactura/`. → Se implementará integración FEL real (decisión aprobada).

---

## FASE 2 - Dependencias

| Dependencia | Estado | Uso en Ventas |
|---|---|---|
| `Cliente` / `Entidad` | Existe | Cliente de la venta y datos de facturación |
| `InventarioItem` + `inventory-movement.service` | Existe | Descuento de existencias y bitácora |
| `RutaSesion` | Existe | Asociar venta a jornada (opcional) |
| `Talonario` | Existe (tabla) | Correlativos de recibo físico |
| `Usuario` + auth/RBAC | Existe | Vendedor y permisos |
| `planilla-mensual.service` | Existe | Consumidor pasivo de `DetalleVenta` |
| Tipo cliente + reglas de precio | **Nuevo** | Precio dinámico |
| Reglas de bonificación | **Nuevo** | Bonificación automática |
| Integración FEL (Eco-Factura) | **Nuevo** | Emisión/anulación de comprobantes |

---

## FASE 3 - Cambios de base de datos

> Un script SQL por cambio en `backend/scripts/` (fecha-descripcion.sql) + actualización de
> `schema.prisma` y del script base. `prisma generate` puede fallar por EPERM en Windows;
> no bloquea build/test.

### 3.1 Tipo de cliente + reglas de precio

- Nueva tabla `TipoCliente` (`Id`, `IdUsuario`, `Nombre`, `Descripcion`, auditoría/borrado lógico).
- `Cliente.IdTipoCliente` (nullable) → FK a `TipoCliente`.
- Nueva tabla `PrecioCliente` o `ReglaPrecio`
  (`Id`, `IdTipoCliente`, `IdInventarioItem`, `Precio`, vigencia opcional, auditoría).
- Regla de resolución de precio: `ReglaPrecio(tipoCliente,item)` → si no existe →
  `InventarioItem.PrecioVenta`.

### 3.2 Reglas de bonificación

- Nueva tabla `ReglaBonificacion`
  (`Id`, `IdInventarioItemComprado`, `CantidadMinima`, `IdInventarioItemBonificado`,
  `CantidadBonificada`, `Activo`, auditoría).
- La venta evalúa reglas y agrega líneas `DetalleVenta` con `EsBonificacion=true`,
  `PrecioUnitario=0`.

### 3.3 FEL

- Reutilizar campos existentes en `Venta` (`AutorizacionFel`, `NumeroFel`, `SerieFel`,
  `QrFel`, `FechaEmisionFel`, `NitFacturado`, `NombreClienteFacturado`,
  `DireccionClienteFacturado`).
- Config FEL vive en `Empresa` (`UsuarioFel`, `ContrasenaFel`, `ServidorFel`).
- Sin cambios de tabla adicionales salvo, de ser necesario, columnas de estado FEL
  (`EstadoFel`, `MotivoAnulacionFel`).

**Commit sugerido:** `feat(ventas): estructuras BD tipo cliente, reglas de precio y bonificacion`

---

## FASE 4 - Backend por submódulo

### Submódulo A - Ventas (núcleo transaccional)

Archivos (siguiendo convención):
`sale.service.ts`, `sale.controller.ts`, `sale.routes.ts`, `sale.validators.ts`.

**Servicio de resolución de precio** (`pricing.service.ts`): dado cliente + item + cantidad,
devuelve precio aplicable según `TipoCliente`.

**Servicio de bonificación** (`bonus.service.ts`): dado el detalle vendido, devuelve líneas
bonificadas según `ReglaBonificacion`.

**Crear venta — transacción `prisma.$transaction`:**
1. Validar cliente activo, ruta/sesión (si aplica) y talonario (si aplica).
2. Validar items existentes/activos y cantidades `> 0`.
3. Resolver precio por línea (pricing) y calcular bonificaciones (bonus).
4. Validar existencias suficientes (vendido + bonificado).
5. Calcular subtotal/total; determinar `CondicionPago` y `EstadoPago` inicial.
6. Generar `NumeroVenta` correlativo; reservar correlativo de talonario si aplica.
7. Crear `Venta` + `DetalleVenta` (guardando `PrecioUnitario` y `Nombre` congelados).
8. Descontar inventario y registrar salida en bitácora (por cada línea, incl. bonificación).
9. Registrar `PagoVenta` inicial si contado / abono si crédito.
10. Emitir FEL si `RequiereFactura` (Fase 6); persistir datos FEL.
11. Recalcular `EstadoPago` (`PENDIENTE / PARCIAL / PAGADO`) desde pagos válidos.
12. `COMMIT` / `ROLLBACK` ante error crítico.

**Estados y reglas:**
- `EstadoPago = TotalVenta − Σ(PagoVenta válidos)` → `PENDIENTE/PARCIAL/PAGADO`.
- Contado no debe quedar con saldo salvo regla explícita.
- Crédito genera saldo derivado (sin sistema paralelo de crédito).

**Anulación** (`POST anular`): `Anulado=true` + `IdUsuarioAnulador/FechaAnulacion`;
restaurar inventario (movimiento inverso en bitácora); recalcular saldo; anular FEL si emitido.

**Modificación**: bloquear si FEL emitido / pago registrado / ruta cerrada / entregado.
Si hubo movimiento de inventario, revertir y reaplicar.

Endpoints (adaptados a convención; base `/api/ventas`):
`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/anular`.

**Frontend Ventas** (ver Fase 5).

**Commit sugerido:** `feat(ventas): backend crear/listar/anular venta con precio, bonificacion e inventario`

### Submódulo B - Pagos

`payment.service/controller/routes/validators`. Endpoints:
`GET /api/ventas/:id/pagos`, `POST /api/ventas/:id/pagos`, `POST /api/pagos/:id/anular`.

Validaciones por método: `EFECTIVO` (sin referencia/banco), `TRANSFERENCIA`/`CHEQUE`
(referencia + banco), `POS` (referencia). Pago ≤ saldo pendiente. Recalcular `EstadoPago`.

**Commit sugerido:** `feat(ventas): backend pagos parciales con validacion por metodo y recalculo de saldo`

### Submódulo C - Talonarios

`talonario.service/controller/routes/validators`. Endpoints:
`GET /api/talonarios`, `GET /api/talonarios/:id`, `POST`, `PATCH`, `POST /:id/anular`.

Control de correlativos con concurrencia (transacción + verificación de rango):
siguiente = `UltimoUtilizado + 1`, sin duplicar ni exceder `CorrelativoFinal`.

**Commit sugerido:** `feat(ventas): backend talonarios con control de correlativos y concurrencia`

### RBAC

- Agregar clave `ventas` a `BackendModuleKey` (`auth.middleware.ts`) y validadores de permisos.
- Sembrar `ModuloSistema('ventas')` + acciones `read/create/update/delete/anular` y permisos.
- Montar routers en `app.ts` bajo `requireAuth` + `requireModulePermission('ventas', ...)`.

---

## FASE 5 - Frontend por submódulo

Ruta base `frontend/app/sales/` (o `ventas/`) + `frontend/services/sales.service.ts`.
Aplicar patrón UX estándar del proyecto: `loading.tsx`, `isLoading/hasLoadedOnce`, skeletons,
empty state con CTA, transición suave.

- **Nueva venta (pantalla tipo POS, no CRUD genérico):** buscador de cliente → tipo/condición
  automáticos → ruta/sesión opcional → grilla de productos con precio resuelto y subtotal →
  bonificaciones visibles como línea `BONIFICACIÓN` (Q0.00) → total → guardar.
- **Formulario de pago:** contado (Total/Pago/Cambio) y crédito (Total/Abono/Saldo).
- **Historial de ventas:** filtros (número, cliente, fecha, vendedor, ruta, condición, estado
  pago, estado entrega, FEL, anulada) y detalle (encabezado, detalle, pagos, saldo, FEL, ruta).
- **Pagos y Talonarios:** pantallas propias por submódulo.

**Commits sugeridos (por submódulo):**
- `feat(ventas): frontend pantalla de nueva venta e historial`
- `feat(ventas): frontend registro de pagos y cuenta por cobrar`
- `feat(ventas): frontend gestion de talonarios`

---

## FASE 6 - Integraciones

- **Inventario/bitácora:** vía `inventory-movement.service` (venta = salida; anulación = entrada).
- **Rutas:** persistir `IdRutaSesion`; validar sesión activa cuando aplique (sin GPS).
- **Comisiones:** integración pasiva; garantizar `EsBonificacion`, `EstadoPago` y `RutaSesion`
  correctos para que `planilla-mensual.service` los consuma.
- **FEL (Eco-Factura):** servicio `fel.service.ts` con firma/emisión y anulación usando
  `Info-Ecofactura/` (XSD `documento.xsd`, ejemplos XML, manual webservice). Alcance limitado a:
  emisión de comprobante de venta, anulación, y comprobantes de contado/abono. Persistir
  `Autorizacion/Numero/Serie/Qr/FechaEmision` y NIT/Nombre/Dirección facturados.

**Commit sugerido:** `feat(ventas): integracion FEL Eco-Factura para emision y anulacion`

---

## FASE 7 - Pruebas

Pruebas de servicio/integración con Vitest (patrón `backend/src/tests/`):

- Venta contado (pago completo, `EstadoPago=PAGADO`, saldo 0).
- Venta crédito sin pago (`PENDIENTE`) y con abono (`PARCIAL`).
- Abono posterior hasta saldar (`PAGADO`).
- Inventario: existencia antes/después + bitácora (venta y bonificación).
- Bonificación: líneas vendida + bonificada registradas.
- Talonario: siguiente correlativo, último, exceder rango, concurrencia.
- Anulación: venta anulada → inventario restaurado → saldo recalculado → bitácora inversa.
- RBAC: rutas protegidas por permiso `ventas`.

**Commit sugerido:** `test(ventas): pruebas de venta, pagos, talonarios y anulacion`

---

## Regla principal

No es un conjunto de CRUDs: es el flujo comercial completo respetando estructuras, relaciones,
autenticación, transacciones y convenciones ya existentes. Prohibido borrado físico (solo
lógico). Prioridad: consistencia con la arquitectura y reglas de negocio actuales.

---

## Validación por fase (a ejecutar al cerrar cada submódulo)

```bash
cd backend; pnpm build; pnpm test; cd ../frontend; pnpm build
```
