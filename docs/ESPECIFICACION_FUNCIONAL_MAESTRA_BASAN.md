# ESPECIFICACIÓN FUNCIONAL MAESTRA
## Sistema integral de gestión de operaciones comerciales — Industrias Basan

**Versión:** 1.0  
**Fecha:** 30 de octubre de 2026  
**Estado:** Documento base para análisis, diseño e implementación  
**Proyecto:** Industrias Basan  
**Objetivo:** Consolidar los requerimientos funcionales, reglas de negocio, decisiones arquitectónicas y criterios de aceptación para la evolución del sistema existente.

---

# 1. PROPÓSITO DEL DOCUMENTO

El presente documento establece los lineamientos funcionales y técnicos que deben orientar la evolución del sistema de gestión de Industrias Basan.

La plataforma tiene como finalidad integrar y optimizar los procesos de administración, compras, inventario, fabricación, ventas, distribución, control financiero y seguimiento de operaciones.

El sistema ya cuenta con funcionalidades implementadas en diferentes módulos. Por consiguiente, el propósito no es reconstruir la aplicación, sino identificar las deficiencias existentes, mejorar los procesos incompletos y ampliar las capacidades necesarias para responder a la dinámica operativa de la empresa.

Este documento funcionará como referencia para:

- Planificar las intervenciones técnicas.
- Definir reglas de negocio.
- Evitar duplicidad de funcionalidades y estructuras.
- Mantener la integridad de los datos.
- Coordinar el trabajo con herramientas de asistencia de programación.
- Establecer criterios verificables de aceptación.
- Organizar las futuras etapas de implementación.

# 2. PRINCIPIOS GENERALES DEL PROYECTO

Toda modificación deberá respetar los siguientes principios:

1. **Reutilización:** aprovechar las entidades, servicios, componentes y procesos existentes siempre que sean adecuados.
2. **Integridad:** mantener consistencia entre inventario, ventas, producción, distribución y finanzas.
3. **Trazabilidad:** cada operación relevante debe permitir identificar su origen, responsable, fecha y efecto.
4. **Separación de responsabilidades:** no confundir procesos comerciales, físicos, financieros y administrativos.
5. **Simplicidad operativa:** reducir la digitación innecesaria y adaptar los procesos a las prácticas reales de la empresa.
6. **Seguridad:** validar permisos tanto en frontend como en backend.
7. **Auditabilidad:** conservar el historial de movimientos y operaciones.
8. **Consistencia:** utilizar criterios uniformes en todos los módulos.
9. **Usabilidad:** permitir que los usuarios comprendan qué hace cada funcionalidad sin depender constantemente del administrador.
10. **Cambios controlados:** no modificar estructuras compartidas sin analizar sus dependencias.

# 3. ALCANCE FUNCIONAL DEL SISTEMA

La plataforma contempla los siguientes dominios:

| Área | Funcionalidad |
|---|---|
| Administración | Usuarios, roles, permisos y configuración. |
| Entidades | Empleados, clientes y proveedores. |
| Inventario | Catálogo, existencias, movimientos, ajustes y bitácora. |
| Compras | Compras, recepción y detalles. |
| Gastos | Registro y control de gastos operativos. |
| Activos | Maquinaria, equipos y otros activos. |
| Producción | Recetas, órdenes, fabricación y mermas. |
| Distribución | Rutas, jornadas, vehículos, despachos y transferencias. |
| Ventas | Ventas de contado, crédito, entregas y devoluciones. |
| Finanzas | Cobros, créditos, deudas y caja. |
| Envases | Préstamos, retornos, pérdidas y saldos. |
| Reportes | Información operativa, comercial y financiera. |
| Dashboard | Indicadores y alertas. |

La existencia de estos dominios no implica que todos requieran una reconstrucción. Cada intervención deberá partir de la auditoría del código y de la verificación de su funcionamiento.

# 4. MODELO CONCEPTUAL DEL CATÁLOGO DE ARTÍCULOS

## 4.1. Separación entre categorías y propiedades

El catálogo actual distingue entre la clasificación del artículo y sus propiedades operativas.

Las categorías existentes son:

- Producto terminado.
- Insumo.
- Materia prima.

