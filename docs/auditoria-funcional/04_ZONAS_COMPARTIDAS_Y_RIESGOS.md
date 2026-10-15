# Zonas compartidas y riesgos de concurrencia

## Inventario de superficies de alto acoplamiento

| Zona | Archivos/componentes principales | Módulos consumidores | Riesgo de cambios paralelos |
|---|---|---|---|
| Esquema y persistencia | [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma), [Base de Datos - FlowManager.sql](../../Base%20de%20Datos%20-%20FlowManager.sql), `backend/prisma/migrations/`, `backend/prisma/seed.ts` | Todos los módulos con persistencia | Cambios de campos/relaciones requieren migración, actualización de contratos y consistencia con despliegues; conflictos de generación y orden de migraciones. Designar una persona coordinadora de esquema. |
| Registro de rutas y autorización | [backend/src/app.ts](../../backend/src/app.ts), [backend/src/middlewares/auth.middleware.ts](../../backend/src/middlewares/auth.middleware.ts), `backend/src/validators/role-permission.validators.ts`, servicios/validadores de rol | Todos los endpoints | Una clave o guard incorrecto modifica el acceso global. No duplicar claves ni modificar la matriz/catálogo simultáneamente desde varios módulos. |
| Sesión/autenticación del frontend | [frontend/lib/api.ts](../../frontend/lib/api.ts), `auth-storage.ts`, `auth-store.ts`, [frontend/components/auth-provider.tsx](../../frontend/components/auth-provider.tsx), `require-auth.tsx` | Todas las páginas autenticadas | Interferencia en refresh, logout, storage o evento 401 puede provocar expiraciones globales o reintentos incorrectos. Cambios reservados a un único grupo responsable. |
| Identidad/contratos compartidos | `Usuario`, `Entidad`, `Empleado`, `Cliente`, `Proveedor`; `frontend/types/`, validadores comunes | Usuarios, personal, clientes, proveedores, ventas, compras, logística y planilla | Un cambio de identificador, DTO o significado de nombre/NIT se propaga a formularios, búsquedas, facturación y relaciones. |
| Inventario y bitácora | [backend/src/services/inventory-movement.service.ts](../../backend/src/services/inventory-movement.service.ts), `InventarioItem`, `BitacoraInventario`, `AjusteInventario` | Compras, ventas, ajustes, productos, envases | Divergencia entre existencia y kardex o doble/reversa de movimientos. Coordinar cualquier modificación de entrada/salida/anulación con todos los módulos productores. |
| Transacciones de venta y cobro | [backend/src/services/sale.service.ts](../../backend/src/services/sale.service.ts), `credit.service.ts`, `Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar` | Ventas, crédito/cartera, FEL, inventario, rutas, planilla | Un cambio parcial puede afectar saldos, inventario o emisión fiscal. La auditoría debe comunicar hallazgos cruzados antes de proponer ajuste. |
| Comisiones y remuneración | `planilla-mensual.service.ts`, `planilla-comision.service.ts`, modelos `ReglaComision`, `Planilla*`, `DetalleVenta`, `RutaSesion`, `Empleado` | Personal, ventas, logística, planilla/comisiones | Un cambio de estados/atributos de venta o asignación de ruta altera resultados de remuneración. |
| Servicios externos | `fel.service.ts`, `notification.service.ts`, `n8n-webhook.client.ts`, variables de entorno documentadas | Ventas/FEL y eventos de varios módulos | Contratos externos, efectos fiscales, formatos y secretos. No cambiar ni ejecutar pruebas con efectos reales en auditoría; toda diferencia de payload se coordina con consumidores. |
| Uploads y resolución de rutas | `upload.middleware.ts`, `utils/paths.ts`, `app.ts` estático `/uploads`; campos de rutas de archivo en DTOs/modelos | Clientes, productos, ventas, logística y mantenimiento | Alteración de path/almacenamiento afecta lectura de imágenes y despliegues multiinstancia. Archivos runtime no son fuente versionada. |
| Contratos de API/DTO compartidos | `frontend/types/`, `frontend/services/`, validadores y controladores por módulo | UI/API de cada flujo y consumidores externos | Cambios de nombres, nulabilidad, estados o paginación pueden dejar UI desincronizada aunque compile una capa. |
| Manejo general de errores | [backend/src/app.ts](../../backend/src/app.ts), controllers y utilidades comunes | Todos los endpoints | Mensajes/códigos HTTP globales son observables por frontend, tests y clientes. Evitar ajustes separados de mapeo de error. |
| Navegación/roles UI | `frontend/lib/rbac.ts`, `frontend/components/dashboard-shell.tsx`, `role-permission*` | Menú y páginas protegidas | El menú puede ocultar/mostrar opciones de forma distinta al backend. La visibilidad UI no sustituye autorización API. |
| Workspace/dependencias/build | `pnpm-workspace.yaml`, `pnpm-lock.yaml`, manifiestos de frontend/backend, configuraciones TS | Todo el workspace | Cambios simultáneos de versión o lockfile causan conflictos y resultados no reproducibles. Esta auditoría no requiere tocar dependencias. |

