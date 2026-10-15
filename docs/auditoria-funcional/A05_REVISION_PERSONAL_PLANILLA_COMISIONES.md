# A05 — Auditoría funcional de personal, planilla y comisiones

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**Commit de referencia:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Modalidad:** revisión estática, solo lectura  
**Estado:** completa como revisión estática del alcance; no certifica una base desplegada ni reglas de negocio sin confirmar

## 1. Resumen ejecutivo

Se trazaron los flujos de empleados, vínculos con usuarios/entidades, configuración y asignación de comisiones, cálculo mensual, ajustes, generación y cierre de planillas, desde las pantallas y clientes frontend hasta rutas, permisos, controladores, validadores, servicios Prisma y modelos persistidos. Se consultó `RutaSesion` como entrada del cálculo y se contrastó el resultado con el hallazgo de A04 sobre edición de sesiones cerradas.

El sistema **sí admite varias reglas de comisión por empleado en la práctica**, porque un empleado puede tener una configuración que contenga múltiples reglas por producto y rango de cantidad. No admite asignar varias configuraciones independientes al mismo empleado: `Empleado.IdConfiguracionComision` es una sola referencia. Cada regla apunta a un producto individual; no se encontró relación a grupos de productos. Los tipos efectivamente implementados son porcentaje sobre venta y monto por unidad; cada regla usa uno de ellos, aunque reglas distintas dentro de la misma configuración pueden usar tipos distintos.

El cálculo suma cantidades e importes por empleado y producto para ventas no anuladas, pagadas y vinculadas a una sesión de ruta activa cuya fecha cae en el mes. Selecciona una sola regla de rango para cada producto agregado. La generación persiste borradores con importes y detalles agregados, y la restricción de persistencia impide más de una planilla activa por empleado/período. El proceso no ejecuta pagos.

Los principales riesgos funcionales observados son:

