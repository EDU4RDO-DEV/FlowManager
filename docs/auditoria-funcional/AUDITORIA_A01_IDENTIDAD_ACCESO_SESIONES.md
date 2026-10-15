# Auditoría funcional A01 — Identidad, acceso y sesiones

## Resumen de ejecución

- **Grupo:** A01 — Identidad, acceso y sesiones.
- **Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`.
- **Fecha de revisión:** 2026-10-11.
- **Alcance asignado:** login, refresh, logout, alta inicial, usuarios, roles, asignaciones, permisos persistidos, guards frontend/backend y sesiones.
- **Dependencias consultadas:** vínculo Usuario–Empleado/Entidad y módulos consumidores únicamente para validar contratos de identidad y autorización. No se auditó la lógica comercial, inventario, logística ni otros procesos.
- **Resultado:** se revisaron las rutas principales desde las pantallas y servicios frontend hasta controladores, servicios, Prisma y modelos. Se documentan seis hallazgos de código, más discrepancias y usos no demostrados. No se verificó una base de datos ni el estado desplegado de sus catálogos. Por esa limitación, no se afirma la operación end-to-end de los permisos persistidos ni la terminación completa de los flujos en un entorno real.
- **Prioridades:** se usa P0–P3 del prompt y, entre paréntesis, su severidad equivalente del contrato común (P0=CRÍTICO, P1=ALTO, P2=MEDIO, P3=BAJO). **Pendiente de verificación** indica que la expectativa de negocio o el comportamiento desplegado no se pudo confirmar.

## Documentos de referencia obligatorios consultados

Se leyeron los siete documentos iniciales antes de comenzar el análisis:

- `docs/auditoria-funcional/00_RESUMEN_GENERAL.md`
- `docs/auditoria-funcional/01_INVENTARIO_MODULOS.md`
- `docs/auditoria-funcional/02_MAPA_ARQUITECTURA.md`
- `docs/auditoria-funcional/03_MAPA_DEPENDENCIAS.md`
- `docs/auditoria-funcional/04_ZONAS_COMPARTIDAS_Y_RIESGOS.md`
- `docs/auditoria-funcional/05_PLAN_AUDITORIAS_PARALELAS.md`
- `docs/auditoria-funcional/06_CONTRATO_DE_AUDITORIA.md`

El alcance ejecutado corresponde exclusivamente a **A01** del plan. Se excluyeron reportes, dashboards, gráficas, analítica, estética general y las auditorías completas de los grupos A02–A06.

## Inventario de endpoints y correspondencia con la UI

Las rutas siguientes están montadas en `backend/src/app.ts`; las rutas de usuarios, roles y sesiones heredan `requireAuth` y agregan el permiso anotado.

| Área | Endpoints observados y protección | Correspondencia frontend |
|---|---|---|
| Autenticación | `POST /api/auth/login` y `POST /api/auth/refresh` públicos; `GET /api/auth/me` y `POST /api/auth/logout` requieren sesión; `POST /api/auth/register` permite bootstrap si no hay usuarios activos, y después requiere `usuarios:create`; `PATCH /api/auth/users/:idUsuario/assignment` requiere `usuarios:update`. | Login, registro, sincronización de usuario y renovación existen. El servicio frontend declara `logout`, pero el proveedor de autenticación no lo invoca. No se encontró consumidor frontend de `assignment`. |
| Usuarios | `GET /api/users`, `/disponibles`, `/anulados` y `/:id` requieren `usuarios:read`; `POST /api/users` requiere `usuarios:create`; `PATCH /api/users/:id/password` permite al usuario propio o a quien tenga `usuarios:update`; `PATCH /:id/password/reset` y `PATCH /:id` requieren `usuarios:update`; `DELETE /:id` requiere `usuarios:delete`; `PATCH /:id/restaurar` requiere `usuarios:update`. | Hay pantallas de lista, alta, edición, cambio propio de contraseña y restablecimiento. La edición invoca `PATCH /api/users/:id`, no el endpoint separado de asignación. |
| Roles y permisos | `GET /api/roles`, `/anulados`, `/:id` y `/:id/permisos` requieren `roles:read`; `POST /api/roles` requiere `roles:create`; `PATCH /:id`, `PATCH /:id/permisos` y `PATCH /:id/restaurar` requieren `roles:update`; `DELETE /:id` requiere `roles:delete`. | La UI lista, crea, edita y restaura roles y muestra/guarda permisos. La matriz de permisos se genera usando la lista devuelta por el backend. |
| Sesiones | `GET /api/sessions`, `/anulados` y `/:id` requieren `sesiones:read`; `POST /api/sessions` requiere `sesiones:create`; `PATCH /:id` y `PATCH /:id/restaurar` requieren `sesiones:update`; `DELETE /:id` requiere `sesiones:delete`. | La UI lista sesiones activas/anuladas, anula y restaura. No se encontraron métodos/pantallas frontend para consultar una sesión individual, crearla o editarla. |

La matriz backend define 17 claves de módulo y las cuatro acciones CRUD. Los guards de rutas de otros dominios usan el mismo mecanismo persistido; se consultaron como consumidores de autorización, no como auditoría funcional de esos módulos.

## Hallazgos

### AUD-A01-001 — El cierre de sesión de la UI no revoca la sesión persistida

- **Módulo:** Autenticación y sesiones.
- **Funcionalidad:** logout desde el control global de la aplicación.
- **Categoría / prioridad:** Implementación incompleta — **P1 (ALTO)**.
- **Descripción:** el callback `logout` de `AuthProvider` limpia el estado/localStorage y redirige a `/login`, pero no llama al endpoint backend. Aunque existe `frontend/services/auth.service.ts::logout`, no se encontró un consumidor del método. El backend sí tiene una operación que revoca el refresh token recibido o, si no se envía, todas las sesiones del usuario.
- **Evidencia técnica:**
  - **Código:** `frontend/components/auth-provider.tsx::logout` (aprox. líneas 41–44) llama solo a `persistLogout()` y `router.replace('/login')`; `frontend/components/dashboard-shell.tsx` conecta el botón de salida con ese callback.
  - **Código:** `frontend/services/auth.service.ts::logout` (aprox. líneas 39–40) sí ejecuta `POST /api/auth/logout`, pero la búsqueda de consumidores frontend solo encontró la declaración.
  - **Código:** `backend/src/routes/auth.routes.ts` (aprox. línea 23) protege `POST /api/auth/logout`; `backend/src/controllers/auth.controller.ts::logoutController` (aprox. líneas 128–153) revoca el token o todas las sesiones; `backend/src/services/auth.service.ts::revokeRefreshToken` y `revokeAllUserSessions` modifican la persistencia.
  - **Esquema/código:** `Sesion` almacena hash de token, expiración y estado anulado; el refresh token permanece aceptable mientras coincidan hash, usuario, vigencia y estado activo.
- **Flujo actual comprobado:** el usuario sale desde la UI → se borran credenciales del navegador → la fila de `Sesion` no se anula por esta acción. La operación backend de revocación está disponible, pero no conectada a ese callback.
- **Flujo esperado y fundamento:** el logout visible debería invalidar también la sesión correspondiente. La ruta backend demuestra que existe esa operación; no se encontró un requisito que determine si se debe cerrar solo la sesión actual o todas las del usuario.
- **Consecuencia:** la sesión puede seguir apareciendo activa y el refresh token no queda revocado en servidor. Un refresh token que aún esté disponible fuera del almacenamiento borrado podría renovar credenciales hasta su expiración o revocación.
- **Dependencias:** ciclo de sesión global, API Axios, `AuthProvider` y pantalla de sesiones.
- **Propuesta (no implementada):** conectar logout del proveedor con la revocación backend antes de limpiar el token, definir el alcance (sesión actual/todas) y conservar una salida local segura si la API falla. Añadir prueba que compruebe la invalidez del refresh token tras logout.
- **Pruebas recomendadas:** prueba de integración logout autenticado con refresh vigente, verificación de `Sesion.Anulado` y rechazo posterior del refresh token; prueba de UX ante fallo de red.
- **Estado / certeza:** comportamiento confirmado por cadena estática frontend→servicio backend; **9/10**. No se ejecutó una revocación contra base de datos.

### AUD-A01-002 — Anular un usuario no invalida sus sesiones de acceso existentes

- **Módulo:** Usuarios y autenticación.
- **Funcionalidad:** desactivación de usuario y autorización posterior.
- **Categoría / prioridad:** Error funcional — **P1 (ALTO)**.
- **Descripción:** la anulación de usuario marca `Usuario.Anulado`, pero no revoca sus sesiones. `requireAuth` valida firma, tipo de token y, cuando hay `sid`, la sesión activa/vigente; no consulta si el usuario sigue activo. Por ello, un access token ya emitido puede seguir pasando el middleware y la autorización por rol hasta que expire o la sesión se anule. El refresh sí rechaza un usuario anulado.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/user.service.ts::deleteUser` (aprox. líneas 708–727) actualiza `Usuario.Anulado` y fechas de anulación, sin actualizar `Sesion`.
  - **Código:** `backend/src/middlewares/auth.middleware.ts::requireAuth` (aprox. líneas 117–205) comprueba la sesión, pero no consulta `Usuario.Anulado`; asigna `req.auth` desde los claims del JWT.
  - **Código:** `backend/src/services/auth.service.ts::refreshAuthTokens` (aprox. líneas 453–468) sí busca el usuario con `Anulado: false`, mostrando la diferencia entre refresh y access.
  - **UI:** `frontend/components/auth-provider.tsx` intenta sincronizar `/api/auth/me` al hidratar/enfocar y limpia el estado si falla; esto no reemplaza el guard de usuario activo en cada petición backend.
