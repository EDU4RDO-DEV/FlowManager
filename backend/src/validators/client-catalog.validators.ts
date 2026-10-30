import { z } from 'zod';

import { positiveInt } from './validation';

const dateOnlyString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe tener formato AAAA-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'fecha inválida');

export const tipoClienteIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const createTipoClienteSchema = z.object({
  idUsuario: positiveInt,
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(100, 'nombre demasiado largo'),
  descripcion: z.string().trim().max(255, 'descripcion demasiado larga').optional(),
});

export const updateTipoClienteSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre no puede ir vacío').max(100, 'nombre demasiado largo').optional(),
    descripcion: z.union([z.string().trim().max(255, 'descripcion demasiado larga'), z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteTipoClienteBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreTipoClienteBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const condicionCreditoIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listCondicionesCreditoQuerySchema = z.object({
  idCliente: z.coerce.number().int('idCliente debe ser entero').positive('idCliente debe ser mayor a 0').optional(),
});

export const createCondicionCreditoSchema = z.object({
  idUsuario: positiveInt,
  idCliente: positiveInt,
  idTipoCredito: positiveInt,
  habilitadoCredito: z.boolean().optional(),
  fechaInicioVigencia: dateOnlyString,
  fechaFinVigencia: dateOnlyString.optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
});

export const updateCondicionCreditoSchema = z
  .object({
    idTipoCredito: positiveInt.optional(),
    habilitadoCredito: z.boolean().optional(),
    fechaInicioVigencia: dateOnlyString.optional(),
    fechaFinVigencia: z.union([dateOnlyString, z.null()]).optional(),
    observaciones: z.union([z.string().trim().max(255, 'observaciones demasiado largas'), z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteCondicionCreditoBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreCondicionCreditoBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
