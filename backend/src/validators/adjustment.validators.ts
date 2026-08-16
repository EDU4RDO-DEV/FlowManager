import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const finitePositiveNumber = z
  .number()
  .finite('debe ser un número válido')
  .positive('debe ser mayor a 0');

const optionalBooleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const optionalPositiveIntFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'debe ser mayor a 0')
  .optional();

const optionalPageFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'page debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'page debe ser mayor a 0')
  .optional();

const optionalLimitFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'limit debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value >= 1 && value <= 100, 'limit debe estar entre 1 y 100')
  .optional();

export const adjustmentIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listAdjustmentsQuerySchema = z.object({
  page: optionalPageFromQuery,
  limit: optionalLimitFromQuery,
  busqueda: z.string().trim().min(1, 'busqueda no puede ir vacía').max(255).optional(),
  tipoAjuste: z.enum(['ENTRADA', 'SALIDA']).optional(),
  anulado: optionalBooleanFromQuery,
  idInventarioItem: optionalPositiveIntFromQuery,
});

export const createAdjustmentSchema = z.object({
  idUsuario: positiveInt,
  nombreAjuste: z
    .string()
    .trim()
    .min(3, 'nombreAjuste debe tener al menos 3 caracteres')
    .max(100, 'nombreAjuste demasiado largo'),
  observacion: z
    .string()
    .trim()
    .min(10, 'observacion debe tener al menos 10 caracteres para justificar el ajuste')
    .max(255, 'observacion demasiado larga'),
  items: z
    .array(
      z.object({
        idInventarioItem: positiveInt,
        tipoAjuste: z.enum(['ENTRADA', 'SALIDA'], {
          message: 'tipoAjuste debe ser ENTRADA o SALIDA',
        }),
        cantidadAjustada: finitePositiveNumber,
      }),
    )
    .min(1, 'Debes agregar al menos un item al ajuste'),
});

export const deleteAdjustmentBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreAdjustmentBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