- **Flujo actual comprobado:** se anula el usuario → se mantienen sin cambio sus filas de sesión → access token con `sid` sigue pasando `requireAuth` si su sesión continúa activa y el token no expiró. No se afirma que el navegador siempre mantenga la UI autenticada: `/me` puede devolver 404 y provocar un cierre local.
- **Flujo esperado y fundamento:** una cuenta anulada no debería seguir autorizando operaciones protegidas. El login y el refresh requieren usuario activo; debe confirmarse con el responsable si la revocación debe ser inmediata y si se aplica a todas las sesiones.
- **Consecuencia:** existe una ventana de acceso backend posterior a la desactivación, hasta vencimiento del access token o revocación manual de la sesión.
- **Dependencias:** administración de usuarios, middleware compartido de autenticación y módulo de sesiones; afecta todos los endpoints protegidos.
- **Propuesta (no implementada):** sincronizar la anulación con revocación de sesiones o verificar estado activo del usuario en el guard; definir atomicidad y cubrir sesiones múltiples.
- **Pruebas recomendadas:** emitir sesión/token en fixture aislado, anular usuario y comprobar que la siguiente petición protegida devuelve 401; comprobar todas las sesiones del usuario.
- **Estado / certeza:** comportamiento confirmado por código; la ventana exacta depende del TTL/configuración desplegada no inspeccionada. **9/10**.

