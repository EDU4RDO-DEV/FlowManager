# Plan maestro de coordinación de auditorías funcionales — FlowManager

**Versión:** 1.0  
**Estado:** Planificación  
**Modalidad:** Auditoría técnica y funcional de solo lectura  
**Repositorio:** FlowManager  
**Ruta propuesta:** `docs/auditoria-funcional/07_PLAN_MAESTRO_COORDINACION.md`

---

## 1. Propósito

Establecer un plan unificado para ejecutar las auditorías funcionales de FlowManager, garantizando que cada campo, configuración, relación, opción y funcionalidad tenga un propósito identificable, un comportamiento comprobable y una conexión coherente con los procesos del sistema.

La auditoría debe determinar, dentro de cada alcance asignado:

- De dónde provienen los datos.
- Dónde y cómo se almacenan.
- Qué validaciones y reglas de negocio se aplican.
- Qué servicios, pantallas y procesos consumen esos datos.
- Si los cambios de estado producen los efectos esperados.
- Si existen campos, configuraciones, endpoints u opciones cuyo uso no está demostrado.
- Si hay discrepancias entre frontend, backend, persistencia y documentación.
- Qué requisitos de negocio necesitan confirmación.

La presencia de una pantalla, endpoint, tabla o campo no constituye por sí sola evidencia de que una funcionalidad esté completa.

## 2. Alcance general

La auditoría abarcará las funcionalidades operativas de los dominios asignados a los seis grupos oficiales A01–A06.

Se priorizará la trazabilidad de los flujos completos, desde la interfaz hasta la persistencia y sus consumidores indirectos, cuando esas capas existan.

### 2.1 Exclusiones obligatorias

Quedan fuera de esta fase:

- Reportes y generación de informes.
- Gráficas y visualizaciones analíticas.
- Dashboards.
- Indicadores, KPI y métricas analíticas.
- Correcciones o implementación de funcionalidades.
- Cambios de esquema, datos, configuración o dependencias.

La existencia de una pantalla de reportes dentro de un módulo no autoriza a investigar su comportamiento analítico.

## 3. Documentación de referencia

Todos los grupos deben leer los siguientes documentos antes de comenzar:

1. `docs/auditoria-funcional/00_RESUMEN_GENERAL.md`
2. `docs/auditoria-funcional/01_INVENTARIO_MODULOS.md`
3. `docs/auditoria-funcional/02_MAPA_ARQUITECTURA.md`
4. `docs/auditoria-funcional/03_MAPA_DEPENDENCIAS.md`
5. `docs/auditoria-funcional/04_ZONAS_COMPARTIDAS_Y_RIESGOS.md`
6. `docs/auditoria-funcional/05_PLAN_AUDITORIAS_PARALELAS.md`
7. `docs/auditoria-funcional/06_CONTRATO_DE_AUDITORIA.md`

También deben consultar, según corresponda, el informe de A01 y las bitácoras técnicas pertinentes.

Si algún documento no existe, está desactualizado o contradice el código vigente, se debe registrar la discrepancia. No se debe inventar ni sustituir silenciosamente su contenido.

## 4. Preparación y control del punto de partida

Antes de iniciar las auditorías especializadas, el coordinador debe:

1. Confirmar la raíz del repositorio.
2. Identificar el commit de referencia vigente.
3. Registrar el hash completo en el informe de cada grupo.
4. Confirmar que todos los grupos trabajan sobre la misma referencia.
5. Verificar los informes de auditoría existentes.
6. Identificar modificaciones previas en el árbol de trabajo.
7. Acordar dónde se almacenarán los informes y cómo se asignarán los identificadores.
8. Confirmar que los grupos aceptan el contrato común de auditoría.

El hash `27f59fa024a804c468c434cfd504baa0b865a362` corresponde al informe A01 existente. No debe asumirse que es automáticamente la referencia vigente de las nuevas sesiones. El coordinador debe verificar el commit actual y registrar cualquier diferencia.

No se debe limpiar, sobrescribir ni descartar trabajo previo durante esta preparación.

## 5. Distribución oficial de responsabilidades

### A01 — Identidad, acceso y sesiones

**Responsable primario:** A01.

