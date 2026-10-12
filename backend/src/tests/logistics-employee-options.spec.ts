import { describe, expect, it } from 'vitest';

import { getLogisticsEmployeeOptions } from '../../../frontend/lib/logistics-employee-options';
import type { EmployeeDto } from '../../../frontend/types/employees';

function employee(
  idUsuario: number,
  idUsuarioVinculado: number | null,
  nombreCompleto: string,
): EmployeeDto {
  return {
    id: 1,
    idEntidad: 10,
    idUsuario,
    idUsuarioVinculado,
    idConfiguracionComision: null,
    puestoTrabajo: 'Chofer',
    descripcionPuesto: null,
    fechaContratacion: '2026-01-01',
    fechaSalida: null,
    sueldoBase: 0,
    fechaRegistro: null,
    idUsuarioModificador: null,
    fechaModificacion: null,
    anulado: false,
    idUsuarioAnulador: null,
    fechaAnulacion: null,
    entidad: {
      id: 10,
      nombreCompleto,
      sexo: null,
      fechaNacimiento: null,
      telefono1: null,
      telefono2: null,
      correoElectronico: null,
      rutaImagen: null,
      nit: null,
      dpi: null,
      anulado: false,
    },
  };
}

describe('logistics employee selector options', () => {
  it('uses the linked employee account and never substitutes the record creator', () => {
    const options = getLogisticsEmployeeOptions([
      employee(30, 47, 'Ana'),
      employee(31, null, 'Luis'),
    ]);

    expect(options).toEqual([{ userId: 47, nombre: 'Ana' }]);
    expect(options).not.toContainEqual({ userId: 30, nombre: 'Ana' });
    expect(options).not.toContainEqual({ userId: 31, nombre: 'Luis' });
  });
});
