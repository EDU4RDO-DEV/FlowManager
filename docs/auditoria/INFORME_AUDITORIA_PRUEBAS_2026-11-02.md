# Auditoría técnica de pruebas — Industrias Basan

**Fecha de ejecución:** 2 de noviembre de 2026  
**Revisión examinada:** rama `developer`, commit `485ab45cad62ba69c499112e66190e25fd1a0e8a`  
**Alcance:** inspección y ejecución controlada; no se modificaron código fuente ni pruebas.

## Alcance y criterio de seguridad

La auditoría se ejecutó sobre el árbol de trabajo disponible, que ya contenía cambios locales en controladores, servicios, definiciones de reportes y pruebas de reportes. Los resultados corresponden a ese árbol, no exclusivamente al commit indicado. La base configurada localmente no se utilizó: para ejecutar Vitest se reemplazó `DATABASE_URL` por un destino local no disponible (`127.0.0.1:1`) y se deshabilitaron las compuertas de integración. No se ejecutaron migraciones, tareas de respaldo/restauración ni operaciones FEL externas.

Los 20 fallos observados durante esa ejecución no se atribuyen como defectos confirmados del producto: las respuestas HTTP `500` coincidieron con el error de conexión al destino local bloqueado. Esos casos requieren repetirse contra una base de pruebas autorizada antes de concluir si existe un defecto funcional.

## A. Información técnica del proyecto

| Área | Evidencia observada |
|---|---|
| Organización | Workspace pnpm con paquetes `backend` y `frontend`; no hay manifiesto raíz de scripts. |
| Backend | Node.js, Express 5.2.1, TypeScript 5.6.3, Prisma 6.16.2, SQL Server, Zod, JWT y bcryptjs. |
| Frontend | Next.js 16.2.11, React 19.2.4 y TypeScript. |
| ORM/base de datos | Prisma Client; el datasource de `backend/prisma/schema.prisma` declara `sqlserver` y obtiene su URL de `DATABASE_URL`. |
| Autenticación | JWT y bcryptjs; las pruebas cubren autenticación, sesiones y autorización RBAC. |
| Pruebas | Vitest 3.2.7 con entorno Node y patrón `backend/src/**/*.spec.ts`; Supertest se usa en pruebas HTTP del backend. |
| Versiones del entorno de auditoría | Node `v22.18.0`, pnpm `10.15.0`, Vitest `3.2.7`. |
| Integraciones con pruebas relacionadas | FEL/SOAP y webhook n8n. Las pruebas FEL usan un servidor HTTP local; las de n8n sustituyen `fetch`. No son evidencia de una transacción con los proveedores reales. |
| Automatización de navegador | No se identificaron pruebas Playwright, Cypress o Selenium ni una carpeta de workflows CI en `.github/workflows`. |

El backend declara los scripts `test`, `test:watch`, `test:integration:routes` y `build`. El frontend declara `lint` y `build`, pero no un script `test`. La configuración de Vitest solo incluye `src/**/*.spec.ts`.

## B. Inventario de pruebas existentes

Se identificaron **73 archivos de prueba** bajo `backend/src/tests`. La tabla muestra todos los archivos incluidos por la configuración y el resultado de cada archivo en la ejecución registrada: P = aprobados, F = fallidos, O = omitidos.

### Autenticación, usuarios y permisos

| Archivo | Casos | P | F | O |
|---|---:|---:|---:|---:|
| `auth-a01-bootstrap.spec.ts` | 3 | 3 | 0 | 0 |
| `auth-a01.controller.spec.ts` | 3 | 3 | 0 | 0 |
| `auth-a01.middleware.spec.ts` | 6 | 6 | 0 | 0 |
| `auth-a01.refresh.spec.ts` | 3 | 3 | 0 | 0 |
| `auth-rbac.spec.ts` | 9 | 7 | 2 | 0 |
| `module-endpoints-rbac.spec.ts` | 10 | 0 | 10 | 0 |
| `role-permission-matrix.spec.ts` | 5 | 0 | 5 | 0 |
| `role-permission.service.spec.ts` | 1 | 1 | 0 | 0 |
| `role-permission.validators.spec.ts` | 1 | 1 | 0 | 0 |
| `session-a01-restore.spec.ts` | 1 | 1 | 0 | 0 |
| `user-a01.controller.spec.ts` | 5 | 5 | 0 | 0 |
| `user-a01.service.spec.ts` | 1 | 1 | 0 | 0 |
| `user-employee-link-centralization.spec.ts` | 5 | 5 | 0 | 0 |
| `usuario-empleado-link.spec.ts` | 4 | 4 | 0 | 0 |

