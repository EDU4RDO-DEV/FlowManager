# A06 — Revisión de calidad, empresa, producción e integraciones internas

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Modalidad:** revisión estática, solo lectura  
**Estado:** parcialmente completa; no certifica datos desplegados, configuración efectiva ni integraciones externas

## 1. Resumen ejecutivo

Se trazaron la pantalla y API de control de calidad de agua, la configuración empresarial editable, la configuración interna del servicio FEL, la integración de notificaciones con n8n y las superficies de producción/estructura de producto. Se contrastaron con el esquema Prisma, rutas montadas, validadores, servicios, pruebas existentes y los límites asignados a A01–A05.

Resultados principales:

- **Calidad:** existe un flujo frontend/API persistido para registrar cuatro mediciones diarias de pH/cloro, identificar días no laborados, modificar registros no validados, validar, anular, restaurar y consultar fechas faltantes. Es un registro de control de agua, no un sistema general de inspección de materias primas, lotes o producto terminado. No se halló un consumidor que use su estado para permitir o bloquear producción, inventario o liberación de producto.
- **Producción:** la ruta UI sigue renderizando `ModulePlaceholder`; `backend/src/app.ts` no monta router de producción. Hay administración CRUD de estructuras producto-componente (BOM), pero no órdenes, ejecución, lotes de producción, genealogía ni movimientos de consumo/recepción derivados de fabricación demostrados.
- **Empresa:** la UI permite consultar y guardar el perfil empresarial y subir un logotipo. Los datos persisten en `Empresa`. Las fechas rotuladas como vigencia FEL se guardan, pero el servicio FEL no las consulta al preparar una emisión. La semántica empresarial de esas fechas y del régimen ISR no está especificada, por lo que se registra como pendiente de confirmación, no como incumplimiento probado.
- **FEL:** configuración de entorno, credenciales, transporte SOAP, validación del receptor, certificados y restricciones de producción están implementadas en código. Solo se inspeccionó estáticamente: no se leyeron valores de entorno/certificados ni se contactó al proveedor. Los hallazgos comerciales y de atomicidad venta/FEL permanecen bajo A02.
- **n8n:** el backend serializa eventos a un webhook con secreto opcional, timeout y clasificación de errores; los envíos de negocio son asíncronos y no bloquean la operación principal. No hay workflow remoto versionado ni se verificó la instancia. El documento técnico enumera emisores que no concuerdan con todos los emisores actuales en el código.

Se registran **5 hallazgos A06**: **2 MEDIO**, **2 BAJO** y **1 PENDIENTE DE VERIFICACIÓN**. Por estado: **1 confirmado estáticamente**, **3 parcialmente comprobados** (incluidas condiciones de concurrencia/configuración no reproducidas) y **1 pendiente de decisión de negocio**. No se asigna hallazgo de defecto a la ausencia de producción ni a la falta de acoplamiento entre calidad y producción porque el repositorio no contiene un requisito autorizado que defina esos flujos.

La auditoría está **parcialmente completa**: se examinó estáticamente el recorrido principal de las capas presentes, pero no se verificaron datos SQL Server, concurrencia real, umbrales de calidad, ambiente FEL ni recepción/efectos de n8n. No se ejecutaron pruebas, builds, CRUD, migraciones, seeds, SQL ni operaciones externas.

## 2. Alcance, punto de partida y exclusiones

### Punto de partida

- Raíz: `D:\Universidad Mariano Gálvez\FlowManager`.
- Rama y commit: `developer`, `27f59fa024a804c468c434cfd504baa0b865a362`.
- Estado inicial: `## developer...origin/developer` y `?? docs/auditoria-funcional/`. La carpeta no seguida era la condición conocida y documentada; se preservó íntegra. No se observaron otros cambios.
- La ruta de este informe no existía en el inventario previo; no se encontró otro archivo A06. Se crea este informe sin sobrescribir documentos existentes.

### Incluido

- Control de calidad de agua desde UI, API, validadores, servicio y modelo.
- Configuración de empresa expuesta por UI/API y su persistencia.
- Existencia de formularios, endpoints, servicios, modelos y consumidores de producción/BOM.
- Lectura estática de configuración, validaciones, transporte, errores y estados internos de FEL.
- Emisores n8n, cliente webhook, documentación disponible y diferencias entre contrato descrito y código.
- Dependencias de identidad/RBAC, inventario, ciclo comercial, logística y planilla solo hasta confirmar los límites de responsabilidad.

