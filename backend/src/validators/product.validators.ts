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
  'PRODUCTO_TERMINADO',
  'MATERIA_PRIMA',
  'INSUMO',
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
  esVendible: optionalBooleanFromQuery,
  esFabricable: optionalBooleanFromQuery,
  permitirReceta: optionalBooleanFromQuery,
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
    esVendible: z.boolean().default(false),
    esEnvaseRetornable: z.boolean().default(false),
    esFabricable: z.boolean().default(false),
    permitirReceta: z.boolean().default(false),
    capacidadEnvaseGalones: finitePositiveNumber.optional(),
    rutaImagen: z.string().trim().max(255, 'rutaImagen demasiado larga').optional(),
    idCategoriaComision: positiveInt.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.esVendible) {
      if (data.precioVenta === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'precioVenta es obligatorio para un artículo vendible',
          path: ['precioVenta'],
        });
      } else if (data.precioVenta < data.costoPromedio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'precioVenta debe ser mayor o igual a costoPromedio para un artículo vendible',
          path: ['precioVenta'],
        });
      }
    }
    if (!data.esEnvaseRetornable && data.capacidadEnvaseGalones !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La capacidad solo aplica a un envase físico retornable',
        path: ['capacidadEnvaseGalones'],
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
    esVendible: z.boolean().optional(),
    esEnvaseRetornable: z.boolean().optional(),
    esFabricable: z.boolean().optional(),
    permitirReceta: z.boolean().optional(),
    capacidadEnvaseGalones: finitePositiveNumber.nullable().optional(),
    rutaImagen: z.string().trim().max(255, 'rutaImagen demasiado larga').optional(),
    idCategoriaComision: positiveInt.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.esEnvaseRetornable === false && data.capacidadEnvaseGalones != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La capacidad solo aplica a un envase físico retornable',
        path: ['capacidadEnvaseGalones'],
      });
    }
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe enviar al menos un campo para actualizar',
      });
    }
  });

export const deleteProductBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreProductBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
