# Implementación A06 — Calidad, configuración, producción e integraciones

**Fecha:** 2026-10-12 (UTC-06:00)
**Rama:** `developer`
**Commit base:** `90e2fea78a058599d4d9da20da306453f70514ab`
**Estado:** implementación A06 previa al commit solicitado.
**Alcance:** correcciones respaldadas por los hallazgos A06, sin definir políticas empresariales pendientes.

## 1. Resumen ejecutivo

Se implementaron tres correcciones acotadas:

- La edición y la validación de un control de calidad ahora usan escrituras condicionales por estado, evitando que una edición tardía modifique un registro después de validarlo.
- Las carreras de creación/restauración que colisionan con la unicidad activa se convierten en un conflicto de negocio explícito. El repositorio ya incluye la migración `20260928231739_control_calidad_fecha_unica`, que crea un índice único filtrado por `Anulado = 0`; no se creó otra migración ni se modificó la histórica.
- El cliente n8n rechaza timeouts no enteros, no positivos o superiores al máximo admitido por `setTimeout`, y no realiza la solicitud cuando la configuración es inválida.

`AUD-A06-001` y `AUD-A06-005` permanecen pendientes de definición empresarial. La fabricación sigue siendo una brecha técnica: la página de producción es un marcador y las estructuras de producto son un catálogo de insumos/cantidades, no una operación de fabricación. No se conectaron recetas a movimientos de existencias ni se inventaron reglas de producción o calidad.

Las pruebas focalizadas aprobaron **21/21** y el build backend aprobó. No se ejecutaron migraciones, pruebas SQL Server ni integraciones externas.

## 2. Estado de hallazgos A06

| ID original | Descripción y evidencia actual | Estado final |
|---|---|---|
| `AUD-A06-001` | `quality.validators.ts::listControlCalidadQuerySchema` admite `anio` o `mes` de manera individual, pero `quality.service.ts::listControlCalidad` solo agrega límites de fecha cuando recibe ambos. La petición parcial todavía puede producir una consulta sin ese filtro. | **Pendiente de decisión de contrato.** No se eligió entre aceptar año/mes individuales, exigir ambos o rechazar entradas parciales. |
| `AUD-A06-002` | La creación/restauración consulta duplicados antes de escribir. Ya existe `backend/prisma/migrations/20260928231739_control_calidad_fecha_unica/migration.sql`, con índice SQL Server único filtrado para fechas activas. `schema.prisma` solo representa el índice ordinario `[Fecha, Anulado]`, pues Prisma no expresa el predicado de filtro. | **Corregido en el código y en el artefacto versionado, con validación limitada.** El servicio traduce `P2002` de creación/restauración al conflicto de fecha ya reconocido por el controlador. No se confirmó que el índice esté aplicado en una base ni que los datos existentes permitan crearlo. |
| `AUD-A06-003` | Antes, edición y validación leían el estado y después actualizaban por ID sin condición de estado en la escritura. | **Corregido en código, con validación limitada.** Ambas escrituras ahora condicionan `updateMany` a `Id`, `Anulado = false` y `Validado = false`. Una edición que pierde la carrera detecta el registro validado y devuelve conflicto en vez de cambiarlo. |
| `AUD-A06-004` | Antes, `N8N_WEBHOOK_TIMEOUT_MS` se convertía a número y se pasaba directamente a `setTimeout`. | **Corregido en código.** Solo se aceptan enteros entre 1 y 2 147 483 647 ms. Un valor inválido devuelve `invalid_timeout` y no llama al webhook. Se conserva el timeout predeterminado de 5000 ms únicamente cuando la variable no está definida. |
| `AUD-A06-005` | Empresa persiste y presenta fechas de vigencia FEL; no se encontró evidencia de que `fel.service.ts` las use para permitir, advertir o bloquear la emisión. | **Pendiente de decisión de negocio/fiscal.** No se alteró la emisión ni se asumió que el rótulo de vigencia deba imponer una regla. |

Los hallazgos originales y sus severidades/evidencias se conservan en [A06_REVISION_CALIDAD_EMPRESA_PRODUCCION.md](./A06_REVISION_CALIDAD_EMPRESA_PRODUCCION.md) y [11_MATRIZ_MAESTRA_HALLAZGOS.md](./11_MATRIZ_MAESTRA_HALLAZGOS.md). No se añadieron IDs ni se reasignó la propiedad de hallazgos.

## 3. Cambios implementados

### Calidad