**Alcance:**
- Autenticación y autorización.
- Login, renovación y cierre de sesión.
- Usuarios, roles y permisos.
- Asignaciones de usuario, empleado y entidad relacionadas con identidad.
- Alta inicial y procedimiento de bootstrap.
- Cambios y restablecimientos de contraseñas.
- Sesiones persistidas.
- Guards y permisos de frontend y backend.
- Correspondencia entre el catálogo de permisos, los tipos y los registros persistidos.

**Áreas principales:**
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/user.routes.ts`
- `backend/src/routes/role.routes.ts`
- `backend/src/routes/session.routes.ts`
- Controladores, servicios y validadores correspondientes.
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/services/role-permission.service.ts`
- `frontend/lib/auth*`
- `frontend/lib/rbac.ts`
- Componentes y páginas de autenticación, usuarios, roles y sesiones.

**Límites:**
No auditar la lógica comercial, inventario, logística o planilla, salvo para comprobar los contratos de autorización.

**Resultados previos:**
El informe existente contiene `AUD-A01-001` a `AUD-A01-006`. Deben conservarse sus identificadores y evidencias. No se deben registrar de nuevo como hallazgos originales.

La nueva sesión A01 debe revisar ese informe, determinar qué cuestiones pendientes siguen abiertas y documentar únicamente evidencia adicional, correcciones verificadas o causas independientes nuevas.

### A02 — Clientes y ciclo comercial hasta el cobro

**Responsable primario:** A02.

**Alcance:**
- Clientes y catálogos comerciales.
- Tipos y condiciones de crédito.
- Ventas y proformas.
- Pagos.
- Cuentas por cobrar.
- Precios y bonificaciones.
- Talonarios.
- Numeración y anulaciones comerciales.
- Integración FEL dentro del flujo comercial.

**Objetivo funcional principal:**

Reconstruir el ciclo cliente → condiciones comerciales → venta → pago o cartera → factura, incluyendo sus validaciones y efectos asociados.

**Áreas principales:**
- Servicios, rutas, controladores y validadores de clientes, reglas comerciales, ventas, créditos y talonarios.
- `backend/src/services/sale.service.ts`
- `backend/src/services/credit.service.ts`
- `backend/src/services/fel.service.ts`
- Páginas y servicios frontend relacionados con clientes y ventas.
- Modelos `Cliente`, `Venta`, `DetalleVenta`, `PagoVenta`, `CuentaPorCobrar`, `Talonario` y reglas comerciales.

**Límites:**
- No emitir ni anular comprobantes reales.
- No modificar reglas comerciales ni saldos.
- No auditar la operación interna del inventario, logística o planilla.

Los hallazgos raíz sobre ventas, pagos y cartera pertenecen a A02. Las consecuencias sobre otros módulos deben registrarse como dependencias.

### A03 — Inventario, compras, proveedores y envases

**Responsable primario:** A03.

**Alcance:**
- Productos, insumos y catálogo de inventario.
- Existencias y ajustes.
- Kardex y bitácora.
- Estructuras de producto.
- Compras y gastos.
- Proveedores.
- Envases retornables.
- Préstamos, devoluciones y saldos asociados.

**Áreas principales:**
- Servicios, rutas, controladores y validadores de productos, ajustes, inventario, compras, proveedores y envases.
- `backend/src/services/inventory-movement.service.ts`
- Modelos `InventarioItem`, `Compra`, `DetalleCompra`, `AjusteInventario`, `BitacoraInventario`, `EstructuraProducto`, `MovimientoEnvase` y `EnvaseClienteSaldo`.

**Objetivo funcional principal:**

Reconstruir las entradas, salidas, ajustes, anulaciones, restauraciones y demás operaciones que modifican existencias o saldos retornables.

**Límites:**
- No auditar reportes de inventario.
- No asumir que una estructura de producto demuestra que la fabricación está implementada.
- No modificar movimientos, existencias ni datos.
- Comunicar a A02 cualquier dependencia comercial y a A06 cualquier cuestión relacionada con producción.

Los hallazgos raíz sobre movimientos de inventario pertenecen a A03, aunque tengan origen en ventas o compras.

### A04 — Rutas, vehículos y operación logística

**Responsable primario:** A04.

