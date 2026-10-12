# Implementación A01 — Identidad, acceso y sesiones

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama y commit base:** `developer`, `27f59fa024a804c468c434cfd504baa0b865a362`  
**Alcance:** autenticación, sesiones, usuarios, roles, permisos, bootstrap y validación de contraseñas.  
**Entorno:** revisión y pruebas locales; no se verificó una instancia desplegada.

## 1. Resumen

- El logout de la interfaz ahora solicita la revocación del refresh token correspondiente antes de limpiar el estado local. Si la API falla, la interfaz igualmente termina la sesión local y comunica que la revocación en el servidor no pudo confirmarse.
- La anulación de un usuario ahora anula sus sesiones activas en la misma transacción y el middleware comprueba el estado activo del usuario para tokens ligados a una sesión. Los registros se conservan.
- La autorización persistida y el DTO de permisos dejan de conceder permisos a un rol anulado.
- La rotación de refresh utiliza una actualización condicional por hash, sesión y vigencia. Una solicitud concurrente que perdió la carrera recibe rechazo explícito.
- Las rutas administrativas de creación, actualización, cambio y restablecimiento comparten los límites de contraseña de login, de 8 a 128 caracteres. No se agregaron requisitos de complejidad nuevos.
- El registro sin autenticar no puede asignar `idRol` mediante un payload manipulado. La asignación de administrador del primer usuario sigue sin implementarse porque el procedimiento autorizado de bootstrap no está definido.

## 2. Estado de los ocho hallazgos

| ID | Estado final | Evidencia de implementación y límite |
|---|---|---|
| `AUD-A01-001` | **corregido con validación limitada** | `AuthProvider.logout` llama al servicio backend con el refresh token antes de limpiar el almacenamiento local; una falla se muestra al usuario y la limpieza local ocurre en `finally`. La revocación servidor marca anulada la sesión asociada, y el middleware rechaza sesiones anuladas. Prueba unitaria confirma la actualización persistida mediante Prisma simulado; no se verificó logout en navegador/SQL Server. La restauración administrativa de sesiones permanece pendiente en `AUD-A01-008`. |
| `AUD-A01-002` | **corregido con validación limitada** | `deleteUser` desactiva el usuario y anula solo sus sesiones activas dentro de una transacción; no elimina registros. `requireAuth` comprueba que el usuario de una sesión vigente siga activo. Pruebas unitarias verifican el alcance de `IdUsuario` y el rechazo del middleware. Falta validación de integración con SQL Server aislado. |
| `AUD-A01-003` | **corregido con validación limitada** | Tanto la resolución de permisos enviada al cliente como la evaluación backend consultan que el rol siga activo antes de considerar sus grants. Prueba unitaria confirma que un rol anulado no alcanza la evaluación de permisos persistidos. Sin validación sobre catálogo desplegado. |
| `AUD-A01-004` | **pendiente de decisión de negocio** | El registro no autenticado rechaza explícitamente un `idRol` enviado por el cliente; el primer registro sin rol no se convierte en administrador automáticamente y la UI ya no lo anuncia como tal. Continúa pendiente definir el mecanismo autorizado (seed, asignación manual u otro), el control de concurrencia/repetición y cuándo habilitar registro posterior. |
| `AUD-A01-005` | **corregido con validación limitada** | `passwordSchema` comparte los límites existentes de login (8–128) y se aplica a alta, actualización directa, cambio y restablecimiento. Registro conserva sus validaciones de complejidad preexistentes, que son más estrictas, pero cualquier clave aceptada sigue cumpliendo los límites de login. Pruebas de límites y de los controladores afectados pasaron; no se modificaron hashes ni se verificaron cuentas existentes. |
| `AUD-A01-006` | **pendiente de decisión de negocio** | No se cambió la propagación de una reasignación de rol a tokens ya emitidos: el token sigue conservando su `idRol` hasta renovación/expiración. Se aplica el control nuevo de rol anulado, pero un rol anterior que siga activo puede seguir concediendo sus grants durante esa ventana. Hace falta definir la latencia/SLA de degradaciones y elevaciones. |
| `AUD-A01-007` | **corregido con validación limitada** | La renovación actualiza por `Id`, `IdUsuario`, hash presentado, estado activo y vencimiento; solo devuelve credenciales si una fila fue rotada. Si otra pestaña ya almacenó un refresh nuevo para el mismo usuario, el cliente reintenta con esa credencial (máximo dos reintentos). Las pruebas simuladas verifican rechazo cuando la actualización condicional afecta cero filas y consistencia del hash al tener éxito. La atomicidad de `updateMany` no se reprodujo en SQL Server; falta prueba concurrente real en una base desechable/navegador. |
| `AUD-A01-008` | **pendiente de decisión de negocio** | No se alteró `restoreSession`: el código existente vuelve a activar la fila manteniendo hash y expiración. Por ello, una restauración anterior al vencimiento puede reactivar credenciales conservadas, incluso después del logout. No se añadieron mecanismos de recuperación. Se requiere decidir si restaurar es solo administrativo o también recupera las credenciales. |