### Excluido

- Reportes, gráficas, dashboards, KPI, métricas analíticas y preferencias exclusivamente visuales de reportes.
- Auditoría de la lógica comercial de ventas, pagos, cartera y coherencia fiscal de venta/FEL (A02); existencias, bitácora, compras y reversas (A03); logística/rutas/entregas (A04); personal y planilla (A05); autenticación/RBAC general (A01).
- Toda escritura a base de datos, operaciones reales de producción/calidad, pruebas con efectos, acceso a ambientes o servicios externos, consulta/alteración FEL, ejecución de automatizaciones y lectura de valores secretos.

## 3. Arquitectura y componentes examinados

### Calidad

`frontend/app/quality/page.tsx` → `frontend/services/quality.service.ts` → `/api/calidad` → `backend/src/routes/quality.routes.ts` → `quality.controller.ts` → `quality.validators.ts` → `quality.service.ts` → `ControlCalidadAgua` en Prisma.

`backend/src/app.ts` monta `/api/calidad` detrás de `requireAuth`; cada endpoint requiere permiso `calidad` por operación. La UI emplea permisos de lectura/alta/edición/baja. A01 conserva la responsabilidad por defectos del middleware o política RBAC compartida.

### Empresa

`frontend/app/company/page.tsx` → `frontend/services/company.service.ts` → `/api/company/settings` y `/api/company/logo` → router/controlador → validación de empresa → `backend/src/services/company.service.ts` → modelo `Empresa`; el logo se escribe en el directorio local de uploads.

Las rutas de empresa están detrás de autenticación y exigen `empresa:read` o `empresa:update`. Se comprobó que la UI construye y envía los campos de la configuración; la persistencia se limita al registro activo que selecciona el servicio.

### Producción / estructura de producto

`frontend/app/production/page.tsx` renderiza un marcador de posición. El router `/api/product-structure` administra el catálogo BOM mediante `product-structure.routes.ts` y `product-structure.service.ts`, relacionado con `InventarioItem` a través de `EstructuraProducto`. La ruta BOM es de inventario y no llama al servicio de movimientos de stock.

### FEL y n8n

- FEL: `backend/src/services/fel.service.ts`; A02 conserva el flujo comercial que llama `emitFelInvoice`/`anulateFelInvoice` y la consistencia fiscal de venta/SQL.
- n8n: `notification.service.ts` declara eventos; `n8n-webhook.client.ts` realiza el POST; controladores/servicios de venta y logística son emisores. La documentación disponible describe una instancia/workflow externo, pero no contiene evidencia versionada del runtime remoto.

## 4. Estado real de producción y fabricación

### Interfaz y navegación

- La página actual de producción (`frontend/app/production/page.tsx`, `ProductionPage`) muestra el título y descripción de “Registro diario de producción, lotes y trazabilidad de planta”, pero su contenido es `ModulePlaceholder`. No se encontraron formularios o acciones operativas de producción en esa ruta.
- `backend/src/app.ts::createApp` no monta un router de producción; tampoco se identificó router, controlador, validador o servicio de órdenes de fabricación.
- La clave `produccion` existe en el catálogo de permisos (`backend/src/validators/role-permission.validators.ts`), lo cual permite configurar permisos, pero no proporciona endpoints ni demuestra un proceso funcional.

### API, persistencia y efectos de inventario

- `EstructuraProducto` contiene producto terminado, materia prima e `CantidadRequerida`; relaciona ambos extremos con `InventarioItem`. El servicio valida categorías activas, cantidades/duplicidad y permite listar, crear, modificar, anular y restaurar componentes.
- La estructura no incorpora operación, orden, fecha/lote, unidad/factor de conversión, rendimiento, merma o versión de receta en la entidad revisada. El campo de cantidad no prueba que exista cálculo de consumo real.
- No se encontró un modelo de lote de producción ni una relación de producción con `BitacoraInventario`. `product-structure.service.ts` no importa ni ejecuta `inventory-movement.service.ts`; las operaciones BOM examinadas no consumen insumos ni incorporan producto terminado a existencias.
- La categoría de producto y existencia pertenecen a inventario (A03). No se presume que disponer de un producto terminado, materia prima o receta equivalga a su fabricación.