Adicionalmente, existen indicadores independientes que determinan el comportamiento del artículo:

- Es vendible.
- Es envase físico o retornable.
- Permite fabricación.
- Necesita receta.
- Otras propiedades ya contempladas en el modelo.

**Regla obligatoria:** no sustituir la categoría PRODUCTO TERMINADO por ARTÍCULO VENDIBLE.

La categoría representa la clasificación del artículo, mientras que la propiedad de vendibilidad determina si puede comercializarse.

## 4.2. Reglas de conservación

- No crear campos duplicados para propiedades existentes.
- No cambiar las categorías sin una justificación funcional y técnica.
- Verificar las reglas aplicadas por cada propiedad en frontend y backend.
- Mantener la compatibilidad con compras, inventario, producción, ventas y envases.
- No asumir que todo producto terminado es vendible.
- No asumir que todo artículo vendible puede fabricarse.
- No asumir que todo artículo retornable es un producto comercial.

# 5. MODELO OPERATIVO DE DISTRIBUCIÓN

## 5.1. Objetivo

Permitir que los camiones realicen operaciones de distribución independientes, manteniendo la trazabilidad de sus rutas, responsables, inventario, ventas y movimientos.

El sistema debe adaptarse a jornadas variables, cambios de vehículos, reabastecimientos y transferencias.

## 5.2. Conceptos funcionales

| Concepto | Definición |
|---|---|
| Ruta | Recorrido comercial o zona asignada a un vehículo. |
| Jornada | Periodo durante el cual se desarrolla una operación de distribución. |
| Vehículo | Unidad física utilizada para transportar y comercializar productos. |
| Personal | Chofer, vendedor y otros responsables asignados. |
| Despacho | Movimiento de productos desde planta hacia un vehículo. |
| Reabastecimiento | Nuevo despacho hacia un vehículo que ya está operando. |
| Transferencia | Movimiento de productos entre vehículos. |
| Retorno | Regreso físico de productos desde un vehículo hacia planta. |
| Cierre de inventario | Conciliación de los productos bajo responsabilidad del vehículo. |
| Cierre de caja | Conciliación del efectivo asociado a la operación. |

Estos conceptos deben mantenerse diferenciados, aunque su representación técnica pueda aprovechar las entidades existentes.

## 5.3. Reglas de operación

1. Cada camión mantiene su propia ruta y operación comercial.
2. Una jornada puede involucrar varios camiones.
3. Cada vehículo conserva su propio inventario operativo.
4. Las ventas se atribuyen al vehículo y vendedor que las realizan.
5. Un vehículo puede regresar a planta, recibir más producto y continuar su recorrido.
6. Se permiten múltiples despachos durante una misma jornada.
7. Un vehículo puede transferir productos a otro sin que esto represente una venta.
8. Dos vehículos pueden continuar operando independientemente después de una transferencia.
9. El cambio de vehículo o personal debe conservar el historial de responsables y movimientos.
10. Los movimientos deben identificar su origen y destino.
11. El cierre de un vehículo no debe cerrar automáticamente las operaciones de los demás.
12. La jornada y la ruta no deben considerarse equivalentes.
13. La operación debe permitir devoluciones parciales y conciliaciones posteriores.

## 5.4. Escenarios operativos obligatorios

### Escenario A. Reabastecimiento del mismo vehículo

- El vehículo inicia su operación.
- Recibe una carga inicial.
- Realiza ventas.
- Regresa a planta.
- Recibe un nuevo despacho.
- Continúa su recorrido.

El sistema debe conservar el historial completo de ambos despachos y de las ventas realizadas entre ellos.

### Escenario B. Sustitución de vehículo

- Un vehículo inicia la operación.
- Por una circunstancia operativa debe ser sustituido.
- Se identifica el inventario que permanece bajo su responsabilidad.
- Se registra la entrega y recepción de productos.
- Se asigna el nuevo vehículo y sus responsables.
- Se conserva la continuidad de la operación comercial cuando corresponda.

La sustitución debe contar con trazabilidad de custodia.

### Escenario C. Transferencia parcial

- Dos vehículos operan independientemente.
- Uno entrega parte de sus productos al otro.
- Se registra el origen, destino, artículos y cantidades.
- Se confirma la recepción.
- Cada vehículo conserva su propia operación comercial.