## 3. Archivos modificados

### Backend

- `backend/src/controllers/auth.controller.ts` — impide asignar un rol desde registro no autenticado.
- `backend/src/controllers/user.controller.ts` — valida los límites compartidos de contraseña en todos los endpoints administrativos relevantes.
- `backend/src/middlewares/auth.middleware.ts` — comprueba sesión y usuario activos para tokens con `sid`; bloquea autorización derivada de roles anulados. Los errores de persistencia ya no se convierten en respuestas 401 por el bloque de verificación JWT.
- `backend/src/services/auth.service.ts` — filtra roles anulados al generar permisos, condiciona la rotación de refresh al hash vigente y permite que errores de persistencia de logout se propaguen como errores del servidor.
- `backend/src/services/user.service.ts` — anula las sesiones del usuario dentro de la misma transacción de desactivación.
- `backend/src/validators/auth.validators.ts` — define y reutiliza los límites de contraseña ya exigidos por login.

### Frontend

- `frontend/components/auth-provider.tsx` — invoca la revocación del servidor, limpia el estado local incluso ante error y notifica si no se confirmó la revocación.
- `frontend/lib/api.ts` — permite a una pestaña que perdió una rotación concurrente reintentar con el refresh recién guardado por otra pestaña del mismo usuario.
- `frontend/app/(auth)/register/page.tsx` — aclara que el registro inicial no asigna privilegios administrativos; limita el campo de clave a 128 caracteres.
- `frontend/app/users/_components/user-form-card.tsx` — limita a 128 caracteres la clave de alta.
- `frontend/app/users/create/page.tsx` — valida el mismo rango 8–128 en la interfaz administrativa.
- `frontend/app/users/change-password/page.tsx` y `frontend/app/users/[id]/reset-password/page.tsx` — limitan a 128 caracteres las claves nuevas.

### Pruebas añadidas

- `backend/src/tests/auth-a01.controller.spec.ts` — rechaza un rol manipulado durante bootstrap y comprueba que el registro inicial no inventa un rol.
- `backend/src/tests/auth-a01.middleware.spec.ts` — rechazo de sesión revocada, usuario anulado y rol desactivado.
- `backend/src/tests/auth-a01.refresh.spec.ts` — rotación concurrente condicional, coherencia de token rotado y revocación de logout.
- `backend/src/tests/user-a01.controller.spec.ts` — límites de contraseñas en creación, actualización, cambio, restablecimiento y login.
- `backend/src/tests/user-a01.service.spec.ts` — anulación transaccional y acotada de sesiones del usuario desactivado.

## 4. Pruebas y comprobaciones ejecutadas

