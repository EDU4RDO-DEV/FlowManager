# Mapa de dependencias y coordinación para implementación

**Referencia de auditoría:** `27f59fa024a804c468c434cfd504baa0b865a362` (`developer`).  
Este mapa organiza dependencias para planificar validación e implementación futura; no autoriza cambios en código, datos, configuración o esquema.

## Propiedad funcional y dependencias

| Causa/superficie | Grupo responsable | Consumidores / grupos a coordinar | Evidencia y riesgo al cambiar sin validar consumidores |
|---|---|---|---|
| Identidad, sesiones, JWT, refresh, guards y catálogo RBAC | A01 | Todos A02–A06 y toda ruta protegida | Access/refresh, rol y sesión son verificados transversalmente. Cambiar revocación/claims/grants puede cerrar sesiones, alterar permisos o afectar cualquier endpoint. Hallazgos A01-001–008. |
| Cliente, tipo/condición de crédito, venta, pago, cartera y talonario | A02 | A03 stock; A04 RutaSesion/entrega; A05 comisión/planilla; A06 FEL y n8n | Una venta puede generar detalles, pagos, CxC, movimiento de stock, FEL y evento; cambio parcial afecta dinero, inventario, entregas o facturación. Hallazgos A02-001–009. |
| FEL comercial y frontera entre efecto fiscal y SQL | A02 para orquestación de venta; A06 para configuración/transporte | A06, proveedor externo (solo en validación controlada) | Servicio FEL externo no comparte rollback Prisma; anulación fiscal y persistencia pueden divergir. No reintentar sin conocer resultado fiscal remoto. `AUD-A02-005`, `AUD-A02-006`; fechas configuradas `AUD-A06-005` son tema distinto. |
| Existencias, movimientos, reversas, kardex y compras | A03 | A02 ventas/anulación; A04 envases/logística; A06 estructura/calidad como futuro | El stock común puede cambiar por compra, ajuste, envase y venta. Cambiar un productor o reversa sin cotejar `Existencia`, documento y `BitacoraInventario` puede duplicar/p perder movimientos. Hallazgos A03-001/002. |
| Correlativo de factura/compra | A03 | Compras, proveedores, consumidor de stock | La validación de duplicado y número interno se realiza antes de transacción; la unicidad y el alcance de numeración deben decidirse antes de esquema/código. |
| Ruta, sesión, vehículo, entrega y gastos vehiculares | A04 | A02 Venta/estado de entrega; A05 atribución de vendedor/chofer; A01 identidad; A03 envases | Venta guarda FK de `RutaSesion`; actualización de sesión puede cambiar datos consumidos por planilla. Disponibilidad de vehículo, estados, gasto y entrega son otras invariantes locales. Hallazgos A04-001–005. |
| Empleado, regla/configuración de comisión y planilla mensual | A05 | A02 venta/pago/estado; A04 RutaSesion; A03 productos; A01 Usuario | El cálculo lee ventas no anuladas/pagadas, producto, período y vendedor/chofer de sesión. Cambiar atributos de ventas, sesiones o vínculos cambia borradores/previews; cierre persistido no se vio recalcular automáticamente. Hallazgos A05-001–007. |
| Calidad y validación de registros diarios | A06 | A01 solo para RBAC, base/esquema común | Fecha única activa, edición/validación y filtros año/mes. No se demostró consumidor que bloquee producción o inventario; no crear dependencia operativa imaginada. Hallazgos A06-001–003. |
| Configuración de Empresa/FEL | A06 para configuración; A02 para ventas/emisión | A02; secretos/proveedor FEL mediante cambio coordinado seguro | Fechas de vigencia guardadas no se leen en el servicio de emisión. No habilitar ni bloquear emisión sin confirmar semántica y revisar fuente de configuración. `AUD-A06-005`. |
| Notificaciones n8n | A06 para cliente/configuración; grupo del evento para contenido | A02 ventas, A04 logística y demás emisores observados | Envíos fire-and-forget; workflow remoto no está versionado ni verificado. Error de evento no debe confundirse con éxito/fracaso de operación principal. `AUD-A06-004` y discrepancia de emisores/contrato. |
| Producción/fabricación | Sin dueño de implementación asignable hasta definición; A06 coordina diagnóstico funcional | A03 inventario/BOM, A06 calidad, potencialmente A02 producto terminado | Página es placeholder, sin API de producción observada; BOM existe pero no demuestra órdenes, lotes o movimientos. Diseñar antes de asignar causa/código. |

