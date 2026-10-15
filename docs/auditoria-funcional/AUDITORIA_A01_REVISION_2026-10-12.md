# Revisión funcional A01 — Identidad, acceso y sesiones

## 1. Resumen ejecutivo

- **Grupo:** A01 — Identidad, acceso y sesiones.
- **Fecha de revisión:** 2026-10-12 (UTC-06:00).
- **Commit base:** `27f59fa024a804c468c434cfd504baa0b865a362`.
- **Rama:** `developer`.
- **Resultado:** revisión estática de los flujos principales desde UI hasta rutas, validación, servicios y persistencia. Se conservaron y contrastaron los seis identificadores `AUD-A01-001` a `AUD-A01-006`; no se modificó su informe original.
- **Hallazgos nuevos:** `AUD-A01-007` documenta una carrera posible al renovar en paralelo una misma sesión (evidencia parcial; no se reprodujo dinámicamente). `AUD-A01-008` documenta el efecto técnico de restaurar una sesión anulada, pero se deja pendiente decidir si el comportamiento contradice la política esperada.
- **Severidad:** no se identificó evidencia para clasificar un hallazgo como crítico. Las conclusiones sobre la instancia desplegada, catálogos, sesiones y políticas operativas no se verificaron contra una base de datos.
- **Integridad del repositorio:** al inicio, `git status --short --branch` mostró `developer...origin/developer`, sin cambios versionados, y la carpeta `docs/auditoria-funcional/` como no seguida. El inventario actual coincide con la continuidad documentada: los documentos de auditoría existentes se preservaron. El único archivo creado por esta ejecución es este informe.

La auditoría puede considerarse **completa como revisión estática del alcance A01**. No equivale a una certificación de comportamiento en una instancia desplegada: las pruebas de integración y las decisiones de negocio indicadas abajo siguen pendientes.

## 2. Alcance y limitaciones

### Incluido

- Login, refresh, logout y bootstrap/registro inicial.
- Usuarios activos/anulados, roles, permisos persistidos y asignaciones usuario–rol.
- Sesiones persistidas, anulación/restauración y sus efectos en access y refresh tokens.
- Guards de frontend y backend, validación de credenciales y rutas administrativas.
- Referencias de identidad/entidad/empleado solo en cuanto afectan a la administración de usuarios.

### Excluido

- Lógica de negocio de ventas, compras, inventario, logística y planilla, salvo sus guards compartidos.
- Reportes, gráficas, dashboards, KPI y analítica.
- Ejecución de migraciones, seeds, SQL, CRUD, llamadas externas y pruebas que escriban o puedan afectar un entorno compartido.

### Limitaciones

- No se proporcionó una base SQL Server desechable/aislada ni evidencia de que la configuración de pruebas apunte a ella. No se conectó a una base ni se ejecutaron pruebas, builds o scripts.
- No se consultaron usuarios, permisos, sesiones ni datos desplegados; el estado operativo de catálogos y seed queda sin verificar.
- No se inspeccionaron valores de entorno, secretos, tokens, credenciales ni integraciones externas.
- La revisión estática puede demostrar la secuencia implementada y sus ramas, pero no acredita la intercalación de solicitudes concurrentes en ejecución ni la política de negocio correcta.
- El informe A01 anterior registra resultados históricos de pruebas (14 casos: 6 aprobados y 8 fallidos/expirados por problemas del pool Prisma; una selección focalizada: 6 aprobados y 3 omitidos). No se repitieron ni se consideran resultados de esta revisión.

## 3. Punto de partida y documentos consultados

Se comprobó:

- Raíz Git: `D:\Universidad Mariano Gálvez\FlowManager`.
- Rama: `developer`.
- HEAD: `27f59fa024a804c468c434cfd504baa0b865a362`.
- Estado versionado inicial: sin archivos modificados/preparados; la documentación bajo `docs/auditoria-funcional/` aparecía como no seguida. Su procedencia no se atribuye a esta ejecución y no se alteró.

