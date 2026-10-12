import { describe, expect, it } from 'vitest';

import { paymentIdempotencyKeySchema } from '../validators/payment.validators';
import { createCreditPaymentSchema, listCreditsQuerySchema } from '../validators/credit.validators';
import { createSalePaymentSchema } from '../validators/sale.validators';

describe('paymentIdempotencyKeySchema', () => {
  it('trims a non-empty key and accepts the configured maximum length', () => {
    expect(paymentIdempotencyKeySchema.parse('  request-key  ')).toBe('request-key');
    expect(paymentIdempotencyKeySchema.parse('k'.repeat(128))).toHaveLength(128);
  });

  it('rejects blank and oversized keys', () => {
    expect(paymentIdempotencyKeySchema.safeParse('   ').success).toBe(false);
    expect(paymentIdempotencyKeySchema.safeParse('k'.repeat(129)).success).toBe(false);
  });

  it('applies the same currency precision and range rules to sales and credits', () => {
    const validCreditPayment = {
      idUsuario: 1,
      monto: 1.15,
      metodoPago: 'EFECTIVO',
    };

    expect(createCreditPaymentSchema.safeParse(validCreditPayment).success).toBe(true);
    expect(createSalePaymentSchema.safeParse(validCreditPayment).success).toBe(true);
    expect(createCreditPaymentSchema.safeParse({ ...validCreditPayment, monto: 1.001 }).success).toBe(false);
    expect(createSalePaymentSchema.safeParse({ ...validCreditPayment, monto: 100_000_000 }).success).toBe(false);
  });

  it('validates credit search and date filters, including calendar dates and order', () => {
    expect(listCreditsQuerySchema.safeParse({
      busqueda: 'Cliente 42',
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      estadoPago: 'PARCIAL',
      incluirAnulados: 'true',
    }).success).toBe(true);
    expect(listCreditsQuerySchema.safeParse({ fechaDesde: '2026-02-30' }).success).toBe(false);
    expect(listCreditsQuerySchema.safeParse({
      fechaDesde: '2026-02-01',
      fechaHasta: '2026-01-31',
    }).success).toBe(false);
  });
});