### AUD-A01-003 — Un rol anulado continúa concediendo sus permisos persistidos

- **Módulo:** Roles, permisos y autorización.
- **Funcionalidad:** eliminación/anulación de rol y evaluación de permisos.
- **Categoría / prioridad:** Error funcional — **P1 (ALTO)**.
- **Descripción:** anular un rol solo marca `Rol.Anulado`; no se desasignan usuarios ni se anulan sus registros `RolPermiso`. La evaluación de permisos une `RolPermiso`, `ModuloSistema` y `AccionSistema`, pero no comprueba que el `Rol` relacionado siga activo. El `idRol` del JWT continúa señalando ese rol. Por tanto, las filas activas de permiso del rol anulado todavía pueden autorizar rutas.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/role.service.ts::deleteRole` (aprox. líneas 137–157) actualiza solo `Rol.Anulado` y metadatos.
  - **Código:** `backend/src/middlewares/auth.middleware.ts::evaluatePersistedPermission` (aprox. líneas 74–103) filtra `rp.Anulado`, `rp.Permitido`, módulo y acción activos, sin unir ni filtrar `Rol.Anulado`.
  - **Código:** `backend/src/middlewares/auth.middleware.ts::requireAuth` (aprox. líneas 158–205) usa el `idRol` incluido en el token.
  - **Esquema:** `Rol` y `RolPermiso` tienen relaciones persistidas (`backend/prisma/schema.prisma`, modelos `Rol` y `RolPermiso`); `Usuario.IdRol` conserva su FK al rol.
- **Flujo actual comprobado:** se anula un rol asignado → sus permisos no se alteran → la consulta de autorización aún puede encontrar permiso activo para el ID del rol.
- **Flujo esperado y fundamento:** que un rol no disponible deje de otorgar permisos o que la operación de anulación obligue a resolver sus asignaciones. La pantalla de roles oculta roles anulados; no se encontró una regla que explique que sus permisos deban seguir vigentes.
- **Consecuencia:** se puede mantener autorización asociada a un rol que el sistema registra como anulado, y restaurar el rol no es requisito para esa decisión.
- **Dependencias:** catálogo RBAC compartido por todos los grupos; coordinar con los dueños de rutas de dominio antes de cualquier corrección.
- **Propuesta (no implementada):** filtrar roles activos durante la evaluación y definir qué hacer con usuarios asignados al anular/restaurar un rol. Añadir pruebas con rol activo/anulado y permisos activos.
- **Pruebas recomendadas:** test aislado de middleware con permiso existente y rol anulado; test de transición de usuarios asignados al anular y restaurar rol.
- **Estado / certeza:** comportamiento confirmado por la consulta estática; no se ejecutó contra registros de una instancia. **9/10**.

### AUD-A01-004 — El registro inicial no asigna el rol administrador que anuncia la UI

- **Módulo:** Alta inicial, usuarios y roles.
- **Funcionalidad:** bootstrap del primer administrador.
- **Categoría / prioridad:** Implementación incompleta — **P1 (ALTO)**.
- **Descripción:** el formulario público dice “Configura el primer usuario administrador”, pero solo envía nombre, correo y clave. El esquema permite `idRol` opcional y `register` persiste `IdRol: null` cuando se omite. La asignación del rol Administrador ocurre en `prisma/seed.ts`, en una ejecución separada; no se invoca desde el inicio del servidor. Sin ejecutar ese seed o asignar un rol por otro canal, el primer usuario puede iniciar sesión, pero carece de `idRol` y los guards RBAC responden 403.
- **Evidencia técnica:**
  - **Observación de UI:** `frontend/app/(auth)/register/page.tsx` (aprox. líneas 48 y 67) envía únicamente `nombre`, `correo`, `clave` y describe el usuario como administrador.
  - **Código:** `backend/src/validators/auth.validators.ts::registerSchema` (aprox. líneas 10–21) hace opcional `idRol`; `backend/src/services/auth.service.ts::register` (aprox. líneas 589–627) guarda `idRol ?? null`.
  - **Código:** `backend/src/middlewares/auth.middleware.ts::requireModulePermission` (aprox. líneas 251–264) devuelve 403 si el token no contiene rol válido.
  - **Configuración:** `backend/package.json` define el script separado `seed`; `backend/prisma/seed.ts` crea la matriz de roles/permisos y asigna Administrador al creador solo si no tiene rol (aprox. líneas 59–67 y 172–179). `backend/src/index.ts` no ejecuta el seed al arrancar.
  - **Documentación:** el README del backend indica que register es libre durante bootstrap, pero no documenta el paso operativo del seed.
- **Flujo actual comprobado:** registro inicial desde la UI → usuario activo sin rol → login permitido → permisos de módulos denegados → recuperación requiere ejecutar seed u otro acceso administrativo ya existente.
- **Flujo esperado y fundamento:** dado el texto de la UI, el alta inicial debería dejar una cuenta administradora utilizable, o informar claramente el paso manual obligatorio. El comportamiento exacto de instalación debe confirmarse con operaciones.
- **Consecuencia:** el usuario que completa el primer registro puede quedar bloqueado fuera de las funciones de administración; registros posteriores requieren autenticación y `usuarios:create`.
- **Dependencias:** semilla Prisma, catálogo RBAC y proceso de despliegue. No se ejecutó `seed`.
- **Propuesta (no implementada):** acordar si el rol y sus permisos se asignan automáticamente durante bootstrap o si existe una secuencia manual obligatoria; reflejarla en el procedimiento y el mensaje de UI. No asumir quién debe recibir privilegios administrativos.
- **Pruebas recomendadas:** prueba de bootstrap vacío que registre primer usuario, autentique y compruebe los permisos; caso con y sin paso seed documentado.
- **Estado / certeza:** diferencia UI/API/semilla confirmada por código; estado operativo de bases desplegadas y ejecución del seed, no verificados. **9/10**.

### AUD-A01-005 — La API de alta administrativa acepta claves que el login no puede aceptar

- **Módulo:** Usuarios y autenticación.
- **Funcionalidad:** creación administrativa y posterior login.
- **Categoría / prioridad:** Inconsistencia entre capas — **P2 (MEDIO)**.
- **Descripción:** la UI administrativa valida un mínimo de ocho caracteres, pero `createUserController` solo comprueba que `clave` sea truthy y el servicio la hashea sin validación de longitud. En cambio, `loginSchema` rechaza cualquier clave de menos de ocho caracteres antes de autenticar. Una llamada directa válida a `POST /api/users` puede, por tanto, persistir una cuenta cuya clave guardada luego no puede enviarse al endpoint de login. Además, el flujo `register` exige mayúscula, minúscula y número, regla que no se aplica a las demás vías.
- **Evidencia técnica:**
  - **Frontend:** `frontend/app/users/create/page.tsx` (aprox. líneas 90–94) exige mínimo ocho caracteres.
  - **Backend:** `backend/src/controllers/user.controller.ts::createUserController` (aprox. líneas 106–132) solo valida presencia de `clave`; `backend/src/services/user.service.ts::createUser` (aprox. líneas 377–400) la hashea y persiste.
  - **Backend:** `backend/src/validators/auth.validators.ts::loginSchema` requiere mínimo ocho y máximo 128 caracteres (aprox. líneas 5–8); `registerSchema` agrega reglas de mayúscula, minúscula y número (aprox. líneas 10–20).
  - **Backend:** cambio y restablecimiento de clave comprueban mínimo ocho en el controlador (aprox. líneas 431–441 y 497–507), demostrando que la creación administrativa aplica una regla distinta.
- **Flujo actual comprobado:** un cliente API con permiso de creación puede enviar una clave no vacía menor de ocho → el servicio la hashea y crea al usuario → el endpoint de login rechaza la clave por `loginSchema`.
- **Flujo esperado y fundamento:** todos los canales de creación/cambio de contraseña deberían compartir la validación de servidor acordada. El mínimo de login está documentado en el propio validador; la política de complejidad global no está documentada fuera de los validadores.
- **Consecuencia:** alta administrativa potencialmente inutilizable y aceptación de claves con reglas distintas según el endpoint.
- **Dependencias:** formularios de usuarios y autenticación; no requiere tocar el flujo laboral Usuario–Empleado consultado.
- **Propuesta (no implementada):** centralizar la política en validadores backend reutilizados por cada canal y alinear las ayudas/validación frontend; añadir prueba de que una clave aceptada al crear se acepta en login.
- **Pruebas recomendadas:** endpoint test de `POST /api/users` con clave menor a ocho, seguido por rechazo esperado; tests de límites y complejidad homogéneos.
- **Estado / certeza:** discrepancia confirmada estáticamente; no se ejecutó una operación de alta. **9/10**.

### AUD-A01-006 — La reasignación de rol no actualiza el rol de sesiones ya emitidas

- **Módulo:** Usuarios, roles y autorización.
- **Funcionalidad:** cambio de rol con usuario autenticado.
- **Categoría / prioridad:** Inconsistencia entre capas — **P2 (MEDIO)**.
- **Descripción:** el rol se incluye como claim `idRol` en access token. La reasignación actualiza `Usuario.IdRol`, pero no invalida sesiones ni actualiza access tokens existentes. `requireAuth` sigue tomando el rol del claim y `requireModulePermission` consulta permisos para ese ID. El servicio refresh sí vuelve a leer el usuario y genera el token siguiente con el rol actual, por lo que el cambio no se refleja en una sesión que aún usa su access token previo hasta que se renueve o expire.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/auth.service.ts::signAccessToken` (aprox. líneas 255–282) incluye `idRol` en el token y fija la expiración mediante `sanitizeAccessMinutes`; el valor predeterminado del servicio es 480 minutos.
  - **Código:** `backend/src/services/auth.service.ts::assignUserRoleEntity` (aprox. líneas 638–716) y `backend/src/services/user.service.ts::updateUser` (aprox. líneas 510–563) escriben el nuevo `IdRol` sin invalidar sesiones.
  - **Código:** `backend/src/middlewares/auth.middleware.ts::requireAuth` (aprox. líneas 158–205) copia `payload.idRol` a `req.auth`; la evaluación posterior usa ese valor.
  - **Código:** `backend/src/services/auth.service.ts::refreshAuthTokens` (aprox. líneas 421–500) consulta el usuario activo y firma el nuevo access token con el `IdRol` actual.