**Conclusión funcional:** el catálogo de estructuras de producto está implementado; el flujo de fabricación desde orden hasta producto terminado e inventario no está demostrado en el commit inspeccionado. Esta conclusión se refiere al código disponible, no a procesos manuales o sistemas externos. No es un hallazgo de defecto sin requisitos que ordenen implementar producción.

## 5. Estructuras de producto, lotes y trazabilidad

- **Confirmado estáticamente:** existen CRUD de `EstructuraProducto` y relaciones a producto terminado y materia prima/insumo (`schema.prisma::EstructuraProducto`, `product-structure.routes.ts`, `product-structure.service.ts`).
- **Parcialmente comprobado:** las páginas de inventario permiten seleccionar productos terminados y gestionar su BOM; no se recorrió cada formulario de administración de inventario porque el proceso de fabricación no existe en el código identificado.
- **No demostrado:** lote como unidad de fabricación, asignación/consumo de materia prima, salida de producto terminado, trazabilidad hacia atrás/adelante, unidad de medida, conversión, rendimiento, desperdicio, re-proceso o enlace de calidad con lotes.
- **Integración A03:** A03 revisa la semántica de producto, existencias y bitácora. No se duplica ninguno de sus hallazgos de stock (`AUD-A03-001`, `AUD-A03-002`); A06 documenta exclusivamente que el BOM no es un proceso productor de movimientos de inventario.

## 6. Calidad y consumidores demostrados

### Flujo disponible

- La UI de `frontend/app/quality/page.tsx` lista registros activos/anulados y ofrece alta, edición, validación, anulación y restauración. `frontend/services/quality.service.ts` conecta esas acciones con la API.
- `quality.validators.ts` limita pH a 0–14, cloro a valor finito no negativo, valida fecha e IDs y exige las cuatro mediciones al crear/actualizar salvo `diaNoLaborado`.
- `quality.service.ts::createControlCalidad`, `updateControlCalidad`, `validateControlCalidadRegistro`, `deleteControlCalidad` y `restoreControlCalidad` implementan las operaciones y guardan usuario/fechas de auditoría. Los registros ya validados no deben editarse según la comprobación implementada en el servicio.
- `listFechasFaltantes` busca días del mes sin registro activo y deliberadamente no presupone que fines de semana sean no laborados; el comentario deja la decisión al negocio.
- `backend/src/tests/quality.service.spec.ts` contiene pruebas unitarias mockeadas de mediciones completas, día no laborado, duplicado, edición de validado, validación y fechas faltantes. No se ejecutaron en esta auditoría.

### Límites funcionales

- El modelo `ControlCalidadAgua` se relaciona con usuario autor y validador; no tiene FK a lote, producto, orden de fabricación o movimiento de inventario.
- No se encontró un consumidor backend que utilice `Validado` para bloquear producción, stock, venta o disponibilidad. La aplicación registra y valida controles de agua, pero no demuestra liberación/rechazo de producto.
- No se localizó un estándar empresarial autorizado para límites aceptables de cloro/pH, revisión/rechazo, acciones correctivas, firmas, periodicidad laboral, retención o trazabilidad de pruebas. Las validaciones numéricas actuales no permiten concluir conformidad sanitaria.
- El endpoint `/api/calidad/faltantes` está implementado, pero no se encontró una llamada desde la página/servicio frontend examinado; la UI consultada carga los registros sin usarlo.

## 7. Configuración empresarial y efectos

### Definición, persistencia y edición

- `Empresa` persiste NIT, razón/nombre comercial, dirección, teléfonos, correo, frase, ruta del logo, `FechaInicioFel`, `FechaFinFel` y `RegimenIsr`, además de datos de auditoría y anulación.
- La página `frontend/app/company/page.tsx` consulta/cambia datos empresariales y fechas etiquetadas como inicio/fin de vigencia FEL. `company.validators.ts` exige los campos textuales pertinentes y valida fechas de calendario; el servicio los guarda en el registro activo.
- La carga de logo valida el tipo de imagen y guarda archivo/ruta; la UI y `company.service.ts` exponen errores de carga/actualización. No se probó acceso a disco ni se subió un archivo.
- `getActiveCompanyOrThrow` selecciona la primera empresa no anulada, por Id ascendente; no hay CRUD de empresas en este flujo para administrar múltiples registros.

