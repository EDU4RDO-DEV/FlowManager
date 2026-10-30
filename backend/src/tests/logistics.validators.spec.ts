import { describe, expect, it } from 'vitest';

import {
  createGastoVehiculoSchema,
  createRutaSesionSchema,
  updateGastoVehiculoSchema,
  updateRutaSesionSchema,
} from '../validators/logistics.validators';

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

// Regresión: idJornada se descartaba silenciosamente porque los schemas de
// creación/edición de RutaSesion no lo declaraban, aunque el servicio sí lo
// soportaba. Esto hacía que asignar/editar la jornada de una sesión "no se
// tomara en cuenta" sin ningún error visible para el usuario.
describe('logistics.validators - RutaSesion.idJornada', () => {
  const baseSesion = {
    idRuta: 1,
    idVehiculo: 1,
    idUsuarioChofer: 1,
    idUsuarioVendedor: 1,
    fechaSesion: '2026-10-30',
  };

  it('createRutaSesionSchema conserva idJornada cuando se envía', () => {
    const result = createRutaSesionSchema.parse({ ...baseSesion, idJornada: 7 });
    expect(result.idJornada).toBe(7);
  });

  it('createRutaSesionSchema permite omitir idJornada', () => {
    const result = createRutaSesionSchema.parse(baseSesion);
    expect(result.idJornada).toBeUndefined();
  });

  it('updateRutaSesionSchema conserva idJornada cuando se envía', () => {
    const result = updateRutaSesionSchema.parse({ idJornada: 9 });
    expect(result.idJornada).toBe(9);
  });

  it('updateRutaSesionSchema permite limpiar idJornada enviando null', () => {
    const result = updateRutaSesionSchema.parse({ idJornada: null });
    expect(result.idJornada).toBeNull();
  });
});