La transferencia no debe generar ventas, ingresos ni compras.

# 6. GESTIÓN DE INVENTARIO

## 6.1. Principio general

El inventario debe conservar una trazabilidad centralizada mediante los mecanismos de movimientos existentes.

No se debe crear un segundo sistema de inventario paralelo.

## 6.2. Ubicaciones conceptuales

- Planta.
- Vehículos.
- Área de productos dañados o cuarentena.
- Clientes, exclusivamente para los saldos de envases retornables cuando corresponda.

La representación técnica de estas ubicaciones debe evaluarse antes de introducir nuevas estructuras.

## 6.3. Reglas de movimientos

| Operación | Efecto esperado |
|---|---|
| Compra recibida | Incrementa inventario de planta. |
| Despacho | Disminuye planta e incrementa inventario del vehículo. |
| Reabastecimiento | Genera un nuevo movimiento planta → vehículo. |
| Transferencia | Disminuye el vehículo de origen e incrementa el de destino. |
| Venta desde vehículo | Disminuye inventario del vehículo correspondiente. |
| Venta directa | Disminuye inventario de la ubicación correspondiente. |
| Retorno vendible | Disminuye inventario del vehículo e incrementa planta. |
| Producto dañado | Se clasifica y traslada según el procedimiento de daños. |
| Ajuste | Modifica existencias con autorización y justificación. |
| Fabricación | Consume componentes e incorpora producto terminado. |

## 6.4. Reglas de integridad

- Evitar dobles descuentos.
- Evitar inventario negativo.
- Registrar movimientos dentro de transacciones consistentes.
- Mantener referencias al documento u operación de origen.
- Garantizar idempotencia cuando se reintente una operación.
- Conservar movimientos compensatorios en anulaciones.
- Diferenciar existencias calculadas de conteos físicos.
- Permitir conciliaciones autorizadas.

# 7. PRODUCCIÓN Y FABRICACIÓN

## 7.1. Objetivo

Permitir el control de la fabricación mediante órdenes por lote o jornada, adaptándose a la producción de cantidades considerables.

No se debe obligar al personal a registrar cada unidad individualmente.

## 7.2. Información requerida

Cada orden deberá permitir controlar, según las necesidades del proceso:

- Producto fabricado.
- Cantidad planificada.
- Cantidad realmente producida.
- Fecha operacional.
- Identificación del lote.
- Responsable.
- Componentes de la receta.
- Consumos planificados.
- Consumos reales.
- Merma.
- Observaciones.
- Estado de la orden.
- Movimientos de inventario asociados.

## 7.3. Reglas de negocio

1. La orden debe conservar la receta y cantidades utilizadas como referencia.
2. Debe diferenciarse la cantidad planificada de la realmente producida.
3. El consumo real debe poder compararse con el consumo esperado.
4. La merma debe registrarse explícitamente cuando corresponda.
5. La cantidad ingresada al inventario debe corresponder al resultado efectivamente aceptado.
6. Las órdenes deben conservar su historial.
7. La modificación de una receta no debe alterar silenciosamente órdenes anteriores.
8. Deben definirse reglas para confirmar órdenes con recetas modificadas.
9. Los movimientos de producción deben ser transaccionales.
10. Los datos estimados no deben presentarse como mediciones exactas.

## 7.4. Operación simplificada

El sistema debe permitir registrar la información al finalizar una producción o lote, sin imponer controles excesivamente frecuentes.

# 8. CONTROL DE ENVASES RETORNABLES

## 8.1. Objetivo

Controlar los recipientes físicos retornables y sus saldos, independientemente del producto comercializado.

## 8.2. Ubicaciones

- Planta.
- Vehículo.
- Cliente.
- Área de dañados.

## 8.3. Estados conceptuales

- Vacío.
- Lleno.
- Dañado.
- Pendiente de conteo.

## 8.4. Reglas

