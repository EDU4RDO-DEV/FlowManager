import { z } from 'zod';

import {
  finitePositiveNumber,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  positiveInt,
} from './validation';

export const productionOrderIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listProductionOrdersQuerySchema = z.object({
  page: optionalPageFromQuery,
  limit: optionalLimitFromQuery,
  busqueda: z.string().trim().min(1).max(255).optional(),
  estado: z.enum(['PENDIENTE', 'FABRICADA', 'CANCELADA']).optional(),
});

export const createProductionOrderSchema = z.object({
  idProductoTerminado: positiveInt,
  cantidadProducir: finitePositiveNumber,
});
