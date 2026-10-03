import { z } from 'zod';

import {
  finitePositiveNumber,
  optionalBooleanFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
  positiveInt,
} from './validation';

const allowedAdjustmentNames = [
  'AJUSTE POR CONTEO',
  'MERMA POR DANIO',
  'MERMA POR VENCIMIENTO',
  'DEVOLUCION A PROVEEDOR',
  'CONSUMO INTERNO',
  'RECLASIFICACION DE INVENTARIO',
] as const;

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
    .refine(
      (value) => allowedAdjustmentNames.includes(value as (typeof allowedAdjustmentNames)[number]),
      'nombreAjuste debe ser uno de los tipos permitidos',
    ),
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