Se leyeron los documentos de orientación `docs/auditoria-funcional/00_RESUMEN_GENERAL.md` a `10_CHECKLIST_INICIO_SESIONES.md`, el contrato `06_CONTRATO_DE_AUDITORIA.md`, el plan `07_PLAN_MAESTRO_COORDINACION.md`, la matriz de continuidad y el informe previo `AUDITORIA_A01_IDENTIDAD_ACCESO_SESIONES.md`. Se buscó en la documentación del repositorio evidencia de requisitos de contraseña, bootstrap y revocación; no se encontró una política autorizada que resuelva las preguntas señaladas abajo.

El informe A01 anterior continúa siendo el registro de origen de `AUD-A01-001` a `AUD-A01-006`. Este documento agrega evidencia y evaluación al commit indicado; no lo sustituye ni sobrescribe.

## 4. Archivos, símbolos y flujos examinados

### Backend

- Montaje y endpoints: `backend/src/app.ts`; `backend/src/routes/auth.routes.ts`, `user.routes.ts`, `role.routes.ts`, `session.routes.ts`.
- Autenticación y autorización: `backend/src/middlewares/auth.middleware.ts::requireAuth`, `evaluatePersistedPermission`, `requireBootstrapOrModulePermission`, `requireModulePermission`.
- Controladores: `backend/src/controllers/auth.controller.ts` (login, refresh, logout, register, `/me`, asignación); `user.controller.ts` (alta, actualización, anulación y contraseñas); `role.controller.ts`; `session.controller.ts`.
- Validación: `backend/src/validators/auth.validators.ts`, `role-permission.validators.ts`, `session.validators.ts`.
- Servicios: `backend/src/services/auth.service.ts::login`, `refreshAuthTokens`, `register`, `assignUserRoleEntity`, `revokeRefreshToken`, `revokeAllUserSessions`; `user.service.ts::createUser`, `updateUser`, `deleteUser`, `restoreUser`, `changeUserPassword`, `resetUserPassword`; `role.service.ts::deleteRole`, `restoreRole`; `role-permission.service.ts::ensureCatalogEntries`, `listRolePermissions`, `updateRolePermissions`; `session.service.ts::deleteSession`, `restoreSession`.
- Persistencia/bootstrap: modelos `Usuario`, `Sesion`, `Rol`, `RolPermiso`, `ModuloSistema` y `AccionSistema` en `backend/prisma/schema.prisma`; `backend/prisma/seed.ts`; `backend/src/index.ts`; scripts de `backend/package.json`.

### Frontend

- Entrada y estado de autenticación: `frontend/app/(auth)/login/page.tsx`, `register/page.tsx`, `frontend/components/auth-provider.tsx`, `require-auth.tsx`, `frontend/lib/api.ts`, `auth-storage.ts`, `auth-store.ts`, `rbac.ts`.
- Servicios/contratos: `frontend/services/auth.service.ts`, `users.service.ts`, `roles.service.ts`, `sessions.service.ts`; `frontend/types/roles.ts`.
- Administración: `frontend/app/users/create/page.tsx`, `users/edit/[id]/page.tsx`, referencias de handlers en `users/page.tsx`, `users/change-password/page.tsx` y `users/[id]/reset-password/page.tsx`; `frontend/app/roles/page.tsx`, `roles/edit/[id]/page.tsx`, `roles/_components/role-permissions-card.tsx`; `frontend/app/sessions/page.tsx`.

### Flujos reconstruidos