**Alcance:**
- Rutas y sesiones de ruta.
- Asignación de vendedor, chofer y vehículo.
- Estados y transiciones de ruta.
- Kilometraje.
- Gastos vehiculares.
- Mantenimiento de vehículos.
- Relaciones operativas con ventas y entregas.

**Áreas principales:**
- Servicios, controladores, validadores y rutas de logística y mantenimiento.
- `backend/src/routes/` y servicios asociados al dominio logístico.
- Páginas de `frontend/app/logistics/`.
- Modelos `Ruta`, `RutaSesion`, `Vehiculo`, `GastoVehiculo` y `MantenimientoVehiculo`.

**Objetivo funcional principal:**

Reconstruir las operaciones de alta, asignación, modificación, cierre, anulación y restauración, siguiendo cada flujo hasta la persistencia.

**Límites:**
- No auditar dashboards ni reportes logísticos.
- No asumir que los estados existentes representan todas las reglas empresariales.
- No duplicar el análisis de ventas y comisiones.

Los hallazgos raíz de rutas y vehículos pertenecen a A04. Las referencias comerciales se comunican a A02 y las dependencias de remuneración a A05.

### A05 — Personal, planilla y comisiones

**Responsable primario:** A05.

**Alcance:**
- Empleados.
- Relación entre empleado, usuario y entidad.
- Configuración y reglas de comisiones.
- Planilla mensual.
- Cálculos por período.
- Ajustes y detalles.
- Previsualización, generación y cierre de planilla.

**Áreas principales:**
- Servicios, controladores, validadores y rutas de empleados, planilla y comisiones.
- Páginas de `frontend/app/employees/`, `payroll/` y `commissions/`.
- Modelos `Empleado`, `PlanillaMensual`, `PlanillaDetalleComision`, `PlanillaDetalleAjuste`, `ConfiguracionComision` y `ReglaComision`.

**Objetivo funcional principal:**

Identificar el origen de cada dato que alimenta un cálculo y comprobar las reglas codificadas, sus condiciones, sus límites y sus períodos.

**Límites:**
- No recalcular ni cerrar planillas con datos productivos.
- No asumir que una fórmula es correcta sin un requisito autorizado.
- No modificar ventas, rutas ni asignaciones de empleados.

Las dependencias de ventas y logística deben seguirse hasta el contrato de datos necesario para explicar el cálculo.

### A06 — Calidad, empresa y áreas sin flujo demostrado

**Responsable primario:** A06.

**Alcance:**
- Control de calidad.
- Configuración de empresa.
- Trazabilidad y validaciones de calidad.
- Verificación del estado real de producción.
- Verificación de la estructura de producto en relación con la posible fabricación.
- Configuración FEL dentro de los límites asignados.
- Documentación e integración técnica de n8n.

**Áreas principales:**
- Servicios, controladores, validadores y rutas de calidad y empresa.
- `frontend/app/quality/`
- `frontend/app/company/`
- `frontend/app/production/page.tsx`
- `backend/src/services/fel.service.ts`, únicamente para configuración no cubierta por A02.
- Servicios de notificaciones y documentación técnica de n8n.

**Objetivo funcional principal:**

Determinar qué está conectado y qué no se puede demostrar con la evidencia disponible, separando claramente la implementación existente de los procesos esperados.

**Límites:**
- No auditar dashboards ni reportes.
- No emitir comprobantes reales.
- No modificar la configuración empresarial ni los webhooks.
- No declarar un defecto de producción sin requisitos y evidencia suficientes.
- No duplicar la auditoría comercial de FEL ni el análisis de inventario.

**Regla especial para producción:**

La página `frontend/app/production/page.tsx` se ha identificado como un marcador de posición. La exploración inicial no encontró un flujo completo de producción. A06 debe verificarlo contra el código vigente y los requisitos disponibles.

La relación entre estructura de producto, materia prima, órdenes, lotes, producto terminado y movimientos de inventario debe clasificarse como confirmada, parcial o pendiente. No se debe presentar producción como funcionalidad implementada sin evidencia.

## 6. Protocolo de coordinación entre grupos

### 6.1 Responsabilidad primaria

Cada hallazgo tiene un único grupo responsable de registrar su causa raíz.

Un grupo puede consultar código de otro dominio para reconstruir un flujo, pero no debe ampliar su trabajo hasta convertirlo en una segunda auditoría completa.