### Clientes, ventas, créditos, compras y administración

| Archivo | Casos | P | F | O |
|---|---:|---:|---:|---:|
| `cash.service.spec.ts` | 4 | 4 | 0 | 0 |
| `client-a02.service.spec.ts` | 3 | 3 | 0 | 0 |
| `client-credit-condition-history.spec.ts` | 7 | 7 | 0 | 0 |
| `commercial-catalog-routes.spec.ts` | 3 | 0 | 3 | 0 |
| `commercial-return.service.spec.ts` | 7 | 7 | 0 | 0 |
| `commercial-rules.service.spec.ts` | 6 | 6 | 0 | 0 |
| `commission-accrual.service.spec.ts` | 11 | 11 | 0 | 0 |
| `credit.service.spec.ts` | 5 | 5 | 0 | 0 |
| `employee-advance.service.spec.ts` | 2 | 2 | 0 | 0 |
| `jornada.service.spec.ts` | 10 | 10 | 0 | 0 |
| `maintenance.service.spec.ts` | 5 | 5 | 0 | 0 |
| `payment.validators.spec.ts` | 4 | 4 | 0 | 0 |
| `payroll-payment.service.spec.ts` | 2 | 2 | 0 | 0 |
| `planilla-mensual.service.spec.ts` | 16 | 16 | 0 | 0 |
| `purchase.service.spec.ts` | 8 | 8 | 0 | 0 |
| `purchase.validators.spec.ts` | 4 | 4 | 0 | 0 |
| `sale-credit-authorization.spec.ts` | 12 | 12 | 0 | 0 |
| `sale-cxc.service.spec.ts` | 11 | 11 | 0 | 0 |
| `sale-notification.service.spec.ts` | 17 | 17 | 0 | 0 |
| `sale-payment.rollback.integration.spec.ts` | 1 | 0 | 0 | 1 |
| `sale-transition-notifications.spec.ts` | 16 | 16 | 0 | 0 |
| `sale.validators.spec.ts` | 3 | 3 | 0 | 0 |
| `talonario.service.spec.ts` | 5 | 5 | 0 | 0 |

### Inventario, producción y calidad

| Archivo | Casos | P | F | O |
|---|---:|---:|---:|---:|
| `adjustment.service.spec.ts` | 13 | 13 | 0 | 0 |
| `envase.service.spec.ts` | 14 | 14 | 0 | 0 |
| `inventory-log.validators.spec.ts` | 4 | 4 | 0 | 0 |
| `inventory-reports.spec.ts` | 1 | 1 | 0 | 0 |
| `product-returnable-balances.controller.spec.ts` | 2 | 2 | 0 | 0 |
| `product-structure.service.spec.ts` | 19 | 19 | 0 | 0 |
| `product-structure.validators.spec.ts` | 4 | 4 | 0 | 0 |
| `product.service.spec.ts` | 12 | 12 | 0 | 0 |
| `product.validators.spec.ts` | 4 | 4 | 0 | 0 |
| `production.spec.ts` | 28 | 28 | 0 | 0 |
| `quality.service.spec.ts` | 9 | 9 | 0 | 0 |
| `quality.validators.spec.ts` | 2 | 2 | 0 | 0 |

### Logística, rutas y movimientos

| Archivo | Casos | P | F | O |
|---|---:|---:|---:|---:|
| `logistics-employee-options.spec.ts` | 1 | 1 | 0 | 0 |
| `logistics-session-concurrency.spec.ts` | 4 | 4 | 0 | 0 |
| `logistics.service.spec.ts` | 7 | 7 | 0 | 0 |
| `logistics.validators.spec.ts` | 6 | 6 | 0 | 0 |
| `operational-scope.service.spec.ts` | 3 | 3 | 0 | 0 |
| `route-flow.sqlserver.integration.spec.ts` | 8 | 0 | 0 | 8 |
| `route-handoff.service.spec.ts` | 5 | 5 | 0 | 0 |
| `route-inventory.controller.spec.ts` | 5 | 5 | 0 | 0 |
| `route-inventory.service.spec.ts` | 31 | 31 | 0 | 0 |
| `route-inventory.validators.spec.ts` | 9 | 9 | 0 | 0 |
| `route-sale-inventory.spec.ts` | 10 | 10 | 0 | 0 |
| `route-transfer.service.spec.ts` | 9 | 9 | 0 | 0 |

