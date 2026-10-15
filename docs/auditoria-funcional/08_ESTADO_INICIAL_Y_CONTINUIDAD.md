# Estado inicial y continuidad de la auditoría funcional

## Comprobación del entorno

- **Fecha y hora:** 2026-10-11 23:55:48, zona UTC-06:00.
- **Raíz Git comprobada:** `D:\Universidad Mariano Gálvez\FlowManager`.
- **Rama activa:** `developer`.
- **Commit base:** `27f59fa024a804c468c434cfd504baa0b865a362`.
- **Estado Git inicial:** `## developer...origin/developer`; no se reportaron cambios versionados preparados, modificados o eliminados. La carpeta `docs/auditoria-funcional/` y sus nueve archivos existentes aparecían como no seguidos (`??`).
- **Atribución:** el estado de Git no identifica quién creó los archivos no seguidos ni cuándo. Se preservaron; no se intentó limpiarlos, restaurarlos o sobrescribirlos.
- **Comprobaciones realizadas:** raíz, rama, hash y estado Git; inventario de `docs/`; lectura de los documentos de coordinación y del informe A01; comprobación de ausencia de los tres documentos autorizados antes de crearlos.
- **No ejecutado en Fase 0:** pruebas, builds, consultas a bases de datos, seeds, migraciones, scripts SQL, operaciones CRUD o llamadas a servicios externos.

## Documentos de coordinación encontrados

Se encontraron y leyeron los ocho documentos solicitados:

- `00_RESUMEN_GENERAL.md`
- `01_INVENTARIO_MODULOS.md`
- `02_MAPA_ARQUITECTURA.md`
- `03_MAPA_DEPENDENCIAS.md`
- `04_ZONAS_COMPARTIDAS_Y_RIESGOS.md`
- `05_PLAN_AUDITORIAS_PARALELAS.md`
- `06_CONTRATO_DE_AUDITORIA.md`
- `07_PLAN_MAESTRO_COORDINACION.md`

También se encontró `AUDITORIA_A01_IDENTIDAD_ACCESO_SESIONES.md`. Los nueve archivos anteriores ya estaban en el árbol de trabajo como no seguidos; no se modificaron. Los documentos `08`, `09` y `10` no existían en la comprobación previa y se crearon en esta Fase 0.

En `docs/auditoria/` se localizaron 16 bitácoras técnicas, enumeradas y distribuidas por alcance real en `09_MATRIZ_CONTINUIDAD_AUDITORIAS.md`. Son antecedentes de cambios/pruebas, no informes completos de auditoría funcional. También existe documentación de integración n8n; no se consideró un informe de auditoría.

## Informes funcionales previos

El único informe especializado de auditoría funcional localizado es el de **A01**. No se encontró un informe funcional dedicado a A02, A03, A04, A05 o A06. Las bitácoras previas sobre ventas, compras e inventario aportan contexto técnico, pero no sustituyen esas auditorías.

### Hallazgos A01 que se conservan

El informe A01 contiene evidencia original y los seis identificadores que deben mantenerse, sin volver a registrarlos como hallazgos nuevos:

- `AUD-A01-001`: cierre de sesión de la UI sin revocación de la sesión persistida.
- `AUD-A01-002`: anular un usuario no invalida las sesiones existentes.
- `AUD-A01-003`: un rol anulado puede continuar concediendo permisos persistidos.
- `AUD-A01-004`: el registro inicial no asigna el rol administrador anunciado por la UI.
- `AUD-A01-005`: la creación administrativa acepta claves que el login rechaza.
- `AUD-A01-006`: la reasignación de rol no actualiza el rol de sesiones ya emitidas; la política de aplicación inmediata sigue pendiente de confirmación.

El informe documenta revisión estática y evidencia de código/UI, no una validación integral en una base desplegada. Registra una ejecución con 14 pruebas, de las cuales 6 pasaron y 8 fallaron o expiraron en medio de problemas de conexión al pool de Prisma; otra selección focalizada pasó 6 pruebas y omitió 3. El propio informe deja pendiente la comprobación dinámica de RBAC, sesiones, seed y datos desplegados. Estos resultados se conservan tal como fueron reportados y no se volvieron a ejecutar ni validar en esta fase.