1. **Login:** formulario → `auth.service.ts` frontend/Axios → `POST /api/auth/login` → `loginSchema` → `login` valida usuario activo y bcrypt → crea `Sesion` con hash del refresh token → firma access token con `sid` y `idRol` → arma DTO de permisos.
2. **Refresh:** interceptor Axios detecta 401 → envía el refresh token almacenado → ruta/controlador validan token → el servicio encuentra sesión activa por usuario/hash/vigencia, vuelve a leer usuario activo, crea refresh nuevo y sustituye el hash en la fila → devuelve tokens y permisos nuevos.
3. **Logout:** el botón usa `AuthProvider.logout`, que limpia localStorage y redirige. Existe un servicio frontend y un endpoint que revocan refresh actual o todas las sesiones, pero ese callback no invoca el servicio.
4. **Registro/bootstrap:** UI de registro → endpoint protegido por la condición de conteo de usuarios activos → validador → `register` persiste rol opcional como `null`. La asignación de Administrador se realiza en el seed separado; el proceso de arranque del servidor no lo ejecuta.
5. **Usuarios:** formularios llaman los endpoints protegidos de usuarios. El backend aplica soft delete en `Usuario`; el middleware valida firma y sesión, pero no vuelve a consultar estado activo del usuario para cada access token.
6. **Roles/permisos:** UI lista/edita/anula y guarda permisos → rutas RBAC → servicio Prisma. La autorización evalúa permisos activos por el `idRol` del JWT y no filtra el estado `Anulado` del rol.
7. **Sesiones:** el login crea la fila; la pantalla lista activas/anuladas y permite anular/restaurar. Middleware y refresh consultan el estado de esa fila para validar tokens.

## 5. Hallazgos anteriores conservados

Los estados describen lo que el código demuestra en el commit revisado. “Confirmado estáticamente” no significa que se haya probado con datos desplegados. Cuando la regla de negocio no está documentada, se indica por separado.

### AUD-A01-001 — El cierre de sesión de la UI no revoca la sesión persistida

- **Módulo/funcionalidad:** autenticación y sesiones; logout global.
- **Evidencia y flujo actual:** `frontend/components/auth-provider.tsx::logout` (aprox. 41–44) ejecuta `persistLogout()` y redirección local. `frontend/services/auth.service.ts::logout` existe, pero el callback no lo invoca. `POST /api/auth/logout` está montado en `backend/src/routes/auth.routes.ts`; `logoutController` llama a `revokeRefreshToken` o `revokeAllUserSessions`.
- **Qué se confirma:** salir desde ese callback no cambia `Sesion.Anulado`; el servidor conserva la fila activa y la UI elimina su copia local del refresh token. Un token retenido en otro lugar puede seguir renovando mientras sea válido.
- **Qué no se confirma:** no hay requisito localizado que indique si logout debe revocar una sola sesión o todas las del usuario. No se consultaron filas desplegadas.
- **Impacto/severidad:** la sesión continúa figurando activa y no se revoca el refresh token del servidor; **ALTO**, manteniendo la clasificación del informe base.
- **Estado:** comportamiento UI/backend confirmado estáticamente; expectativa de alcance de revocación pendiente de negocio.
- **Verificación recomendada:** en un entorno aislado, comprobar logout con refresh vigente, estado de la fila y rechazo posterior del token.

### AUD-A01-002 — Anular un usuario no invalida sus sesiones de acceso existentes

- **Módulo/funcionalidad:** usuarios, autenticación y autorización de peticiones posteriores a la anulación.
- **Evidencia y flujo actual:** `backend/src/services/user.service.ts::deleteUser` (708–729) marca `Usuario.Anulado` sin tocar `Sesion`. `requireAuth` (117–205) valida firma y, cuando existe `sid`, sesión activa/vigente; no comprueba `Usuario.Anulado`. En contraste, `refreshAuthTokens` (aprox. 453–468) sí exige usuario activo.
- **Qué se confirma:** con un access token emitido cuyo registro `Sesion` siga activo y vigente, la anulación del usuario no impide por sí sola que `requireAuth` acepte el token. `/api/auth/me` puede fallar después y cerrar la UI, pero no sustituye la validación del middleware en cada endpoint.
- **Qué no se confirma:** TTL efectivo ni estado de sesiones en despliegue. La política de aplicación inmediata a todas las sesiones no está documentada.
- **Impacto/severidad:** ventana de acceso backend posterior a la anulación; **ALTO**, conservando clasificación previa.
- **Estado:** comportamiento confirmado por código; inmediatez y alcance son decisión pendiente.
- **Verificación recomendada:** solo con fixtures/base desechable, anular usuario y probar access y refresh existentes, incluyendo sesiones múltiples.

### AUD-A01-003 — Un rol anulado continúa concediendo sus permisos persistidos

