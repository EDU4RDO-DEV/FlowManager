import { z } from 'zod';

import {
  optionalBooleanFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
} from './validation';

export const listInventoryLogQuerySchema = z.object({
  page: optionalPageFromQuery,
  limit: optionalLimitFromQuery,
  busqueda: z.string().trim().min(1, 'busqueda no puede ir vacia').max(255).optional(),
  tipoMovimiento: optionalBooleanFromQuery,
  anulado: optionalBooleanFromQuery,
  idInventarioItem: optionalPositiveIntFromQuery,
});
