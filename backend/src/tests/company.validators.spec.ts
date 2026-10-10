import { describe, expect, it } from 'vitest';

import { updateCompanySettingsSchema } from '../validators/company.validators';

const validSettings = {
  nit: '1234567-8',
  nombre: 'Industrias Basan, S.A.',
  nombreComercial: 'Basan',
  direccion: 'Zona 1, Guatemala',
  telefono1: '5555-5555',
  telefono2: null,
  correoElectronico: 'info@example.com',
  frase: 'Calidad y servicio',
  fechaInicioFel: '2026-01-01',
  fechaFinFel: null,
  regimenIsr: 'General',
};

describe('updateCompanySettingsSchema', () => {
  it('accepts valid company details and nullable optional fields', () => {
    expect(updateCompanySettingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it('converts an empty email to null', () => {
    expect(updateCompanySettingsSchema.parse({ ...validSettings, correoElectronico: '' }).correoElectronico)
      .toBeNull();
  });

  it('rejects invalid dates, malformed email, and FEL credentials', () => {
    expect(updateCompanySettingsSchema.safeParse({ ...validSettings, fechaInicioFel: '2026-02-31' }).success)
      .toBe(false);
    expect(updateCompanySettingsSchema.safeParse({ ...validSettings, correoElectronico: 'not-an-email' }).success)
      .toBe(false);
    expect(updateCompanySettingsSchema.safeParse({ ...validSettings, UsuarioFel: 'must-not-be-saved' }).success)
      .toBe(false);
  });
});
