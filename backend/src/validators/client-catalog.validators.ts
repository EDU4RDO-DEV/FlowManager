import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'fecha inválida');

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
  fechaInicioVigencia: dateString,
  fechaFinVigencia: dateString.optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
});

export const updateCondicionCreditoSchema = z
  .object({
    idTipoCredito: positiveInt.optional(),
    habilitadoCredito: z.boolean().optional(),
    fechaInicioVigencia: dateString.optional(),
    fechaFinVigencia: z.union([dateString, z.null()]).optional(),
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
