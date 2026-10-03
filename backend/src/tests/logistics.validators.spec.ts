import { describe, expect, it } from 'vitest';

import { createGastoVehiculoSchema, updateGastoVehiculoSchema } from '../validators/logistics.validators';

describe('logistics.validators - numeroVale (límite INT de SQL Server)', () => {
  const baseGasto = {
    idRutaSesion: 1,
    idUsuario: 1,
    descripcion: 'Peaje de ruta',
    monto: 25,
    metodoPago: 'EFECTIVO' as const,
  };

  it('acepta numeroVale dentro del rango de INT', () => {
    expect(() =>
      createGastoVehiculoSchema.parse({ ...baseGasto, numeroVale: 13515313 }),
    ).not.toThrow();
  });

  it('rechaza numeroVale que excede el máximo de INT de SQL Server', () => {
    expect(() =>
      createGastoVehiculoSchema.parse({ ...baseGasto, numeroVale: 99999999999 }),
    ).toThrowError(/numeroVale excede el máximo permitido/);

    expect(() =>
      updateGastoVehiculoSchema.parse({ numeroVale: 99999999999 }),
    ).toThrowError(/numeroVale excede el máximo permitido/);
  });
});
