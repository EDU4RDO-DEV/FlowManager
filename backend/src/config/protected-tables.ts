/**
 * Lista única de tablas y campos protegidos de FlowManager (T-F1-BASE-07).
 *
 * "Protegido" significa: ventas, sus detalles, pagos, créditos y documentos FEL.
 * Ninguna tarea de implementación debe modificar, eliminar, reconstruir ni usar como
 * destino de datos de prueba persistentes a estas tablas sin presentar primero el riesgo
 * y una alternativa segura (ver docs/PLAN_MAESTRO_IMPLEMENTACION.md, sección 9, "Protocolo
 * de operación sobre la base de datos existente").
 *
 * Esta lista fue derivada directamente del esquema real verificado en
 * backend/prisma/schema.prisma; su ratificación formal por el negocio sigue pendiente
 * como D-BASE-05 (docs/DECISIONES_TECNICAS_PENDIENTES.md). No modificar este archivo para
 * reducir el alcance de protección sin esa ratificación explícita.
 */

/** Tablas protegidas en su totalidad. */
export const PROTECTED_TABLES = [
  'Venta',
  'DetalleVenta',
  'PagoVenta',
  'CuentaPorCobrar',
  'SolicitudPagoIdempotente',
  'ReservaProforma',
  'DevolucionComercial',
  'Talonario',
] as const;

export type ProtectedTable = (typeof PROTECTED_TABLES)[number];

/** Campos FEL de Venta, protegidos aunque la tabla en sí ya lo esté (listados por claridad). */
export const PROTECTED_VENTA_FEL_FIELDS = [
  'AutorizacionFel',
  'NumeroFel',
  'SerieFel',
  'QrFel',
  'RutaPdfFel',
  'FechaEmisionFel',
  'RutaPdfFelAnulacion',
  'FechaAnulacionFel',
  'NitFacturado',
] as const;

export function isProtectedTable(tableName: string): tableName is ProtectedTable {
  return (PROTECTED_TABLES as readonly string[]).includes(tableName);
}