### Consumidores

- `fel.service.ts::getActiveFelConfig` carga de `Empresa` NIT y nombres. En sandbox puede tomar el NIT de Empresa como valor por defecto para cliente/NIT emisor; en producción exige variables de entorno. El servicio configura entorno, endpoint, cliente, usuario, clave, afiliación IVA, establecimiento, formato, acciones SOAP, TLS, certificado y timeout desde variables de entorno.
- No se observó lectura por el servicio FEL de `FechaInicioFel`, `FechaFinFel` o `RegimenIsr`, ni una comparación de las fechas con el momento de emisión. El NIT/identidad y parámetros fiscales también tienen fuentes ambientales; el valor efectivo desplegado no se leyó.
- El nombre de empresa se obtiene de los campos de Empresa para la configuración FEL, aunque la búsqueda estática no demuestra que el campo resultante afecte el XML enviado. Los usos en reportes/documentos de salida quedaron excluidos.
- Las fechas de vigencia se guardan y se muestran correctamente, pero su efecto de control de emisión no está demostrado. Sin requisito del negocio, no se concluye que la no aplicación sea defecto. Ver `AUD-A06-005`.

## 8. Configuración e integración interna de FEL

- `getFelEnvironment` permite `sandbox`/`production` (por defecto sandbox) y rechaza valores distintos. Configuración por entorno puede tomar valores con sufijo de ambiente; el fallback sin sufijo está limitado a sandbox.
- `getActiveFelConfig` valida campos requeridos, establecimiento, formato compatible y timeout. Producción exige endpoint HTTPS de host permitido, TLS, certificado cliente, validación NIT y ausencia de fallback/mock; carga certificado desde una ruta configurada sin exponer la ruta/clave en este informe.
- `postFelSoap` restringe protocolo, verifica TLS según config, valida certificado del servidor, limita respuesta y aplica timeout. `emitFelInvoice` valida NIT antes de emisión y solo permite fallback simulado cuando sandbox lo configura; `anulateFelInvoice` requiere respuesta de anulación confirmada. `pingFelProvider` existe, pero no se invocó.
- No se observó mecanismo general de reintentos o reconciliación persistida dentro de `fel.service.ts`; la persistencia del resultado de factura/venta y las fronteras externas/SQL son responsabilidad A02. A02 registra `AUD-A02-005` (FEL y SQL no comparten transacción compensable) y los demás hallazgos comerciales; no se duplica aquí.
- El servicio sí contacta el proveedor cuando sus consumidores lo llaman con modo real. Esta auditoría solo inspeccionó ramas estáticas; no se leyó archivo `.env`, certificado ni credenciales, no se invocó `pingFelProvider` y no se verificó una instalación.

## 9. Automatizaciones n8n

### Flujo implementado en el repositorio

- `notification.service.ts::send` serializa `{ evento, datos }`; `n8n-webhook.client.ts::postToN8nWebhook` lee URL/secreto/timeout del entorno, hace POST con JSON y clasifica falta de configuración, timeout, red y HTTP 4xx/5xx.
- Hay emisiones desde ventas (pedido creado, factura emitida, entrega, anulación, pago) y logística (vehículo no disponible), además de `PRUEBA` desde `POST /api/notifications/test`. Los emisores de negocio usan envío fire-and-forget, registran fallos y no hacen fallar la operación principal.
- El enum también declara `STOCK_BAJO` y `CREDITO_VENCIDO`, sin llamada emisora encontrada. El contrato n8n lista estos eventos, y otros, como plantillas sin emisor; sin acceso al workflow actual no se confirma si las plantillas siguen instaladas.
- La documentación `docs/infraestructura/n8n-notificaciones.md` afirma que solo `PEDIDO_CREADO` tiene emisor backend y describe eventos como “plantilla lista, sin emisor”. El código actual contiene emisores para varios de esos eventos. Es una discrepancia documental/código; la tabla documental no se tomó como evidencia del estado remoto.
- No se encontró export JSON/workflow local que permita revisar nodos, expresiones, rutas internas, deduplicación, credenciales o efectos de Telegram. La documentación describe un flujo remoto; no demuestra que esté activo ni que procese cada evento.

### Manejo de errores y limitaciones

