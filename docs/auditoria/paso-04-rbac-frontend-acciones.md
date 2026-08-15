# Paso 04 - RBAC frontend por accion

Fecha: 2026-08-15

## Objetivo
Aplicar autorizacion por accion en frontend (read/create/update/delete) para evitar mostrar o habilitar operaciones no permitidas por rol.

## Cambios implementados

1. Capa RBAC por accion
- Archivo: frontend/lib/rbac.ts
- Se agrego:
  - Tipo CrudAction
  - Matriz de acciones por rol y modulo
  - Funcion hasModulePermission(nombreRol, moduleKey, action)
- getAllowedModulesByRole ahora deriva de permiso read.

2. Guard de rutas con permiso
- Archivo: frontend/components/require-auth.tsx
- Se agrego soporte opcional a:
  - moduleKey
  - action (default read)
- Si el usuario autenticado no tiene permiso requerido, redirige a '/'.

3. Modulo Usuarios
- Archivos:
  - frontend/app/users/page.tsx
  - frontend/app/users/_components/users-table.tsx
  - frontend/app/users/create/page.tsx
  - frontend/app/users/edit/[id]/page.tsx
- Cambios:
  - Guard por modulo/accion en rutas
  - Bloqueo de crear/editar/reset/anular/restaurar por accion
  - Mensajes de error cuando se intenta ejecutar accion sin permiso

4. Modulo Roles
- Archivos:
  - frontend/app/roles/page.tsx
  - frontend/app/roles/create/page.tsx
  - frontend/app/roles/edit/[id]/page.tsx
- Cambios:
  - Guard por modulo/accion en rutas
  - Bloqueo de crear/editar/anular/restaurar por accion

5. Modulo Sesiones
- Archivo: frontend/app/sessions/page.tsx
- Cambios:
  - Guard por modulo read
  - Bloqueo de anular/restaurar por accion

## Validacion
- Build frontend: OK
- next build completo sin errores de tipo ni de compilacion para los cambios aplicados.

## Estado del paso
Paso 04 completado en alcance critico (users, roles, sessions) con autorizacion por accion en frontend.
