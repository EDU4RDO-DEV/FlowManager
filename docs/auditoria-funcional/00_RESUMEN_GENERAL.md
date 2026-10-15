# Resumen general — exploración inicial

## Objetivo y alcance

Esta exploración establece una referencia técnica y funcional inicial del repositorio de FlowManager para Industrias Basan y prepara auditorías especializadas. No es una auditoría funcional final: no se evaluó exhaustivamente cada campo o regla de negocio, no se declararon datos huérfanos y no se ejecutaron cambios sobre el sistema.

Se revisaron los archivos propios versionados de las capas principales, la estructura de páginas, rutas y servicios, el esquema Prisma, la lista de migraciones, las pruebas existentes y la documentación disponible. Se excluyeron del análisis funcional reportes, dashboards, indicadores, gráficas y visualizaciones analíticas, tal como exige el alcance.

## Arquitectura y tecnologías detectadas

El repositorio es un workspace pnpm con dos aplicaciones:

- **Frontend:** Next.js 16 con App Router, React 19 y TypeScript. Usa Axios, React Hook Form, Zod, Tailwind CSS y componentes Radix/shadcn. El punto de entrada visual es [frontend/app/layout.tsx](../../frontend/app/layout.tsx); la aplicación centraliza la sesión y el tema en componentes compartidos.
- **Backend:** Node.js, Express 5 y TypeScript 5.6. La aplicación se inicializa en [backend/src/index.ts](../../backend/src/index.ts) y monta rutas en [backend/src/app.ts](../../backend/src/app.ts). Sus capas predominantes son rutas → middleware/controladores → validadores Zod/servicios → Prisma.
- **Persistencia:** SQL Server mediante Prisma ORM 6.16.2; el esquema contiene 42 modelos. Hay un esquema Prisma, un script SQL maestro y 14 migraciones SQL versionadas. La configuración de Prisma está en [backend/src/config/prisma.ts](../../backend/src/config/prisma.ts).
- **Autenticación/autorización:** JWT, sesiones persistidas y RBAC por módulo/acción. La definición de claves de RBAC reside en [backend/src/validators/role-permission.validators.ts](../../backend/src/validators/role-permission.validators.ts) y los guards en [backend/src/middlewares/auth.middleware.ts](../../backend/src/middlewares/auth.middleware.ts).
- **Pruebas:** 32 archivos de pruebas backend con Vitest y Supertest. No se identificó un script de pruebas frontend en los manifiestos consultados.
- **Integraciones y archivos:** FEL se implementa en un servicio backend; las notificaciones envían eventos a n8n. Los archivos subidos se sirven desde `/uploads`; las plantillas de informes/PDF existen, pero se excluyen de esta auditoría.

Referencias de configuración: [pnpm-workspace.yaml](../../pnpm-workspace.yaml), [backend/package.json](../../backend/package.json), [backend/tsconfig.json](../../backend/tsconfig.json), [frontend/package.json](../../frontend/package.json), [frontend/tsconfig.json](../../frontend/tsconfig.json) y [frontend/next.config.ts](../../frontend/next.config.ts).

## Estado de la exploración

- Se identificaron **14 grupos funcionales con evidencia de API o backend**, además de una página de producción que muestra un placeholder sin API de producción observada. El desglose está en [01_INVENTARIO_MODULOS.md](./01_INVENTARIO_MODULOS.md).
- Se identificaron **26 archivos de router backend** montados en la aplicación (25 prefijos distintos; logística comparte prefijo entre rutas y mantenimiento).
- Se identificaron **42 modelos Prisma**, **14 migraciones SQL** y **32 archivos de pruebas backend**.
- Se registraron los acoplamientos y flujos técnicos visibles en código, con grado de certeza, en [03_MAPA_DEPENDENCIAS.md](./03_MAPA_DEPENDENCIAS.md).
- Se inventariaron los documentos versionados existentes. Son principalmente bitácoras de pasos técnicos y documentación de integración; no se encontraron especificaciones de negocio completas para todas las áreas.