1. El intercambio de envases vacíos por llenos debe quedar registrado.
2. Los préstamos a clientes deben incrementar su saldo pendiente.
3. Las devoluciones pueden realizarse junto con una compra o independientemente.
4. Los envases dañados deben mantenerse separados.
5. Los envases perdidos o no devueltos deben conservar su saldo pendiente.
6. Los cobros por envases deben depender de las condiciones comerciales aplicables.
7. Los movimientos deben conservar trazabilidad.
8. Las conciliaciones deben permitir identificar diferencias.
9. Debe evitarse la sobrescritura de saldos ante operaciones concurrentes.

# 9. VENTAS, ENTREGAS Y COBROS

## 9.1. Modalidades

- Ventas de contado.
- Ventas a crédito.
- Cobros de créditos anteriores.

## 9.2. Reglas

1. Una venta de contado debe registrar su correspondiente pago.
2. Una venta a crédito debe generar el saldo pendiente correspondiente.
3. El cobro de una deuda anterior debe asociarse a la cuenta correspondiente.
4. Las ventas realizadas desde un vehículo deben afectar su inventario.
5. Las ventas directas deben afectar la ubicación de inventario correspondiente.
6. Las devoluciones comerciales deben distinguirse de los retornos físicos.
7. Las incidencias de entrega deben quedar registradas cuando corresponda.
8. Las anulaciones deben conservar trazabilidad.
9. Debe evitarse registrar dos veces una misma venta o pago.

## 9.3. Incidencias contempladas

- Cliente ausente.
- Falta de producto.
- Rechazo del cliente.
- Error de pedido.
- Error de cantidad.
- Cancelación.
- Diferencia de precio.

# 10. CAJA Y CONTROL FINANCIERO

## 10.1. Objetivo

Implementar un flujo formal de apertura, movimientos, arqueo y cierre de efectivo por vehículo y jornada.

## 10.2. Componentes

- Apertura de caja.
- Fondo inicial.
- Ventas cobradas en efectivo.
- Cobros de créditos anteriores.
- Otros ingresos.
- Gastos autorizados.
- Otras salidas.
- Efectivo esperado.
- Efectivo contado.
- Efectivo entregado.
- Diferencias.
- Responsable de apertura.
- Responsable de cierre.

## 10.3. Cálculo de efectivo esperado

Efectivo esperado = Fondo inicial + Ventas cobradas en efectivo + Cobros de créditos anteriores + Otros ingresos − Gastos − Otras salidas.

Una venta a crédito no incrementa el efectivo.

El cobro de una deuda anterior sí incrementa el efectivo, pero debe identificarse separadamente de las ventas del día.

## 10.4. Reglas

1. Cada caja debe estar vinculada a su operación y vehículo.
2. Debe existir trazabilidad de apertura y cierre.
3. Los movimientos deben identificar su origen.
4. Los pagos y gastos existentes deben reutilizarse como fuentes de información cuando corresponda.
5. No se deben duplicar ventas ni pagos para construir el saldo de caja.
6. Las diferencias deben justificarse.
7. Las anulaciones deben conservar historial.
8. El cierre de caja es independiente del cierre de inventario.
9. Debe poder consultarse el resumen de caja por vehículo y jornada.
10. Las autorizaciones deben respetar los permisos del usuario.

# 11. AJUSTES Y CONCILIACIONES

Los ajustes deben estar sujetos a autorización.

Causas contempladas:

- Errores de conteo.
- Daños.
- Pérdidas.
- Errores de registro.

Todo ajuste debe identificar:

- Artículo.
- Cantidad.
- Existencia anterior.
- Existencia resultante.
- Motivo.
- Responsable.
- Fecha.
- Autorización.
- Documento de referencia, cuando corresponda.

Los ajustes no deben utilizarse para ocultar transferencias, ventas, devoluciones o movimientos que deberían registrarse mediante su proceso específico.

# 12. SEGURIDAD Y CONTROL DE ACCESOS

## 12.1. Perfiles operativos

- Administración.
- Encargado.
- Chofer.
- Vendedor.
- Gerencia.

Los roles existentes son configurables y deben conservarse.

## 12.2. Responsabilidades generales

**Administración**
- Compras.
- Ajustes.
- Anulaciones.
- Caja.
- Reportes.
- Usuarios y permisos.

**Encargado**
- Producción.
- Inventario.
- Despachos.
- Recepciones.
- Envases.
- Conteos.