- Si URL falta, `postToN8nWebhook` devuelve `not_configured`; errores se clasifican y reportan por emisores. No hay cola/outbox ni reintento persistido demostrado: al ser fire-and-forget, un fallo puede perder notificación aunque la operación de negocio haya tenido éxito.
- `N8N_WEBHOOK_TIMEOUT_MS` se convierte con `Number(...)` sin comprobar finitud ni rango antes de `setTimeout`. Un valor inválido/negativo puede traducirse en timeout inmediato o casi inmediato según el runtime; esta rama no se validó dinámicamente. Ver `AUD-A06-004`.
- Las pruebas existentes sustituyen `fetch` y cubren respuestas correctas, falta de URL, errores HTTP/red/timeout y que el secreto no aparezca en el mensaje. No prueban workflow real, entrega ni ejecución de esta auditoría.
- Se identificaron nombres de variables y propósito únicamente; no se inspeccionaron sus valores, URLs runtime, secretos, tokens ni credenciales.

## 10. Hallazgos

### AUD-A06-001 — Los filtros de calidad por año o mes se ignoran si se envía solo uno

- **Módulo:** calidad.
- **Funcionalidad:** consulta de controles por período.
- **Descripción:** el validador acepta `anio` y `mes` opcionales de forma independiente. `listControlCalidad` solo construye límites `gte`/`lt` cuando ambos están presentes; si se envía solo año o solo mes, construye `Fecha: {}` y no aplica el filtro solicitado.
- **Evidencia técnica:** `backend/src/validators/quality.validators.ts::listControlCalidadQuerySchema`; `backend/src/services/quality.service.ts::listControlCalidad` (aprox. líneas 138–160); `backend/src/controllers/quality.controller.ts::listControlCalidadController`; `frontend/services/quality.service.ts::listControlCalidad` ofrece ambos parámetros.
- **Flujo actual comprobado:** query parseable → construcción condicional de filtro temporal → `findMany`; la rama con un solo parámetro no incluye límites temporales.
- **Flujo esperado y fundamento:** si se acepta cada filtro independientemente, debe limitar los resultados por el parámetro proporcionado; si solo se admite período completo, el validador debe exigir ambos. La UI actual no ofrece filtro de período, por lo que el impacto práctico para consumidoras externas no se comprobó.
- **Consecuencia:** una consulta solicitada por año/mes puede devolver controles de otros períodos y confundir revisiones/auditorías.
- **Severidad:** BAJO.
- **Dependencias:** ninguna otra causa raíz detectada; A01 es dueño de fallas generales de autorización, no de la consulta de calidad.
- **Propuesta:** acordar el contrato año/mes y construir un rango para cada combinación válida o rechazar parámetros incompletos.
- **Pruebas recomendadas:** test unitario con `findMany` mock para solo año, solo mes y ambos; prueba de integración aislada para verificar los límites SQL/Prisma.
- **Estado de verificación:** confirmado estáticamente en la construcción del filtro; no se ejecutó Prisma ni se consultaron datos.

### AUD-A06-002 — El chequeo de fecha única de calidad no es atómico

- **Módulo:** calidad.
- **Funcionalidad:** creación/restauración de control diario.
- **Descripción:** `validateFechaDisponible` consulta por fecha activa antes de que `createControlCalidad` cree el registro; restauración también consulta antes de actualizar. La verificación y escritura son operaciones separadas. El esquema declara un índice normal (`@@index([Fecha, Anulado])`), no una restricción única que impida dos registros activos de la misma fecha.
- **Evidencia técnica:** `backend/src/services/quality.service.ts::validateFechaDisponible`, `createControlCalidad`, `restoreControlCalidad`; `backend/prisma/schema.prisma::ControlCalidadAgua` (índice Fecha/Anulado). El servicio informa explícitamente conflicto por fecha duplicada.
- **Flujo actual comprobado:** dos solicitudes concurrentes pueden observar ausencia de registro activo antes de que cualquiera escriba, y ambas continuar; para restauración ocurre el mismo patrón. La posibilidad se deriva de la secuencia, no fue reproducida en SQL Server.
- **Flujo esperado y fundamento:** la creación/restauración ya expresa unicidad de un registro activo por fecha en la validación de aplicación; la persistencia debe sostenerla también bajo concurrencia. No se prescribe una estrategia de base de datos sin considerar esquema y semántica de anulados.
- **Consecuencia:** podrían coexistir controles activos duplicados para un día, duplicando la evidencia de calidad y alterando consultas/listados de fechas faltantes.
- **Severidad:** MEDIO.
- **Dependencias:** esquema compartido coordinado con A03; los datos de calidad permanecen bajo A06.
- **Propuesta:** proteger unicidad activa y escritura con una estrategia transaccional/constraint compatible con la semántica de restauración.
- **Pruebas recomendadas:** solicitudes paralelas de creación y restauración sobre la misma fecha en una base SQL Server desechable, incluyendo verificación de restricciones e intercalación.
- **Estado de verificación:** parcialmente comprobado; cadena de check-then-write e índice no único confirmados estáticamente, carrera efectiva pendiente de reproducción aislada.

