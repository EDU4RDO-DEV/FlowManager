import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'fecha inválida');

const cloroValue = z.number().finite('debe ser un número válido').min(0, 'debe ser mayor o igual a 0');
const phValue = z.number().finite('debe ser un número válido').min(0, 'debe ser mayor o igual a 0').max(14, 'pH debe estar entre 0 y 14');

export const controlCalidadIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listControlCalidadQuerySchema = z.object({
  anio: z.coerce.number().int('anio debe ser entero').min(2000, 'anio inválido').max(9999, 'anio inválido').optional(),
  mes: z.coerce.number().int('mes debe ser entero').min(1, 'mes debe ser >= 1').max(12, 'mes debe ser <= 12').optional(),
  anulado: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const listFechasFaltantesQuerySchema = z.object({
  anio: z.coerce.number().int('anio debe ser entero').min(2000, 'anio inválido').max(9999, 'anio inválido'),
  mes: z.coerce.number().int('mes debe ser entero').min(1, 'mes debe ser >= 1').max(12, 'mes debe ser <= 12'),
});

export const createControlCalidadSchema = z.object({
  idUsuario: positiveInt,
  fecha: dateString,
  diaNoLaborado: z.boolean().optional(),
  cloroAntesFiltrado: cloroValue.optional(),
  cloroDespuesFiltrado: cloroValue.optional(),
  phAntesFiltrado: phValue.optional(),
  phDespuesFiltrado: phValue.optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
});

export const updateControlCalidadSchema = z
  .object({
    diaNoLaborado: z.boolean().optional(),
    cloroAntesFiltrado: z.union([cloroValue, z.null()]).optional(),
    cloroDespuesFiltrado: z.union([cloroValue, z.null()]).optional(),
    phAntesFiltrado: z.union([phValue, z.null()]).optional(),
    phDespuesFiltrado: z.union([phValue, z.null()]).optional(),
    observaciones: z.union([z.string().trim().max(255, 'observaciones demasiado largas'), z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const validateControlCalidadBodySchema = z.object({
  idUsuarioValidador: positiveInt.optional(),
});

export const deleteControlCalidadBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreControlCalidadBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