- **Módulo/funcionalidad:** roles, permisos y guards backend.
- **Evidencia y flujo actual:** `role.service.ts::deleteRole` (137–160) anula el rol, sin desasignar usuarios ni anular `RolPermiso`. `auth.middleware.ts::evaluatePersistedPermission` (74–103) filtra permiso/módulo/acción, pero no une ni verifica `Rol.Anulado`; `requireAuth` carga `idRol` del JWT. El esquema mantiene las relaciones Usuario–Rol y Rol–RolPermiso.
- **Qué se confirma:** un `idRol` de token con permisos persistidos activos puede seguir autorizando aunque el registro del rol esté anulado.
- **Qué no se confirma:** existencia de asignaciones/permisos de ese tipo en producción ni si anular debe forzar reasignación, revocar permisos o conservarlos para restauración.
- **Impacto/severidad:** usuarios pueden mantener permisos de un rol marcado no disponible; **ALTO**, conservando clasificación previa.
- **Estado:** efecto de la consulta confirmado estáticamente; política de anulación/restauración pendiente.
- **Verificación recomendada:** fixture aislado con usuario, rol anulado y permiso activo; comprobar autorización antes y después de restaurar.

### AUD-A01-004 — El registro inicial no asigna el rol administrador que anuncia la UI

- **Módulo/funcionalidad:** bootstrap, alta inicial y RBAC.
- **Evidencia y flujo actual:** `frontend/app/(auth)/register/page.tsx` describe el primer usuario administrador y envía nombre/correo/clave, sin `idRol`. `registerSchema` permite omitir `idRol`; `auth.service.ts::register` (589–627) guarda `IdRol: null` al omitirse. Los guards requieren rol para autorizar. `backend/prisma/seed.ts` solo asigna Administrador en ejecución aparte y requiere hallar un usuario activo; `backend/src/index.ts` no llama al seed.
- **Qué se confirma:** sin paso posterior de asignación/seed, el usuario registrado no recibe rol del flujo de registro y no supera permisos de módulo.
- **Qué no se confirma:** procedimiento de instalación real, si/cuándo se ejecuta el seed ni el estado de usuarios y roles desplegados.
- **Impacto/severidad:** primera cuenta puede iniciar sesión pero no administrar; **ALTO**, condicionada a que no se ejecute el paso operativo separado.
- **Estado:** discrepancia UI/API/seed confirmada; bloqueo de una instalación desplegada, parcial/no verificado.
- **Verificación recomendada:** documentar el procedimiento autorizado y, en instalación aislada, verificar la secuencia registro → seed/asignación → primer permiso administrativo.

### AUD-A01-005 — Los canales de alta/actualización de usuario no comparten la validación de contraseña del login

- **Módulo/funcionalidad:** contraseñas de alta administrativa, actualización, cambio/restablecimiento y autenticación.
- **Evidencia y flujo actual:** `auth.validators.ts::loginSchema` exige 8–128 caracteres y `registerSchema` añade mayúscula, minúscula y número. `user.controller.ts::createUserController` (106–132) solo exige clave presente; `user.service.ts::createUser` la hashea sin aplicar esos límites. `updateUserController` (205 en adelante) acepta `clave` y `updateUser` (510–560) la hashea sin validación. Los endpoints específicos de cambio/restablecimiento comprueban mínimo ocho, no máximo 128 ni complejidad.
- **Qué se confirma:** por `POST /api/users` y por `PATCH /api/users/:id` pueden persistirse claves que `loginSchema` rechazará por longitud; las reglas de complejidad también difieren entre registro y los otros canales.
- **Qué no se confirma:** política global de complejidad, máximo deseado y tratamiento de contraseñas históricas; no se creó ningún usuario.
- **Impacto/severidad:** cuentas potencialmente inutilizables y reglas servidor distintas según canal; **MEDIO**, conservando clasificación previa.
- **Estado:** discrepancia de validadores confirmada estáticamente; criterio empresarial global pendiente.
- **Verificación recomendada:** pruebas de contrato de cada canal contra login, únicamente con base aislada y sin contraseñas reales.

### AUD-A01-006 — La reasignación de rol no actualiza el rol de sesiones ya emitidas

