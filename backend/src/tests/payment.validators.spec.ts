import { describe, expect, it } from 'vitest';

import { paymentIdempotencyKeySchema } from '../validators/payment.validators';

describe('paymentIdempotencyKeySchema', () => {
  it('trims a non-empty key and accepts the configured maximum length', () => {
    expect(paymentIdempotencyKeySchema.parse('  request-key  ')).toBe('request-key');
    expect(paymentIdempotencyKeySchema.parse('k'.repeat(128))).toHaveLength(128);
  });

  it('rejects blank and oversized keys', () => {
    expect(paymentIdempotencyKeySchema.safeParse('   ').success).toBe(false);
    expect(paymentIdempotencyKeySchema.safeParse('k'.repeat(129)).success).toBe(false);
  });
});