## Asignación propuesta y trabajo que no debe duplicarse

- **A01:** conservar el informe A01 y sus seis IDs. Las bitácoras RBAC/autenticación son contexto de implementación, no reemplazo de la revisión funcional ni evidencia de estado desplegado.
- **A02:** el paso 16 documenta ventas, pagos, crédito derivado, talonarios, FEL y dependencias; sus fases posteriores describen principalmente un diseño/plan y no prueban por sí solas una implementación completa. No se encontró auditoría funcional de ciclo comercial.
- **A03:** los pasos sobre compras, kardex, existencias, ajustes, envases/estructura y normalización de producto son antecedentes técnicos para revisar; no equivalen a una auditoría integral de entradas, salidas y reversas.
- **A04:** no se encontró informe funcional ni bitácora especializada de rutas/sesiones logísticas, vehículos, entregas o mantenimiento. La mención de “restore routes” en una bitácora se refiere a endpoints REST, no demuestra auditoría de rutas logísticas.
- **A05:** no se encontró informe funcional de empleados, planilla o comisiones. El paso 16 menciona el consumo de ventas por comisiones como dependencia, no como revisión de la planilla.
- **A06:** no se encontró informe funcional de calidad, empresa, producción o n8n. Las notas sobre estructura/BOM no prueban un flujo de producción; el inventario inicial describe la página de producción como marcador de posición. Confirmar contra código vigente y requisitos durante A06.
- No se localizó un informe dedicado a pedidos/órdenes de producción o entregas operativas. Las menciones en antecedentes no bastan para afirmar que esos flujos estén implementados.
- Los informes de fecha técnica en `docs/auditoria/` incluyen referencias a nombres de migración `2026-11-01` y `2026-11-02`, posteriores a la fecha de esta comprobación. Es una discrepancia documental por verificar; no se inspeccionó ni ejecutó ninguna migración.

La asignación detallada, los cruces y las verificaciones pendientes están en `09_MATRIZ_CONTINUIDAD_AUDITORIAS.md`.

## Superficies compartidas y restricciones

Se registran para coordinación y permanecen sin modificar:

- `backend/prisma/schema.prisma`, SQL maestro, migraciones y seeds.
- Middleware de autenticación/autorización, validadores RBAC, `frontend/lib/api.ts` y almacenamiento de autenticación.
- `backend/src/services/inventory-movement.service.ts`.
- `backend/src/services/sale.service.ts` y `backend/src/services/credit.service.ts`.
- Modelos y relaciones de `Venta`, `PagoVenta` y `CuentaPorCobrar`.
- Relaciones de planilla, ventas, rutas y empleados.
- Integraciones FEL y n8n.
- DTO, manejo de errores, archivos cargados y componentes compartidos.

Las dependencias entre grupos deben seguir el contrato común y el plan maestro. Cada hallazgo futuro tendrá un solo grupo responsable; los demás grupos aportarán evidencia de cruces sin duplicar el hallazgo. Se mantienen fuera del alcance reportes, gráficas, dashboards, indicadores, KPI y analítica.

## Limitaciones, riesgos y bloqueos

- El estado Git inicial incluye nueve archivos no seguidos de auditoría funcional; su autoría y procedencia no se pueden determinar con Git. Se conservaron íntegros.
- No se verificó acceso a SQL Server ni se consultaron datos desplegados; los resultados dinámicos de A01 y las bitácoras históricas no se revalidaron.
- No se verificaron consumidores externos de APIs ni el estado de servicios/workflows externos.
- La cronología de los nombres de migración futuros referidos en los pasos 13 y 15 queda pendiente de revisión humana.
- Los requisitos de negocio que los antecedentes declaran ausentes o ambiguos siguen pendientes; no se infirieron ni resolvieron.
- No se encontraron errores de lectura o permisos durante las comprobaciones realizadas.

## Confirmación de alcance de Fase 0

Durante esta fase no se iniciaron las auditorías A01–A06, no se modificaron código, configuración, dependencias, esquema o datos, y no se alteraron los documentos existentes. Los únicos archivos creados fueron los tres documentos de coordinación autorizados, tras comprobar que no existían.
