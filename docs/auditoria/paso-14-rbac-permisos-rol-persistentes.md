# Paso 14 - Permisos persistentes por rol (funcional)

## Objetivo
Hacer operativo el modulo de Roles para asignar permisos reales por modulo/accion, eliminando dependencia exclusiva del fallback por nombre de rol.

## Backend

### Nuevos endpoints
- `GET /api/roles/:id/permisos`
  - Devuelve matriz completa de modulos y acciones con estado `permitido`.
- `PATCH /api/roles/:id/permisos`
  - Persiste permisos por rol con trazabilidad de usuario.

### Implementacion
- Rutas agregadas en `backend/src/routes/role.routes.ts`.
- Controladores agregados en `backend/src/controllers/role.controller.ts`.
- Servicio nuevo en `backend/src/services/role-permission.service.ts`.
- Validadores Zod nuevos en `backend/src/validators/role-permission.validators.ts`.

### Reglas aplicadas
- Soft delete en revocacion de permisos:
  - Se marca `RolPermiso.Anulado = true` y auditoria (`IdUsuarioAnulador`, `FechaAnulacion`).
- Restauracion logica en reactivacion:
  - Se reutiliza registro previo cuando existe, reactivando `Anulado = false`.
- Auto-catalogo:
  - Se asegura existencia de `ModuloSistema` y `AccionSistema` para toda la matriz CRUD.

## Frontend

### Edicion de roles
- Se agrego panel de permisos por modulo/accion en:
  - `frontend/app/roles/edit/[id]/page.tsx`
  - `frontend/app/roles/_components/role-permissions-card.tsx`

### Integracion API
- Servicios nuevos en `frontend/services/roles.service.ts`:
  - `getRolePermissions(id)`
  - `updateRolePermissions(id, payload)`
- Tipos nuevos en `frontend/types/roles.ts` para matriz de permisos.

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
- Backend build: OK.
- Backend tests: 42/42 en verde.
- Frontend build: OK.

## Impacto funcional
- Ahora el modulo Roles no solo crea/edita nombres, tambien asigna permisos reales consumidos por `requireModulePermission` en backend.
- Si existe configuracion persistida en `RolPermiso`, prevalece sobre fallback por nombre de rol.
