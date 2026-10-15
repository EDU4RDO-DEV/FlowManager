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

## Integración FEL de producción

La emisión se ejecuta desde el flujo normal de venta únicamente cuando `requiereFactura` es
`true`. El servicio FEL usa `FEL_ENVIRONMENT=production` para seleccionar exclusivamente las
variables con sufijo `_PROD`; el entorno de pruebas conserva las variables legadas sin sufijo
o puede usar `_SANDBOX`.

Producción requiere `FEL_BASE_URL_PROD`, credenciales y datos del emisor, `FEL_USE_MOCK_PROD=false`,
validación de NIT habilitada, fallback deshabilitado y un certificado cliente PFX. Configure
`FEL_PFX_PATH_PROD` con la ruta segura del archivo y `FEL_PFX_PASSWORD_PROD` mediante un gestor
de secretos o el entorno protegido del servidor. No envíe el PFX por chat ni lo agregue al
repositorio; los formatos `.pfx` y `.p12` están ignorados por Git.

El servicio falla antes de contactar al proveedor si faltan el certificado, su contraseña o la
configuración TLS requerida. En producción no genera respuestas simuladas ante fallos. No use
el endpoint de emisión para una prueba técnica: cada emisión puede tener efecto fiscal real.

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
- `produccion:allow-negative-stock` habilita saldos negativos sólo al confirmar fabricación; el seed lo concede al Administrador y no a los demás roles.

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
- `GET /api/dashboard?fechaInicio=AAAA-MM-DD&fechaFin=AAAA-MM-DD`
- `GET /api/production/recipes`
- `GET /api/production/orders?busqueda=&estado=&page=&limit=` (filtros opcionales)
- `GET /api/production/orders/:id` (incluye el historial de movimientos `PROD` asociado)
- `POST /api/production/orders`
- `POST /api/production/orders/:id/confirm`
- `PATCH /api/production/orders/:id/cancel`

Producción conserva una instantánea de la receta al crear una orden pendiente. La cantidad de receta representa el consumo de cada componente por una unidad del producto terminado; no hay conversiones automáticas. Los productos existentes comienzan con `UnidadMedida` nula y no se pueden fabricar hasta completar las unidades del producto terminado y de cada materia prima/insumo. Confirmar aplica todas las salidas y la entrada de producto terminado en una transacción serializable y escribe la bitácora con referencia `PROD` más el ID de orden. La consulta de detalle expone los movimientos enlazados por esa referencia. Una orden pendiente con movimientos previos no puede confirmarse ni cancelarse para proteger la trazabilidad. El esquema vigente no modela lotes; no se asignan lotes ficticios.

## Despacho y liquidación de rutas

El flujo reutiliza `RutaSesion`, `Vehiculo`, `Venta.IdRutaSesion`, `InventarioItem.Existencia`
y `BitacoraInventario`; no duplica las sesiones, las ventas ni los productos. Se agregan
`DespachoRuta`/`DespachoRutaDetalle`, `DevolucionRuta`/`DevolucionRutaDetalle` y `AjusteRuta`.
Cada sesión admite un único despacho inicial y una única recepción consolidada. Los detalles
conservan el nombre y la unidad del producto al despachar; las cantidades no se guardan como
un inventario por número de vehículo.

```mermaid
erDiagram
  RutaSesion ||--o| DespachoRuta : recibe
  DespachoRuta ||--|{ DespachoRutaDetalle : contiene
  InventarioItem ||--o{ DespachoRutaDetalle : producto
  RutaSesion ||--o| DevolucionRuta : liquida
  DevolucionRuta ||--o{ DevolucionRutaDetalle : contiene
  InventarioItem ||--o{ DevolucionRutaDetalle : producto
  RutaSesion ||--o{ Venta : vincula
  Venta ||--|{ DetalleVenta : registra
  RutaSesion ||--o{ AjusteRuta : autoriza
  InventarioItem ||--o{ AjusteRuta : producto
```

Al confirmar el despacho, la API descuenta el stock de planta y crea movimientos `DES` en la
misma transacción serializable. Las ventas `VENTA` ligadas a una sesión consumen el saldo
vendible del camión: despacho menos ventas, más devoluciones comerciales, menos recepción física
final, ajustes, reservas y devoluciones comerciales no vendibles. El saldo de conciliación cuenta
también las unidades comerciales no vendibles porque siguen físicamente en el vehículo. Las ventas
no vuelven a descontar el stock de planta. Anular una venta de ruta la excluye del saldo vendido, sin
reincorporarla a la planta. El despacho se rechaza si ya existen ventas en la sesión, para
evitar mezclar registros históricos que descontaron el stock global con la nueva contabilidad
del vehículo.

La devolución valida el saldo del camión y registra las unidades recibidas, las dañadas y la
ubicación física de estas últimas. El registro de recepción no cambia inmediatamente el
inventario de planta: las unidades recibidas permanecen en el ledger de la ruta hasta que la
conciliación permita cerrar la sesión. Al cierre, solo las unidades recibidas y aptas aumentan
`InventarioItem.Existencia` y generan movimientos `DEV`, dentro de la misma transacción que
cierra la ruta. Las cantidades dañadas conservan su ubicación y no aumentan el stock vendible.
Una diferencia restante requiere un ajuste con clasificación, motivo y usuario autenticado; se
protege con el permiso `logistica:update`. Una sesión solo pasa a `CERRADA` si el saldo de
todos los productos quedó conciliado. `RutaSesion.FechaCierre` y `IdUsuarioCierre` guardan la
fecha y el responsable.

