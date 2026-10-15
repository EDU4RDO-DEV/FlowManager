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

  it('createClientSchema acepta la autorización de crédito y usa deshabilitado como valor seguro', () => {
    const client = { idUsuario: 1, entidad: { nombreCompleto: 'Cliente X' } };

    expect(createClientSchema.parse(client).habilitadoCredito).toBe(false);
    expect(createClientSchema.parse({ ...client, habilitadoCredito: true }).habilitadoCredito).toBe(true);
    expect(() => createClientSchema.parse({ ...client, habilitadoCredito: 'true' })).toThrowError();
  });

  it('updateClientSchema permite actualizar solo un valor booleano de autorización', () => {
    expect(() => updateClientSchema.parse({ habilitadoCredito: true })).not.toThrow();
    expect(() => updateClientSchema.parse({ habilitadoCredito: false })).not.toThrow();
    expect(() => updateClientSchema.parse({ habilitadoCredito: 'false' })).toThrowError();
  });

  it('createEmployeeSchema restringe entidad.sexo a M o F', () => {
    const base = {
      idUsuario: 1,
      idTipoTrabajador: 1,
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
