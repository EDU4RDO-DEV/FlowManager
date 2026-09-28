import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const optionalPageFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'page debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'page debe ser mayor a 0')
  .optional();

const optionalLimitFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'limit debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value >= 1 && value <= 100, 'limit debe estar entre 1 y 100')
  .optional();

const optionalPositiveIntFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'debe ser mayor a 0')
  .optional();

const optionalBooleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const paymentMethodSchema = z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS']);

const creditPaymentSchema = z
  .object({
    idUsuario: positiveInt,
    monto: z.number().finite('debe ser un número válido').positive('debe ser mayor a 0'),
    metodoPago: paymentMethodSchema,
    numeroReferencia: z.string().trim().max(100, 'numeroReferencia demasiado largo').optional(),
    banco: z.string().trim().max(100, 'banco demasiado largo').optional(),
    fechaPago: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaPago inválida').optional(),
    rutaFirma: z.string().trim().max(255, 'rutaFirma demasiado larga').optional(),
    observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
  })
  .superRefine((data, ctx) => {
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
  });

export const creditIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const creditPaymentIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idPago: z.coerce.number().int('idPago debe ser entero').positive('idPago debe ser mayor a 0'),
});

export const customerIdParamsSchema = z.object({
  idCliente: z.coerce.number().int('idCliente debe ser entero').positive('idCliente debe ser mayor a 0'),
});

export const listCreditsQuerySchema = z.object({
  page: optionalPageFromQuery,
  limit: optionalLimitFromQuery,
  idCliente: optionalPositiveIntFromQuery,
  estado: z.enum(['ACTIVO', 'PAGADO', 'ANULADO']).optional(),
  anulado: optionalBooleanFromQuery,
});

export const createCreditPaymentSchema = creditPaymentSchema;

export const anulateCreditPaymentBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});