### 6.2 Dependencias cruzadas

Las dependencias más importantes son:

| Flujo o superficie | Responsable raíz | Grupos relacionados |
|---|---|---|
| Autenticación, roles y permisos | A01 | Todos los grupos consumidores |
| Venta, pago, cartera y facturación | A02 | A03, A04, A05, A06 |
| Existencias, kardex y reversas | A03 | A02, A04, A06 |
| Rutas, sesiones y vehículos | A04 | A02, A03, A05 |
| Comisiones y planilla | A05 | A02, A04 |
| Calidad y configuración de empresa | A06 | A02, A03 |
| Notificaciones y contratos n8n | Grupo dueño del evento de origen | A02, A04, A06 según el evento |

La coordinación debe distinguir entre un hallazgo raíz y sus consecuencias. No se deben generar seis hallazgos distintos si existe una única causa que afecta varias pantallas.

### 6.3 Superficies compartidas protegidas

Ningún grupo debe modificar durante la auditoría:

- `backend/prisma/schema.prisma`
- El SQL maestro, las migraciones o las semillas.
- `backend/src/middlewares/auth.middleware.ts`
- Los validadores y catálogos RBAC compartidos.
- `frontend/lib/api.ts` y la infraestructura compartida de autenticación.
- `backend/src/services/inventory-movement.service.ts`
- `backend/src/services/sale.service.ts`
- Configuración empresarial o FEL compartida.
- Contratos comunes de API y DTO.
- Dependencias y archivos de bloqueo del workspace.

Si un hallazgo involucra alguna de estas superficies, el grupo documentará el impacto y notificará al coordinador y a los responsables afectados.

## 7. Contrato obligatorio de investigación

Todos los grupos deben cumplir `06_CONTRATO_DE_AUDITORIA.md`.

En particular:

1. Solo lectura.
2. Mismo commit de referencia.
3. Evidencia con archivo, símbolo y comportamiento demostrado.
4. Separación entre código, esquema, prueba, documentación, UI y configuración.
5. Registro de archivos revisados y pendientes.
6. Investigación de consumidores indirectos.
7. No declarar campos huérfanos mediante búsqueda textual simple.
8. No asumir reglas de negocio no documentadas.
9. No ejecutar operaciones con efectos laterales.
10. Excluir reportes, dashboards, gráficas, indicadores y analítica.
11. Consolidar hallazgos duplicados.
12. Entregar propuestas, sin implementar correcciones.

No se deben ejecutar migraciones, seeds, scripts SQL, operaciones CRUD sobre entornos compartidos, pagos, cierres de planilla ni emisión o anulación fiscal real.

Las pruebas solo podrán ejecutarse si su carácter de solo lectura está establecido y no producen efectos externos ni cambios de datos. Todo resultado debe indicar sus limitaciones.

## 8. Convención de identificadores

Se utilizará la siguiente nomenclatura:

- `AUD-A01-NNN`
- `AUD-A02-NNN`
- `AUD-A03-NNN`
- `AUD-A04-NNN`
- `AUD-A05-NNN`
- `AUD-A06-NNN`

El coordinador debe mantener un registro global de identificadores y comprobar los informes existentes antes de asignar uno nuevo.

Los hallazgos previos de A01 conservan los identificadores `AUD-A01-001` a `AUD-A01-006`.

Si dos grupos encuentran el mismo problema raíz, el responsable primario lo registra y el otro grupo referencia su ID aportando evidencia complementaria.

## 9. Clasificación de hallazgos

Se aplicarán las categorías del contrato común:

- **CRÍTICO:** compromete gravemente la integridad de datos, una operación principal o una regla esencial.
- **ALTO:** funcionalidad importante incompleta o con validaciones insuficientes.
- **MEDIO:** inconsistencia secundaria o dato cuyo uso no está suficientemente conectado.
- **BAJO:** inconsistencia menor, duplicidad o mejora de coherencia.
- **PENDIENTE DE VERIFICACIÓN:** sospecha que requiere evidencia adicional.

También se registrará el estado de evidencia:

- Confirmado.
- Parcialmente comprobado.
- Pendiente de verificación.
- No aplicable al alcance.

No se utilizará la severidad para expresar facilidad de corrección ni se clasificará como defecto confirmado una expectativa de negocio sin fundamento autorizado.

