# Contrato común para auditorías funcionales especializadas

Este documento puede copiarse como instrucción común en cada prompt especializado. Es obligatorio para todos los agentes.

## 1. Objetivo general

Determinar, para el alcance asignado, si cada dato/campo/configuración/relación/opción/funcionalidad tiene origen identificable, almacenamiento coherente cuando corresponda, regla de negocio respaldada y uso comprobable en el sistema. La existencia de pantalla, endpoint, tabla o formulario por sí sola no prueba completitud funcional.

El informe debe permitir reproducir el razonamiento a partir de evidencia y separar comportamiento probado de inferencia o requisito no disponible.

## 2. Reglas de investigación

1. Trabajar sobre el mismo repositorio y commit de referencia comunicado por el coordinador.
2. Solo lectura: no modificar código, datos, esquema, configuraciones, variables, migraciones, dependencias ni archivos funcionales; no ejecutar operaciones con efectos laterales.
3. No crear/eliminar funcionalidades, no aplicar scripts ni sembrar/restaurar datos.
4. Excluir reportes, gráficas, dashboards, indicadores y visualizaciones analíticas.
5. No exponer secretos, tokens, certificados, contraseñas, connection strings ni valores de entorno. Registrar únicamente la función y ubicación conceptual de la configuración.
6. No asumir requisitos ausentes. Buscar primero documentación y evidencia de código; lo no demostrado se clasifica pendiente.
7. Seguir flujos entre UI, servicio frontend, endpoint, validación, controlador, servicio, ORM y modelo persistido cuando existan esas capas.
8. Revisar operaciones que consumen campos indirectamente: relaciones Prisma, filtros/joins, DTOs, enumeraciones, archivos, procesos compartidos y consumidores frontend/backend.
9. Una ausencia en búsqueda textual no basta para concluir “sin uso”. Investigar formas indirectas de consumo; si no se logra probar el uso o la ausencia, indicar **uso no comprobado**.
10. Si código y documentación discrepan, citar ambas fuentes/fechas y dejar la decisión al responsable del negocio/técnico.
11. Ejecutar pruebas solo si están diseñadas para lectura y no producen cambios externos/de datos; anotar comando, resultado y alcance. No llamar a proveedor FEL real ni a sistemas externos con efectos.

## 3. Convención de evidencia

Cada afirmación relevante debe indicar:

- Ruta de archivo desde la raíz, símbolo (función/modelo/endpoint) y líneas aproximadas cuando sea posible.
- Tipo de evidencia: **código**, **esquema**, **prueba**, **requisito/documentación**, **observación de UI** o **configuración**.
- Qué demuestra y qué no demuestra.
- Versión/commit y fecha de revisión.
- Para pruebas, nombre/alcance/resultado sin presentar una prueba indirecta como comprobación de requisito.

Formato sugerido:

`EVID-<grupo>-NNN — Código — backend/src/services/xxx.ts::funciónX — relación/campo Y participa en Z; no demuestra que Z satisfaga requisito empresarial.`

Usar rutas relativas a la raíz del repositorio. No copiar valores secretos ni datos personales reales al informe.

## 4. Clasificación de hallazgos

Aplicar solo una severidad por hallazgo:

- **CRÍTICO:** inconsistencia que compromete gravemente la integridad de datos, una operación principal o regla esencial de negocio.
- **ALTO:** funcionalidad importante incompleta/desconectada o con validaciones insuficientes.
- **MEDIO:** inconsistencia funcional secundaria o dato cuyo uso no está suficientemente conectado.
- **BAJO:** inconsistencia menor, duplicidad o mejora de coherencia.
- **PENDIENTE DE VERIFICACIÓN:** sospecha que requiere evidencia adicional; no presentarla como defecto confirmado.

La severidad expresa consecuencia funcional, no cantidad de archivos ni facilidad de corrección. No etiquetar como defecto confirmado una expectativa sin fuente autorizada.

### Estados de evidencia

- **Confirmado:** reproducción/prueba o cadena de código inequívoca prueba el comportamiento señalado.
- **Parcialmente comprobado:** la cadena está presente, pero una parte (por ejemplo, integración externa, datos desplegados o condición límite) no fue verificada.
- **Pendiente de verificación:** la sospecha o expectativa no puede demostrarse con las fuentes disponibles.
- **No aplicable al alcance:** elemento excluido, indicando el motivo.

## 5. Formato obligatorio de informes

### Resumen por auditoría

- Identificador/nombre del grupo.
- Commit de referencia y fecha.
- Alcance asignado, módulos efectivamente examinados y módulos excluidos.
- Resultado general sin afirmar completitud no demostrada.
- Archivos revisados y archivos/rangos pendientes.
- Pruebas/consultas realizadas (solo lectura) y limitaciones.
- Requisitos/documentación consultados y contradicciones.

### Registro por hallazgo

Cada hallazgo debe incluir, como mínimo:

1. **Identificador único** (`AUD-<grupo>-NNN`).
2. **Módulo** primario y módulos cruzados.
3. **Funcionalidad afectada**.
4. **Descripción del problema o sospecha**.
5. **Evidencia técnica** referenciada.
6. **Archivos y símbolos implicados**.
7. **Flujo actual comprobado**.
8. **Flujo esperado y fundamento** (requisito/documento; si no existe, `no documentado / pendiente de confirmación`).
9. **Consecuencia funcional**.
10. **Severidad** según clasificación anterior.
11. **Dependencias** y grupos que deben coordinarse.
12. **Propuesta de solución** (describir, no implementar).
13. **Pruebas recomendadas** para resolver/verificar.
14. **Estado de verificación**.

Plantilla:

```text
### AUD-<grupo>-NNN — <título breve>
- Módulo:
- Funcionalidad:
- Descripción:
- Evidencia técnica:
- Archivos/símbolos:
- Flujo actual comprobado:
- Flujo esperado y fundamento:
- Consecuencia:
- Severidad:
- Dependencias:
- Propuesta de solución:
- Pruebas recomendadas:
- Estado de verificación:
```

## 6. Reglas para evitar duplicados y coordinar dependencias

1. Antes de registrar un hallazgo, buscar por entidad, operación, consecuencia y hallazgos existentes.
2. Si un problema de raíz afecta varias pantallas/tablas, crear un hallazgo raíz y listar consumidores; evitar una copia por cada archivo/módulo.
3. Identificadores únicos dentro de todo el proyecto: coordinador asigna prefijo/grupo, por ejemplo `AUD-A02-001`.
4. Si hay dos causas independientes, registrar dos hallazgos con evidencia separada. No agrupar solo porque ocurren en la misma pantalla.
5. El grupo dueño registra el hallazgo primario; otro grupo lo referencia por ID y agrega evidencia complementaria sin duplicarlo.
6. Toda dependencia que cruce límites del grupo debe aparecer en la sección “Dependencias”, con módulo origen/consumidor/dato/mecanismo.
7. No proponer cambios de esquemas o componentes compartidos sin mencionar impacto en sus consumidores y coordinación requerida.

## 7. Reglas para diferenciar confirmación de sospecha

- Una pantalla visible no demuestra que persista datos correctamente.
- Un endpoint definido no demuestra que la UI lo use ni que el proceso sea accesible al usuario esperado.
- Una tabla/campo no demuestra que tenga consumidor funcional.
- Una prueba unitaria no prueba reglas que no cubre ni validez del comportamiento en datos desplegados.
- Documentación de diseño o una bitácora de un paso no prueba estado actual; cotejar el código vigente.
- Código observado puede demostrar comportamiento implementado, pero no que ese comportamiento sea el requisito correcto.
- Si falta contrato de negocio, registrar pregunta/requisito no documentado y clasificar pendiente; no definir una regla por intuición.
- Antes de etiquetar un campo “huérfano”, revisar relaciones, includes, búsquedas dinámicas, acceso genérico, DTO, exportaciones, integraciones y referencias del frontend.

## 8. Exclusiones y prohibiciones

- Quedan excluidos reportes, gráficas, dashboards, indicadores y visualizaciones analíticas.
- Está prohibido modificar código fuente, pruebas, configuración, esquema, datos, migraciones, documentación funcional existente o dependencias.
- No ejecutar migraciones, seeds, scripts SQL, operaciones CRUD en entornos compartidos, pagos, cierres o emisión/anulación fiscal.
- No crear, eliminar ni alterar tablas/columnas ni instalar dependencias.
- No revelar secretos ni copiar credenciales.
- El único artefacto de escritura permitido es el informe de auditoría expresamente acordado por el coordinador. Esta regla prevalece sobre recomendaciones de implementación.

## 9. Criterios para declarar completa una auditoría especializada

Una auditoría puede declararse completa en su alcance únicamente si:

1. Identificó páginas, servicios frontend, endpoints, validadores, controladores, servicios backend, modelos/tablas y pruebas pertinentes.
2. Registró los archivos revisados y los pendientes, con motivo y efecto en certeza.
3. Siguió los flujos principales desde entrada hasta persistencia y consumidores relevantes, sin asumir que una capa aislada prueba el flujo.
4. Documentó dependencias cruzadas y avisó a los grupos correspondientes.
5. Diferenció requisito documentado, comportamiento comprobado, implementación parcial, expectativa sin evidencia y posible discrepancia negocio/código.
6. Investigó usos indirectos antes de clasificar campos/relaciones como no usados.
7. Registró pruebas/consultas realizadas y sus límites; no dejó efectos laterales.
8. Consolidó duplicados y asignó identificadores únicos.
9. No modificó código, esquema, datos ni configuración.
10. Excluyó analítica/reportes/dashboards como requiere este contrato.

## 10. Cierre y comunicación

Entregar el informe al coordinador con el resumen, hallazgos, preguntas de negocio, dependencias, archivos revisados y pendientes. Los hallazgos que crucen grupos deben enlazarse por ID. La fase de auditoría termina con evidencia y propuestas; implementación/corrección requiere una autorización y una tarea posterior independientes.
