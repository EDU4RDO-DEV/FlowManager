import { z } from 'zod';

export const paymentIdempotencyKeySchema = z
  .string()
  .trim()
  .min(1, 'El encabezado Idempotency-Key es obligatorio')
  .max(128, 'El encabezado Idempotency-Key no puede superar 128 caracteres');