## 10. Tratamiento del trabajo previo

Antes de abrir las seis sesiones nuevas, el coordinador debe inventariar los resultados existentes.

### 10.1 Informe A01

Reutilizar el informe de identidad, acceso y sesiones. Conservar sus seis hallazgos y registrar las limitaciones existentes:

- No se verificó una base SQL Server operativa.
- Algunas pruebas de RBAC fallaron o expiraron por problemas de conexión al pool Prisma.
- El estado del seed en instalaciones desplegadas no está confirmado.
- Varias políticas de negocio siguen pendientes de definición.

No interpretar el resultado de las pruebas que fallaron por conectividad como prueba de un defecto funcional.

### 10.2 Sesiones anteriores

Las sesiones anteriores de auditoría general, Inventario y Compras, Ventas y Créditos, Producción y Fabricación, y Pedidos y Entregas no deben considerarse equivalentes automáticos a los grupos oficiales.

Antes de reutilizar sus resultados, el coordinador debe verificar:

- El alcance original de cada sesión.
- Los archivos examinados.
- Los informes que produjo.
- Los identificadores de sus hallazgos.
- La evidencia disponible.
- Las modificaciones realizadas, si las hubo.
- Los módulos y dependencias cubiertos.
- Las áreas que siguen sin investigar.

Los resultados útiles se conservarán y asignarán al grupo oficial correspondiente. La falta de un informe o de evidencia verificable se registrará como una limitación, no se suplirá mediante suposiciones.

## 11. Estructura de entregables

Cada grupo deberá entregar:

1. Resumen de ejecución.
2. Commit de referencia y fecha.
3. Alcance asignado y alcance realmente examinado.
4. Inventario de archivos revisados y pendientes.
5. Mapa de los flujos funcionales.
6. Registro de hallazgos.
7. Evidencia y resultados de pruebas.
8. Dependencias cruzadas y grupos relacionados.
9. Preguntas de negocio pendientes.
10. Limitaciones y recomendación de continuidad.

Cada hallazgo debe utilizar la plantilla definida en `06_CONTRATO_DE_AUDITORIA.md`.

El informe consolidado final deberá contener:

- Catálogo único de hallazgos.
- Duplicados consolidados.
- Dependencias y causas raíz.
- Priorización por consecuencia funcional.
- Requisitos pendientes de confirmación.
- Limitaciones de evidencia.
- Recomendaciones para una futura fase de corrección.

## 12. Criterios de finalización

Una auditoría solo podrá declararse completa dentro de su alcance cuando haya:

- Identificado las capas pertinentes.
- Seguido los flujos principales hasta la persistencia y sus consumidores relevantes.
- Documentado archivos revisados y pendientes.
- Investigado usos indirectos.
- Diferenciado implementación y requisito.
- Registrado pruebas y sus limitaciones.
- Coordinado dependencias.
- Consolidado duplicados.
- Respetado las restricciones de solo lectura.
- Excluido la analítica y los reportes.

Una auditoría estática puede estar completa dentro de su alcance sin que todos sus comportamientos hayan sido verificados dinámicamente. En ese caso, la limitación debe expresarse claramente.

## 13. Secuencia de ejecución

1. Validar el repositorio, commit y documentación.
2. Inventariar los informes previos y los cambios existentes.
3. Registrar el catálogo inicial de hallazgos y sus responsables.
4. Preparar los seis prompts especializados a partir de este plan.
5. Abrir una sesión nueva para cada grupo A01–A06.
6. Ejecutar las auditorías respetando el contrato.
7. Coordinar dependencias durante la investigación.
8. Consolidar los resultados y resolver duplicados.
9. Entregar el informe maestro de auditoría.
10. Finalizar esta fase sin implementar correcciones.

## 14. Condición final

Este documento establece la coordinación y la distribución oficial de responsabilidades. No sustituye al contrato común, al inventario técnico ni a los requisitos del negocio.

La siguiente actividad autorizada es preparar las instrucciones especializadas de los seis grupos y verificar el estado de los resultados anteriores. La implementación de cambios requerirá una autorización y un plan independientes.

**Estado del proyecto:** pendiente de validar el punto de partida y preparar las seis sesiones especializadas.