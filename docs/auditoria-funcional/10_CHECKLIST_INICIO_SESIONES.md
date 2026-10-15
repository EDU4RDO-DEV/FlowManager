# Checklist para iniciar las sesiones A01–A06

Completar por cada sesión antes de comenzar la auditoría. Una casilla sin evidencia comprobable debe permanecer pendiente; no completar por inferencia.

## Punto de partida y documentación

- [ ] Confirmar la raíz real del repositorio, la rama y el hash completo del commit base.
- [ ] Confirmar que todos los grupos trabajarán sobre el mismo commit y registrar el hash en el informe.
- [ ] Registrar `git status`, cambios previos y archivos no seguidos; no limpiar, descartar ni sobrescribir trabajo.
- [ ] Leer `07_PLAN_MAESTRO_COORDINACION.md` y `06_CONTRATO_DE_AUDITORIA.md`.
- [ ] Leer los mapas y antecedentes aplicables: documentos `00`–`05`, `08` y `09`, además del informe especializado existente.
- [ ] Revisar `AUDITORIA_A01_IDENTIDAD_ACCESO_SESIONES.md` antes de iniciar A01 y conservar `AUD-A01-001` a `AUD-A01-006`; no volver a registrarlos con IDs distintos.
- [ ] Revisar los antecedentes técnicos de `docs/auditoria/` según el alcance asignado. Tratar sus resultados como históricos hasta verificarlos.
- [ ] Resolver o registrar como pendiente cualquier diferencia entre documentación, código vigente, fechas, commit de referencia y requisitos.

## Asignación y dependencias

- [ ] Confirmar el grupo oficial y el alcance exacto de la sesión.
- [ ] Asignar un único grupo responsable por cada causa raíz/hallazgo; otros grupos solo añaden evidencia de dependencias.
- [ ] Registrar dependencias entre grupos antes de ampliar la revisión a módulos vecinos.
- [ ] Proteger las superficies compartidas descritas en `04_ZONAS_COMPARTIDAS_Y_RIESGOS.md` y en el estado inicial; coordinar cualquier conclusión que las involucre.
- [ ] No convertir la presencia de una pantalla, endpoint, modelo o campo en prueba de que el flujo está completo.
- [ ] Antes de declarar un campo sin uso, revisar relaciones, consultas, servicios, DTO, consumidores indirectos frontend/backend y documentación relevante.

## Límites y seguridad operacional

- [ ] Excluir estrictamente reportes, gráficas, dashboards, indicadores, KPI y analítica.
- [ ] Mantener la auditoría en solo lectura: no modificar código, configuración, dependencias, datos, esquema, migraciones, seeds ni informes previos.
- [ ] No ejecutar operaciones CRUD en entornos compartidos, pagos, cierres de planilla, emisión/anulación fiscal, scripts SQL, seeds ni migraciones.
- [ ] No contactar servicios externos ni alterar integraciones. No inspeccionar ni copiar secretos, tokens, certificados, contraseñas o valores de entorno.
- [ ] Ejecutar pruebas solo cuando se haya comprobado que son de solo lectura y no producen efectos externos o cambios de datos.
- [ ] Documentar los tests/consultas que no se ejecuten y el motivo; no presentar resultados históricos como ejecución actual.

## Evidencia y registro de hallazgos

- [ ] Seguir el flujo existente desde UI y servicio frontend a ruta/API, validación, controlador, servicio, persistencia y consumidores posteriores cuando esas capas existan.
- [ ] Para cada afirmación, citar archivo/ruta, símbolo y líneas aproximadas cuando sea posible; indicar tipo de evidencia, commit, fecha, qué demuestra y qué no demuestra.
- [ ] Separar evidencia de código, esquema, prueba, requisito/documentación, observación de UI y configuración.
- [ ] Diferenciar defecto confirmado, comportamiento parcial, pendiente de verificación y expectativa de negocio sin requisito confirmado.
- [ ] No etiquetar una expectativa sin requisito autorizado como defecto confirmado.
- [ ] Usar el identificador asignado al grupo, conservar IDs existentes y consolidar duplicados con la misma causa funcional.
- [ ] Registrar dependencias, consecuencias cruzadas y preguntas de negocio sin asignar dos responsables al mismo hallazgo.
- [ ] No marcar una prueba como aprobada si no se ejecutó correctamente; reportar fallos, timeouts y limitaciones de base/integraciones.

## Criterio para declarar una auditoría completa

- [ ] Cubrir el alcance asignado y los flujos funcionales relevantes de extremo a extremo, o enumerar explícitamente las áreas/rangos que no se pudieron revisar.
- [ ] Identificar evidencia para datos, campos, opciones, validaciones, relaciones y consumidores; dejar como pendiente lo no comprobado.
- [ ] Registrar pruebas realizadas, resultados exactos, alcance, restricciones y pruebas pendientes.
- [ ] Consultar requisitos de negocio disponibles y dejar como pregunta cualquier expectativa no documentada o contradictoria.
- [ ] Confirmar cruces con otros grupos y asignación única de cada causa raíz.
- [ ] Mantener fuera de alcance las áreas analíticas y confirmar que no se modificó código, configuración ni datos.
- [ ] Declarar la auditoría incompleta si queda una parte sustancial sin evidencia, una limitación bloquea la conclusión o una prueba necesaria no se pudo ejecutar; indicar el bloqueo sin inventar un resultado.