- **Flujo actual comprobado:** se actualiza el rol → las sesiones existentes conservan el access token anterior → el servidor evalúa con el rol anterior hasta renovación/expiración. No se consultó una sesión real.
- **Flujo esperado y fundamento:** no se halló un SLA explícito para aplicar cambios de rol; la autorización debe corresponder eventualmente al rol persistido. Se requiere confirmar si el cambio debe ser inmediato o al renovar.
- **Consecuencia:** al degradar o retirar permisos, la sesión previa puede conservar el acceso anterior por el resto de la vigencia del access token; al elevar permisos, la UI y el servidor pueden tener permisos diferentes durante ese intervalo.
- **Dependencias:** middleware global, refresh del cliente Axios, asignación de roles y cualquier ruta que evalúe permisos.
- **Propuesta (no implementada):** definir la latencia aceptable del cambio y alinear el mecanismo (invalidación de sesiones, control de versión de credenciales/rol o lectura actualizada) con el modelo de refresh.
- **Pruebas recomendadas:** emitir token, cambiar rol, comprobar decisión antes/después de refresh; probar tanto degradación como elevación.
- **Estado / certeza:** comportamiento de claims confirmado estáticamente; que se clasifique como defecto depende de política de negocio pendiente. **8/10**.

## Discrepancias, dependencias y elementos sin uso demostrado

