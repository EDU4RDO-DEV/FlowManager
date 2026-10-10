import { describe, expect, it } from 'vitest';

import { dashboardQuerySchema } from '../validators/dashboard.validators';

describe('dashboardQuerySchema', () => {
  it('accepts an ordered date range of up to 366 calendar days', () => {
    expect(
      dashboardQuerySchema.safeParse({
        fechaInicio: '2025-01-01',
        fechaFin: '2026-01-01',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid dates, reversed ranges, and ranges longer than 366 days', () => {
    expect(
      dashboardQuerySchema.safeParse({
        fechaInicio: '2025-02-29',
        fechaFin: '2025-03-01',
      }).success,
    ).toBe(false);
    expect(
      dashboardQuerySchema.safeParse({
        fechaInicio: '2025-03-02',
        fechaFin: '2025-03-01',
      }).success,
    ).toBe(false);
    expect(
      dashboardQuerySchema.safeParse({
        fechaInicio: '2025-01-01',
        fechaFin: '2026-01-02',
      }).success,
    ).toBe(false);
  });
});
