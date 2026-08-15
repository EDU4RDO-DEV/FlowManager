# Paso 15 - Unificacion de datos de Usuario y Proveedor

## Objetivo
- Permitir que Crear/Editar Usuario manejen los mismos datos de perfil (incluyendo entidad).
- Eliminar duplicidad entre `Usuario.Nombre` y `Entidad.NombreCompleto` en formulario (un solo campo en UI).
- Eliminar redundancia `Proveedor.Nombre` y usar solo `Entidad.NombreCompleto` como fuente de verdad.

## Cambios aplicados

### Usuarios
- Formulario `users` unificado para crear/editar con los mismos campos de entidad:
  - sexo, fechaNacimiento, telefono1, telefono2, correoElectronico, nit, dpi.
- Se removio el campo duplicado de UI `entidadNombreCompleto` (`entity-full-name`).
- El nombre principal del usuario ahora sincroniza `Entidad.NombreCompleto`.
- `GET /api/users/:id` ahora retorna bloque `entidad` para precargar edición.
- `PATCH /api/users/:id` ahora acepta `entidad` y persiste cambios en tabla `Entidad`.

### Proveedores
- Se removio el campo redundante de entrada `nombre` en create/update de proveedor.
- `Proveedor` ahora usa solo `Entidad.NombreCompleto` como nombre funcional.
- DTO mantiene `nombre` por compatibilidad, derivado desde `Entidad.NombreCompleto`.
- UI de proveedores removio "Nombre comercial" y trabaja con un solo nombre.

### Compras e Inventario
- Ajuste de mapeo para nombre de proveedor desde `Entidad.NombreCompleto`.
- Filtro de busqueda de compras por proveedor actualizado a `Proveedor.Entidad.NombreCompleto`.
- Compatibilidad transitoria en DTOs para tests/mocks antiguos sin `Entidad`.

### Base de datos
- Script base actualizado para quitar columna `Nombre` de tabla `Proveedor`.
- Prisma schema actualizado para quitar `Proveedor.Nombre`.
- Script de migracion para BD existente:
  - `backend/scripts/2026-11-02-drop-proveedor-nombre.sql`

## Validacion tecnica
Comandos ejecutados:

```bash
cd backend
pnpm build
pnpm test

cd ../frontend
pnpm build
```

Resultado:
- Backend build: OK
- Backend tests: 42/42 OK
- Frontend build: OK

Nota:
- `pnpm exec prisma generate` volvio a presentar EPERM por DLL bloqueada en Windows (no bloquea build/test en este estado, pero se recomienda ejecutarlo cuando el archivo quede liberado).
