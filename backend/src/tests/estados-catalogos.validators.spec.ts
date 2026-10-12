import { describe, expect, it } from 'vitest';

import { createGastoVehiculoSchema, updateGastoVehiculoSchema } from '../validators/logistics.validators';
import { createClientSchema, updateClientSchema } from '../validators/client.validators';
import { createEmployeeSchema } from '../validators/employee.validators';

describe('Fase 12 - homologación estados/catálogos (MetodoPago y Sexo)', () => {
  const baseGasto = {
    idRutaSesion: 1,
    idUsuario: 1,
    descripcion: 'Peaje de ruta',
    monto: 25,
  };

  it('createGastoVehiculoSchema acepta solo los metodos de pago homologados', () => {
    expect(() =>
      createGastoVehiculoSchema.parse({ ...baseGasto, metodoPago: 'EFECTIVO' }),
    ).not.toThrow();

    expect(() =>
      createGastoVehiculoSchema.parse({ ...baseGasto, metodoPago: 'DEPOSITO_LIBRE' }),
    ).toThrowError();
  });

  it('updateGastoVehiculoSchema rechaza metodoPago fuera del catálogo homologado', () => {
    expect(() => updateGastoVehiculoSchema.parse({ metodoPago: 'BITCOIN' })).toThrowError();
    expect(() => updateGastoVehiculoSchema.parse({ metodoPago: 'POS' })).not.toThrow();
  });

  it('createClientSchema restringe entidad.sexo a M o F', () => {
    expect(() =>
      createClientSchema.parse({ idUsuario: 1, entidad: { nombreCompleto: 'Cliente X', sexo: 'M' } }),
    ).not.toThrow();

    expect(() =>
      createClientSchema.parse({ idUsuario: 1, entidad: { nombreCompleto: 'Cliente X', sexo: 'X' } }),
    ).toThrowError();
  });

  it('createClientSchema acepta un tipo de cliente opcional o nulo y valida su identificador', () => {
    const client = { idUsuario: 1, entidad: { nombreCompleto: 'Cliente X' } };

    expect(() => createClientSchema.parse(client)).not.toThrow();
    expect(() => createClientSchema.parse({ ...client, idTipoCliente: null })).not.toThrow();
    expect(() => createClientSchema.parse({ ...client, idTipoCliente: 3 })).not.toThrow();
    expect(() => createClientSchema.parse({ ...client, idTipoCliente: 0 })).toThrowError();
  });

  it('updateClientSchema permite asignar o quitar la clasificación comercial', () => {
    expect(() => updateClientSchema.parse({ idTipoCliente: 4 })).not.toThrow();
    expect(() => updateClientSchema.parse({ idTipoCliente: null })).not.toThrow();
    expect(() => updateClientSchema.parse({ idTipoCliente: -1 })).toThrowError();
  });

  it('createEmployeeSchema restringe entidad.sexo a M o F', () => {
    const base = {
      idUsuario: 1,
      puestoTrabajo: 'Chofer',
      fechaContratacion: '2026-01-01',
      sueldoBase: 3000,
    };

    expect(() =>
      createEmployeeSchema.parse({ ...base, entidad: { nombreCompleto: 'Empleado X', sexo: 'F' } }),
    ).not.toThrow();

    expect(() =>
      createEmployeeSchema.parse({ ...base, entidad: { nombreCompleto: 'Empleado X', sexo: '1' } }),
    ).toThrowError();
  });
});
