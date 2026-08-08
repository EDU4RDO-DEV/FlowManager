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
npm run dev
npm run build
npm run start
npm test
npm run test:watch
```

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
npm test
```