1. **Asignación duplicada/no conectada a UI:** `PATCH /api/auth/users/:idUsuario/assignment` actualiza rol/entidad; no se encontró un servicio frontend que lo invoque. La pantalla de edición usa `PATCH /api/users/:id`, cuyo servicio también permite modificar `idRol` y la relación de empleado/entidad. Se registra como solapamiento y uso no demostrado, no como endpoint obsoleto: podría haber consumidores externos no presentes en el repositorio.
2. **Sesiones:** el backend ofrece `GET /:id`, `POST /` y `PATCH /:id`, pero el servicio/pantalla frontend solo usa listado activo/anulado, anular y restaurar. El alta normal de sesión sí está conectada al login; no se encontró uso de las operaciones CRUD administrativas adicionales.
3. **Contrato TypeScript de permisos:** `backend/src/validators/role-permission.validators.ts` y el catálogo backend contienen 17 módulos; `frontend/types/roles.ts::RolePermissionModuleDto` tipa solo 12 y omite `logistica`, `envases`, `calidad`, `reportes` y `empresa`. La pantalla itera los módulos recibidos del backend sin filtrarlos, por lo que no se comprobó una opción actualmente oculta o imposible de guardar; queda un contrato estático incompleto que reduce la seguridad de tipos.
4. **Lectura con efecto de escritura:** `GET /api/roles/:id/permisos` llama a `listRolePermissions`, que ejecuta `ensureCatalogEntries`; esta función crea/reactiva filas de módulo/acción. No se consultó la base para determinar si ocurre una escritura en cada despliegue o si hay catálogo incompleto. Confirmar si el efecto de reparación durante una lectura es intencional.
5. **Cambio de contraseña y otras sesiones:** los servicios de cambio/restablecimiento no revocan sesiones. No se encontró un requisito que indique si este cambio debe cerrar sesiones existentes; queda como pregunta de política, no hallazgo confirmado.
6. **Usuario–Empleado/Entidad:** se revisaron el formulario y el servicio de edición junto con `backend/src/tests/usuario-empleado-link.spec.ts`. El código usa `Empleado.IdUsuarioVinculado` como vínculo laboral y la prueba cubre vincular/desvincular. La prueba no se ejecutó y no se auditó el módulo de empleados (A05).
7. **Bootstrap abierto:** el guard habilita `/register` cuando el conteo de usuarios activos es cero. No se confirmó si la reapertura tras anular todos los usuarios es intencional; validar esta condición con negocio/operaciones. No se probaron registros.