**Chofer y vendedor**
- Operaciones autorizadas del vehículo.
- Ventas.
- Cobros.
- Transferencias.
- Retornos.
- Caja, según los permisos asignados.

**Gerencia**
- Supervisión.
- Reportes.
- Consulta de indicadores.
- Funciones autorizadas.

## 12.3. Reglas de seguridad

1. Mantener usuarios individuales.
2. Conservar la configuración dinámica de roles.
3. Validar permisos en backend.
4. Proteger rutas y páginas del frontend.
5. No utilizar la ocultación de botones como mecanismo único de seguridad.
6. Registrar operaciones relevantes.
7. Restringir anulaciones y ajustes.
8. Verificar autorizaciones por acción.
9. Probar accesos permitidos y denegados.
10. Mantener trazabilidad de las modificaciones.

# 13. REPORTES, DASHBOARD Y ALERTAS

## 13.1. Reportes requeridos

- Inventario.
- Ventas.
- Camiones.
- Caja.
- Clientes.
- Producción.
- Compras.
- Envases.
- Finanzas.
- Rutas.

## 13.2. Dimensiones de consulta

La información de distribución debe poder consultarse por:

- Vehículo.
- Ruta.
- Vendedor.
- Producto.
- Fecha.
- Jornada.

## 13.3. Alertas

- Stock bajo.
- Faltantes.
- Diferencias de caja.
- Envases pendientes.
- Créditos.
- Producción.
- Rutas.
- Operaciones pendientes.
- Permisos y accesos.

Las alertas deben tener criterios definidos y evitar notificaciones redundantes.

# 14. EXPERIENCIA DE USUARIO Y AYUDA CONTEXTUAL

## 14.1. Objetivo

Toda la plataforma debe ser comprensible para usuarios que no necesariamente tienen conocimientos técnicos.

La ayuda contextual se aplicará a toda la plataforma, sin excepciones.

**Nivel aprobado: intermedio.**

## 14.2. Elementos obligatorios

- Iconos de información junto a campos y conceptos importantes.
- Descripciones breves y contextualizadas.
- Instrucciones para utilizar funcionalidades.
- Confirmaciones inteligentes antes de operaciones sensibles.
- Mensajes de éxito, advertencia y error comprensibles.
- Terminología uniforme.
- Iconografía consistente.
- Diseño adaptable a computadoras y dispositivos móviles.

## 14.3. Componentes reutilizables propuestos

Los siguientes nombres son referencias conceptuales; primero deben revisarse los componentes existentes.

| Componente propuesto | Responsabilidad |
|---|---|
| InfoTooltip | Explicación breve de conceptos. |
| FieldHelper | Descripción de campos. |
| ModuleHelp | Instrucciones generales de un módulo. |
| OperationWarning | Advertencias operativas. |
| ActionConfirmation | Confirmaciones con consecuencias. |
| OperationFeedback | Mensajes de éxito y error. |

## 14.4. Criterios de diseño

1. No saturar las pantallas con textos extensos.
2. Mostrar información cuando resulte relevante.
3. Utilizar términos comprensibles para el personal.
4. Explicar las consecuencias de operaciones sensibles.
5. Mantener las mismas definiciones para un concepto en todos los módulos.
6. Evitar mensajes técnicos innecesarios.
7. Proporcionar información útil para corregir errores.
8. Mantener consistencia visual.
9. No duplicar explicaciones de forma contradictoria.
10. Aplicar la ayuda también en formularios, tablas, filtros, modales y dashboards.

# 15. REQUERIMIENTOS FUNCIONALES CONSOLIDADOS