- La ausencia de vínculo laboral o de configuración de comisión en **cualquier empleado activo** puede impedir la previsualización y generación de la nómina completa; no hay una lista de prevalidación que permita resolver las excepciones antes de calcular.
- La previsualización no es un paso requerido para generar, deja de corresponder al formulario cuando este cambia, muestra solo cuatro importes líquidos y no ofrece desglose previo por empleado. La pantalla permite generar sin revisión vinculante.
- La planilla guarda una instantánea parcial de los valores calculados, pero no identifica ventas, regla, configuración ni atribuciones de ruta de origen. Una sesión editada puede cambiar cálculos futuros o el recálculo de un borrador; una planilla ya cerrada conserva sus importes y no se recalcula automáticamente.
- El soft delete más la clave única por empleado/período/**estado anulado** permite solo una fila anulada por período: una sucesión de anular, regenerar y volver a anular no está soportada por el esquema actual.
- Una actualización de borrador que envía únicamente observaciones vuelve a calcular con datos/configuración actuales y puede anular los ajustes previamente guardados.

Se registran **7 hallazgos**: **2 ALTO**, **4 MEDIO** y **1 PENDIENTE DE VERIFICACIÓN**. Cinco comportamientos/limitaciones están confirmados estáticamente; uno está parcialmente comprobado por depender también de la política de rutas; uno requiere confirmar la regla empresarial de aplicación de ajustes.

**Resultado:** auditoría completa del alcance como análisis estático del código versionado. La verificación de comportamiento en SQL Server, concurrencia, datos desplegados, reglas de negocio y uso operativo queda pendiente. No se ejecutaron pruebas ni operaciones.

## 2. Alcance, punto de partida y limitaciones

### Punto de partida y documentos

- Raíz Git: `D:\Universidad Mariano Gálvez\FlowManager`; rama `developer`; HEAD `27f59fa024a804c468c434cfd504baa0b865a362`.
- El estado inicial fue `## developer...origin/developer` más `?? docs/auditoria-funcional/`. La carpeta y los documentos no seguidos son un estado conocido y registrado en la continuidad; se preservaron sin limpiar, restaurar, eliminar ni sobrescribir.
- Se leyeron los documentos de coordinación `00_RESUMEN_GENERAL.md` a `10_CHECKLIST_INICIO_SESIONES.md`, incluidos el mapa de arquitectura, la matriz de dependencias, el contrato de auditoría y el plan maestro.
- Se leyeron el informe A01 original, su revisión del 2026-10-12, A02, A03 y A04. La matriz documenta que no había un informe A05 anterior; se comprobó que la ruta de este informe no existía antes de crearlo.
- El nombre de A04 citado en la instrucción (`A04_REVISION_RUTAS_VEHICULOS_LOGISTICA.md`) no existe en el directorio. El informe de A04 disponible y consultado es `A04_REVISION_RUTAS_VEHICULOS_OPERACION_LOGISTICA.md`, cuyo tema y contenido corresponden a la revisión de rutas, vehículos y logística.

### Incluido

- Empleados, sus relaciones con `Entidad`, usuario registrador, usuario vinculado y configuración de comisiones.
- Reglas por producto y cantidad, tipos de cálculo, asignación y cálculo de comisiones.
- Selección de ventas/detalles, sesión de ruta, estados de ventas y pagos consumidos por planilla.
- Ajustes y conceptos agregados, salarios, períodos, previsualización, generación, edición, anulación, restauración, cierre, consulta histórica y restricciones de duplicidad.
- Pantallas de empleados, configuración de comisiones y planilla mensual, incluidos los pasos de preparación y revisión.
- Guards y permisos de las rutas específicas como dependencia; no se reauditaron autenticación ni RBAC general.

### Excluido y no comprobado

- Reportes, gráficas, dashboards, indicadores, KPI y analítica.
- Consultas o escrituras a SQL Server, nóminas productivas, pagos, cierres reales, migraciones, seeds, scripts SQL y servicios externos.
- La exactitud comercial de fórmulas sin especificación autorizada, el efecto real de datos desplegados, condiciones de concurrencia e integración fuera del monorepo.
- No se inspeccionaron valores de entorno, credenciales ni datos personales reales.

## 3. Arquitectura y entidades examinadas

### Recorrido técnico

**Empleados:** `frontend/app/employees/{create,page,edit/[id]}.tsx` y `employee-form-card.tsx` → `frontend/services/employees.service.ts` → `/api/employees` → `employee.routes.ts` → `employee.controller.ts` → `employee.validators.ts` → `employee.service.ts` → Prisma.

**Comisiones:** `frontend/app/commissions/page.tsx` → `frontend/services/commissions.service.ts` y `products.service.ts` → `/api/planilla/comisiones` → `planilla.routes.ts` → `planilla-comision.controller.ts` → `planilla-comision.validators.ts` → `planilla-comision.service.ts` → Prisma.

**Planilla:** `frontend/app/payroll/page.tsx` → `frontend/services/payroll.service.ts` → `/api/planilla/mensuales` → `planilla.routes.ts` → `planilla-mensual.controller.ts` → `planilla-mensual.validators.ts` → `planilla-mensual.service.ts` → Prisma/SQL Server.

Las rutas de empleados exigen `empleados:read/create/update/delete`; las de planilla y comisiones exigen `planilla:read/create/update/delete` según operación (`backend/src/routes/employee.routes.ts`, `backend/src/routes/planilla.routes.ts`). El middleware común protege la aplicación y queda bajo A01.

### Entidades y relaciones relevantes

- `Empleado` enlaza una `Entidad`, un `Usuario` registrador, un `UsuarioVinculado` opcional, una `ConfiguracionComision` opcional y múltiples filas `PlanillaMensual`. También conserva puesto, fechas de contratación/salida y sueldo base (`backend/prisma/schema.prisma::Empleado`).
- `ConfiguracionComision` tiene muchas `ReglaComision`; cada regla apunta a un `InventarioItem` y almacena intervalo de cantidad, tipo, porcentaje y/o monto por unidad (`schema.prisma::ConfiguracionComision`, `ReglaComision`).
- `Venta` se relaciona opcionalmente con una `RutaSesion`; sus `DetalleVenta` guardan item, cantidad, precio y marca de bonificación. `RutaSesion` enlaza vendedor y chofer mediante IDs de usuario.
- `PlanillaMensual` enlaza empleado y conserva período, estado, autor, sueldo base, totales, líquido y observaciones. `PlanillaDetalleComision` conserva producto, cantidad, base, tipo, valor aplicado e importe; `PlanillaDetalleAjuste` conserva tipo, descripción e importe.
- La planilla no almacena referencias a las ventas/detalles fuente, al ID de la regla/configuración aplicada o a una versión de asignaciones de ruta/usuario.

## 4. Flujo actual de asignación y cálculo de comisiones

### Configuración y asignación

1. En la pantalla de comisiones se crean configuraciones con nombre; una configuración agrega reglas seleccionando **un producto**, mínimo/máximo de cantidad y un tipo de cálculo.
2. `employee-form-card.tsx` ofrece un único selector de “Configuración de comisión”. Las páginas de alta y edición envían un solo `idConfiguracionComision` o `null`.
3. El servicio de empleados valida que esa configuración exista y no esté anulada. El esquema solo contiene `Empleado.IdConfiguracionComision Int?`, no una relación múltiple empleado–configuración.
4. `validateReglaRangeAvailable` rechaza intervalos que se solapan para el mismo producto dentro de una configuración. No impide crear reglas para distintos productos o tipos de cálculo dentro de la misma configuración.
5. La pantalla obtiene productos mediante `listProducts({ limit: 100 })`; no se observó paginación o carga incremental en el selector de reglas. Si el catálogo excede el límite entregado por ese servicio, la asignación de reglas a productos fuera de esos resultados queda sin acceso por esta interfaz.

### Tipos y fórmula realmente implementados

Los tipos aceptados por Zod y el servicio son:

- `PORCENTAJE_VENTA`: suma `PrecioUnitario × Cantidad` de las líneas seleccionadas y aplica el porcentaje.
- `MONTO_POR_UNIDAD`: suma cantidades y aplica un importe por unidad.

No existe un tipo independiente de comisión fija por período. Cada regla es de un solo tipo; una configuración puede tener, por ejemplo, reglas porcentuales para unos productos y por unidad para otros. Para cada producto y empleado, el cálculo acumula las líneas del período, selecciona una única regla activa cuyo intervalo contenga la cantidad total y omite el producto si no encuentra regla. No suma varias bandas de cantidad para el mismo producto.

### Elegibilidad de ventas y atribución

`calculateEmployeePayroll` busca detalles no anulados y no bonificados de ventas no anuladas con `EstadoPago` `PAGADO` o `PAGADA`. La venta debe tener una `RutaSesion` no anulada cuya `FechaSesion` esté dentro del mes y cuyo usuario chofer **o** vendedor coincida con el `Empleado.IdUsuarioVinculado` actual. El cálculo agrupa por `IdInventarioItem`; no filtra por fecha de pago ni usa la fecha de registro de venta como período.

La comisión resulta del conjunto agrupado por producto, no de una comisión persistida por línea de venta. El líquido se calcula como sueldo base + comisiones + bonos de meta + viáticos − descuentos, redondeando a dos decimales en la lógica observada.

## 5. Viabilidad y limitaciones de múltiples comisiones

La sospecha de “una sola comisión” requiere precisión:

- **Sí es posible** asignar varias reglas a un empleado dentro de una sola configuración, incluso para productos distintos y mezclando los dos tipos de cálculo entre reglas.
- **No es posible** asignar al empleado varias configuraciones independientes al mismo tiempo; el vínculo único es `Empleado.IdConfiguracionComision`.
- **No se encontró** una entidad o FK de grupo de productos para `ReglaComision`: su selector y modelo se basan en un `InventarioItem` individual. La búsqueda de modelos y contratos de grupos relacionados con comisión/producto no halló una relación de grupos.
- Las reglas por cantidad son bandas alternativas, no comisiones simultáneas acumulables para el mismo producto/configuración/rango. Se aplican sobre la cantidad agregada del mes.
- La identidad de cálculo es el usuario vinculado actual. Si un usuario es chofer o vendedor de la sesión, cada empleado que coincida obtiene un cálculo independiente sobre las líneas de esa venta; no se encontró una regla que decida si ambos roles deben cobrar o si deben repartirse una comisión.

Por ello, varios productos con reglas específicas caben en una configuración, pero reglas administradas en varias configuraciones y comisiones asignadas por grupos no están representadas directamente. Confirmar con el negocio si cada empleado debe tener un conjunto único de reglas o poder combinar paquetes, si los grupos se definen por categoría u otro criterio y cómo tratar una venta con el mismo usuario en ambos roles.

## 6. Flujo mensual de generación de planilla

1. El usuario introduce mes y año como números; puede seleccionar un empleado o dejar “Todos los empleados”. Por omisión, ambos campos corresponden al mes/año actuales del navegador.
2. Puede añadir ajustes del tipo bono de meta, viático o descuento. La estructura del ajuste contiene tipo, descripción e importe, sin `idEmpleado`.
3. `Previsualizar` llama `previewPayroll`. El servicio consulta a todos los empleados no anulados con entidad activa (o al empleado indicado), calcula el rango UTC del mes, y calcula sus comisiones/ajustes.
4. `Generar` es una llamada separada a `generatePayroll`, que vuelve a ejecutar la previsualización y guarda cada planilla en estado `BORRADOR`, junto con detalles agregados y ajustes. No usa ni requiere el objeto de previsualización mostrado en la UI.
5. La lista histórica permite consultar detalle y cerrar un borrador. El servicio vuelve a permitir cierre idempotente si ya está cerrado; al cerrar establece `CERRADA`. `updatePayroll` rechaza editar un cierre. No existe estado `EN_REVISION` o `APROBADA` en el tipo del servicio/frontend observado.
6. El borrado lógico anula planillas; la restauración rechaza una fila si ya existe otra activa para ese empleado/período.
7. No se encontró endpoint ni operación de pago o transferencia. “Generar” crea datos de planilla, no ordena ni confirma un pago.

La protección de duplicidad está en dos niveles versionados: consulta previa de planilla activa durante la generación y restricción única `(IdEmpleado, Mes, Anio, Anulado)` en Prisma y en la migración inicial. Esto impide dos filas activas por empleado/período, pero restringe el número de filas históricas anuladas a una por empleado/período. No se verificó que la base desplegada tenga exactamente esa restricción.

## 7. Evaluación funcional de la interfaz y del flujo mensual

La UI está concentrada en `frontend/app/payroll/page.tsx`, mientras que la asignación de empleado/configuración y la definición de reglas viven en pantallas distintas. La secuencia de trabajo no se presenta como etapas enlazadas ni como lista de requisitos completados.

Problemas concretos observables en código:

- **Selección de período poco guiada:** mes y año son campos numéricos editables, no un selector de mes/período con nombre; solo se informa “Mes inválido” o “Año inválido” al intentar calcular.
- **Selección de personal sin comprobación previa:** la pantalla lista empleados y deja seleccionar todos, pero no explica quién será excluido ni comprueba vínculo laboral, configuración activa, reglas aplicables o fechas de contratación/salida antes de lanzar el cálculo.
- **Un dato incompleto puede abortar el lote entero:** el servicio requiere usuario vinculado y configuración de comisión en `calculateEmployeePayroll`; `Promise.all` rechaza toda la previsualización si cualquier empleado incluido carece de uno. La UI solo muestra el error devuelto como toast; no presenta un resumen de empleados incompletos ni permite resolverlo desde el flujo.
- **Revisión insuficiente y no vinculante:** el panel de previsualización muestra período, cantidad total de empleados y hasta cuatro nombres/importes líquidos. No presenta el desglose de comisiones, bases, tasas, ajustes por empleado ni una tabla completa. El botón `Generar` permanece disponible aunque no se haya previsualizado.
- **Previsualización potencialmente desactualizada:** cambiar mes, año, empleado o ajustes no invalida `preview`. El panel mantiene el mes calculado anterior, mientras `Generar` vuelve a tomar el formulario actual y recalcula desde el backend; lo que se ve puede no ser lo que se generará.
- **Borrador sin flujo visual de corrección:** el detalle histórico muestra totales y nombres/importes de comisiones, pero no renderiza `detalleAjustes`, cantidades, bases ni tasas que la API devuelve. No se encontró botón de edición de borrador en la página aunque el servicio cliente declare `updatePayroll`; en la UI las salidas visibles son consultar, cerrar o anular.
- **Cierre inmediato:** la acción “Cerrar planilla” se ejecuta desde el listado con un clic, sin confirmación visible ni una etapa de revisión/aprobación separada. El servicio hace inmutable el estado `CERRADA`.
- **Consulta histórica dispersa:** el componente carga todas las planillas activas y anuladas sin pasar filtros de período o empleado, aunque el servicio frontend/API admite esos parámetros. El listado no ofrece búsqueda o paginación.
- **Estados del proceso:** en código solo existen `BORRADOR` y `CERRADA` para el estado de planilla. La pantalla presenta el valor técnico del estado; no existe paso de aprobación ni pago en el flujo examinado. No se evalúan las tarjetas de métricas de la pantalla por estar fuera del alcance analítico.

Las recomendaciones de mejora están en la sección 12; estas observaciones describen interacciones y estados del código, no defectos visuales inferidos.

## 8. Hallazgos

### AUD-A05-001 — Una sola configuración asignada y ausencia de reglas por grupo de productos

- **Título y flujo afectado:** Una relación única de configuración limita la composición de reglas desde empleado a planilla.
- **Estado:** confirmado estáticamente.
- **Severidad:** MEDIO. Las reglas de varios productos ya se admiten en una configuración, pero no los grupos ni la composición de configuraciones separadas.
- **Evidencia:** `backend/prisma/schema.prisma::Empleado` declara un `IdConfiguracionComision` singular y una relación opcional; `ReglaComision` referencia `IdConfiguracionComision` e `IdInventarioItem`, sin FK de grupo. `employee.validators.ts::createEmployeeSchema/updateEmployeeSchema` admiten un ID singular. `frontend/app/employees/_components/employee-form-card.tsx` renderiza un selector; `frontend/app/commissions/page.tsx` crea reglas de un producto y tipo. `planilla-comision.service.ts::validateReglaRangeAvailable/createReglaComision` valida rangos por producto y configura reglas múltiples.
- **Causa raíz:** la estructura de asignación y la regla se modelaron como empleado → una configuración → reglas por item individual.
- **Impacto funcional:** puede componerse una tabla de reglas producto-específicas en una configuración; no puede asignarse más de una configuración independiente ni dirigir una regla a un grupo de productos con el modelo/UI disponibles.
- **Dependencias:** A03 por catálogo y clasificación de productos; A04/A02 por ventas, detalle y usuario vendedor/chofer. A05 es responsable de la causa de asignación/cálculo.
- **Comprobación pendiente:** confirmar si varias configuraciones por empleado son necesarias, qué significa “grupo de productos” y si las reglas deben ser alternativas por cantidad o acumulables.
- **Recomendación:** decidir el catálogo/grupos y semántica; luego modelar explícitamente la asignación múltiple si se confirma, conservando compatibilidad de empleados y reglas existentes.

### AUD-A05-002 — Una sola ficha incompleta puede bloquear la previsualización y generación de todo el período

- **Título y flujo afectado:** Preparación mensual de roster completo y cálculo por empleado.
- **Estado:** confirmado estáticamente; la presencia de fichas incompletas en datos reales no fue comprobada.
- **Severidad:** ALTO, porque un empleado activo con configuración faltante puede impedir completar la planilla en lote.
- **Evidencia:** el esquema de empleado hace opcionales `IdUsuarioVinculado` e `IdConfiguracionComision`; el formulario de empleado permite “Sin configuración” y el vínculo laboral es opcional. `previewPayroll` selecciona empleados no anulados y `calculateEmployeePayroll` lanza error si falta cualquiera de esos campos; el mapeo usa `Promise.all`, por lo que falla la operación completa. La UI de planilla captura el error en un toast y no ofrece reporte de faltantes por empleado. Si el ID de configuración existe pero fue anulada, el cálculo no valida que siga activa y puede terminar con comisión cero por falta de reglas activas.
- **Causa raíz:** la elegibilidad de empleados se comprueba durante el cálculo de todo el lote, sin prevalidación separada ni resultado parcial accionable.
- **Impacto funcional:** el usuario descubre faltantes al previsualizar/generar y recibe una falla global o un total cero sin distinguir qué configuración o regla debe corregir.
- **Dependencias:** A01 para identidad/cuenta; A05 para vínculo laboral, reglas y prevalidación; A04 para roles de vendedores/choferes que alimentan ventas.
- **Comprobación pendiente:** acordar si toda persona empleada activa debe incluirse, si puestos sin comisión deben ser válidos y qué política rige para una configuración anulada o sin regla aplicable.
- **Recomendación:** mostrar antes del cálculo un roster de elegibles, advertencias y bloqueos con nombre/causa por empleado, y permitir excluir o corregir únicamente conforme a una regla aprobada.

### AUD-A05-003 — La previsualización puede quedar obsoleta y no es requisito para generar

- **Título y flujo afectado:** Revisión del total mensual antes de persistir planillas.
- **Estado:** confirmado estáticamente.
- **Severidad:** ALTO, por riesgo de generar importes sin revisar el cálculo que corresponde a los parámetros vigentes.
- **Evidencia:** `frontend/app/payroll/page.tsx::handlePreview` guarda la previsualización, pero los cambios de período, empleado y ajustes no limpian ese estado. El bloque de previsualización solo renderiza `preview.planillas.slice(0, 4)` con líquido y conteo. `handleGenerate` llama a `generatePayroll(currentPayload())` sin exigir una previsualización vigente; `backend/src/services/planilla-mensual.service.ts::generatePayroll` calcula otra vez desde los valores actuales. El histórico tampoco permite editar un borrador desde la página; cerrar lo vuelve inmutable.
- **Causa raíz:** la previsualización es una respuesta informativa desconectada del comando de generación y no se presenta un flujo de revisión completo.
- **Impacto funcional:** el resumen mostrado puede corresponder a otro mes, empleado o conjunto de ajustes; el usuario puede generar sin examinar todos los cálculos o descubrir tarde un error.
- **Dependencias:** A02 por estados/anulaciones de venta y pagos; A04 por atribución de ruta; A05 por la UI y el proceso de planilla. No se duplican hallazgos de esos grupos.
- **Comprobación pendiente:** prueba de interacción UI con cambios de parámetros tras previsualizar y confirmación de aprobadores/pasos que exige el proceso empresarial.
- **Recomendación:** hacer el período un flujo explícito de preparación → validación → vista completa de resultados por persona/producto/ajuste → confirmación de generación, invalidando la vista cuando cambien los parámetros y vinculando la confirmación al cálculo revisado.

### AUD-A05-004 — La instantánea de importes no conserva las fuentes de atribución de la comisión

- **Título y flujo afectado:** Trazabilidad y reproducción histórica de las comisiones de un período.
- **Estado:** parcialmente comprobado.
- **Severidad:** MEDIO, dado que se persiste el resultado aritmético, pero no todo el contexto necesario para explicar por qué se eligió.
- **Evidencia:** `PlanillaDetalleComision` guarda producto, cantidad, base, tipo, valor aplicado e importe, pero no IDs de regla, configuración, detalle/venta o sesión. `calculateEmployeePayroll` agrega líneas por producto, con atribución consultada en tiempo real desde `RutaSesion` y `Empleado.IdUsuarioVinculado`. `updatePayroll` vuelve a calcular un borrador usando ventas, asignación y reglas actuales. En cambio `closePayroll` establece `CERRADA` y `assertEditablePayrollState` rechaza editarla; no se observó recálculo automático de una planilla cerrada.
- **Causa raíz:** los detalles guardan el resultado agregado y una parte de los operandos, no una versión reproducible de la regla y las relaciones fuente.
- **Impacto funcional:** una sesión corregida, un vínculo de usuario o regla modificados pueden cambiar una previsualización o borrador; el detalle histórico cerrado conserva su total, pero no permite identificar las ventas/sesiones/reglas que lo originaron. No debe afirmarse que la edición logística altera automáticamente un cierre ya persistido.
- **Dependencias:** `AUD-A04-003` (edición de sesión cerrada; política pendiente), A02 por anulaciones/pagos y estados de venta, A03 por la identidad del producto. A05 es responsable de la trazabilidad persistida.
- **Comprobación pendiente:** política de inmutabilidad/corrección de sesiones cerradas; fechas efectivas para salario/configuración/usuario; tratamiento de venta anulada, pago anulado, corrección y devoluciones parciales (A02 no encontró un flujo específico de devolución).
- **Recomendación:** acordar fuente y fecha de período; versionar o capturar regla, empleado/usuario, sesión y ventas/detalles usados en cada cálculo y ofrecer una corrección auditada separada del cierre histórico.

### AUD-A05-005 — La clave única permite solo una planilla anulada por empleado y período

- **Título y flujo afectado:** Anular, regenerar y corregir varias veces un mismo período.
- **Estado:** confirmado estáticamente en Prisma y en la migración versionada.
- **Severidad:** MEDIO, por restringir la corrección y conservación del historial.
- **Evidencia:** `PlanillaMensual` declara `@@unique([IdEmpleado, Mes, Anio, Anulado])`; `backend/prisma/migrations/20260928205241_init/migration.sql` crea `UQ_PlanillaMensual_EmpleadoPeriodoEstado` con las mismas columnas. `generatePayroll` bloquea duplicado activo; `deletePayroll` cambia `Anulado` a verdadero; `restorePayroll` exige que no haya otra planilla activa.
- **Causa raíz:** la marca booleana `Anulado` forma parte de la clave única del período, de modo que todas las anuladas compiten por la misma combinación.
- **Impacto funcional:** tras anular una planilla y generar su reemplazo, anular ese segundo registro intentará crear otra fila anulada para el mismo período, incompatible con la clave única; el controlador no tiene una traducción específica de esa colisión. Así, la regla permite una regeneración simple, pero no una cadena arbitraria de correcciones con historial.
- **Dependencias:** A05 (ciclo de vida e historial), esquema Prisma/migraciones compartido; no se atribuye a A03/A02.
- **Comprobación pendiente:** comprobar índices en una base aislada con el mismo esquema y definir cuántas versiones/correcciones deben conservarse. No se consultó SQL Server desplegado.
- **Recomendación:** definir explícitamente versiones vigentes/anuladas y sus transiciones; probar generación repetida, anulación y restauración con más de una revisión sin perder trazabilidad.

### AUD-A05-006 — Actualizar un borrador solo para cambiar observaciones puede eliminar ajustes y recalcular importes

- **Título y flujo afectado:** Edición administrativa de planillas en estado `BORRADOR`.
- **Estado:** confirmado estáticamente; no se encontró consumidor de `updatePayroll` desde la pantalla frontend actual.
- **Severidad:** MEDIO, por la modificación involuntaria de importes persistidos mediante una actualización válida del API.
- **Evidencia:** `updatePayrollSchema` acepta una solicitud que incluya solo `observaciones`. `planilla-mensual.service.ts::updatePayroll` llama `previewPayroll` con `ajustes: input.ajustes` (indefinido si se omitió), sustituye totales desde el resultado recalculado, anula todos los detalles de comisión y ajuste activos y crea solo los detalles resultantes. `frontend/services/payroll.service.ts` expone el método, pero `frontend/app/payroll/page.tsx` no lo invoca.
- **Causa raíz:** la actualización trata los ajustes omitidos como lista vacía y recalcula comisiones/sueldo desde las fuentes vigentes, en vez de distinguir ausencia de campo de una instrucción explícita para reemplazar ajustes.
- **Impacto funcional:** editar solo las observaciones puede retirar bonos, viáticos o descuentos del borrador y cambiar la comisión respecto a la fecha de generación. Los ajustes antiguos quedan anulados.
- **Dependencias:** A05 por semántica de edición y ajuste; A02/A04 por ventas, pagos y sesiones actuales usados al recalcular. Consumidores externos del endpoint no verificados.
- **Comprobación pendiente:** confirmar si el endpoint se mantiene para clientes externos y cuál debe ser la semántica de edición parcial; probar con borrador que contenga cada tipo de ajuste.
- **Recomendación:** especificar `PATCH` como operación parcial o como reemplazo explícito; conservar ajustes cuando no se envían, no recalcular importes incidentalmente y mostrar un cambio de cálculo con revisión/confirmación.

### AUD-A05-007 — El mismo ajuste de período se aplica a todos los empleados seleccionados

- **Título y flujo afectado:** Ajustes individuales frente a generación en lote.
- **Estado:** requisito de negocio pendiente; la aplicación del mismo arreglo de ajustes a cada cálculo está confirmada estáticamente.
- **Severidad:** PENDIENTE DE VERIFICACIÓN, porque no existe contrato que determine si estos importes son conceptos globales o individuales.
- **Evidencia:** `PayrollAdjustmentPayload` contiene tipo, descripción y monto, pero no empleado. La UI etiqueta el bloque “Ajustes del período” y permite “Todos los empleados”; `previewPayroll` pasa el mismo `input.ajustes` a cada `calculateEmployeePayroll`, y `generatePayroll` persiste los conceptos en cada planilla devuelta.
- **Causa raíz:** el payload expresa ajustes de lote, no una colección de ajustes identificados por persona.
- **Impacto funcional:** al generar para todos, un mismo importe se repite en cada planilla. Si el operador esperaba aplicarlo una sola vez o a una persona concreta, la suma resultante será distinta.
- **Dependencias:** A05; confirmar con finanzas/recursos humanos antes de cambiar reglas o interfaz.
- **Comprobación pendiente:** definir si bonos, viáticos y descuentos son globales, por empleado o ambos, y cómo una carga masiva identifica sus destinatarios.
- **Recomendación:** separar conceptos globales de ajustes individuales, mostrar el alcance/destinatario antes de generar y probar importes en lote con varios empleados.

## 9. Cruce obligatorio con sesiones de ruta de A04

El cálculo depende directamente de `Venta.RutaSesion.FechaSesion`, `RutaSesion.Anulado`, `IdUsuarioChofer`, `IdUsuarioVendedor` y del `Empleado.IdUsuarioVinculado` vigente. No copia esos valores a `Venta` ni a la fila de detalle de comisión. A04 documenta en `AUD-A04-003` que `updateRutaSesion` permite editar asignación/fecha aun estando cerrada y que una consulta posterior puede consumir los datos nuevos; el informe deja pendiente de negocio si una sesión cerrada debe ser inmutable, corregible o versionada.

La evidencia de A05 matiza ese efecto: nuevas previsualizaciones/generaciones y actualizaciones de borradores vuelven a leer la sesión actual. Los importes ya guardados en una planilla cerrada no se recalculan automáticamente y el servicio la trata como inmutable. Aun así, no hay snapshot fuente que permita explicar o reproducir desde la planilla qué atribución se usó al generarla.

**No se decide** que las sesiones cerradas deban ser inmutables. Se requiere una decisión conjunta de negocio A04/A05 sobre atribución retroactiva, correcciones y evidencia histórica. Se recomienda prueba sintética aislada: venta pagada en sesión, cierre de sesión, edición de fecha/asignación y comparación entre una vista previa, un borrador ya generado y una planilla cerrada, sin modificar registros productivos.

## 10. Hallazgos por severidad y estado

| ID | Severidad | Estado | Causa raíz |
|---|---|---|---|
| AUD-A05-001 | MEDIO | Confirmado estáticamente | Asignación a una configuración y reglas solo por producto, sin grupo |
| AUD-A05-002 | ALTO | Confirmado estáticamente | Sin prevalidación accionable del roster/configuración |
| AUD-A05-003 | ALTO | Confirmado estáticamente | Previsualización informativa, parcial y separada de generación |
| AUD-A05-004 | MEDIO | Parcialmente comprobado | Detalle agregado sin referencias a fuentes; política A04 pendiente |
| AUD-A05-005 | MEDIO | Confirmado estáticamente | Unicidad de período basada también en `Anulado` |
| AUD-A05-006 | MEDIO | Confirmado estáticamente | Actualización interpreta ajuste omitido como conjunto vacío y recalcula |
| AUD-A05-007 | Pendiente de verificación | Requisito de negocio pendiente | Alcance global vs individual de ajustes no definido |

No se identificó evidencia suficiente para severidad crítica. Los estados estáticos no equivalen a comprobación en una instancia productiva.

## 11. Dependencias con A01, A02, A03, A04 y A06

| Grupo | Dependencia observada | Tratamiento en A05 |
|---|---|---|
| **A01 — Identidad/acceso/sesiones** | `Empleado.IdUsuarioVinculado` es la identidad buscada en las asignaciones de sesiones y es obligatorio para calcular. Los routers usan guards `empleados`/`planilla`. | Se señala como dependencia; no se duplica ningún `AUD-A01-*` ni se reauditan login, sesión o RBAC general. |
| **A02 — Ventas/cobros** | Se consultan `Venta`, `DetalleVenta`, `EstadoPago`, `Anulado`, líneas bonificadas y `RutaSesion`; A02 reporta anulaciones de pagos y ausencia de flujo específico de devoluciones. | A02 conserva las causas de venta/pago; A05 registra cómo esos estados alimentan comisión. Confirmar regla de período y reversión de comisiones. |
| **A03 — Inventario/compras/envases** | `ReglaComision` y detalle de comisión dependen de `InventarioItem`; se emplea cantidad y precio de línea. | A03 conserva la causa de inventario/producto. El modelo actual no muestra grupos de productos para comisión. |
| **A04 — Rutas/logística** | Fecha, chofer y vendedor de `RutaSesion` determinan período y empleado elegible. A04-003 documenta edición de sesión cerrada y decisión pendiente. | Hallazgo raíz de edición corresponde a A04; A05 describe consumo, resultado histórico y falta de snapshot sin duplicar A04-003. |
| **A06 — Calidad/empresa/áreas sin flujo demostrado** | No se identificó dependencia directa de cálculos de empleados, comisiones o planillas con controles de calidad o configuración de empresa. | Sin hallazgo cruzado A06. Revaluar solo si una futura regla empresarial vincula comisiones a lotes/calidad. |

## 12. Requisitos de negocio pendientes y recomendaciones

### Decisiones a confirmar

1. ¿Cada empleado tiene una sola tabla de reglas que agrupa productos o puede combinar configuraciones? ¿Se necesita comisión por grupo de productos y qué define el grupo?
2. ¿Los rangos son escalones excluyentes aplicados al volumen mensual agregado o se pagan por tramo? ¿Se aplica porcentaje sobre precio vendido neto de descuento? ¿Qué ocurre si la regla falta?
3. Si una venta tiene el mismo usuario como vendedor y chofer, ¿se calcula comisión para ambos roles o se comparte un único importe?
4. ¿El período se determina por fecha de sesión, venta o cobro? ¿La comisión se condiciona a estar totalmente pagada? ¿Cómo se corrige una comisión tras anulación de pago, venta o devolución parcial/completa?
5. ¿Qué empleados entran en el lote? ¿Las fechas de contratación/salida requieren excluir o prorratear salario/comisión? El cálculo observado no usa esas fechas; la regla no se infiere.
6. ¿Hay empleados activos sin comisión, configuración anulada o productos no configurados que deban generar solo sueldo base, bloquear el período o ser advertencias?
7. ¿Los ajustes son importes generales repetidos por persona, individuales o ambos? ¿Se admiten importes cero, negativos o ajustes por empleado?
8. ¿Qué pasos y roles separan cálculo, revisión, aprobación, cierre y pago? El código observado solo persiste borrador y cerrado; no se atribuye un flujo de aprobación/pago ausente a una expectativa formal.
9. ¿Se permite corregir una planilla cerrada? ¿Se conserva una o múltiples revisiones anuladas por período?
10. ¿Una edición de sesión cerrada cambia atribuciones futuras o requiere historial/corrección? Decisión pendiente de A04 y negocio.

### Recomendaciones funcionales para una implementación futura

- Organizar el proceso mensual en pasos explícitos: período → empleados incluidos/excluidos → validaciones accionables → importes completos por empleado → confirmación de generación como borrador → revisión/aprobación/cierre según política.
- Vincular la confirmación a una previsualización exacta; invalidar el resultado cuando cambien período, empleado, ajustes, reglas o fuentes relevantes.
- Mostrar el roster entero con salario base, productos/cantidades/base/tasa/importe, ajustes nominados y totales; facilitar corrección de datos faltantes antes de generar.
- Marcar claramente borrador, revisión, aprobado, cerrado y pago **solo después de que negocio defina e implemente sus transiciones**; actualmente no hay aprobación ni ejecución de pagos.
- Facilitar la consulta histórica mediante filtros por período y empleado, estado comprensible, detalle de conceptos y acceso a versiones/correcciones.
- Mantener trazabilidad reproducible para datos fuente, regla aplicada y asignación vendedor/chofer, coordinando con A02/A04 y respetando la política que se confirme para sesiones cerradas.
- Definir idempotencia/versionado y una clave de unicidad que refleje el número permitido de correcciones, sin truncar el historial.
- En configuración, soportar grupos o composiciones múltiples solo tras resolver su semántica; hacer visible el alcance real del producto que puede seleccionarse.

## 13. Pruebas no ejecutadas, trabajo pendiente y cobertura

Se inspeccionó estáticamente `backend/src/tests/planilla-mensual.service.spec.ts`; contiene casos para cálculo de comisión sobre ventas pagadas/volumen agregado, cierre de borrador y rechazo de edición cerrada. **No se ejecutó** esa suite ni se declara como aprobada. No se ejecutaron pruebas frontend, build, comandos Prisma, migraciones, seeds o scripts.

Pruebas recomendadas en un entorno aislado, con base SQL Server desechable y fixtures sintéticos:

- empleado con varias reglas de producto y tipos; venta compartida entre vendedor/chofer; tramo sin regla; configuración anulada;
- empleados sin usuario, sin configuración y con fechas laborales que bordean el período; demostrar el preflight;
- detalle completo de vista previa, invalidación por cambio y comprobación de igualdad con la generación confirmada;
- generación simultánea/repetida, anulación, regeneración, segunda anulación y restauración; revisar traducción de conflictos únicos;
- actualización de un borrador con observaciones solamente y con arreglo de ajustes vacío/no vacío;
- edición de sesión cerrada y cambio de pago/venta, contrastando nuevos cálculos con snapshots ya cerrados;
- UI con roster de más de cuatro personas y consulta histórica filtrada; no ejecutar generación ni cierre en una base compartida.

**Pendiente externo:** validar índices/esquema y datos desplegados; confirmar consumidores externos de endpoints; resolver preguntas de negocio de la sección 12; probar el flujo visual completo con usuarios en entorno de prueba. Ninguna validación dinámica/financiera se llevó a cabo.

**Integridad:** no se modificaron código, configuración, dependencias, esquema, datos ni documentos previos. Este informe es el único archivo creado para esta ejecución. No se ejecutaron pruebas ni operaciones financieras.