## Cobertura de pruebas y verificaciones

- **Prueba ejecutada, de solo lectura:** `pnpm --dir backend test -- src/tests/auth-rbac.spec.ts src/tests/role-permission-matrix.spec.ts`.
  - Resultado: 14 pruebas en total; 6 pasaron y 8 fallaron o expiraron.
  - Causa observada: varios tests que consultan guards/permisos recibieron errores de espera de conexión del pool Prisma; hubo respuestas 500 donde el test esperaba 200. No se pudo atribuir el resultado al comportamiento funcional esperado porque no había una conexión utilizable a la base de datos.
  - No se ejecutaron operaciones de escritura; los tests seleccionados verifican guards, lecturas o entradas inválidas.
- **Verificación segura focalizada:** `pnpm --dir backend exec vitest run src/tests/auth-rbac.spec.ts -t "without token|invalid|using refresh token as bearer|malformed JSON"`.
  - Resultado: 6 pasaron, 3 omitidas por el filtro.
  - Cubre token ausente/inválido, refresh inválido, refresh como bearer, logout con refresh inválido y JSON malformado; no cubre logout exitoso, altas, cambios de rol ni revocación de sesiones.
- **Cobertura revisada en código:** `auth-rbac.spec.ts`, `role-permission-matrix.spec.ts`, `module-endpoints-rbac.spec.ts` y `usuario-empleado-link.spec.ts`. La matriz de roles y varios guards dependen de catálogos/roles sembrados en SQL Server. No se ejecutó el seed ni se modificó información.
- **Frontend:** no se identificó script de pruebas frontend en las referencias de workspace consultadas; no se ejecutaron builds porque el único archivo creado es documentación.
- **No ejecutado:** acceso a base de datos, consultas a registros reales, migraciones, seed, scripts SQL, pruebas que creen/modifiquen usuarios/roles/sesiones, ni servicios externos.