### AUD-A06-003 — La edición puede competir con la validación y modificar un registro ya aprobado

- **Módulo:** calidad.
- **Funcionalidad:** congelamiento de un registro validado.
- **Descripción:** `updateControlCalidad` lee `Validado` y luego actualiza usando solo el Id. `validateControlCalidadRegistro` también lee el estado y lo actualiza por Id. No hay condición de estado en la escritura ni transacción/compare-and-set que haga atómica la transición con la modificación. Si la validación confirma después de la lectura de edición y antes de su escritura, la edición puede sobrescribir campos manteniendo `Validado = true`.
- **Evidencia técnica:** `backend/src/services/quality.service.ts::updateControlCalidad` (lectura `Validado`, seguida de `controlCalidadAgua.update`); `validateControlCalidadRegistro` (lectura separada, seguida de escritura de `Validado: true`).
- **Flujo actual comprobado:** la regla “no editar registro ya validado” se comprueba antes de la escritura, no como condición atómica de la actualización. No se reprodujo concurrencia.
- **Flujo esperado y fundamento:** dado que el servicio rechaza edición cuando `Validado` ya es true y la UI ofrece acción separada de validación, la aprobación debe impedir que cambios concurrentes posteriores alteren su contenido sin desvalidación/revisión expresa.
- **Consecuencia:** el registro podría mostrar una validación cuya medición/observación cambió después de la aprobación.
- **Severidad:** MEDIO.
- **Dependencias:** solo calidad y su modelo; A01 conserva la responsabilidad por la política RBAC general.
- **Propuesta:** coordinar transición y edición con actualización condicional/atomicidad; definir explícitamente si revalidar es posible.
- **Pruebas recomendadas:** prueba de concurrencia con dos transacciones en base aislada y barreras controladas; verificar que una edición no cambie valores una vez confirmada la validación.
- **Estado de verificación:** parcialmente comprobado estáticamente; condición de carrera y comportamiento real del nivel de aislamiento no se ejecutaron.

### AUD-A06-004 — El timeout configurable de n8n no valida el valor antes de usarlo

- **Módulo:** notificaciones/n8n.
- **Funcionalidad:** límite temporal de envío webhook.
- **Descripción:** `N8N_WEBHOOK_TIMEOUT_MS` se convierte a número y se entrega directamente a `setTimeout`; no se rechazan valores no finitos, negativos o fuera de límites.
- **Evidencia técnica:** `backend/src/services/n8n-webhook.client.ts::postToN8nWebhook` (lectura de timeout y `setTimeout`); `backend/src/tests/n8n-webhook.client.spec.ts` cubre fallos de timeout, pero no valores de configuración inválidos.
- **Flujo actual comprobado:** la configuración aceptada por el proceso se usa directamente al armar el abort timer. La consecuencia exacta de un valor inválido depende del comportamiento de timers del runtime y no fue ejecutada aquí.
- **Flujo esperado y fundamento:** una configuración de timeout debe ser validada y rechazada o sustituida por un valor explícito seguro; no hay rango de negocio documentado.
- **Consecuencia:** una configuración malformada puede provocar que los envíos terminen casi inmediatamente; al ser notificaciones fire-and-forget, el evento puede perderse aunque la operación principal complete.
- **Severidad:** BAJO.
- **Dependencias:** configuración de despliegue n8n; no duplicar fallos de entrega comercial/logística de A02/A04.
- **Propuesta:** validar número finito y rango operativo documentado al iniciar o antes del envío, y exponer fallo de configuración sin intentar una solicitud engañosamente exitosa.
- **Pruebas recomendadas:** casos de configuración NaN, negativa, cero, límite válido y sobre límite con `fetch` simulado; no llamar a webhook real.
- **Estado de verificación:** parcialmente comprobado estáticamente; efecto de timers no reproducido.