## Dependencias principales por flujo

### Identidad, permisos y sesiones

El middleware y el catálogo RBAC protegen todos los routers. `AUD-A01-001`–`008` comparten superficie, pero no se fusionan: logout local, anulación de usuario, rol anulado, bootstrap, política de contraseña, latencia de cambio de rol, refresh concurrente y restauración de credenciales son operaciones distintas. El cambio futuro de middleware debe probar login, refresh, logout, rol, permisos y varios módulos consumidores; coordinar UI de auth y grants persistidos.

### Ventas, crédito, pagos y cuentas por cobrar

`sale.service.ts` coordina ventas y efectos comerciales; `credit.service.ts` deriva pagos de `PagoVenta`. La anulación de pago contado (`AUD-A02-003`), concurrencia de abonos (`004`), operación FEL/SQL (`005`), cambio de requisito de factura (`006`), talonarios (`007`), proformas (`008`) y precios (`009`) no son intercambiables. Probar saldo, estado, pago, cartera, numeración, inventario y estado fiscal en fixture sintético; no operar con fondos o comprobantes reales.

### Ventas y movimientos de inventario / compras, existencias, bitácora y reversas

Ventas comerciales tienen causa raíz A02; movimiento común, kardex, compras, ajustes, envases y reversas son A03. La relación técnica está confirmada; la corrección de A03-001 debe incluir a todos los productores/consumidores, distinguir transacción de consistencia concurrente y validar stock final junto con cada fila de bitácora. Compra usa proveedor; gastos de compra no deben equipararse a libro contable sin requisito.

### Pedidos/ventas, rutas, sesiones, vehículos y entregas

No se encontró modelo `Pedido` separado; la revisión A04 identifica `Venta` con sesión y estados de entrega. A02 posee venta/pago/FEL; A04 posee operación logística y confirmación. La página comercial crea pendiente, backend puede aceptar cambios, pero no se demostró flujo UI de seguimiento/entrega completa o parcial. Evento n8n no demuestra que entrega ocurra.

### Sesiones de ruta y datos consumidos por planilla

`Venta.IdRutaSesion` enlaza a sesión; el cálculo de A05 consulta `FechaSesion`, `IdUsuarioChofer` e `IdUsuarioVendedor` actuales. `AUD-A04-003` es sobre permitir cambiar sesión cerrada sin política; `AUD-A05-004` es sobre falta de contexto reproducible del cálculo. A04 decide/implementa política de sesión; A05 captura procedencia/versionado de comisión. Validar borradores y cierres por separado; el informe no observa recálculo automático de cerradas.

### Comisiones, productos y ventas

A05 es responsable de asignación y fórmula implementada; A03 mantiene catálogo de producto y A02 venta/detalle/estados. Las múltiples reglas por producto ya caben en una configuración; varias configuraciones por empleado o grupos de producto son evolución solicitada y requieren definir semántica, trazabilidad y prevención de dobles aplicaciones.

### Planillas mensuales, ajustes y UX

La generación usa datos actuales; el preview puede ser obsoleto, roster incompleto puede bloquear todo, actualización parcial de borrador puede recalcular/eliminar ajustes y el mismo ajuste se aplica a todos los seleccionados. Estos cuatro aspectos conservan IDs A05-002/003/006/007, no una causa única. UX de preparación mensual es mejora funcional explícita aparte, no severidad o regla empresarial asumida.

### Calidad, lotes, fabricación e inventario

A06 encontró registro de calidad de agua, pero no flujo de liberación/calidad que controle producción o stock. A03 encontró BOM, sin ejecución que consuma estructura y modifique existencias. No existe evidencia para cerrar la cadena calidad → lote → fabricación → stock. A06-001–003 son defectos/risgos del registro de calidad, no evidencia de fabricación. Hace falta especificación previa para decidir qué modelos o transiciones se requieren.

### Empresa, FEL y n8n

Los datos de Empresa, las variables de entorno para FEL y el transporte son distintas fuentes. `AUD-A02-005` cubre consistencia entre proveedor fiscal y SQL; `AUD-A02-006` cubre cambio de `RequiereFactura`; `AUD-A06-005` cubre efecto no demostrado de fechas de vigencia guardadas. n8n envía eventos asíncronos, la documentación histórica no coincide en todos sus emisores con el código y no se inspeccionó workflow remoto. No conectar éxito comercial a una notificación sin un contrato remoto verificado.

