import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');
const nonNegativeNumber = z.number().finite('debe ser un número válido').nonnegative('debe ser mayor o igual a 0');
const positiveNumber = z.number().finite('debe ser un número válido').positive('debe ser mayor a 0');

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'fecha inválida');

export const tipoCreditoIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listTiposCreditoQuerySchema = z.object({
  activo: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const createTipoCreditoSchema = z.object({
  idUsuario: positiveInt,
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(100, 'nombre demasiado largo'),
  plazoDias: z.number().int('plazoDias debe ser entero').positive('plazoDias debe ser mayor a 0').optional(),
  incrementoPorcentual: nonNegativeNumber.optional(),
  requiereCamion: z.boolean().optional(),
  condiciones: z.string().trim().max(500, 'condiciones demasiado largas').optional(),
  activo: z.boolean().optional(),
});

export const updateTipoCreditoSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre no puede ir vacío').max(100, 'nombre demasiado largo').optional(),
    plazoDias: z.union([z.number().int('plazoDias debe ser entero').positive('plazoDias debe ser mayor a 0'), z.null()]).optional(),
    incrementoPorcentual: z.union([nonNegativeNumber, z.null()]).optional(),
    requiereCamion: z.boolean().optional(),
    condiciones: z.union([z.string().trim().max(500, 'condiciones demasiado largas'), z.null()]).optional(),
    activo: z.boolean().optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteTipoCreditoBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreTipoCreditoBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const reglaPrecioClienteIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listReglasPrecioClienteQuerySchema = z.object({
  idTipoCliente: positiveInt.optional(),
});

export const createReglaPrecioClienteSchema = z.object({
  idUsuario: positiveInt,
  idTipoCliente: positiveInt,
  idInventarioItem: positiveInt,
  precio: positiveNumber,
  fechaInicio: dateString.optional(),
  fechaFin: dateString.optional(),
});

export const updateReglaPrecioClienteSchema = z
  .object({
    precio: positiveNumber.optional(),
    fechaInicio: z.union([dateString, z.null()]).optional(),
    fechaFin: z.union([dateString, z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteReglaPrecioClienteBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreReglaPrecioClienteBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const reglaBonificacionIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listReglasBonificacionQuerySchema = z.object({
  idInventarioItemCompra: positiveInt.optional(),
});

export const createReglaBonificacionSchema = z.object({
  idUsuario: positiveInt,
  nombre: z.string().trim().max(100, 'nombre demasiado largo').optional(),
  idInventarioItemCompra: positiveInt,
  cantidadMinima: positiveNumber,
  cantidadMaxima: positiveNumber.optional(),
  idInventarioItemBonificado: positiveInt,
  cantidadBonificada: positiveNumber,
  prioridad: z.number().int('prioridad debe ser entero').positive('prioridad debe ser mayor a 0').optional(),
  fechaInicio: dateString.optional(),
  fechaFin: dateString.optional(),
});

export const updateReglaBonificacionSchema = z
  .object({
    nombre: z.union([z.string().trim().max(100, 'nombre demasiado largo'), z.null()]).optional(),
    cantidadMinima: positiveNumber.optional(),
    cantidadMaxima: z.union([positiveNumber, z.null()]).optional(),
    cantidadBonificada: positiveNumber.optional(),
    prioridad: z.number().int('prioridad debe ser entero').positive('prioridad debe ser mayor a 0').optional(),
    fechaInicio: z.union([dateString, z.null()]).optional(),
    fechaFin: z.union([dateString, z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteReglaBonificacionBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreReglaBonificacionBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