| ID | Requerimiento | Resultado esperado |
|---|---|---|
| RF-01 | Rutas, jornadas y asignaciones | Representación diferenciada de las operaciones, vehículos y personal. |
| RF-02 | Múltiples despachos | Reabastecimientos repetidos durante una jornada. |
| RF-03 | Transferencias entre vehículos | Traslado trazable de mercadería entre camiones. |
| RF-04 | Cambios de vehículo y personal | Continuidad operativa con historial de custodia. |
| RF-05 | Ventas, entregas y cobros | Registro integrado de operaciones comerciales. |
| RF-06 | Caja por vehículo y jornada | Apertura, movimientos, arqueo y cierre. |
| RF-07 | Inventario por ubicación | Existencias y movimientos consistentes. |
| RF-08 | Envases retornables | Trazabilidad de recipientes y saldos por cliente. |
| RF-09 | Producción por lotes | Registro de producción real, consumos y mermas. |
| RF-10 | Conteos y ajustes | Conciliaciones y ajustes autorizados. |
| RF-11 | Seguridad y permisos | Autorización consistente en frontend y backend. |
| RF-12 | Reportes | Información operativa, comercial y financiera. |
| RF-13 | Alertas | Detección de situaciones que requieren atención. |
| RF-14 | Interfaz por perfil | Experiencia adaptada a las responsabilidades del usuario. |
| RF-15 | Ayuda contextual | Explicaciones accesibles en toda la plataforma. |
| RF-16 | Consistencia de UX | Navegación, mensajes, componentes e iconografía uniformes. |

# 16. ESTADO ACTUAL Y BRECHAS IDENTIFICADAS

Con base en la auditoría estática realizada sobre el repositorio, se identificaron los siguientes estados preliminares:

| Área | Estado de auditoría |
|---|---|
| Catálogo e inventario | Implementado con deficiencias. |
| Compras | Implementado. |
| Ventas y créditos | Implementado con deficiencias. |
| Distribución y despachos | Implementado con deficiencias. |
| Producción | Implementado parcialmente. |
| Envases retornables | Implementado parcialmente. |
| Caja | No implementado como flujo formal. |
| Roles y permisos | Implementado con deficiencias. |
| Reportes y dashboard | Implementado parcialmente. |
| Calidad | Implementado parcialmente. |

## 16.1. Brechas prioritarias

**B-01. Caja por vehículo y jornada**

No se identificó un flujo formal de apertura, movimientos, arqueo y cierre.

**B-02. Reabastecimientos y transferencias**

No se identificó una transferencia general de productos entre vehículos ni un flujo de reabastecimiento posterior al despacho inicial.

**B-03. Retornos y conciliación**

Las devoluciones comerciales y los movimientos físicos se gestionan en etapas separadas.

**B-04. Producción real**

Faltan lote, cantidades reales separadas de las planificadas, consumos reales y merma explícita.

**B-05. Continuidad operativa**

La sesión actual concentra ruta, vehículo y personal. No se identificó un historial formal de relevos y custodia.

**B-06. Permisos frontend**

Existen páginas que no exigen explícitamente la protección de módulo correspondiente.

**B-07. Concurrencia de envases**

Se requiere comprobar el comportamiento de los saldos ante operaciones simultáneas y reversas.

**B-08. Ayuda contextual y consistencia**

Se requiere una revisión transversal de la experiencia de usuario y de los mecanismos de orientación.

Estos estados son una línea base de auditoría, no una certificación de comportamiento en producción.

# 17. DECISIONES ARQUITECTÓNICAS QUE DEBEN CONSERVARSE

1. No duplicar el inventario existente.
2. No sustituir las categorías de artículos por propiedades operativas.
3. No reemplazar el módulo de roles configurables.
4. No reconstruir el módulo de envases sin evidencia que lo justifique.
5. No reconstruir el módulo de producción existente.
6. No registrar transferencias como ventas.
7. No registrar retornos como compras.
8. No confundir envases con productos comerciales.
9. No confundir ventas a crédito con ingresos de efectivo.
10. No confundir ruta, jornada, vehículo y personal.
11. Mantener independientes los cierres de inventario y caja.
12. Conservar historial y trazabilidad de las operaciones.
13. Mantener la compatibilidad con las operaciones existentes.
14. Priorizar ampliaciones y correcciones mínimas sobre rediseños completos.

# 18. PLAN DE IMPLEMENTACIÓN

## Fase 1. Línea base y decisiones de negocio

- Confirmar versión desplegada.
- Verificar estructura real de la base de datos.
- Revisar migraciones.
- Identificar servicios compartidos.
- Definir políticas operativas pendientes.
- Preparar un entorno aislado para pruebas.

**Resultado esperado:** línea base técnica y funcional confiable.

## Fase 2. Diseño de distribución

