import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rol: { findFirst: vi.fn() },
    usuario: { findFirst: vi.fn() },
    moduloSistema: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    accionSistema: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    rolPermiso: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import { listRolePermissions, updateRolePermissions } from '../services/role-permission.service';
import { rbacActionKeys, rbacModuleKeys } from '../validators/role-permission.validators';

describe('role permission catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
    prismaMock.rol.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 2 });
    prismaMock.moduloSistema.findFirst.mockImplementation(
      ({ where }: { where: { Clave: string } }) =>
        where.Clave === 'despacho'
          ? null
          : { Id: rbacModuleKeys.indexOf(where.Clave as (typeof rbacModuleKeys)[number]) + 1, Anulado: false },
    );
    prismaMock.moduloSistema.create.mockImplementation(
      ({ data }: { data: { Clave: string; Nombre: string } }) => ({
        Id: rbacModuleKeys.indexOf(data.Clave as (typeof rbacModuleKeys)[number]) + 1,
        ...data,
      }),
    );
    prismaMock.moduloSistema.findMany.mockResolvedValue(
      rbacModuleKeys.map((Clave, index) => ({
        Id: index + 1,
        Clave,
        Nombre: Clave === 'despacho' ? 'Despacho' : Clave,
      })),
    );
    prismaMock.accionSistema.findFirst.mockImplementation(
      ({ where }: { where: { Clave: string } }) => ({
        Id: rbacActionKeys.indexOf(where.Clave as (typeof rbacActionKeys)[number]) + 1,
        Anulado: false,
      }),
    );
    prismaMock.accionSistema.findMany.mockResolvedValue(
      rbacActionKeys.map((Clave, index) => ({ Id: index + 1, Clave, Nombre: Clave })),
    );
    prismaMock.rolPermiso.findMany.mockResolvedValue([]);
  });

  it('creates and exposes Despacho in the role permission matrix', async () => {
    const result = await listRolePermissions(1);
    const dispatchModule = result.modules.find((moduleItem) => moduleItem.moduleKey === 'despacho');

    expect(prismaMock.moduloSistema.create).toHaveBeenCalledWith({
      data: { Clave: 'despacho', Nombre: 'Despacho', Anulado: false },
    });
    expect(dispatchModule?.moduleName).toBe('Despacho');
    expect(dispatchModule?.actions.map((action) => action.action)).toEqual([
      'read',
      'create',
      'update',
      'delete',
    ]);
  });

  it('revokes every active duplicate grant when a permission is disabled', async () => {
    prismaMock.rolPermiso.updateMany.mockResolvedValue({ count: 2 });

    await updateRolePermissions(1, 2, [
      { moduleKey: 'ventas', action: 'create', permitido: false },
    ]);

    expect(prismaMock.rolPermiso.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          IdRol: 1,
          IdModuloSistema: rbacModuleKeys.indexOf('ventas') + 1,
          IdAccionSistema: rbacActionKeys.indexOf('create') + 1,
          Anulado: false,
        },
        data: expect.objectContaining({
          Permitido: false,
          Anulado: true,
          IdUsuarioModificador: 2,
          IdUsuarioAnulador: 2,
        }),
      }),
    );
  });
});