- **Pruebas A01 aisladas:** `npm test -- src/tests/auth-a01.middleware.spec.ts src/tests/auth-a01.controller.spec.ts src/tests/user-a01.controller.spec.ts src/tests/user-a01.service.spec.ts src/tests/auth-a01.refresh.spec.ts` desde `backend/` — **5 archivos, 14 pruebas aprobadas**. Las pruebas nuevas simulan Prisma y no escriben en una base de datos.
- **Compilación backend:** `npm run build` desde `backend/` — **aprobada** (`tsc` y copia de plantillas de reportes).
- **Type-check frontend:** `npx tsc --noEmit` desde `frontend/` — **aprobado**.
- **ESLint frontend:** lint de los archivos modificados excepto `frontend/app/users/create/page.tsx` — **aprobado**. Al incluir ese archivo, ESLint reportó `react-hooks/set-state-in-effect` en la llamada preexistente a `setForm` del efecto de selección de empleado (línea 72); no se cambió porque no corresponde a A01.
- **Selección adicional de `auth-rbac.spec.ts`:** se intentó junto con las pruebas dirigidas. Resultado de esa ejecución inicial: **18 aprobadas y 3 fallidas de 21**; las tres expectativas de autorización recibieron 401 por usar un token sintético sin sesión/usuario activo bajo el primer cambio del middleware. Se ajustó el control de usuario para aplicarse a tokens ligados a `sid`, tal como los emite el login vigente, pero no se repitió la prueba: su configuración emplea Prisma/SQL Server y no se confirmó que la base sea aislada. Este resultado no se presenta como prueba aprobada.
- No se ejecutaron la suite completa, migraciones, seeds, consultas de escritura ni operaciones externas. No se comprobó SQL Server aislado ni se validó producción.

## 5. Decisiones pendientes y pasos de verificación manual

Decisiones humanas requeridas, conforme a `14_DECISIONES_NEGOCIO_PENDIENTES.md`:

1. Procedimiento protegido para otorgar el rol administrador al primer usuario, tratamiento de concurrencia/repetición y política de registro cuando no haya usuarios activos.
2. Latencia aceptable para reasignar/degradar o elevar roles en sesiones vigentes.
3. Semántica de restaurar una sesión anulada: recuperar credenciales previas o únicamente el registro administrativo.
4. Alcance de logout entre sesión actual y todas las sesiones, y UX si el servidor no confirma la revocación. La implementación usa el refresh token local para revocar la sesión asociada; si no hay refresh token, el endpoint existente revoca las sesiones del usuario autenticado.
5. Política global de complejidad de contraseñas. Se conservaron los requisitos previos y solo se igualaron los límites demostrables de login.
6. Política de concurrencia esperada entre pestañas para refresh. El servidor ahora rechaza explícitamente una rotación que perdió la comparación.

Cuando exista una base SQL Server desechable y aislada, repetir en ella: logout seguido de uso del access/refresh anterior; desactivación con varias sesiones y solicitud protegida; rol anulado con permisos persistidos; bootstrap con `idRol` manipulado y solicitudes concurrentes/repetidas; rotaciones simultáneas con el mismo refresh; y anulación/restauración con credenciales anteriores.

## 6. Riesgos de regresión y dependencias

- `requireAuth` protege rutas de todos los grupos A02–A06. Para tokens de sesión vigentes ahora consulta también el estado del usuario; `requireModulePermission` consulta que el rol continúe activo. Esto aumenta consultas al SQL Server en rutas protegidas; se debe observar latencia y disponibilidad en entorno aislado.
- Los tokens sin `sid` conservan el comportamiento anterior por compatibilidad; los tokens emitidos por el login actual incluyen `sid`. Debe confirmarse que ningún emisor legítimo externo dependa de tokens sin sesión.
- Una falla de red durante logout limpia los tokens locales, pero el servidor podría conservar la sesión; la interfaz lo indica y no afirma revocación exitosa. La sesión expirará o deberá revocarse administrativamente.
- El reintento entre pestañas está acotado a dos intentos y al mismo `id` de usuario almacenado; no se ejecutó una prueba de navegador con solicitudes simultáneas.
- El flujo de restauración existente puede reactivar credenciales anuladas antes de su expiración. Afecta logout y la semántica de recuperación hasta que se decida `AUD-A01-008`.
- Los permisos almacenados en cliente pueden permanecer visualmente obsoletos hasta que la UI sincronice; el backend vuelve a comprobar el rol activo y no confía en ellos para autorizar.
- No hubo cambios de esquema, dependencias, contratos de endpoints ni lógica funcional de A02–A06.

## 7. Confirmación de alcance

Se preservó la carpeta de auditoría preexistente que Git mostraba como no seguida. No se modificaron sus informes originales ni los documentos maestros 00–14. No se crearon commits, no se cambió de rama, no se ejecutaron migraciones ni seeds y no se realizaron escrituras sobre datos compartidos. Las comprobaciones de integración que requieren una base aislada permanecen pendientes.
