import { z } from 'zod';

import { dateString, nonNegativeNumber, positiveInt } from './validation';

const tipoMantenimientoSchema = z.enum(['PREVENTIVO', 'CORRECTIVO']);
const estadoMantenimientoSchema = z.enum(['PROGRAMADO', 'REALIZADO', 'CANCELADO']);

export const maintenanceIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listMaintenanceQuerySchema = z.object({
  idVehiculo: positiveInt.optional(),
  estado: estadoMantenimientoSchema.optional(),
  tipoMantenimiento: tipoMantenimientoSchema.optional(),
  anulado: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const createMaintenanceSchema = z.object({
  idVehiculo: positiveInt,
  idProveedor: positiveInt.optional(),
  tipoMantenimiento: tipoMantenimientoSchema,
  descripcion: z.string().trim().min(3, 'descripcion debe tener al menos 3 caracteres').max(255, 'descripcion demasiado larga'),
  fechaMantenimiento: dateString,
  costo: nonNegativeNumber.optional(),
  estado: estadoMantenimientoSchema.optional(),
  proximoMantenimiento: dateString.optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
  rutaImagen: z.string().trim().max(255, 'rutaImagen demasiado larga').optional(),
});

export const updateMaintenanceSchema = z
  .object({
    idProveedor: z.union([positiveInt, z.null()]).optional(),
    tipoMantenimiento: tipoMantenimientoSchema.optional(),
    descripcion: z.string().trim().min(3, 'descripcion debe tener al menos 3 caracteres').max(255).optional(),
    fechaMantenimiento: dateString.optional(),
    costo: z.union([nonNegativeNumber, z.null()]).optional(),
    estado: estadoMantenimientoSchema.optional(),
    proximoMantenimiento: z.union([dateString, z.null()]).optional(),
    observaciones: z.union([z.string().trim().max(255, 'observaciones demasiado largas'), z.null()]).optional(),
    rutaImagen: z.union([z.string().trim().max(255, 'rutaImagen demasiado larga'), z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteMaintenanceBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreMaintenanceBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