### AUD-A06-005 — El efecto operativo de las fechas de vigencia FEL guardadas no está demostrado

- **Módulo:** empresa/configuración y límite de integración FEL.
- **Funcionalidad:** campos “Inicio de vigencia FEL” y “Fin de vigencia FEL”.
- **Descripción:** los dos campos se editan en la UI y se guardan en `Empresa`, pero `getActiveFelConfig` no los selecciona ni `emitFelInvoice` comprueba el rango antes de solicitar emisión. Las credenciales/ambiente/endpoint sí proceden de configuración de entorno.
- **Evidencia técnica:** `frontend/app/company/page.tsx` (campos y payload guardado); `backend/src/services/company.service.ts::updateCompanySettings`; `backend/prisma/schema.prisma::Empresa`; `backend/src/services/fel.service.ts::getActiveFelConfig` y `emitFelInvoice`.
- **Flujo actual comprobado:** lectura/edición/persistencia de valores confirmadas estáticamente; el servicio de emisión no usa esas fechas en el flujo inspeccionado.
- **Flujo esperado y fundamento:** la etiqueta “vigencia” sugiere un posible control de emisión, pero no se localizó un requisito empresarial/técnico que diga que esos campos deban bloquear, alertar o configurar el proveedor. No se califica como defecto hasta confirmar su propósito.
- **Consecuencia:** quien configure fechas puede creer que limitan emisión FEL aunque ese efecto no está demostrado en backend.
- **Severidad:** PENDIENTE DE VERIFICACIÓN.
- **Dependencias:** A02 para el consumidor comercial de FEL; coordinación de Empresa/FEL requerida antes de cambiar fuente de configuración.
- **Propuesta:** confirmar con negocio si las fechas son informativas, contractuales o un control de autorización temporal; documentar y alinear UI/backend/configuración.
- **Pruebas recomendadas:** tras decisión, prueba aislada de emisión simulada en fechas previas, dentro y posteriores al rango; no invocar proveedor real.
- **Estado de verificación:** pendiente de decisión empresarial y verificación del entorno; no se afirma defecto operativo.

## 11. Cruces con A01–A05 y hallazgos preservados

- **A01:** permisos específicos `calidad`/`empresa` están presentes en las rutas examinadas; no se reauditaron guards generales ni se duplica `AUD-A01-001` a `AUD-A01-008`. La revisión A01 del 2026-10-12 incorpora `AUD-A01-007` y `AUD-A01-008`; la matriz de continuidad aún enumera solo `001`–`006`, diferencia documental que se conserva y no afecta este alcance.
- **A02:** `sale.service.ts` invoca FEL y emite notificaciones después de operaciones comerciales. A02 mantiene la propiedad de ventas, emisión/anulación comercial y la frontera de transacción; se referencia `AUD-A02-005` sin duplicarlo. A06 revisa configuración/transporte, no reaudita ventas, pagos o facturas.
- **A03:** inventario expone categorías y estructuras de producto; A03 mantiene la propiedad de stock y bitácora, con `AUD-A03-001` y `AUD-A03-002`. A06 no imputa a A03 una falta de fabricación ni replica problemas de movimientos.
- **A04:** la logística emite `VEHICULO_NO_DISPONIBLE` a n8n; las rutas/entregas y sus hallazgos `AUD-A04-001` a `AUD-A04-005` quedan con A04.
- **A05:** no se identificó un consumidor directo de registros de calidad o producción en planilla/comisiones. La relación indirecta por empleados/ventas permanece en los límites de A05.
- **Continuidad:** se leyeron los documentos de coordinación `00`–`10`, el informe A01 original, su revisión del 2026-10-12 y los informes A02–A05. La matriz `09` aclara que la estructura/BOM no demuestra fabricación y que las causas raíz deben conservar dueño único.

## 12. Requisitos de negocio pendientes

