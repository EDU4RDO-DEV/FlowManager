import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rol: { findFirst: vi.fn() },
    moduloSistema: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    accionSistema: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    rolPermiso: { findMany: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import { listRolePermissions } from '../services/role-permission.service';
import { rbacActionKeys, rbacModuleKeys } from '../validators/role-permission.validators';

describe('role permission catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
    prismaMock.rol.findFirst.mockResolvedValue({ Id: 1 });
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
});
