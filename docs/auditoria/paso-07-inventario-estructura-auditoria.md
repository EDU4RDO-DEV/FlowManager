# Paso 07 - Inventario: estructura de producto con auditoria y permisos por accion

Fecha: 2026-08-15

## Alcance ejecutado

1. Backend estructura de producto
- `deleteProductStructure(...)` ahora registra auditoria de anulacion:
  - `IdUsuarioAnulador`
  - `FechaAnulacion`
- `restoreProductStructure(...)` ahora limpia trazas de anulacion:
  - `IdUsuarioAnulador = null`
  - `FechaAnulacion = null`
- Validacion de usuario activo para operaciones de auditoria.

2. Controller + validators
- `product-structure.controller.ts` actualizado para usar `req.auth.userId` como fuente principal en anular/restaurar.
- Nuevos payloads Zod opcionales:
  - `idUsuarioAnulador`
  - `idUsuarioModificador`
- Mapeo de errores consistente (`400`, `404`, `500`).

3. Frontend estructura de producto
- Servicio actualizado para enviar payload de auditoria en delete.
- Tipos actualizados con payloads de delete/restore.
- Vista `inventory/[id]/structure` con permisos por accion:
  - crea solo con `inventario:create`
  - edita/restaura con `inventario:update`
  - anula con `inventario:delete`
- Guard de lectura por modulo: `RequireAuth moduleKey="inventario" action="read"`.

4. Pruebas
- Nueva suite: `product-structure.validators.spec.ts`.
- Casos: creacion minima, update vacio, cuerpos vacios con auth, ids de auditoria invalidos.

## Estado
Subpaso completado y alineado a directiva de borrado logico con auditoria por usuario autenticado.