## Duplicidad y causas raíz compartidas

No hay duplicidad intergrupal confirmada que permita eliminar IDs. Los posibles agrupamientos para coordinar son:

1. **Pruebas/patrón de concurrencia:** A01-007, A02-004, A03-001, A04-002, A06-002/003. Comparten riesgo de check/read-then-write, pero cada uno afecta entidad e invariantes diferentes; responsable individual se mantiene.
2. **Datos de ruta en nómina:** A04-003 y A05-004 se condicionan mutuamente. La asignación mutable de sesión es del módulo A04; snapshots/proveniencia del resultado son de A05.
3. **Unicidad/contadores:** A02-007, A03-002 y A06-002 comparten una preocupación general de unicidad bajo concurrencia, pero corresponden a talonario, compra y control diario, respectivamente; no imponer una solución única sin revisar semánticas.
4. **Sesiones/roles:** A01-001/002/003/008 deben compartir contrato de revocación/restauración, no un solo hallazgo. A01-006 depende de cuánto tarda en aplicarse el cambio de rol.
5. **FEL:** A02-005/006 y A06-005 son interfaces coordinadas pero con disparador, transacción y configuración separables.

## Discrepancias entre informes y documentos de coordinación

- `08_ESTADO_INICIAL_Y_CONTINUIDAD.md`, `09_MATRIZ_CONTINUIDAD_AUDITORIAS.md` y `07_PLAN_MAESTRO_COORDINACION.md` describen una etapa anterior: indican que A02–A06 no tenían informes, que A01 solo conservaba 001–006 y que las auditorías estaban por iniciar. Los informes A02–A06 y la revisión A01 del 2026-10-12 existen actualmente; esos enunciados se preservan como registro histórico, no estado actual.
- La continuidad `09` resume A01 como seis IDs; la revisión A01 actual incorpora 007–008. A06 confirma la existencia de ambos y que su sección de referencias los conserva. Catálogo actualizado: ocho IDs.
- `00` y `08` indican que había nueve archivos no seguidos originalmente o documentan creación posterior de 08–10. El inventario actual contiene 18 documentos en la carpeta, todos bajo el mismo estado no seguido inicial observado en esta sesión; no se atribuye autoría ni se infiere cronología desde Git.
- El nombre `A04_REVISION_RUTAS_VEHICULOS_LOGISTICA.md` mencionado en la instrucción no existe. El informe encontrado y usado es `A04_REVISION_RUTAS_VEHICULOS_OPERACION_LOGISTICA.md`; A05 también deja constancia de la misma diferencia.
- A01 original (2026-10-11) y revisión (2026-10-12) difieren en alcance de la redacción de `AUD-A01-005`: el original trata la creación administrativa; la revisión amplía a actualización. Se mantienen ambas referencias y se refleja el alcance más reciente sin borrar el original.
- Los informes especializados declaran mismo commit/branch, pero sus límites no son homogéneos: A05 indica revisión estática completa de su alcance; A02/A03/A04/A06 la califican parcial en distintos grados. “Completa” no equivale a validación dinámica/desplegada.
- Varios informes refieren resultados históricos de pruebas o planes técnicos `docs/auditoria/`; no se reejecutaron ni se elevan a evidencia actual. La cronología documental de ciertas migraciones y la divergencia del contrato n8n se mantienen pendientes según sus fuentes.

## Riesgos de cambiar un módulo sin validar sus consumidores

1. RBAC/sesiones pueden impedir o conceder operaciones en toda la API.
2. Cambio de venta afecta cobro, CxC, stock, entrega, comisión y FEL.
3. Reversa de stock debe respetar documento, existencia y kardex en la misma operación lógica.
4. Cambio de `RutaSesion` puede trasladar ventas entre períodos/personas para cálculo futuro.
5. Cambio de configuración/reglas o reglas de pago puede alterar planillas mensuales; no recalcular períodos productivos sin autorización.
6. Modificar campos de Empresa o fuente de credenciales puede afectar emisión FEL.
7. Cambio de payload/evento n8n puede romper workflow no verificado; no tratar webhook como parte transaccional confirmada.
8. Esquema, SQL maestro, migraciones y bases desplegadas no se cotejaron; cualquier cambio requiere determinar autoridad y compatibilidad antes de migrar.