### Reportes, FEL, webhooks y validaciones generales

| Archivo | Casos | P | F | O |
|---|---:|---:|---:|---:|
| `company.validators.spec.ts` | 3 | 3 | 0 | 0 |
| `dashboard.service.spec.ts` | 3 | 3 | 0 | 0 |
| `dashboard.validators.spec.ts` | 2 | 2 | 0 | 0 |
| `estados-catalogos.validators.spec.ts` | 6 | 6 | 0 | 0 |
| `fel-service.spec.ts` | 4 | 4 | 0 | 0 |
| `fel-transport.spec.ts` | 2 | 2 | 0 | 0 |
| `image-signature.spec.ts` | 5 | 5 | 0 | 0 |
| `n8n-webhook.client.spec.ts` | 12 | 12 | 0 | 0 |
| `report-pdf-templates.spec.ts` | 6 | 6 | 0 | 0 |
| `reports-registry.spec.ts` | 2 | 2 | 0 | 0 |
| `sales-reports.spec.ts` | 3 | 3 | 0 | 0 |
| `serializable-transaction.spec.ts` | 3 | 3 | 0 | 0 |

Los nombres de escenarios, entradas y aserciones están en cada archivo `.spec.ts`. Vitest no reportó tiempos individuales por caso en el resumen ejecutado; por eso no se atribuyen tiempos por escenario.

## C. Resultados de pruebas unitarias y de rutas

La ejecución completa de Vitest informó **480 casos** en 73 archivos: **451 aprobados, 20 fallidos y 9 omitidos**. Los 20 casos fallidos se concentran en pruebas HTTP/RBAC que hacen consultas Prisma no sustituidas por completo:

| Archivo | Casos fallidos | Expectativa del caso | Resultado observado |
|---|---:|---|---|
| `auth-rbac.spec.ts` | 2 | Denegación HTTP `403` por falta de permiso | `500` |
| `commercial-catalog-routes.spec.ts` | 3 | Respuestas `200` al listar catálogos y `400` ante body inválido | `500` |
| `module-endpoints-rbac.spec.ts` | 10 | Respuestas `400`, `403` o `404` ante permisos/entradas descritos por cada escenario | `500` |
| `role-permission-matrix.spec.ts` | 5 | Respuestas `200`/`403` según el rol y la acción | `500` |

Vitest registró el error `Can't reach database server at 127.0.0.1:1`. La configuración de estas pruebas conserva consultas Prisma reales en algunos caminos; por tanto, con la conexión deliberadamente bloqueada el resultado no permite separar una falla de conexión de un defecto de aplicación. **No se concluye que los 20 casos sean defectos del sistema.**

Los otros 451 casos pasaron en esta ejecución. Entre las áreas con pruebas están autenticación/sesiones/RBAC, clientes y créditos, compras, ventas y pagos, inventario/envases, producción/recetas, calidad, logística/rutas, planilla, reportes, validadores, FEL y n8n. Las cantidades aprobadas no equivalen a cobertura de código.

## D. Resultados de pruebas de integración

| Prueba | Escenarios | Entorno y datos | Resultado |
|---|---:|---|---|
| `route-flow.sqlserver.integration.spec.ts` | 8 | SQL Server real; crea usuarios, vehículos, sesiones, entidades, artículos, ventas y movimientos, y luego elimina los registros creados. Evalúa permisos persistidos, concurrencia de despacho, reservas, devoluciones y cierres de ruta. | Omitidos por `ROUTE_SQLSERVER_INTEGRATION` deshabilitado. |
| `sale-payment.rollback.integration.spec.ts` | 1 | SQL Server real (`FlowManager_Test` o autorización explícita para `FlowManager`); crea datos temporales para concurrencia, idempotencia y saldos, y los elimina al finalizar. | Omitido por `ROUTE_SQLSERVER_INTEGRATION` deshabilitado. |

No se ejecutaron estas pruebas: requieren una base de datos configurada y escriben/eliminan registros. El script `test:integration:routes` también carga `backend/.env`, requiere `FLOWMANAGER_SQLSERVER_INTEGRATION=1` y valida que la base sea `FlowManager`; su objetivo no es seguro de ejecutar sin autorización y entorno de integración dedicado. No se ejecutó.

