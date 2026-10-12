import { z } from 'zod';

export const paymentMethodSchema = z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS']);

export const paymentDetailsFields = {
  monto: z
    .number()
    .finite('debe ser un número válido')
    .positive('debe ser mayor a 0')
    .max(99_999_999.99, 'supera el importe máximo permitido')
    .refine(
      (value) => Number.isInteger(Number((value * 100).toFixed(8))),
      'debe tener máximo dos decimales',
    ),
  metodoPago: paymentMethodSchema,
  numeroReferencia: z.string().trim().max(100, 'numeroReferencia demasiado largo').optional(),
  banco: z.string().trim().max(100, 'banco demasiado largo').optional(),
  fechaPago: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaPago inválida').optional(),
  rutaFirma: z.string().trim().max(255, 'rutaFirma demasiado larga').optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
};

export function validatePaymentMethodRequirements(
  data: { metodoPago: z.infer<typeof paymentMethodSchema>; numeroReferencia?: string; banco?: string },
  ctx: z.RefinementCtx,
) {
  if (data.metodoPago === 'TRANSFERENCIA' || data.metodoPago === 'CHEQUE' || data.metodoPago === 'POS') {
    if (!data.numeroReferencia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numeroReferencia es obligatoria para este método de pago',
        path: ['numeroReferencia'],
      });
    }
  }

  if (data.metodoPago === 'TRANSFERENCIA' || data.metodoPago === 'CHEQUE') {
    if (!data.banco) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'banco es obligatorio para este método de pago',
        path: ['banco'],
      });
    }
  }
}

export const paymentIdempotencyKeySchema = z
  .string()
  .trim()
  .min(1, 'El encabezado Idempotency-Key es obligatorio')
  .max(128, 'El encabezado Idempotency-Key no puede superar 128 caracteres');