- Definir la relación entre jornada y ruta.
- Definir asignaciones de vehículos y personal.
- Diseñar reabastecimientos.
- Diseñar transferencias entre camiones.
- Definir cambios de vehículo y responsables.
- Definir trazabilidad de custodia.

**Resultado esperado:** modelo funcional de distribución aprobado.

## Fase 3. Caja y conciliación financiera

- Diseñar apertura de caja.
- Integrar ventas y cobros.
- Integrar gastos y salidas.
- Diseñar arqueos.
- Diseñar cierre y entrega.
- Definir autorización de diferencias.

**Resultado esperado:** control financiero por vehículo y jornada.

## Fase 4. Inventario y logística

- Incorporar los movimientos faltantes.
- Completar reabastecimientos.
- Completar transferencias.
- Mejorar retornos y conciliaciones.
- Validar inventario por ubicación.
- Revisar ajustes y anulaciones.

**Resultado esperado:** trazabilidad completa de mercadería.

## Fase 5. Producción y fabricación

- Incorporar identificación de lotes.
- Registrar cantidades reales.
- Comparar consumos planificados y reales.
- Registrar mermas.
- Revisar el comportamiento de recetas modificadas.
- Validar los movimientos de inventario.

**Resultado esperado:** control de producción adaptado a la operación real.

## Fase 6. Seguridad y experiencia de usuario

- Homologar los guards de páginas.
- Revisar los permisos de cada acción.
- Mejorar formularios.
- Implementar ayuda contextual.
- Homologar mensajes.
- Mejorar dashboards.
- Revisar experiencia móvil.

**Resultado esperado:** plataforma consistente, comprensible y segura.

## Fase 7. Validación integral

- Ejecutar pruebas de inventario.
- Ejecutar pruebas de ventas.
- Ejecutar pruebas de transferencias.
- Ejecutar pruebas de caja.
- Ejecutar pruebas de producción.
- Ejecutar pruebas de envases.
- Ejecutar pruebas de permisos.
- Validar procesos completos de principio a fin.

**Resultado esperado:** sistema validado en un entorno controlado antes de su despliegue.

# 19. CRITERIOS GENERALES DE ACEPTACIÓN

Ninguna funcionalidad se considerará terminada únicamente porque exista una pantalla, endpoint o tabla.

Debe cumplir los siguientes criterios:

1. El usuario puede completar el proceso correctamente.
2. Las validaciones funcionan en frontend y backend.
3. Los movimientos de inventario son consistentes.
4. Las operaciones financieras conservan sus relaciones.
5. Se registra el usuario responsable.
6. Se conserva el historial.
7. Las anulaciones tienen tratamiento adecuado.
8. Se evitan operaciones duplicadas.
9. Se respetan los permisos.
10. La interfaz explica claramente la funcionalidad.
11. Se contemplan errores y situaciones excepcionales.
12. Existen pruebas automatizadas o procedimientos de validación reproducibles.
13. No se afectan funcionalidades previamente operativas.
14. Se documentan los cambios y sus dependencias.

# 20. ESCENARIOS MÍNIMOS DE PRUEBA

## Distribución

- Crear una jornada con dos vehículos.
- Registrar rutas independientes.
- Realizar un despacho inicial para cada vehículo.
- Registrar ventas en ambos.
- Reabastecer uno de los vehículos.
- Realizar una transferencia parcial.
- Confirmar la recepción.
- Sustituir un vehículo.
- Registrar el retorno de ambos.
- Conciliar inventarios independientemente.

## Caja

- Abrir caja con fondo inicial.
- Registrar ventas de contado.
- Registrar ventas a crédito.
- Cobrar una deuda anterior.
- Registrar un gasto autorizado.
- Calcular efectivo esperado.
- Registrar efectivo contado.
- Identificar diferencias.
- Cerrar y entregar efectivo.
- Consultar el resumen de cada vehículo.

## Producción

- Crear una orden.
- Conservar la receta utilizada.
- Registrar producción real diferente de la planificada.
- Registrar consumos reales.
- Registrar merma.
- Confirmar el resultado.
- Verificar los movimientos de inventario.
- Comprobar el comportamiento ante cambios posteriores de receta.

## Envases