## Dependencias compartidas más sensibles

### Inventario

El servicio de movimientos recibe una transacción Prisma, registra `BitacoraInventario` y también ofrece anulación/restauración por referencia. Compra y venta lo importan directamente; envases también gestiona stock y movimientos de envase. Cualquier hallazgo que toque stock debe indicar los documentos de origen, efectos de reversa y módulos consumidores.

### Venta y crédito

`credit.service.ts` importa funciones de `sale.service.ts` para operar pagos. `sale.service.ts` también enlaza precio, bonificación, inventario, FEL y notificación, y los modelos se relacionan con cliente, ruta y talonario. Es un núcleo transaccional de alto acoplamiento; no repartir cambios de servicio en paralelo entre agentes.

### Seguridad

Las acciones permitidas se tipan en backend y existen consumidores frontend. Los routers incluyen las claves de RBAC en cada endpoint; el contrato persistido en SQL/Prisma y la interfaz de roles deben mantenerse coordinados.

### Planilla

El cálculo consulta ventas y datos de vendedor/chofer por período y configuración de comisiones. La auditoría de ventas/logística debe reportar cambios o sospechas que alteren datos consumidos por planilla, sin modificar unilateralmente esas superficies.

## Reglas de coordinación recomendadas

1. Fijar un commit base y registrar el hash en cada informe; no permitir que los agentes trabajen sobre referencias distintas.
2. Asignar un responsable único para cambios de esquema, RBAC, API compartida o estado de ventas. Durante esta fase solo lectura: ningún agente debe modificar estas áreas.
3. Los grupos de auditoría pueden leer dependencias fuera de su ámbito, pero sus hallazgos deben identificar el módulo dueño y dejar propuesta coordinada, sin asumir responsabilidad sobre él.
4. No ejecutar endpoints de emisión FEL, alteraciones de datos, scripts SQL, seeds, migraciones ni cargas que modifiquen estado.
5. En cada conclusión registrar archivo/símbolo, comportamiento comprobado y prueba/documento usado. Señalar por separado evidencia de código, requisito documental y expectativa pendiente.
6. Una aparente falta de uso exige búsqueda de relaciones Prisma, queries, servicios compartidos, tipos, consumidores frontend/backend y accesos indirectos antes de categorizar.
7. Mantener los resultados de auditoría en los documentos solicitados o en un espacio de resultados coordinado; no editar código fuente ni documentos funcionales existentes.
8. Consolidar duplicados por flujo afectado, conservando las evidencias y dependencias aportadas por cada grupo.

## Riesgos no resueltos en esta fase

- No se comparó una instancia SQL real con esquema Prisma/migraciones/script maestro.
- No se verificó el contrato del proveedor FEL en vivo ni el workflow remoto n8n.
- No se investigó despliegue de uploads, uso multinstancia o retención de archivos.
- No se confirmó el proceso empresarial de fabricación ni la relación de BOM a inventario.
- Las bitácoras técnicas tienen fechas y alcances distintos; pueden describir estados previos o decisiones locales. La auditoría debe resolver discrepancias con evidencia vigente.
- Reportes, dashboard y analítica son zonas del repositorio pero su comportamiento queda expresamente fuera del encargo.