## Evidencia y archivos revisados

### Documentación y configuración

- Los siete documentos de referencia enumerados arriba.
- `backend/README.md`, `backend/package.json`, `backend/src/index.ts`.

### Backend

- Montaje y rutas: `backend/src/app.ts`; `backend/src/routes/auth.routes.ts`, `user.routes.ts`, `role.routes.ts`, `session.routes.ts`.
- Controladores: `backend/src/controllers/auth.controller.ts`, `user.controller.ts`, `role.controller.ts`, `session.controller.ts`.
- Middleware/validación: `backend/src/middlewares/auth.middleware.ts`; `backend/src/validators/auth.validators.ts`, `role-permission.validators.ts`, `session.validators.ts`.
- Servicios: `backend/src/services/auth.service.ts`, `user.service.ts`, `role.service.ts`, `role-permission.service.ts`, `session.service.ts`.
- Persistencia/bootstrap: modelos relacionados de `backend/prisma/schema.prisma`; `backend/prisma/seed.ts`.
- Pruebas: `backend/src/tests/auth-rbac.spec.ts`, `role-permission-matrix.spec.ts`, `module-endpoints-rbac.spec.ts`, `usuario-empleado-link.spec.ts`.

### Frontend

- Auth: `frontend/app/(auth)/login/page.tsx`, `register/page.tsx`; `frontend/components/auth-provider.tsx`, `require-auth.tsx`; `frontend/lib/api.ts`, `auth-storage.ts`, `auth-store.ts`, `rbac.ts`.
- Administración: páginas y formularios de `frontend/app/users/`, `frontend/app/roles/` y `frontend/app/sessions/`, incluidos cambio/restablecimiento de contraseña y edición de rol/permisos.
- Contratos/servicios: `frontend/services/auth.service.ts`, `users.service.ts`, `roles.service.ts`, `sessions.service.ts`; `frontend/types/auth.ts`, `users.ts`, `roles.ts`, `sessions.ts`.

