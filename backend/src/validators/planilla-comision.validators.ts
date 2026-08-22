import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const finitePositiveNumber = z
  .number()
  .finite('debe ser un número válido')
  .positive('debe ser mayor a 0');

const tipoCalculoSchema = z.enum(['PORCENTAJE_VENTA', 'MONTO_POR_UNIDAD']);

const optionalBooleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const comisionConfigIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const comisionRuleIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idRegla: z.coerce
    .number()
    .int('idRegla debe ser entero')
    .positive('idRegla debe ser mayor a 0'),
});

export const listComisionConfigsQuerySchema = z.object({
  anulado: optionalBooleanFromQuery,
});

export const createComisionConfigSchema = z.object({
  idUsuario: positiveInt,
  nombre: z
    .string()
    .trim()
    .min(3, 'nombre debe tener al menos 3 caracteres')
    .max(100, 'nombre demasiado largo'),
});

export const updateComisionConfigSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(3, 'nombre debe tener al menos 3 caracteres')
      .max(100, 'nombre demasiado largo')
      .optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteComisionConfigBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreComisionConfigBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const createReglaComisionSchema = z
  .object({
    idInventarioItem: positiveInt,
    cantidadMinima: finitePositiveNumber,
    cantidadMaxima: finitePositiveNumber.optional(),
    tipoCalculo: tipoCalculoSchema.default('PORCENTAJE_VENTA'),
    porcentaje: z
      .number()
      .finite('porcentaje debe ser un número válido')
      .min(0, 'porcentaje debe ser mayor o igual a 0')
      .max(100, 'porcentaje no puede ser mayor a 100'),
    montoPorUnidad: z
      .number()
      .finite('montoPorUnidad debe ser un número válido')
      .positive('montoPorUnidad debe ser mayor a 0')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.cantidadMaxima !== undefined &&
      data.cantidadMaxima < data.cantidadMinima
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cantidadMaxima'],
        message: 'cantidadMaxima debe ser mayor o igual a cantidadMinima',
      });
    }

    if (data.tipoCalculo === 'PORCENTAJE_VENTA' && data.porcentaje <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['porcentaje'],
        message: 'porcentaje debe ser mayor a 0 para PORCENTAJE_VENTA',
      });
    }

    if (data.tipoCalculo === 'MONTO_POR_UNIDAD' && (data.montoPorUnidad ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['montoPorUnidad'],
        message: 'montoPorUnidad debe ser mayor a 0 para MONTO_POR_UNIDAD',
      });
    }
  });

export const updateReglaComisionSchema = z
  .object({
    idInventarioItem: positiveInt.optional(),
    cantidadMinima: finitePositiveNumber.optional(),
    cantidadMaxima: finitePositiveNumber.nullable().optional(),
    tipoCalculo: tipoCalculoSchema.optional(),
    porcentaje: z
      .number()
      .finite('porcentaje debe ser un número válido')
      .min(0, 'porcentaje debe ser mayor o igual a 0')
      .max(100, 'porcentaje no puede ser mayor a 100')
      .optional(),
    montoPorUnidad: z
      .number()
      .finite('montoPorUnidad debe ser un número válido')
      .positive('montoPorUnidad debe ser mayor a 0')
      .nullable()
      .optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine(
    (data) =>
      data.idInventarioItem !== undefined ||
      data.cantidadMinima !== undefined ||
      data.cantidadMaxima !== undefined ||
      data.porcentaje !== undefined ||
      data.montoPorUnidad !== undefined ||
      data.tipoCalculo !== undefined,
    {
      message: 'Debe enviar al menos un campo de la regla para actualizar',
    },
  )
  .superRefine((data, ctx) => {
    if (
      data.cantidadMinima !== undefined &&
      data.cantidadMaxima !== undefined &&
      data.cantidadMaxima !== null &&
      data.cantidadMaxima < data.cantidadMinima
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cantidadMaxima'],
        message: 'cantidadMaxima debe ser mayor o igual a cantidadMinima',
      });
    }
  });

export const deleteReglaComisionBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreReglaComisionBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
