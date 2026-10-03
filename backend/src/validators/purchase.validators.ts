import { z } from 'zod';

import {
  finitePositiveNumber,
  optionalBooleanFromQuery,
  optionalDateFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
  positiveInt,
} from './validation';

const requiredDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaFactura debe tener formato YYYY-MM-DD');

const detalleCompraItemSchema = z.object({
  idInventarioItem: positiveInt,
  cantidad: finitePositiveNumber,
  costoUnitario: finitePositiveNumber,
});

const detalleGastoItemSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(3, 'descripcion debe tener al menos 3 caracteres')
    .max(255, 'descripcion demasiado larga'),
  cantidad: finitePositiveNumber,
  precioUnitario: finitePositiveNumber,
});

export const purchaseIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const purchaseExpenseIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idGasto: z.coerce.number().int('idGasto debe ser entero').positive('idGasto debe ser mayor a 0'),
});

export const listPurchasesQuerySchema = z
  .object({
    page: optionalPageFromQuery,
    limit: optionalLimitFromQuery,
    busqueda: z.string().trim().min(1, 'busqueda no puede ir vacía').max(255).optional(),
    idProveedor: optionalPositiveIntFromQuery,
    esGasto: optionalBooleanFromQuery,
    anulado: optionalBooleanFromQuery,
    fechaDesde: optionalDateFromQuery,
    fechaHasta: optionalDateFromQuery,
  })
  .refine(
    (data) => {
      if (!data.fechaDesde || !data.fechaHasta) {
        return true;
      }

      return data.fechaDesde <= data.fechaHasta;
    },
    {
      message: 'fechaDesde debe ser menor o igual a fechaHasta',
      path: ['fechaDesde'],
    },
  );

export const createPurchaseSchema = z
  .object({
    idUsuario: positiveInt,
    idProveedor: positiveInt,
    numeroFactura: z
      .string()
      .trim()
      .min(1, 'numeroFactura es obligatorio')
      .max(50, 'numeroFactura demasiado largo'),
    esGasto: z.boolean().default(false),
    observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
    fechaFactura: requiredDateString,
    detalleCompra: z.array(detalleCompraItemSchema).optional(),
    detalleGasto: z.array(detalleGastoItemSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const compraItems = data.detalleCompra ?? [];
    const gastoItems = data.detalleGasto ?? [];

    if (data.esGasto) {
      if (gastoItems.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'detalleGasto es obligatorio cuando esGasto=true',
          path: ['detalleGasto'],
        });
      }

      if (compraItems.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'detalleCompra no debe enviarse cuando esGasto=true',
          path: ['detalleCompra'],
        });
      }

      return;
    }

    if (compraItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'detalleCompra es obligatorio cuando esGasto=false',
        path: ['detalleCompra'],
      });
    }

    if (gastoItems.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'detalleGasto no debe enviarse cuando esGasto=false',
        path: ['detalleGasto'],
      });
    }

    const uniqueIds = new Set<number>();
    for (const [index, item] of compraItems.entries()) {
      if (uniqueIds.has(item.idInventarioItem)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No se permite repetir el mismo inventarioItem en detalleCompra',
          path: ['detalleCompra', index, 'idInventarioItem'],
        });
      }

      uniqueIds.add(item.idInventarioItem);
    }
  });

export const anulatePurchaseBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restorePurchaseBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const createPurchaseExpenseSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(3, 'descripcion debe tener al menos 3 caracteres')
    .max(255, 'descripcion demasiado larga'),
  cantidad: finitePositiveNumber,
  precioUnitario: finitePositiveNumber,
});

export const updatePurchaseExpenseSchema = z
  .object({
    descripcion: z.string().trim().min(3, 'descripcion debe tener al menos 3 caracteres').max(255).optional(),
    cantidad: finitePositiveNumber.optional(),
    precioUnitario: finitePositiveNumber.optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deletePurchaseExpenseBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restorePurchaseExpenseBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