Las pruebas de FEL arrancan un servidor HTTP local y verifican solicitudes/respuestas de prueba; las de n8n sustituyen `fetch`. No acreditan una llamada real al proveedor FEL ni a n8n. Algunas suites con Supertest montan la aplicación Express, pero sus consultas de base de datos condicionan su independencia de SQL Server.

## E. Pruebas de aceptación

No se identificaron pruebas formales de aceptación de usuario, pruebas de navegador ni matriz ejecutable de aceptación. “No implementado” en esta tabla se refiere a una **prueba de aceptación formal**, no a que la funcionalidad del producto no exista.

| Escenario de usuario | Evidencia de nivel inferior | Estado de aceptación |
|---|---|---|
| Inicio de sesión y cierre de sesión | `auth-a01.*`, `auth-rbac.spec.ts` | No implementado como aceptación |
| Administración de usuarios y roles | `user-a01.*`, `role-permission-matrix.spec.ts` | No implementado como aceptación |
| Registro/consulta de clientes | `client-a02.service.spec.ts`, `commercial-catalog-routes.spec.ts` | No implementado como aceptación |
| Consulta y movimientos de inventario | `product.service.spec.ts`, `inventory-reports.spec.ts`, validadores | No implementado como aceptación |
| Registro de compras | `purchase.service.spec.ts`, `purchase.validators.spec.ts` | No implementado como aceptación |
| Registro de producción | `production.spec.ts`, `product-structure.service.spec.ts` | No implementado como aceptación |
| Creación y seguimiento de pedidos/ventas | `sale-*.spec.ts`, `route-sale-inventory.spec.ts` | No implementado como aceptación |
| Asignación y cierre de rutas | `logistics.service.spec.ts`; integración SQL Server omitida | No implementado como aceptación |
| Registro de entregas y devoluciones | `route-flow.sqlserver.integration.spec.ts` (omitida), `commercial-return.service.spec.ts` | No implementado como aceptación |
| Facturación electrónica | `fel-service.spec.ts`, `fel-transport.spec.ts` con servidor local | No implementado como aceptación |
| Consulta de créditos y pagos | `credit.service.spec.ts`, `sale-cxc.service.spec.ts` | No implementado como aceptación |
| Generación de reportes | `reports-registry.spec.ts`, `sales-reports.spec.ts`, pruebas PDF | No implementado como aceptación |

## F. Resumen de métricas de calidad

| Categoría | Métrica | Resultado |
|---|---|---|
| Vitest | Archivos de prueba ejecutados | 73 |
| Vitest | Casos totales | 480 |
| Vitest | Aprobados / fallidos / omitidos | 451 / 20 / 9 |
| Vitest | Archivos pasados / fallidos / omitidos | 67 / 4 / 2 |
| Vitest | Duración reportada por Vitest | 63.33 s |
| Vitest | Tiempo de pared medido | 68.09 s |
| SQL Server | Casos de integración ejecutados | 0; 9 omitidos |
| Aceptación | Escenarios automatizados formales identificados | 0 |
| Cobertura | Porcentaje de cobertura | No fue posible determinarlo; no se identificó instrumentación ni reporte de cobertura en los scripts/resultados examinados. |
| Backend | `pnpm run build` | Aprobado; 22.95 s |
| Frontend | `pnpm run lint` | Fallido; 39 errores y 2 advertencias; 42.41 s |

Los 39 errores de ESLint se distribuyen en 26 archivos: 37 infracciones `react-hooks/set-state-in-effect` y 2 `react-hooks/immutability`. Las 2 advertencias son `react-hooks/exhaustive-deps`. Son hallazgos del análisis estático; no se corrigieron como parte de esta auditoría. Entre los archivos con observaciones están páginas de clientes, compras, inventario, ventas, reportes, nómina, usuarios y `components/theme-provider.tsx`.

## G. Hallazgos y limitaciones

