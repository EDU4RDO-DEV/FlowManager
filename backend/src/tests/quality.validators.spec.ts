import { describe, expect, it } from 'vitest';

import { createControlCalidadSchema } from '../validators/quality.validators';

describe('createControlCalidadSchema pH range', () => {
  const baseInput = {
    idUsuario: 1,
    fecha: '2026-10-17',
  };

  it('accepts pH values from 1 through 14', () => {
    expect(
      createControlCalidadSchema.safeParse({
        ...baseInput,
        phAntesFiltrado: 1,
        phDespuesFiltrado: 14,
      }).success,
    ).toBe(true);
  });

  it('rejects pH values outside the 1 to 14 range', () => {
    expect(
      createControlCalidadSchema.safeParse({
        ...baseInput,
        phAntesFiltrado: 0.99,
      }).success,
    ).toBe(false);
    expect(
      createControlCalidadSchema.safeParse({
        ...baseInput,
        phDespuesFiltrado: 14.01,
      }).success,
    ).toBe(false);
  });
});