- **Módulo/funcionalidad:** asignación de roles, access tokens y RBAC.
- **Evidencia y flujo actual:** `auth.service.ts::signAccessToken` (255–282) incorpora `idRol`. `assignUserRoleEntity` (638–716) y `user.service.ts::updateUser` (510–563) actualizan `Usuario.IdRol` sin revocar sesiones. `requireAuth` (158–205) conserva el claim del token; refresh vuelve a leer el rol actual antes de firmar los siguientes tokens.
- **Qué se confirma:** un access token ya emitido conserva el rol anterior hasta expirar/anularse; una renovación posterior toma el rol actual. El guard de permisos consulta los grants del rol indicado por el token.
- **Qué no se confirma:** política/SLA de propagación de cambios de rol y TTL efectivo de access token en despliegue.
- **Impacto/severidad:** una degradación puede dejar permisos antiguos durante la vigencia restante; **MEDIO**, conservando clasificación previa.
- **Estado:** mecánica de claims confirmada; si es defecto depende de decisión de negocio pendiente.
- **Verificación recomendada:** caso aislado de degradación y elevación, comparando petición con token previo y posterior a refresh.

## 6. Hallazgos nuevos

### AUD-A01-007 — Renovaciones concurrentes pueden devolver refresh tokens que se invalidan entre sí