| ID | Tipo | Evidencia | Impacto/estado |
|---|---|---|---|
| H-01 | Dependencia/configuración de pruebas | Veinte casos de cuatro suites recibieron HTTP `500` y el log registra imposibilidad de alcanzar `127.0.0.1:1`. | Resultado inconcluso para esos casos; no es evidencia suficiente para declarar un defecto funcional. Requieren repetición en base de pruebas controlada. |
| H-02 | Pruebas omitidas | Ocho escenarios de ruta y uno de pagos SQL Server están protegidos por variables de entorno y escriben/eliminan datos. | No hay resultado actual de integración real, transacciones, persistencia ni concurrencia SQL Server. |
| H-03 | Análisis estático | `pnpm run lint` finalizó con 39 errores y 2 advertencias en el frontend. | El análisis estático del frontend no pasa; no se modificó código para corregirlo. |
| H-04 | Aceptación/cobertura | No se encontraron pruebas E2E/aceptación ni instrumentación de cobertura. | No es posible certificar flujos desde la perspectiva del usuario ni informar porcentaje de cobertura. |
| H-05 | Evidencia preexistente no coincidente | `backend/vitest-results.json`, ya presente como archivo no rastreado antes de esta auditoría, registra 151 suites y 471 casos con otra fecha. La ejecución actual encontró 73 archivos y 480 casos. | No se mezcló ese reporte con las métricas actuales ni se sobrescribió. No hay evidencia suficiente para atribuirlo a esta revisión. |
| H-06 | Estado del repositorio | El árbol ya tenía cambios locales en backend, incluyendo `dashboard.service.spec.ts` y el nuevo `sales-reports.spec.ts`. | Las métricas describen el árbol de trabajo y no deben presentarse como resultados de un commit limpio. |

## H. Evidencias y comandos

### Ejecuciones realizadas

1. **Backend Vitest**
   - Directorio: `backend`.
   - Comando: `pnpm test -- --reporter=dot`.
   - Fecha: 2026-11-02; duración Vitest 63.33 s, tiempo de pared 68.09 s.
   - Base de datos protegida: `DATABASE_URL` sustituido por un destino local no disponible; `FLOWMANAGER_SQLSERVER_INTEGRATION=0` y `ROUTE_SQLSERVER_INTEGRATION=0`.
   - Código de salida: `1`; 451 pasaron, 20 fallaron y 9 se omitieron.
   - Salida observada: `Can't reach database server at 127.0.0.1:1`.
2. **Compilación backend**
   - Directorio: `backend`.
   - Comando: `pnpm run build` (`tsc && node scripts/copy-report-templates.js`).
   - Código de salida: `0`; 22.95 s. TypeScript compiló y se copiaron los templates de reportes a `dist`.
3. **Análisis estático frontend**
   - Directorio: `frontend`.
   - Comando: `pnpm run lint` (`eslint`).
   - Código de salida: `1`; 42.41 s; `✖ 41 problems (39 errors, 2 warnings)`.

### Referencias del repositorio

- `backend/package.json`: scripts y dependencias de backend.
- `backend/vitest.config.ts`: entorno, patrón y alcance de Vitest.
- `backend/src/tests/`: los 73 archivos de pruebas inventariados.
- `backend/scripts/run-route-integration-tests.js`: compuerta de seguridad y validación de base para pruebas de ruta.
- `backend/src/tests/route-flow.sqlserver.integration.spec.ts`: escenarios SQL Server y escrituras/limpieza.
- `backend/src/tests/sale-payment.rollback.integration.spec.ts`: escenario SQL Server de pagos y limpieza.
- `backend/prisma/schema.prisma`: datasource SQL Server.
- `frontend/package.json` y `frontend/eslint.config.mjs`: scripts y configuración ESLint.

La revisión Git al inicio indicó la rama `developer`, commit `485ab45cad62ba69c499112e66190e25fd1a0e8a` (“Version de capacitación 30-10-2026”), con diferencias sin confirmar. No se afirma que este código corresponda a producción.

## I. Conclusión de auditoría

El proyecto cuenta con un conjunto amplio de pruebas automatizadas de backend, organizado en 73 archivos y con cobertura funcional en autenticación/RBAC, ventas, inventario, producción, compras, logística y reportes. En la ejecución segura disponible pasaron 451 casos; otros 20 no pudieron validarse debido a la dependencia de SQL Server, y 9 escenarios SQL Server quedaron omitidos deliberadamente para evitar escrituras en una base no autorizada. Por tanto, las cifras no certifican el comportamiento integral del sistema ni una integración real con servicios externos.

La compilación del backend pasó, mientras que ESLint reportó errores y advertencias en el frontend. No se identificaron pruebas formales de aceptación, automatización de navegador ni métricas de cobertura. Para cerrar esas brechas se necesita repetir las suites dependientes de base de datos en una instancia de pruebas aislada, definir escenarios de aceptación y habilitar instrumentación de cobertura; esta auditoría no aplicó esas modificaciones.
