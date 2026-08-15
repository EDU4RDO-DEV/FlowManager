# Paso 06 - Compras: restauracion y endurecimiento de validaciones

Fecha: 2026-08-15

## Alcance ejecutado

1. Backend compras
- Se agrego restauracion de compra anulada con endpoint `PATCH /api/compras/:id/restaurar`.
- Se agrego restauracion de gasto anulado de compra con endpoint `PATCH /api/compras/:id/gastos/:idGasto/restaurar`.
- Se reforzo auditoria usando `req.auth.userId` como fuente principal para restaurar.

2. Servicios backend
- `restorePurchase(...)` en `purchase.service.ts`:
  - valida compra anulada existente,
  - restaura estado logico de compra y detalles,
  - re-aplica stock en compras de inventario,
  - registra movimiento de inventario `COMRES`.
- `restorePurchaseExpense(...)` en `purchase.service.ts`.

3. Validadores y controlador
- Nuevos esquemas Zod:
  - `restorePurchaseBodySchema`
  - `restorePurchaseExpenseBodySchema`
- Nuevos controladores:
  - `restorePurchaseController`
  - `restorePurchaseExpenseController`

4. Frontend compras
- Servicio de compras actualizado con:
  - `restorePurchase(...)`
  - `restorePurchaseExpense(...)`
- Pantalla de compras actualizada:
  - boton de restaurar en pestaña de anulados,
  - guardado por permiso de accion (`compras:update`),
  - anular oculto si no hay permiso `compras:delete`.

5. Pruebas
- Nueva suite: `purchase.validators.spec.ts`.
- Casos de validacion cubiertos:
  - coherencia compra/gasto en payload,
  - cuerpos de restauracion,
  - rango de fechas en filtros.

## Estado
Subpaso completado. Pendiente siguiente tramo: extender restauracion/validaciones equivalentes al resto del bloque inventario-compras que aun no tenga cobertura completa.