En `backend/src/services/quality.service.ts`:

- La edición conserva las validaciones actuales y actualiza únicamente si el registro sigue activo y no validado. Si la actualización condicional afecta cero filas, el servicio distingue entre un registro inexistente/anulado y uno que ya fue validado.
- La acción de validar también se realiza como transición condicional desde activo/no validado; después vuelve a leer el DTO existente.
- La creación y restauración convierten un error Prisma `P2002` en el conflicto de fecha duplicada que la API ya mapea a HTTP 409. Los demás errores se propagan.
- No se cambió la regla de mediciones, el significado de “día no laborado”, los permisos, los umbrales sanitarios ni los efectos operativos.

El índice filtrado existente protege la unicidad activa cuando la migración está aplicada. El esquema Prisma conserva `@@index([Fecha, Anulado])` y no declara una unicidad filtrada; futuras operaciones de esquema deben preservar el índice SQL manual. La migración histórica no se modificó y no se volvió a ejecutar.

### Notificaciones n8n

En `backend/src/services/n8n-webhook.client.ts`, el timeout se valida antes de crear el temporizador o invocar `fetch`. El límite superior corresponde al máximo de retardo aceptado por el runtime de Node.js, no a una política de entrega aprobada por la empresa. Se añadió el resultado explícito `invalid_timeout`; no se cambia el contrato HTTP externo ni se contacta el workflow.

### Pruebas

- `backend/src/tests/quality.service.spec.ts`: cubre las escrituras condicionales de edición/validación y el mapeo de colisión `P2002` en creación/restauración.
- `backend/src/tests/n8n-webhook.client.spec.ts`: cubre configuración no numérica, negativa, cero, superior al límite y el límite máximo válido; en configuraciones inválidas verifica que `fetch` no se invoque.

## 4. Recetas, producción e inventario

Se verificó el estado vigente del código:

- `frontend/app/production/page.tsx` renderiza `ModulePlaceholder`.
- `backend/src/app.ts` no monta un router de producción; no se encontró una API/servicio de órdenes de fabricación en la superficie revisada.
- `EstructuraProducto` y `product-structure.service.ts` administran relaciones entre producto terminado e insumos con una cantidad requerida. Guardar, editar, anular o visualizar esa estructura no ejecuta `inventory-movement.service.ts` ni registra consumo o recepción de inventario.
- No se comprobó una entidad de orden/lote de fabricación, cálculo por unidad/conversión, rendimiento real, merma, trazabilidad de insumo a producto terminado ni integración de control de calidad con lotes.

Por tanto, **no se confirmó un flujo funcional de fabricación**. La utilidad demostrada del módulo de recetas es configurar/listar componentes del producto; no fabrica ni modifica existencias. No se conectó automáticamente la receta al inventario y no se añadió una segunda deducción al vender. Las salidas comerciales de productos siguen bajo el flujo de ventas/inventario existente, propiedad de A02/A03.

Antes de diseñar fabricación, el negocio debe definir: disponibilidad/reserva de insumos; unidades y conversiones; cantidades teóricas frente a reales; rendimientos y política de merma; productos terminados recibidos; trazabilidad de movimientos; idempotencia y concurrencia; cancelación/reversión/reproceso; y, si aplica, lotes, caducidad y controles/liberación de calidad.

## 5. Calidad, Empresa, FEL y n8n: límites funcionales

- **Calidad:** el módulo registra controles de agua (pH/cloro) y permite validarlos. No se encontró evidencia de que el estado validado autorice o bloquee producción, existencias, venta o liberación de producto. No se añadieron bloqueos sanitarios ni reglas de conformidad.
- **Empresa/FEL:** los campos de vigencia FEL y `RegimenIsr` permanecen persistidos. No se cambiaron fuentes de configuración fiscal ni se emitieron/anularon comprobantes.
- **n8n:** se probaron las ramas del cliente HTTP con dobles locales. No se verificó el workflow remoto, conectividad, eventos aceptados, entrega garantizada ni reintentos. La política de entrega actual continúa siendo la existente.

## 6. Archivos modificados

- `backend/src/services/quality.service.ts` — transición condicional de estados y respuesta coherente ante colisión de unicidad.
- `backend/src/tests/quality.service.spec.ts` — pruebas de carreras simuladas y unicidad.
- `backend/src/services/n8n-webhook.client.ts` — validación explícita del timeout.
- `backend/src/tests/n8n-webhook.client.spec.ts` — cobertura de límites y rechazo sin llamada externa.
- `docs/auditoria-funcional/IMPLEMENTACION_A06_CALIDAD_CONFIGURACION_PRODUCCION.md` — este informe.

