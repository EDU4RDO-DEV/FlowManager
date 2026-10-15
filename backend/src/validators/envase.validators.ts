import { z } from 'zod';

import { positiveInt } from './validation';

const positiveNumber = z.number().finite('debe ser un número válido').positive('debe ser mayor a 0');

export const movimientoEnvaseIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const envaseIdempotencyKeySchema = z.string().uuid('El encabezado Idempotency-Key debe ser UUID');

const tipoMovimientoSchema = z.enum([
  'PRESTAMO',
  'DEVOLUCION',
  'DEVOLUCION_DANADA',
  'PERDIDA',
  'BAJA',
]);

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
  idRutaSesion: positiveInt.optional(),
  cantidad: positiveNumber,
  estadoEnvase: z.enum(['VACIO', 'LLENO']).optional(),
  rutaFirma: z.string().trim().max(255, 'rutaFirma demasiado larga').optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
});

export const registrarDevolucionEnvaseSchema = registrarPrestamoEnvaseSchema.extend({
  estadoEnvase: z.enum(['VACIO', 'LLENO', 'DANADO']).optional(),
});

export const registrarPerdidaEnvaseSchema = z.object({
  idInventarioItem: positiveInt,
  idCliente: positiveInt,
  idVenta: positiveInt.optional(),
  idRutaSesion: positiveInt.optional(),
  cantidad: z.number().int().positive(),
  observaciones: z.string().trim().min(3, 'El motivo de la pérdida es obligatorio').max(255, 'observaciones demasiado largas'),
});

export const registrarBajaEnvaseSchema = z.object({
  idInventarioItem: positiveInt,
  idRutaSesion: positiveInt.optional(),
  cantidad: z.number().int().positive(),
  estadoEnvase: z.enum(['VACIO', 'LLENO', 'DANADO']),
  ubicacionEnvase: z.enum(['PLANTA', 'RUTA', 'CUARENTENA']),
  observaciones: z.string().trim().min(3, 'El motivo de la baja es obligatorio').max(255, 'observaciones demasiado largas'),
}).refine(
  (data) => (data.ubicacionEnvase === 'RUTA') === (data.idRutaSesion !== undefined),
  { message: 'La ubicación RUTA requiere idRutaSesion y las otras ubicaciones no lo permiten' },
).refine(
  (data) => (
    (data.estadoEnvase === 'DANADO' && ['CUARENTENA', 'RUTA'].includes(data.ubicacionEnvase)) ||
    (data.estadoEnvase !== 'DANADO' && data.ubicacionEnvase !== 'CUARENTENA')
  ),
  { message: 'La ubicación y el estado del envase no son compatibles' },
);

export const reconcileEnvasePhysicalStockSchema = z.object({
  idInventarioItem: positiveInt,
  cantidadVacia: z.number().int().min(0),
  cantidadLlena: z.number().int().min(0),
  cantidadDanada: z.number().int().min(0),
  observaciones: z.string().trim().min(3, 'Las observaciones del conteo son obligatorias').max(200),
}).refine(
  (data) => data.cantidadVacia + data.cantidadLlena + data.cantidadDanada > 0,
  { message: 'La clasificación debe incluir al menos un envase' },
);

export const envasePhysicalCountSchema = z.object({
  idInventarioItem: positiveInt,
  ubicacionEnvase: z.enum(['PLANTA', 'RUTA', 'CUARENTENA']),
  idRutaSesion: positiveInt.optional(),
  cantidadVacia: z.number().int().min(0),
  cantidadLlena: z.number().int().min(0),
  cantidadDanada: z.number().int().min(0),
  observaciones: z.string().trim().min(3, 'Las observaciones del conteo son obligatorias').max(200),
}).refine(
  (data) => (data.ubicacionEnvase === 'RUTA') === (data.idRutaSesion !== undefined),
  { message: 'La ubicación RUTA requiere idRutaSesion y las otras ubicaciones no lo permiten' },
).refine(
  (data) => data.ubicacionEnvase !== 'PLANTA' || data.cantidadDanada === 0,
  { message: 'Los envases dañados deben contarse en CUARENTENA o en ruta' },
).refine(
  (data) => data.ubicacionEnvase !== 'CUARENTENA' || (data.cantidadVacia === 0 && data.cantidadLlena === 0),
  { message: 'En CUARENTENA solo se cuentan envases dañados' },
);

export const anulateMovimientoEnvaseBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreMovimientoEnvaseBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
