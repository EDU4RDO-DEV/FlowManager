# Implementación A03 — Inventario, compras y envases

**Fecha:** 2026-10-12 (UTC-06:00)  
**Rama:** `developer`  
**HEAD comprobado antes de editar:** `62cf2c25a97107c69814754858d4c7f079025afe`  
**Commit de referencia de auditoría:** `27f59fa024a804c468c434cfd504baa0b865a362`  
**Entorno:** implementación local y pruebas unitarias con dobles de Prisma; no se confirmó una instancia SQL Server aislada.

## 1. Resumen de las correcciones

- Las escrituras que cambian existencias y agregan movimientos de kardex ahora solicitan aislamiento `Serializable` y consultan el stock dentro de la misma transacción.
- Las anulaciones/restauraciones de compras, ajustes y envases vuelven a leer el documento y su estado dentro de la transacción, junto con el stock/saldo que se modifica. La anulación de venta también vuelve a comprobar dentro de la transacción que la venta siga activa antes de devolver stock.
- Compra, detalle, existencias y bitácora permanecen dentro de la transacción de alta. La validación de factura y el cálculo de `NumeroCompra` también se trasladaron a esa transacción serializable.
- No se añadieron reintentos automáticos. Los conflictos Prisma `P2034` de las rutas de mutación de inventario, compra, envase y anulación de venta se responden como HTTP 409 con una instrucción de verificar el resultado antes de reintentar.
- No se modificaron el esquema Prisma, las migraciones ni los datos.

## 2. Estado de `AUD-A03-001` y `AUD-A03-002`

| Hallazgo | Estado | Resultado y límite |
|---|---|---|
| `AUD-A03-001` — Las operaciones concurrentes pueden dejar existencia y bitácora divergentes | **Corregido con validación limitada** | Ajustes, compras, movimientos de envases y anulación de ventas realizan lecturas y escrituras de stock, estados y bitácora dentro de transacciones serializables. Las pruebas unitarias verifican el límite transaccional y la opción de aislamiento; no demuestran el comportamiento de bloqueo/abortos de SQL Server. |
| `AUD-A03-002` — La verificación de factura y la numeración de compra no son atómicas | **Corregido con validación limitada; decisión de negocio pendiente** | La verificación existente de factura activa por proveedor y la lectura de `MAX(NumeroCompra) + 1` ocurren ahora dentro de la misma transacción serializable que crea compra, detalles y efectos de inventario. No se agregó unicidad de esquema: la regla para facturas anuladas/restauradas y el ámbito/posible reutilización del número interno siguen requiriendo confirmación. No se comprobó SQL Server. |

La regla de factura preservada es la que ya implementaba el servicio: misma combinación de proveedor y número de factura entre compras activas. No se amplió a unicidad global ni a compras anuladas. La numeración interna continúa usando el máximo global más uno del modelo actual.

## 3. Otros defectos demostrados corregidos

No se confirmó ni corrigió otro defecto independiente dentro del alcance. Se cerró la lectura fuera de transacción que permitía que las anulaciones/restauraciones de stock usaran estados o saldos obsoletos; esta es una dependencia inmediata de `AUD-A03-001`, no un hallazgo nuevo.

## 4. Archivos modificados y justificación

### Servicios

- `backend/src/services/adjustment.service.ts` — lee el ajuste y la existencia dentro de la transacción serializable para crear, anular y restaurar ajustes.
- `backend/src/services/envase.service.ts` — valida categoría/stock, obtiene saldos y consulta el movimiento anulable/restaurable dentro de transacciones serializables.
- `backend/src/services/purchase.service.ts` — hace atómica la validación de factura, la asignación del número y la creación; mueve la carga de compras y sus estados dentro de transacciones serializables de alta, anulación y restauración.
- `backend/src/services/sale.service.ts` — conserva el trabajo A02 y su aislamiento de alta/pagos; añade lectura serializable del estado de venta durante la anulación porque ese flujo repone inventario.

### Controladores

- `backend/src/controllers/adjustment.controller.ts` — expone conflictos de serialización como HTTP 409.
- `backend/src/controllers/envase.controller.ts` — mapea conflictos de serialización a HTTP 409 manteniendo los errores de negocio existentes.
- `backend/src/controllers/purchase.controller.ts` — expone conflictos de serialización de compras y sus anulaciones/restauraciones como HTTP 409.
- `backend/src/controllers/sale.controller.ts` — expone como HTTP 409 un conflicto concurrente durante la anulación de venta.

### Pruebas e informe

- `backend/src/tests/adjustment.service.spec.ts` — adapta los dobles a lecturas dentro de la transacción y verifica el aislamiento en anulaciones/restauraciones.
- `backend/src/tests/envase.service.spec.ts` — verifica el aislamiento serializable en el préstamo.
- `backend/src/tests/purchase.service.spec.ts` — adapta los dobles de alta/anulación/restauración y verifica la transacción serializable.
- `backend/src/tests/sale-transition-notifications.spec.ts` — adapta la doble lectura de venta y verifica el aislamiento de su anulación.
- `docs/auditoria-funcional/IMPLEMENTACION_A03_INVENTARIO_COMPRAS_ENVASES.md` — registra esta implementación y sus límites.