No hubo cambios en frontend, `schema.prisma`, migraciones, dependencias, configuración FEL ni datos.

## 7. Pruebas y validación

| Verificación | Resultado |
|---|---|
| `npm --prefix backend test -- src/tests/quality.service.spec.ts src/tests/n8n-webhook.client.spec.ts` | **Aprobado:** 2 archivos, 21 pruebas. |
| `npm --prefix backend run build` | **Aprobado:** TypeScript y copia de plantillas. |
| `git diff --check` | **Aprobado:** sin errores de whitespace. |
| Prisma validate/generate y frontend TypeScript/build | No ejecutados; no hubo cambios de esquema ni frontend. |
| ESLint | No ejecutado; el manifiesto del backend no define un script lint. |
| SQL Server, migración e integración de concurrencia real | No ejecutados; no se confirmó una base aislada/desechable. |
| FEL y n8n externos | No contactados; las pruebas n8n usan `fetch` simulado. |
| Interacción visual autenticada | No ejecutada; no hubo cambios de interfaz. |

Las pruebas unitarias mockeadas no demuestran la semántica de concurrencia del nivel de aislamiento de SQL Server ni el estado aplicado de la migración.

## 8. Dependencias, decisiones pendientes y riesgos residuales

### Decisiones concretas pendientes

1. **Filtro de calidad:** ¿se permite consultar solo año, solo mes y ambos, o se rechaza toda combinación parcial?
2. **Controles de calidad:** ¿qué parámetros/rangos, unidades, frecuencia/calendario y aprobaciones se exigen? ¿La validación de agua afecta algún proceso y cuál es su regla aprobada?
3. **Edición/restauración:** ¿puede restaurarse un registro anulado si ya existe otro activo para la fecha? ¿Se permite desvalidar/revalidar y quién lo autoriza?
4. **Vigencia FEL:** ¿las fechas son informativas, contractuales o una autorización temporal de emisión? ¿Qué fuente/configuración prevalece por ambiente?
5. **n8n:** ¿qué workflow/eventos/payloads son el contrato vigente? ¿La notificación es informativa u obligatoria, requiere reintentos/deduplicación y qué timeout de negocio se acepta?
6. **Producción:** ¿qué etapas/estados, fórmulas, unidades, conversiones, rendimientos, mermas y cantidades reales se aplican? ¿Cómo se manejan insumos, productos terminados, concurrencia, repetición, cancelación, reversa y lotes/calidad?
7. **Régimen fiscal:** ¿`RegimenIsr` es dato informativo o debe alterar un documento/proceso? ¿Quién es la fuente autorizada?

### Dependencias con A01–A05

- **A01:** autenticación/permisos de rutas permanecen fuera de este cambio; la revisión no modifica RBAC.
- **A02:** conserva la orquestación comercial y emisión FEL; `AUD-A06-005` se coordina con `AUD-A02-005` sin duplicarlo.
- **A03:** conserva inventario, kardex, compras y movimientos. Cualquier futuro consumo/recepción de fabricación debe coordinarse con A03 y probarse sin duplicar movimientos.
- **A04:** sus eventos logísticos son emisores n8n; no se alteraron flujos de logística.
- **A05:** no se encontró consumo directo de producción/calidad por planilla; no se modificó su lógica.

### Riesgos y próximos pasos

- Verificar en un SQL Server aislado que no haya fechas activas duplicadas y que la migración histórica esté aplicada; comprobar que el índice filtrado no se pierda por drift de Prisma.
- Ejecutar pruebas concurrentes reales para edición/validación y creación/restauración con fixtures sintéticos.
- Definir las políticas enumeradas antes de conectar recetas a movimientos, bloquear operaciones por calidad o cambiar la autorización FEL.
- Probar n8n/FEL únicamente con simuladores o entornos aislados y sin credenciales/efectos reales.

## 9. Estado de Git y cierre

La rama sigue siendo `developer`, con `HEAD` en `90e2fea78a058599d4d9da20da306453f70514ab`; no se creó commit. `git diff --check` pasó. Git muestra cuatro archivos backend modificados y este informe nuevo; los demás documentos de auditoría ya no seguidos permanecen preservados y no se alteraron. Los cambios quedan listos para revisión y commit manual.
