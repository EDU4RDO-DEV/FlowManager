import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');
const positiveNumber = z.number().finite('debe ser un número válido').positive('debe ser mayor a 0');

export const movimientoEnvaseIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

const tipoMovimientoSchema = z.enum(['PRESTAMO', 'DEVOLUCION']);

export const listMovimientosEnvaseQuerySchema = z.object({
  idCliente: z.coerce.number().int('idCliente debe ser entero').positive('idCliente debe ser mayor a 0').optional(),
  idInventarioItem: z.coerce
    .number()
    .int('idInventarioItem debe ser entero')
    .positive('idInventarioItem debe ser mayor a 0')
    .optional(),
  idVenta: z.coerce.number().int('idVenta debe ser entero').positive('idVenta debe ser mayor a 0').optional(),
  tipoMovimiento: tipoMovimientoSchema.optional(),
  anulado: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const listEnvaseSaldosQuerySchema = z.object({
  idCliente: z.coerce.number().int('idCliente debe ser entero').positive('idCliente debe ser mayor a 0').optional(),
  soloConSaldo: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const registrarPrestamoEnvaseSchema = z.object({
  idInventarioItem: positiveInt,
  idCliente: positiveInt,
  idVenta: positiveInt.optional(),
  cantidad: positiveNumber,
  rutaFirma: z.string().trim().max(255, 'rutaFirma demasiado larga').optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
});

export const registrarDevolucionEnvaseSchema = registrarPrestamoEnvaseSchema;

export const anulateMovimientoEnvaseBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreMovimientoEnvaseBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
