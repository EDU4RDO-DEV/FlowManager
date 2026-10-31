import { describe, expect, it } from 'vitest';

import {
  getRouteSessionVisibilityWhere,
  getSaleVisibilityWhere,
} from '../services/operational-scope.service';

describe('operational record visibility', () => {
  it('limits sellers to their assigned sessions and own or assigned route sales', () => {
    expect(getRouteSessionVisibilityWhere({ userId: 17, roleName: 'Vendedor' })).toEqual({
      OR: [
        { IdUsuarioVendedor: 17 },
        {
          Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
            is: { IdUsuarioVinculado: 17, Anulado: false },
          },
        },
      ],
    });
    expect(getSaleVisibilityWhere({ userId: 17, roleName: 'Vendedor' })).toEqual({
      OR: [
        { IdUsuario: 17 },
        {
          RutaSesion: {
            is: {
              OR: [
                { IdUsuarioVendedor: 17 },
                {
                  Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
                    is: { IdUsuarioVinculado: 17, Anulado: false },
                  },
                },
              ],
            },
          },
        },
        { EmpleadoVendedor: { is: { IdUsuarioVinculado: 17 } } },
      ],
    });
  });

  it('limits drivers to their assigned sessions and their route sales', () => {
    expect(getRouteSessionVisibilityWhere({ userId: 21, roleName: 'Chofer' })).toEqual({
      OR: [
        { IdUsuarioChofer: 21 },
        {
          Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
            is: { IdUsuarioVinculado: 21, Anulado: false },
          },
        },
      ],
    });
    expect(getSaleVisibilityWhere({ userId: 21, roleName: 'Chofer' })).toEqual({
      RutaSesion: {
        is: {
          OR: [
            { IdUsuarioChofer: 21 },
            {
              Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
                is: { IdUsuarioVinculado: 21, Anulado: false },
              },
            },
          ],
        },
      },
    });
  });

  it('leaves broad access decisions to RBAC for other roles', () => {
    expect(getRouteSessionVisibilityWhere({ userId: 1, roleName: 'Administrador' })).toBeUndefined();
    expect(getSaleVisibilityWhere({ userId: 1, roleName: 'Administrador' })).toBeUndefined();
    expect(getSaleVisibilityWhere({ userId: 1, roleName: 'Encargado de Producción' })).toBeUndefined();
  });
});