### Pendientes de evidencia

- Estado de tablas, roles, permisos, sesiones y datos de usuario en la base desplegada: **pendiente**, sin conexión autorizada/utilizable.
- Ejecución/resultado operativo del seed en el proceso de instalación: **pendiente**.
- Contratos de negocio sobre bootstrap, retiro de roles, revocación de sesión y política de contraseña: **no documentados en las referencias revisadas**.
- Consumidores externos de endpoints que no usa la UI del repositorio: **no verificables**.
- Resultado funcional de los tests de RBAC con una base de datos sembrada: **pendiente** por timeout del pool.

## Preguntas para coordinación

1. ¿La anulación de un usuario o la reasignación de rol debe surtir efecto inmediatamente en todas sus sesiones?
2. ¿Cuál es el procedimiento autorizado para dejar operativo al primer administrador y debe `/register` volver a habilitarse cuando no quedan usuarios activos?
3. ¿La anulación de un rol debe bloquear inmediatamente a sus asignados o exigir que se reasignen antes?
4. ¿La regla de mayúscula/minúscula/número de `registerSchema` es la política global para todas las altas y cambios de contraseña?
5. ¿Las operaciones de consulta/creación/edición de sesiones del backend tienen consumidores externos o se mantienen solo para administración interna?

## Conteo de hallazgos

| Prioridad | Cantidad |
|---|---:|
| P0 — Crítica | 0 |
| P1 — Alta | 4 |
| P2 — Media | 2 |
| P3 — Baja | 0 |

| Categoría | Cantidad |
|---|---:|
| Implementación incompleta | 2 |
| Error funcional | 2 |
| Inconsistencia entre capas | 2 |

## Cierre

La investigación cubrió los flujos principales del alcance A01 en el código versionado, pero las conclusiones sobre permisos efectivos, semilla y sesiones desplegadas siguen limitadas por la falta de conexión a SQL Server y de requisitos de negocio para algunos estados. La auditoría se declara completa **solo como revisión estática del alcance asignado**; la verificación dinámica de la matriz RBAC y de las transiciones de usuario/rol/sesión queda pendiente.

**Integridad:** no se modificó código funcional, pruebas, esquema, datos, migraciones, variables de entorno, configuración ni dependencias. No se ejecutó seed, migración, script SQL ni operación CRUD. El único archivo creado en esta ejecución es este informe de auditoría.
