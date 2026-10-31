import { describe, expect, it } from 'vitest';

import { getLogisticsEmployeeOptions } from '../../../frontend/lib/logistics-employee-options';
import type { EmployeeDto } from '../../../frontend/types/employees';

function employee(
  id: number,
  idUsuario: number,
  idUsuarioVinculado: number | null,
  nombreCompleto: string,
): EmployeeDto {
  return {
    id,
    idEntidad: 10,
    idUsuario,
    idUsuarioVinculado,
    idConfiguracionComision: null,
    idTipoTrabajador: null,
    tipoTrabajador: null,
    historialSueldos: [],
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
      employee(1, 30, 47, 'Ana'),
      employee(2, 31, null, 'Luis'),
    ]);

    expect(options).toEqual([
      { employeeId: 1, userId: 47, nombre: 'Ana' },
      { employeeId: 2, userId: null, nombre: 'Luis' },
    ]);
  });
});
