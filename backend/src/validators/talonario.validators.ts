import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

export const talonarioIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const createTalonarioSchema = z
  .object({
    idUsuario: positiveInt,
    nombre: z.string().trim().min(1, 'nombre es obligatorio').max(100, 'nombre demasiado largo'),
    correlativoInicial: positiveInt,
    correlativoFinal: positiveInt,
    ultimoUtilizado: positiveInt.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.correlativoInicial >= data.correlativoFinal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correlativoInicial debe ser menor que correlativoFinal',
        path: ['correlativoInicial'],
      });
    }

    if (data.ultimoUtilizado !== undefined) {
      if (data.ultimoUtilizado < data.correlativoInicial - 1 || data.ultimoUtilizado > data.correlativoFinal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ultimoUtilizado debe estar dentro del rango del talonario',
          path: ['ultimoUtilizado'],
        });
      }
    }
  });

export const updateTalonarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre no puede ir vacío').max(100, 'nombre demasiado largo').optional(),
    correlativoInicial: positiveInt.optional(),
    correlativoFinal: positiveInt.optional(),
    ultimoUtilizado: positiveInt.optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const anulateTalonarioBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreTalonarioBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
