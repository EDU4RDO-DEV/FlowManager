import { z } from 'zod';

export const payrollPaymentIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const payrollPaymentBodySchema = z.object({
  monto: z.number().finite().positive().max(99999999),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']),
  numeroReferencia: z.string().trim().max(100).optional(),
  banco: z.string().trim().max(100).optional(),
  fechaPago: z.string().datetime({ offset: true }).optional(),
  rutaComprobante: z.string().trim().max(255).optional(),
  observaciones: z.string().trim().max(255).optional(),
}).superRefine((value, context) => {
  if (value.metodoPago === 'TRANSFERENCIA' && !value.numeroReferencia) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['numeroReferencia'],
      message: 'La referencia es obligatoria para pagos por transferencia',
    });
  }
});
