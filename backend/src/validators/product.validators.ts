import { z } from 'zod';

import {
  finitePositiveNumber,
  optionalBooleanFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
  positiveInt,
} from './validation';

const allowedCategories = [
  'ENVASE',
  'INSUMO',
  'PRODUCTO_TERMINADO',
  'MATERIA_PRIMA',
] as const;

const categorySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => (allowedCategories as readonly string[]).includes(value), {
    message: `categoria inválida. Valores permitidos: ${allowedCategories.join(', ')}`,
  });

export const productIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listProductsQuerySchema = z.object({
  page: optionalPageFromQuery,
  limit: optionalLimitFromQuery,
  busqueda: z.string().trim().min(1, 'busqueda no puede ir vacía').max(255).optional(),
  categoria: categorySchema.optional(),
  anulado: optionalBooleanFromQuery,
  idProveedor: optionalPositiveIntFromQuery,
});

export const createProductSchema = z
  .object({
    idUsuario: positiveInt,
    idProveedor: positiveInt,
    nombre: z.string().trim().min(1, 'nombre es obligatorio').max(255, 'nombre demasiado largo'),
    categoria: categorySchema,
    unidadMedida: z.string().trim().min(1).max(30).optional(),
    costoPromedio: finitePositiveNumber,
    precioVenta: finitePositiveNumber.optional(),
    rutaImagen: z.string().trim().max(255, 'rutaImagen demasiado larga').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.categoria !== 'PRODUCTO_TERMINADO') {
      return;
    }

    if (data.precioVenta === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'precioVenta es obligatorio para PRODUCTO_TERMINADO',
        path: ['precioVenta'],
      });
      return;
    }

    if (data.precioVenta < data.costoPromedio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'precioVenta debe ser mayor o igual a costoPromedio para PRODUCTO_TERMINADO',
        path: ['precioVenta'],
      });
    }
  });

export const updateProductSchema = z
  .object({
    idUsuario: positiveInt.optional(),
    idUsuarioModificador: positiveInt.optional(),
    idProveedor: positiveInt.optional(),
    nombre: z.string().trim().min(1, 'nombre no puede ir vacío').max(255, 'nombre demasiado largo').optional(),
    categoria: categorySchema.optional(),
    unidadMedida: z.union([z.string().trim().min(1).max(30), z.null()]).optional(),
    costoPromedio: finitePositiveNumber.optional(),
    precioVenta: finitePositiveNumber.optional(),
    rutaImagen: z.string().trim().max(255, 'rutaImagen demasiado larga').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteProductBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreProductBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