Los documentos maestros y los informes originales de auditoría permanecen sin modificar.

## 5. Cambios en Prisma y migraciones

**Ninguno.** No se modificaron `backend/prisma/schema.prisma`, SQL maestro ni migraciones. No se creó ni ejecutó una migración A03. Se preservó la migración A02 `20261012073000_a02_unique_venta_numero`; no se ejecutó.

La decisión pendiente sobre el alcance de factura/número interno impide agregar con seguridad una restricción única A03 basada en una interpretación no aprobada. La protección añadida conserva la regla de aplicación existente y depende de la transacción serializable.

## 6. Pruebas y resultados

Comando ejecutado desde la raíz:

```text
npm --prefix backend test -- --run src/tests/adjustment.service.spec.ts src/tests/envase.service.spec.ts src/tests/purchase.service.spec.ts src/tests/sale-cxc.service.spec.ts src/tests/sale-transition-notifications.spec.ts
```

**Resultado final:** 5 archivos aprobados, 27 pruebas aprobadas, 0 fallidas.

```text
npm --prefix backend run build
```

**Resultado:** aprobado (`tsc` y copia de plantillas de reportes).

```text
git diff --check
```

**Resultado:** aprobado, sin errores de whitespace.

Los dobles unitarios verifican las decisiones del servicio, no la semántica de concurrencia ni el rollback real del motor. El primer intento de pruebas después de mover las lecturas dentro de transacciones expuso dobles desactualizados; se adaptaron a la interfaz transaccional y la ejecución final indicada arriba pasó.

## 7. Limitaciones de concurrencia y base de datos

- No se confirmó una instancia SQL Server aislada/desechable; por ello no se ejecutaron carreras concurrentes ni pruebas de integración contra base de datos.
- No se validó la configuración de aislamiento efectiva, bloqueos de rango, interbloqueos, respuestas `P2034`, estado de índices ni compatibilidad de datos desplegados. `Serializable` es la protección solicitada por el código y debe comprobarse en el motor destino.
- No se consultó ni modificó ninguna base, y no se ejecutaron migraciones, seeds, SQL o movimientos operativos.
- No hay reintentos automáticos. Un conflicto devuelve HTTP 409 y la interfaz/operador debe verificar el resultado antes de decidir reintentar.
- La anulación fiscal FEL permanece fuera del alcance A03: puede tener efectos remotos que no se revierten junto con SQL; coordinar cualquier cambio futuro con A02/A06.

## 8. Decisiones de negocio pendientes

1. Confirmar el alcance de unicidad de factura, incluida la reutilización tras anulación/restauración, y si la combinación proveedor/factura es la regla autorizada.
2. Confirmar el ámbito y política de reutilización de `NumeroCompra`.
3. Definir unidades, precisión y redondeo de existencias, compras, ajustes, consumo y envases.
4. Definir el tratamiento de costo promedio ante anulaciones/restauraciones con compras o ventas posteriores.
5. Definir si movimientos de envase deben asociarse a venta, ruta/sesión o firma, y los procesos de pérdida/daño.
6. Definir si los gastos de compra requieren pagos a proveedor o contabilización; no se infirió ese requisito.
7. Definir lotes, caducidad y consumo de estructuras antes de conectar inventario con fabricación/calidad.

## 9. Dependencias con A02, A04, A05 y A06

- **A02:** la creación/anulación de venta consume inventario. Solo se ajustó el límite transaccional de anulación necesario para evitar reversas concurrentes de stock; no se cambió la política de pagos, FEL, proformas ni estados comerciales.
- **A04:** los movimientos de envase participan en operaciones logísticas, pero no se inventó una asociación nueva con ruta/sesión.
- **A05:** productos e inventario siguen siendo datos consumidos por ventas/comisiones; no se cambiaron fórmulas ni planillas.
- **A06:** no se implementó fabricación, BOM, lotes ni una relación con calidad.
- **A01:** no se modificaron autenticación, autorización o sesiones.

## 10. Riesgos y pasos pendientes antes del despliegue

1. Preparar una instancia SQL Server desechable y confirmar que no comparte datos, credenciales ni integraciones con producción.
2. Ejecutar allí carreras sincronizadas para compras, ajustes, ventas, préstamos/devoluciones de envases y anulación/restauración del mismo documento; comparar existencia/saldos, estado documental y cada fila de kardex.
3. Probar factura repetida por mismo proveedor y número, facturas distintas concurrentes y asignación concurrente de `NumeroCompra`; definir primero los casos de facturas anuladas/restauradas.
4. Confirmar la respuesta HTTP y el comportamiento de cliente ante `P2034`; evitar reintentos ciegos.
5. Antes de aplicar cualquier cambio futuro de esquema, cotejar duplicados/datos y la secuencia completa de migraciones únicamente en un entorno aislado aprobado.
6. Revisar con A02 la divergencia posible entre una anulación FEL externa y un fallo/competencia de la transacción SQL.

**Integridad operativa:** no se hicieron commits, no se cambió de rama y no se escribieron datos compartidos. Se preservaron los cambios y documentos previos de A01/A02 y los archivos de auditoría que ya estaban sin seguimiento.
