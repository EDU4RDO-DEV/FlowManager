import { z } from 'zod';

export const openCashSessionSchema = z.object({
  saldoInicial: z.number().finite().min(0).max(999999999),
});

export const closeCashSessionSchema = z.object({
  efectivoContado: z.number().finite().min(0).max(999999999),
  observaciones: z.string().trim().max(500).optional(),
});

export const cashSessionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