- Entregar envases.
- Registrar préstamos.
- Recibir devoluciones.
- Registrar pérdidas.
- Registrar daños.
- Realizar conteos.
- Conciliar saldos.
- Probar operaciones concurrentes en un entorno aislado.

## Seguridad

- Acceder con permisos válidos.
- Intentar acceder sin permisos.
- Acceder directamente a una página protegida.
- Intentar ejecutar un endpoint sin autorización.
- Intentar anular una operación sin permiso.
- Verificar la auditoría de operaciones.

## Experiencia de usuario

- Comprender un formulario sin asistencia externa.
- Consultar las explicaciones de los campos.
- Identificar advertencias.
- Comprender las consecuencias de una operación.
- Interpretar mensajes de error.
- Completar operaciones desde dispositivos móviles.

# 21. PROTOCOLO DE TRABAJO CON CLAUDE Y COPILOT

Todas las intervenciones sobre el repositorio deberán respetar este procedimiento.

## Etapa A. Investigación

- Identificar los archivos afectados.
- Revisar los modelos y relaciones.
- Examinar servicios y endpoints.
- Revisar las pantallas relacionadas.
- Identificar dependencias.
- Comparar con esta especificación.

## Etapa B. Propuesta

Antes de programar, presentar:

- Problema identificado.
- Comportamiento actual.
- Comportamiento esperado.
- Archivos involucrados.
- Cambios propuestos.
- Posibles efectos secundarios.
- Cambios de base de datos, si fueran necesarios.
- Pruebas requeridas.
- Riesgos de compatibilidad.

## Etapa C. Aprobación

No ejecutar cambios estructurales o de alto impacto sin autorización.

## Etapa D. Implementación

- Realizar cambios pequeños y controlados.
- Evitar refactorizaciones innecesarias.
- Mantener compatibilidad.
- Respetar las convenciones del proyecto.
- No eliminar funcionalidades existentes sin justificación.

## Etapa E. Validación

- Ejecutar pruebas en entornos aislados.
- Comprobar los escenarios afectados.
- Verificar los módulos dependientes.
- Revisar migraciones.
- Documentar los resultados.

## Etapa F. Cierre

Entregar un resumen de:

- Archivos modificados.
- Funcionalidades corregidas o agregadas.
- Cambios de base de datos.
- Pruebas ejecutadas.
- Resultados.
- Pendientes.
- Riesgos conocidos.

# 22. DECISIONES PENDIENTES

Los siguientes aspectos requieren definición antes de diseñar su implementación definitiva:

1. Política de inicio y finalización de una jornada.
2. Tratamiento de jornadas que continúan después de un cambio de vehículo.
3. Responsabilidad de inventario durante relevos.
4. Autorización de transferencias.
5. Confirmación de recepción de transferencias.
6. Política de apertura y cierre de caja.
7. Responsables de arqueo y entrega de efectivo.
8. Tratamiento de diferencias de caja.
9. Criterios para registrar mermas de producción.
10. Identificación y numeración de lotes.
11. Tratamiento de órdenes pendientes cuando cambia una receta.
12. Política de aprobación de ajustes de inventario.
13. Reglas de alertas y notificaciones.

Estas decisiones deben acordarse con base en la operación real, no asumirse automáticamente desde el código.

# 23. CONCLUSIÓN

Industrias Basan cuenta con una base tecnológica que ya incorpora funcionalidades importantes para la administración de sus operaciones comerciales.

La evolución del sistema debe centrarse en integrar adecuadamente los procesos, completar los controles que todavía no existen, fortalecer la trazabilidad y mejorar la experiencia de los usuarios.

Las prioridades principales son la gestión de distribución, la conciliación de inventario, el control de caja, la precisión de producción y la consistencia de los permisos.

De igual manera, se establece que la facilidad de uso es una característica fundamental de la solución. La plataforma debe ser comprensible para los diferentes perfiles operativos, proporcionando información contextual, instrucciones claras y mensajes que faciliten la toma de decisiones.

La implementación deberá realizarse de forma progresiva, con cambios controlados y pruebas que permitan garantizar la continuidad de las funcionalidades existentes.

**Principio rector del proyecto: mejorar lo que ya funciona, corregir lo que presenta deficiencias e incorporar únicamente lo que realmente hace falta.**