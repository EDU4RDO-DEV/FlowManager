# Paso 02 - RBAC persistente (modulo, accion, permiso)

Fecha: 2026-08-15

## Objetivo del paso
Migrar la autorizacion por modulo/accion de una matriz estatica en codigo a una fuente persistente en base de datos, conservando compatibilidad transicional.

## Cambios implementados

1. Middleware RBAC con evaluacion persistente
- Archivo: backend/src/middlewares/auth.middleware.ts
- Se agrego:
  - Modo RBAC_PERSISTED_MODE (fallback por defecto, strict opcional)
  - Verificacion de existencia de tablas de permisos
  - Verificacion de permisos activos persistidos
  - Evaluacion por IdRol + modulo + accion
- Comportamiento:
  - Si permiso persistente existe y permite: acceso
  - Si permiso persistente existe y deniega: 403
  - Si no hay configuracion persistente y modo fallback: aplica matriz legacy por nombre de rol

2. Modelo Prisma actualizado
- Archivo: backend/prisma/schema.prisma
- Se agrego:
  - ModuloSistema
  - AccionSistema
  - RolPermiso
  - Relaciones Rol <-> RolPermiso
  - Relaciones Usuario <-> RolPermiso
- Adicional:
  - EstructuraProducto agrega campos de auditoria IdUsuarioAnulador y FechaAnulacion

3. Script SQL maestro actualizado
- Archivo: Base de Datos - FlowManager.sql
- Se agrego:
  - DDL de ModuloSistema, AccionSistema, RolPermiso
  - FKs de RolPermiso hacia Rol, ModuloSistema, AccionSistema, Usuario
  - Indices de soporte y unicidad en permisos activos
  - Seed inicial de catalogos y permisos base equivalentes a matriz actual
  - Auditoria en EstructuraProducto

## Validacion tecnica

1. Pruebas backend
- Resultado: OK (7/7)
- Archivo de pruebas: backend/src/tests/auth-rbac.spec.ts

2. Compilacion backend
- Resultado: FAIL por error previo existente en validadores de ajustes
- Archivo: backend/src/validators/adjustment.validators.ts
- Error: firma z.enum con propiedad errorMap incompatible con version actual de Zod.

## Estado del paso
Paso 02 completado en alcance RBAC persistente.

## Riesgo pendiente fuera del paso
El error de compilacion en adjustment.validators.ts bloquea build global, pero no corresponde a los cambios RBAC de este paso.

## Siguiente paso planificado
Paso 03: endurecimiento de autenticacion y sesiones (validacion de sesion activa por sid, consolidacion de logout/revocacion y cobertura de pruebas adicionales).
