# Backend FlowManager - Industrias Basan

Backend Node.js + TypeScript para modulos criticos de autenticacion, control de acceso y operaciones base de la plataforma.

## Stack

- Node.js + Express
- TypeScript 5.6.3
- Prisma ORM 6.16.2
- SQL Server (host/puerto, ejemplo: `PCMASTER:1433`)
- JWT + bcrypt
- Vitest + Supertest

## Scripts

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm test
pnpm run test:watch
```

## Base de datos y migraciones

El unico mecanismo oficial de cambios de esquema es **Prisma Migrate** (`prisma/migrations/`).
No se usa `prisma db push` en ningun flujo (dev, CI ni documentacion): toda migracion debe
quedar registrada como archivo versionado para poder auditarla y reproducirla.

Flujo estandar para un cambio de esquema:

```bash
pnpm exec prisma migrate dev --name descripcion_del_cambio
```

Para reglas que Prisma no expresa en `schema.prisma` (CHECK constraints, indices unicos
filtrados con `WHERE`), el flujo es:

```bash
pnpm exec prisma migrate dev --create-only --name descripcion_del_cambio
# editar a mano prisma/migrations/<timestamp>_descripcion_del_cambio/migration.sql
pnpm exec prisma migrate dev
```

En Windows, si el backend esta corriendo (`ts-node-dev`), este bloquea
`query_engine-windows.dll.node` y la migracion falla con `EPERM` al regenerar el cliente.
Detener el proceso antes de migrar y volver a levantarlo despues (`pnpm run dev`).

Los scripts sueltos en `backend/scripts/*.sql` son parches manuales previos a la adopcion
de Prisma Migrate. Quedan congelados como referencia historica; no se ejecutan ni se amplian.

`npx prisma migrate status` debe reportar siempre `Database schema is up to date!` antes de
cerrar una fase de trabajo.

## Variables de entorno minimas

```env
DATABASE_URL="sqlserver://USER:PASSWORD@PCMASTER:1433;database=FlowManager;encrypt=true;trustServerCertificate=true"
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ISSUER="flowmanager.api"
JWT_AUDIENCE="flowmanager.web"
JWT_ACCESS_EXPIRES_IN_MINUTES="480"
JWT_REFRESH_EXPIRES_IN_DAYS="7"
BCRYPT_SALT_ROUNDS="12"
```

## Seguridad implementada

### Autenticacion

- Login con validacion de credenciales y password hasheado con bcrypt.
- Emision de Access Token + Refresh Token.
- Rotacion de refresh token en endpoint de refresh.
- Revocacion de refresh token puntual y revocacion global de sesiones por usuario.

### JWT hardening

- Verificacion de algoritmo `HS256`.
- Verificacion de `issuer` y `audience`.
- Verificacion de `tokenType` (`access` para rutas protegidas).

### Sesiones

- `Sesion.TokenSesion` se guarda hasheado con SHA-256.
- No se expone `TokenSesion` en respuestas API.
- Indices de rendimiento en `Sesion`:
  - `IX_Sesion_Usuario_Activo_Expira` (`IdUsuario`, `Anulado`, `FechaExpiracionToken`)
  - `IX_Sesion_Token_Activo` (`TokenSesion`, `Anulado`)

### RBAC

- RBAC por modulo/accion (`read`, `create`, `update`, `delete`).
- Middleware `requireModulePermission(module, action)`.
- Matriz de permisos centralizada por grupos de rol.

### Validacion y errores

- Validacion de entrada con Zod en flujos criticos (`auth`, `sessions`).
- Middleware global de errores.
- Manejo controlado para JSON malformado (400).

## Endpoints criticos

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/register` (libre solo en bootstrap)
- `PATCH /api/auth/users/:idUsuario/assignment`

## Pruebas de integracion

Archivo: `src/tests/auth-rbac.spec.ts`

Cobertura critica actual:

- 401 sin token en ruta protegida
- 403 por rol sin permiso
- 401 con refresh invalido
- 404 al revocar refresh invalido
- 401 usando refresh token como bearer
- 400 con JSON malformado

Ejecucion:

```bash
pnpm test
```
