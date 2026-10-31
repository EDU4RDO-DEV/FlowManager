import { z } from 'zod';

export const commissionAccrualQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  idEmpleado: z.coerce.number().int().positive().optional(),
});

export const commissionReversalIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const reviewCommissionReversalSchema = z.object({
  decision: z.enum(['APROBAR', 'RECHAZAR']),
  observaciones: z.string().trim().min(3).max(500),
});