- **Módulo:** autenticación y sesiones.
- **Funcionalidad:** rotación de refresh token ante llamadas paralelas.
- **Descripción:** la renovación valida la sesión usando el hash del refresh recibido, genera un token nuevo y actualiza la fila por `Id` únicamente. No hay compare-and-swap que condicione la escritura a que `TokenSesion` todavía sea el hash presentado.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/auth.service.ts::refreshAuthTokens` (421–510): lee la sesión con el hash actual (aprox. 434–449), genera el token nuevo (475–482) y luego reemplaza `TokenSesion` por su hash mediante `update where Id` (485–490).
  - **Código:** `frontend/lib/api.ts::renewAccessToken` (49–69) actualiza el refresh token compartido en `localStorage`. `refreshPromise` (26, 97–103) evita duplicar la renovación dentro de una sola instancia del módulo, pero no sincroniza pestañas/contexts JavaScript distintos.
  - **Código:** `backend/prisma/schema.prisma::Sesion` almacena un hash por fila y la expiración, sin un mecanismo de concurrencia adicional declarado en el modelo.
- **Flujo actual comprobado:** si dos solicitudes con el mismo refresh token pasan la lectura antes de la escritura de la otra, ambas pueden continuar y generar respuestas distintas; la última escritura deja solo uno de los hashes en la fila. La respuesta cuya escritura perdió devuelve un refresh token que ya no coincide con la sesión y fallará en la renovación siguiente.
- **Impacto:** cierre inesperado de una de las sesiones/pestañas y respuesta inconsistente ante llamadas paralelas. No se demuestra acceso indebido ni alteración de datos de negocio.
- **Flujo esperado/fundamento:** el contrato de rotación debe asegurar que el cliente que recibe éxito conserva un refresh utilizable, o rechazar claramente la solicitud que perdió la carrera. No se encontró un contrato explícito para renovaciones paralelas.
- **Severidad:** **MEDIO** (disponibilidad/consistencia de sesión, no integridad de datos).
- **Dependencias:** endpoint refresh, cliente Axios, almacenamiento compartido entre pestañas y persistencia de sesión.
- **Propuesta:** hacer la rotación atómica/condicional al hash presentado y tratar la pérdida de carrera como token ya consumido; evaluar sincronización de refresh entre pestañas.
- **Pruebas recomendadas:** con SQL Server desechable, presentar el mismo refresh en dos renovaciones sincronizadas; comprobar número de éxitos y que todo token devuelto tenga comportamiento definido.
- **Estado:** **parcialmente comprobado**. La secuencia sin actualización condicional está confirmada por código; no se simuló concurrencia ni se comprobó el resultado en una base.

### AUD-A01-008 — Restaurar una sesión vuelve a activar sus credenciales no vencidas

- **Módulo:** sesiones, cierre y revocación.
- **Funcionalidad:** restauración administrativa de sesión anulada.
- **Descripción:** la operación de restaurar cambia `Sesion.Anulado` a `false` y limpia metadatos de anulación, sin cambiar el hash de token ni la expiración.
- **Evidencia técnica:**
  - **Código:** `backend/src/services/session.service.ts::restoreSession` (187–206) reabre la fila y conserva `TokenSesion` y `FechaExpiracionToken`.
  - **Código:** `auth.middleware.ts::requireAuth` (177–196) acepta tokens cuyo `sid` corresponde a una sesión no anulada y vigente.
  - **Código:** `auth.service.ts::refreshAuthTokens` (434–449) vuelve a aceptar un refresh cuyo hash coincide con la fila, que esté activa y no vencida.
  - **UI:** `frontend/app/sessions/page.tsx::restoreSessionFromTrash` (aprox. 160–180) expone la restauración para usuarios con permiso `sesiones:update`.
- **Flujo actual comprobado:** si se restaura la fila antes de la expiración y alguien conserva un access/refresh token asociado, las condiciones de sesión que antes lo rechazaban vuelven a ser verdaderas; el código no emite un token nuevo durante la restauración.
- **Impacto potencial:** una credencial previamente revocada podría volver a ser utilizable mientras conserve vigencia.
- **Flujo esperado/fundamento:** no se encontró requisito que determine si “restaurar” significa recuperar también credenciales antiguas o solo recuperar el registro administrativo. Tampoco se documentó si anular una sesión debe ser una revocación irreversible.
- **Severidad:** **PENDIENTE DE VERIFICACIÓN**; no se declara defecto hasta confirmar la política autorizada.
- **Dependencias:** administración de sesiones, logout, invalidación de access y refresh tokens.
- **Propuesta:** confirmar semántica de restauración; si la revocación debe ser final, invalidar el hash anterior o exigir reautenticación al restaurar.
- **Pruebas recomendadas:** en instancia desechable, anular y restaurar una sesión y probar access/refresh antiguos, vencidos y rotados.
- **Estado:** comportamiento del código confirmado; clasificación funcional pendiente de requisito de negocio.

## 7. Otras observaciones reevaluadas sin duplicar hallazgos

- **Consulta de permisos con escritura:** `GET /api/roles/:id/permisos` llega a `listRolePermissions`, que invoca `ensureCatalogEntries` (`backend/src/services/role-permission.service.ts`, 65–129 y 133–136). La función crea entradas faltantes y actualiza filas existentes; además, reactiva módulos/acciones anulados. Por tanto, el efecto de escritura durante esa lectura sí está presente en el código. Ya constaba como observación en el informe anterior, por lo que no se crea otro ID. La intención de reactivar el catálogo y su situación real en SQL quedan pendientes.
- **Contrato TypeScript de permisos:** el backend publica 17 claves (`role-permission.validators.ts`); `frontend/types/roles.ts::RolePermissionModuleDto` tipa 12. La matriz frontend itera los módulos recibidos y el servicio envía la lista dinámica. Se confirma un contrato estático incompleto, pero no se encontró evidencia de que las cinco claves ausentes estén ocultas en runtime o no puedan guardarse; no se promueve a defecto funcional confirmado.
- **Restauración de usuarios y roles:** la restauración conserva las relaciones/permissions persistidas; su efecto final se combina con `AUD-A01-002` y `AUD-A01-003`. No se crea otro hallazgo raíz por cada consumidor.
- **Endpoints administrativos de sesión/asignación:** la UI usa el flujo normal de login para crear sesiones, y las pantallas encontradas usan listados, anulación y restauración. La presencia de endpoints de creación/edición/consulta individual de sesión o de asignación usuario–entidad no prueba uso; no se afirma que no existan consumidores externos.

## 8. Requisitos y decisiones de negocio pendientes

1. ¿Logout debe revocar solo la sesión actual o todas las sesiones del usuario? ¿Qué comportamiento se espera si falla la llamada de revocación?
2. ¿La anulación de usuario debe invalidar de inmediato todas sus sesiones o basta con impedir renovaciones y esperar el vencimiento de access tokens?
3. ¿Anular un rol debe impedir de inmediato sus grants y exigir reasignación? ¿Qué ocurre al restaurarlo?
4. ¿Cuál es el proceso operativo obligatorio para dejar al primer usuario como administrador? ¿Debe abrirse nuevamente `/register` cuando no hay usuarios activos porque fueron anulados?
5. ¿Cuál es la política global de clave (mínimo, máximo, complejidad) y qué canales deben aplicarla: registro, alta administrativa, edición, cambio y restablecimiento?
6. ¿Cambiar/restablecer una clave debe revocar otras sesiones?
7. ¿Cuál es la duración aprobada de access/refresh tokens y cómo deben tratarse refresh concurrentes entre pestañas/dispositivos?
8. ¿La restauración de una sesión debe revalidar credenciales emitidas anteriormente o requerir login nuevo?
9. ¿Es intencional que consultar permisos repare/reactive entradas del catálogo?
10. ¿Los endpoints administrativos de sesión y asignación tienen consumidores externos al frontend de este repositorio?

## 9. Pruebas realizadas y limitaciones

- **Pruebas ejecutadas en esta revisión:** ninguna. Se limitó el trabajo a lectura estática; no se afirmó que ningún test/build haya pasado.
- **Motivo:** no se pudo establecer que las pruebas de integración apuntaran a una base aislada y desechable. El informe previo documenta problemas del pool Prisma, pero ese resultado histórico no se tomó como prueba actual ni se volvió a intentar.
- **Pruebas dinámicas pendientes:** escenarios de los hallazgos 001–008, permisos persistidos/roles anulados, alta inicial y ciclo de contraseñas, renovación paralela y restauración de sesiones.
- **Requisitos de entorno seguro antes de ejecutar esas pruebas:** SQL Server local/temporal desechable, schema y seed propios del test, credenciales y claves de prueba aisladas, servicios externos/FEL/n8n deshabilitados o simulados, datos sintéticos, comprobación previa del datasource efectivo y limpieza limitada a esa base. No reutilizar una instancia compartida ni ejecutar migraciones/seeds sin autorización y entorno aislado.
- **Operaciones prohibidas/no realizadas:** CRUD de usuarios/roles/sesiones, consultas a base desplegada, seed, migraciones, SQL, llamadas externas y escrituras de archivos funcionales.

## 10. Resumen de cobertura y asuntos pendientes

| Superficie | Cobertura estática | Limitación principal |
|---|---|---|
| Login, refresh y logout | UI, cliente HTTP, ruta, controlador, validación, servicio y persistencia de sesión | Sin reproducción contra base aislada |
| Bootstrap y asignación inicial | UI, guard de bootstrap, validador, servicio, seed y arranque del servidor | Procedimiento de instalación desplegado no confirmado |
| Usuarios y contraseñas | UI de alta/edición y referencias de cambio/reset; rutas, controladores, servicios y validadores | No se hicieron operaciones de usuario; política global no documentada |
| Roles, permisos y autorización | UI de permisos, tipos, rutas, middleware, servicio de catálogo y modelos | Sin instancia para verificar datos efectivos del catálogo |
| Anulación/restauración de usuarios, roles y sesiones | Servicios, guards, relaciones y consumidores frontend encontrados | Política de inmediatez/irreversibilidad pendiente |
| Consumidores RBAC de otros dominios | Montaje global de `requireAuth` y mecanismos comunes de permisos | No se auditó la lógica interna de esos módulos |

**Pendientes técnicos:** validar con fixtures el comportamiento posterior a anulación de usuario/rol; verificar matriz RBAC y seed en instancia aislada; reproducir concurrencia de refresh; aclarar efecto de restauración de sesión; cubrir todos los caminos de cambio de clave; confirmar uso externo de endpoints cuyo consumidor no aparece en este frontend.

**Conclusión de cobertura:** los flujos principales del alcance fueron seguidos estáticamente hasta persistencia y consumidores relevantes. La auditoría A01 está completa únicamente en esa modalidad y en el commit registrado. La validación dinámica, el estado de despliegue y las políticas de negocio permanecen explícitamente pendientes.