## Áreas principales

Autenticación, usuarios, sesiones y roles; empleados; clientes y catálogos comerciales; proveedores; productos e inventario; compras y gastos; ventas, pagos, créditos y talonarios; envases retornables; logística, vehículos, rutas y mantenimiento; planilla y comisiones; calidad; empresa/configuración; notificaciones e integraciones.

La existencia de pantallas no equivale a un flujo implementado. En particular, `frontend/app/production/page.tsx` muestra un placeholder y no hay una ruta backend de producción montada en `backend/src/app.ts`; las estructuras de producto no demuestran por sí solas ejecución de órdenes o trazabilidad de producción.

## Riesgos iniciales de coordinación

1. [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma), migraciones y el SQL maestro son superficies comunes con cambios que pueden afectar varios módulos.
2. Ventas comparte lógica y datos con clientes, inventario, cuentas por cobrar/pagos, logística, FEL, notificaciones, envases y planilla/comisiones.
3. [backend/src/services/inventory-movement.service.ts](../../backend/src/services/inventory-movement.service.ts) sirve a flujos que actualizan stock y bitácora.
4. Autenticación, permisos, modelos/contratos compartidos del frontend y el adaptador Axios impactan transversalmente.
5. Los documentos históricos pueden quedar desfasados frente al código actual; registrar ambas evidencias y su fecha, sin asumir que el documento refleja el estado vigente.

El detalle está en [04_ZONAS_COMPARTIDAS_Y_RIESGOS.md](./04_ZONAS_COMPARTIDAS_Y_RIESGOS.md).

## Limitaciones y cuestiones pendientes

- No se conectó ni consultó una base de datos; la exploración de datos se limitó al esquema y a las consultas del código.
- No se leyeron archivos locales de entorno, credenciales ni certificados. Solo se registraron las ubicaciones/configuraciones por su función, sin exponer valores.
- El contenido de insumos FEL locales ignorados por Git no se examinó. El README del backend y los documentos del repositorio los mencionan como referencias externas.
- No se evaluó en profundidad la totalidad de cada controlador, servicio, migración, prueba o regla; esta fase es un mapa, no un dictamen funcional.
- Reportes, dashboards, analítica y visualizaciones quedaron intencionalmente fuera de revisión.
- Las reglas esperadas que no están respaldadas por código o requisitos quedan pendientes de validación con el negocio.

## Documentos generados

1. [00_RESUMEN_GENERAL.md](./00_RESUMEN_GENERAL.md)
2. [01_INVENTARIO_MODULOS.md](./01_INVENTARIO_MODULOS.md)
3. [02_MAPA_ARQUITECTURA.md](./02_MAPA_ARQUITECTURA.md)
4. [03_MAPA_DEPENDENCIAS.md](./03_MAPA_DEPENDENCIAS.md)
5. [04_ZONAS_COMPARTIDAS_Y_RIESGOS.md](./04_ZONAS_COMPARTIDAS_Y_RIESGOS.md)
6. [05_PLAN_AUDITORIAS_PARALELAS.md](./05_PLAN_AUDITORIAS_PARALELAS.md)
7. [06_CONTRATO_DE_AUDITORIA.md](./06_CONTRATO_DE_AUDITORIA.md)

## Próximos pasos

1. Confirmar con el responsable del negocio los requisitos de producción, calidad, estados comerciales, crédito, uso de envases y comisiones que no estén especificados en el repositorio.
2. Fijar el commit/versión de referencia para los agentes.
3. Asignar los grupos propuestos en [05_PLAN_AUDITORIAS_PARALELAS.md](./05_PLAN_AUDITORIAS_PARALELAS.md) y exigir que consulten el contrato, inventario y mapa de dependencias.
4. Resolver cualquier discrepancia documental durante la auditoría especializada, no por inferencia en esta fase.
