import { z } from 'zod';

import { dateString, optionalBooleanFromQuery, positiveInt } from './validation';

const vehiculoEstadoSchema = z.enum([
  'DISPONIBLE',
  'EN_RUTA',
  'MANTENIMIENTO',
  'NO_DISPONIBLE',
]);

const rutaSesionEstadoSchema = z.enum(['PROGRAMADA', 'EN_CURSO', 'CERRADA']);

const gastoEstadoPagoSchema = z.enum(['PENDIENTE', 'PAGADO']);

// Homologado con el mismo dominio de métodos de pago usado en PagoVenta/CreditoPago.
const gastoMetodoPagoSchema = z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS']);

// Límite real de la columna INT en SQL Server; sin este tope Prisma lanza un error crudo de overflow.
const SQL_INT_MAX = 2147483647;
const numeroValeSchema = z
  .number()
  .int('numeroVale debe ser entero')
  .positive('numeroVale debe ser mayor a 0')
  .max(SQL_INT_MAX, 'numeroVale excede el máximo permitido');

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaSesion debe tener formato YYYY-MM-DD');

const optionalDateTimeSchema = dateString.optional();

export const logisticsIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const logisticsTwoIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idSesion: z.coerce
    .number()
    .int('idSesion debe ser entero')
    .positive('idSesion debe ser mayor a 0'),
});

export const vehiculoFiltersSchema = z.object({
  anulado: optionalBooleanFromQuery,
  estado: vehiculoEstadoSchema.optional(),
  disponible: optionalBooleanFromQuery,
});

export const createVehiculoSchema = z.object({
  idUsuario: positiveInt,
  placa: z.string().trim().min(3, 'placa debe tener al menos 3 caracteres').max(50),
  marca: z.string().trim().min(2, 'marca debe tener al menos 2 caracteres').max(50),
  modelo: z.string().trim().min(1, 'modelo es obligatorio').max(50),
  color: z.string().trim().max(50).optional(),
  estado: vehiculoEstadoSchema.default('DISPONIBLE'),
});

export const updateVehiculoSchema = z
  .object({
    placa: z.string().trim().min(3).max(50).optional(),
    marca: z.string().trim().min(2).max(50).optional(),
    modelo: z.string().trim().min(1).max(50).optional(),
    color: z.string().trim().max(50).nullable().optional(),
    estado: vehiculoEstadoSchema.optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteVehiculoBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreVehiculoBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const rutaFiltersSchema = z.object({
  anulado: optionalBooleanFromQuery,
});

export const createRutaSchema = z.object({
  nombre: z.string().trim().min(3, 'nombre debe tener al menos 3 caracteres').max(100),
  descripcion: z.string().trim().max(255).optional(),
});

export const updateRutaSchema = z
  .object({
    nombre: z.string().trim().min(3).max(100).optional(),
    descripcion: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteRutaBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreRutaBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const rutaSesionFiltersSchema = z.object({
  idRuta: z.coerce.number().int().positive().optional(),
  idVehiculo: z.coerce.number().int().positive().optional(),
  anulado: optionalBooleanFromQuery,
  estado: rutaSesionEstadoSchema.optional(),
});

export const createRutaSesionSchema = z.object({
  idRuta: positiveInt,
  idVehiculo: positiveInt,
  idUsuarioChofer: positiveInt,
  idUsuarioVendedor: positiveInt,
  fechaSesion: dateOnlySchema,
  kmInicial: z.number().finite('kmInicial debe ser válido').min(0).optional(),
  kmFinal: z.number().finite('kmFinal debe ser válido').min(0).optional(),
  estado: rutaSesionEstadoSchema.default('PROGRAMADA'),
});

export const updateRutaSesionSchema = z
  .object({
    idRuta: positiveInt.optional(),
    idVehiculo: positiveInt.optional(),
    idUsuarioChofer: positiveInt.optional(),
    idUsuarioVendedor: positiveInt.optional(),
    fechaSesion: dateOnlySchema.optional(),
    kmInicial: z.number().finite('kmInicial debe ser válido').min(0).nullable().optional(),
    kmFinal: z.number().finite('kmFinal debe ser válido').min(0).nullable().optional(),
    estado: rutaSesionEstadoSchema.optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteRutaSesionBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreRutaSesionBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const gastoVehiculoFiltersSchema = z.object({
  idRutaSesion: z.coerce.number().int().positive().optional(),
  idRuta: z.coerce.number().int().positive().optional(),
  anulado: optionalBooleanFromQuery,
  estadoPago: gastoEstadoPagoSchema.optional(),
});

export const createGastoVehiculoSchema = z.object({
  idRutaSesion: positiveInt,
  idUsuario: positiveInt,
  idProveedor: positiveInt.optional(),
  descripcion: z.string().trim().min(3, 'descripcion debe tener al menos 3 caracteres').max(255),
  monto: z.number().finite('monto debe ser válido').positive('monto debe ser mayor a 0'),
  metodoPago: gastoMetodoPagoSchema,
  numeroVale: numeroValeSchema.optional(),
  rutaImagen: z.string().trim().max(255).optional(),
  estadoPago: gastoEstadoPagoSchema.default('PAGADO'),
  fechaPago: optionalDateTimeSchema,
  referenciaPago: z.string().trim().max(100).optional(),
});

export const updateGastoVehiculoSchema = z
  .object({
    idRutaSesion: positiveInt.optional(),
    idUsuario: positiveInt.optional(),
    idProveedor: positiveInt.nullable().optional(),
    descripcion: z.string().trim().min(3).max(255).optional(),
    monto: z.number().finite('monto debe ser válido').positive('monto debe ser mayor a 0').optional(),
    metodoPago: gastoMetodoPagoSchema.optional(),
    numeroVale: numeroValeSchema.nullable().optional(),
    rutaImagen: z.string().trim().max(255).nullable().optional(),
    estadoPago: gastoEstadoPagoSchema.optional(),
    fechaPago: optionalDateTimeSchema,
    referenciaPago: z.string().trim().max(100).nullable().optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteGastoVehiculoBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreGastoVehiculoBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
