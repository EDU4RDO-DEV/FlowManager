import { z } from 'zod';

const positiveInt = z
  .number()
  .int('debe ser entero')
  .positive('debe ser mayor a 0');

const finitePositiveNumber = z
  .number()
  .finite('debe ser un número válido')
  .positive('debe ser mayor a 0');

export const structureIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const productIdParamsSchema = z.object({
  idProducto: z.coerce.number().int('idProducto debe ser entero').positive('idProducto debe ser mayor a 0'),
});

export const listStructureByProductQuerySchema = z.object({
  anulado: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const createProductStructureSchema = z.object({
  idProductoTerminado: positiveInt,
  idMateriaPrima: positiveInt,
  cantidadRequerida: finitePositiveNumber,
});

export const updateProductStructureSchema = z
  .object({
    cantidadRequerida: finitePositiveNumber.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteProductStructureBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreProductStructureBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