Regla aprobada para proformas ligadas a una ruta: `POST /api/ventas` requiere
`fechaExpiracionProforma` (fecha/hora ISO con zona horaria) y reserva el saldo del vehículo sin
descontar otra vez el inventario de planta. Las reservas activas reducen el disponible para
otras ventas y bloquean la liquidación de la ruta mientras sigan sin conciliar. El endpoint
`POST /api/ventas/:id/confirmar-proforma` cambia el registro a `VENTA` y consume la reserva en
una transacción; el saldo reservado pasa a saldo vendido sin un segundo descuento ni movimiento
de inventario de planta. Anular la proforma libera su reserva. Un trabajador de expiración
procesa reservas al iniciar el backend y cada 30 segundos; las actualizaciones condicionales
por estado las hacen idempotentes incluso si hay varias instancias. Las consultas de inventario
de ruta también liberan vencimientos antes de calcular disponibilidad. El estado, usuario de
origen, fechas de consumo/liberación y motivo quedan en `ReservaProforma`. Las proformas sin
sesión de ruta conservan su flujo previo de inventario.

El modelo de producto no tiene un código comercial independiente; el selector filtra los
campos disponibles (nombre, presentación/unidad y categoría). Las bonificaciones cuentan como
unidades que salieron del camión, y las anulaciones de ventas de ruta se excluyen del saldo solo
antes de recibir o cerrar la ruta.

Las devoluciones comerciales de ventas de ruta se registran en `DevolucionComercial` y
`DevolucionComercialDetalle`, vinculadas a la venta y sus líneas originales; el cliente y la
sesión se derivan de la venta para no duplicar relaciones. El usuario autenticado con permiso
`ventas:update` autoriza la recepción y se almacenan usuario y fecha. La transacción serializable
limita la cantidad acumulada devuelta a lo vendido por cada línea. `Idempotency-Key` evita crear
dos veces la misma operación ante reintentos. Los productos inspeccionados como vendibles
aumentan el saldo disponible del vehículo y pueden revenderse en la misma ruta; los dañados o no
vendibles quedan registrados con ubicación segregada y nunca aumentan el saldo vendible. Al
cierre, solo las cantidades físicamente recibidas y clasificadas como aptas se trasladan a
planta mediante movimientos `DEV`. La recepción comercial y la devolución física de sobrantes
son registros distintos. Una venta con devoluciones comerciales autorizadas no se puede anular,
para evitar restaurar dos veces las mismas unidades.

Las devoluciones de ventas no asociadas a una ruta todavía se rechazan: requieren aprobar el
destino del inventario. No se modifican automáticamente pagos, CxC, importes originales, FEL,
comisiones ni liquidaciones; estos flujos financieros y fiscales permanecen fuera de alcance
hasta definir sus reglas.

Mejoras operativas aún no soportadas: la sesión permite un despacho inicial y una recepción
consolidada; recargas o recepciones parciales requieren un historial de movimientos por ruta,
no otra existencia duplicada. `AjusteRuta.IdUsuario` registra al responsable actual, pero no
separa liquidador y aprobador. El comprobante usa impresión del navegador, no PDF formal. Los
códigos de producto requieren una regla de negocio y un campo/índice nuevo. La necesidad de
cada mejora debe confirmarse con Operaciones antes de ampliar el esquema.

Endpoints (todos bajo `/api/logistics`, autenticados y con permiso `logistica`):

- `GET /rutas/sesiones/:id/inventario`
- `GET /rutas/sesiones/:id/liquidacion`
- `POST /rutas/sesiones/:id/despacho`
- `POST /rutas/sesiones/:id/devolucion`
- `POST /rutas/sesiones/:id/ajustes`
- `PATCH /rutas/:id/sesiones/:idSesion` con `estado: "CERRADA"` para liquidar y cerrar

La migración `20261015080000_route_dispatch_settlement` es aditiva y no se ejecuta
automáticamente. Aplíquela solo mediante Prisma Migrate en una base aprobada. Las pruebas
unitarias y de integración deben cubrir los movimientos y la concurrencia antes de habilitar
este flujo en producción.

La migración `20261012110000_production_module` agrega unidades y órdenes, y elimina las restricciones SQL globales de existencia no negativa para permitir el caso autorizado. La API protege las salidas de los demás flujos y verifica el permiso especial al fabricar. Revise la migración en el entorno objetivo antes de aplicarla; no la ejecute contra producción ni una base compartida sin autorización. Aplique las migraciones y ejecute el seed de roles/permisos sólo en un entorno aprobado.

El dashboard requiere autenticacion y permiso `ventas:read`. Resume registros no anulados
con `TipoRegistro = VENTA` mediante `Venta`, `DetalleVenta` y `EstadoEntrega`; excluye
proformas y bonificaciones de los importes y unidades vendidos. El rango es inclusivo,
admite hasta 366 dias y alimenta los indicadores, el ticket promedio, las tendencias y los diez
productos y clientes principales, además de la distribucion por estado de entrega.

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

### Despacho y liquidacion contra SQL Server

La suite `src/tests/route-flow.sqlserver.integration.spec.ts` usa una base SQL Server real y
comprueba que la conexion efectiva sea `FlowManager_Test`; aborta si apunta a otra base. Prepara
esa base con `prisma migrate deploy` y el seed de roles antes de ejecutarla:

```bash
pnpm run test:integration:routes
```

El runner deriva `FlowManager_Test` de `DATABASE_URL` sin imprimir la cadena de conexion. No
ejecuta migraciones ni modifica la base `FlowManager`. La suite prueba sesiones y permisos por
endpoint, despachos concurrentes, ventas y anulaciones, devoluciones comerciales parciales e
idempotentes, reventa desde el vehiculo, conciliacion de productos vendibles y danados, y cierres.