1. ¿Qué procesos de producción deben existir (orden, preparación, envasado, lote, rendimiento, desperdicio/reproceso, cancelación) y qué estados/transiciones tienen?
2. ¿Cómo se asignan unidades y conversiones a insumos/productos y cuándo se descuentan materias primas y se incorporan productos terminados al stock/kardex?
3. ¿Se requiere trazabilidad lote-a-lote, retención/bloqueo, caducidad o retirada de producto?
4. ¿Qué sustancias/mediciones de calidad aplican, cuáles son límites aprobados, frecuencia/calendario y acciones ante rechazo? ¿La validación de calidad debe bloquear o liberar producción/productos?
5. ¿Quién puede registrar en nombre de otro usuario y qué aprobación, segregación de funciones e historial se exige?
6. ¿Las fechas FEL guardadas deben impedir/advertir emisión fuera de vigencia? ¿Cómo se coordinan con la configuración ambiental de credenciales y emisor?
7. ¿`RegimenIsr` es dato informativo o debe cambiar alguna operación/documento fiscal? ¿Qué fuente debe prevalecer para identidad fiscal de Empresa?
8. ¿n8n requiere entrega garantizada, reintentos persistidos, deduplicación o recuperación? ¿Qué eventos listados sin emisor son intencionales?
9. ¿Qué timeout y comportamiento ante URL/secreto ausente son válidos por ambiente?

## 13. Pruebas no ejecutadas y limitaciones

- No se consultó SQL Server ni se verificaron datos, configuración efectiva, usuarios o registros de calidad/empresa.
- No se ejecutaron pruebas automatizadas, builds, migraciones, seeds, SQL, operaciones CRUD, procesos productivos ni pruebas de concurrencia. Las pruebas recomendadas requieren una base SQL Server aislada/desechable con fixtures sintéticos y sin credenciales externas reales.
- No se inspeccionaron valores de `.env`, secretos, tokens, credenciales ni certificados. No se abrió conexión al proveedor FEL, instancia n8n, workflow remoto o canal Telegram.
- No se validaron los archivos runtime de n8n ni el comportamiento de los consumidores fuera del repositorio.
- El estado de la instalación, de las reglas sanitarias/fiscales y de los procesos manuales queda fuera de lo que prueba el commit.
- No se examinó la totalidad de los subsistemas comerciales/logísticos/inventario/planilla; se consultaron únicamente los límites y consumidores necesarios para A06. No se auditó analítica.

## 14. Cobertura alcanzada y cierre

| Área | Cobertura estática | Resultado | Pendiente principal |
|---|---|---|---|
| Producción/fabricación | UI, rutas montadas, modelo BOM, servicio de estructura y búsqueda de consumidores de stock | UI placeholder; no se demuestra API/orden/lote ni entradas/salidas de fabricación | Requisitos, posible proceso externo/manual y pruebas de inventario aisladas |
| Calidad | UI/API/validadores/servicio/modelo/pruebas existentes | CRUD operativo de controles de agua; integración a producción no demostrada | Concurrencia, umbrales, calendario y regla de liberación |
| Empresa | UI/API/validadores/servicio/modelo | Perfil y logo configurables; fechas FEL/regimen se guardan | Propósito funcional de campos y ambiente desplegado |
| FEL interno | configuración y transporte en servicio, controladores/consumidor por límite | Guardas internas visibles; integración externa no verificada | Sandbox aislado/simulador, valores operativos y política de reconciliación A02 |
| n8n | Cliente, eventos, emisores, endpoint de prueba, documentación y pruebas unitarias existentes | POST y manejo de errores demostrados en código; workflow remoto no verificado | Workflow/configuración remota, entrega, reintentos y contrato vigente |

**Hallazgos nuevos:** `AUD-A06-001` a `AUD-A06-005`; sin referencias heredadas duplicadas.  
**Conteo:** 1 confirmado estáticamente, 3 parcialmente comprobados y 1 pendiente de decisión empresarial; severidad: 2 MEDIO, 2 BAJO y 1 PENDIENTE DE VERIFICACIÓN.  
**Resultado:** auditoría **parcialmente completa**, con flujos ausentes/no demostrados y limitaciones documentadas; no se declara completa la operación de producción, calidad integrada, FEL externo ni automatizaciones.

**Integridad:** no se modificaron código, configuración, dependencias, esquema, migraciones ni datos. No se ejecutaron procesos operativos o llamadas externas. Se creó únicamente este informe A06 dentro de la carpeta de auditoría no seguida preexistente; no se eliminaron, restauraron ni sobrescribieron archivos anteriores y no se hizo commit.
