import { prisma } from '../config/prisma';
import {
  rbacActionKeys,
  rbacModuleKeys,
} from '../validators/role-permission.validators';

type BackendModuleKey = (typeof rbacModuleKeys)[number];
type CrudAction = (typeof rbacActionKeys)[number];

type PermissionInput = {
  moduleKey: BackendModuleKey;
  action: CrudAction;
  permitido: boolean;
};

const MODULE_LABELS: Record<BackendModuleKey, string> = {
  resumen: 'Resumen',
  usuarios: 'Usuarios',
  roles: 'Roles',
  clientes: 'Clientes',
  ventas: 'Ventas',
  logistica: 'Logistica',
  empleados: 'Empleados',
  proveedores: 'Proveedores',
  compras: 'Compras',
  inventario: 'Inventario',
  planilla: 'Planilla',
  sesiones: 'Sesiones',
  produccion: 'Produccion',
};

const ACTION_LABELS: Record<CrudAction, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Anular',
};

async function validateRoleExists(idRol: number) {
  const role = await prisma.rol.findFirst({
    where: { Id: idRol, Anulado: false },
    select: { Id: true },
  });

  if (!role) {
    throw new Error('Rol no existe');
  }
}

async function validateUserExists(idUsuario: number) {
  const user = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }
}

export async function ensureCatalogEntries() {
  await prisma.$transaction(async (tx) => {
    for (const moduleKey of rbacModuleKeys) {
      const existing = await tx.moduloSistema.findFirst({
        where: { Clave: moduleKey },
        select: { Id: true, Anulado: true },
      });

      if (!existing) {
        await tx.moduloSistema.create({
          data: {
            Clave: moduleKey,
            Nombre: MODULE_LABELS[moduleKey],
            Anulado: false,
          },
        });
        continue;
      }

      await tx.moduloSistema.update({
        where: { Id: existing.Id },
        data: {
          Nombre: MODULE_LABELS[moduleKey],
          ...(existing.Anulado
            ? {
                Anulado: false,
                IdUsuarioAnulador: null,
                FechaAnulacion: null,
              }
            : {}),
        },
      });
    }

    for (const actionKey of rbacActionKeys) {
      const existing = await tx.accionSistema.findFirst({
        where: { Clave: actionKey },
        select: { Id: true, Anulado: true },
      });

      if (!existing) {
        await tx.accionSistema.create({
          data: {
            Clave: actionKey,
            Nombre: ACTION_LABELS[actionKey],
            Anulado: false,
          },
        });
        continue;
      }

      await tx.accionSistema.update({
        where: { Id: existing.Id },
        data: {
          Nombre: ACTION_LABELS[actionKey],
          ...(existing.Anulado
            ? {
                Anulado: false,
                IdUsuarioAnulador: null,
                FechaAnulacion: null,
              }
            : {}),
        },
      });
    }
  });
}

export async function listRolePermissions(idRol: number) {
  await validateRoleExists(idRol);
  await ensureCatalogEntries();

  const [modules, actions, granted] = await Promise.all([
    prisma.moduloSistema.findMany({
      where: {
        Clave: { in: [...rbacModuleKeys] },
        Anulado: false,
      },
      select: { Id: true, Clave: true, Nombre: true },
    }),
    prisma.accionSistema.findMany({
      where: {
        Clave: { in: [...rbacActionKeys] },
        Anulado: false,
      },
      select: { Id: true, Clave: true, Nombre: true },
    }),
    prisma.rolPermiso.findMany({
      where: {
        IdRol: idRol,
        Permitido: true,
        Anulado: false,
      },
      select: {
        IdModuloSistema: true,
        IdAccionSistema: true,
      },
    }),
  ]);

  const moduleByKey = new Map(modules.map((item) => [item.Clave, item]));
  const actionByKey = new Map(actions.map((item) => [item.Clave, item]));

  const grantedSet = new Set(granted.map((item) => `${item.IdModuloSistema}:${item.IdAccionSistema}`));

  const orderedActions = rbacActionKeys
    .map((key) => actionByKey.get(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const orderedModules = rbacModuleKeys
    .map((key) => moduleByKey.get(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    roleId: idRol,
    modules: orderedModules.map((moduleItem) => ({
      moduleKey: moduleItem.Clave,
      moduleName: moduleItem.Nombre,
      actions: orderedActions.map((actionItem) => ({
        action: actionItem.Clave,
        actionName: actionItem.Nombre,
        permitido: grantedSet.has(`${moduleItem.Id}:${actionItem.Id}`),
      })),
    })),
  };
}

export async function updateRolePermissions(
  idRol: number,
  idUsuarioModificador: number,
  permissions: PermissionInput[],
) {
  await validateRoleExists(idRol);
  await validateUserExists(idUsuarioModificador);
  await ensureCatalogEntries();

  const deduped = new Map<string, PermissionInput>();
  for (const permission of permissions) {
    deduped.set(`${permission.moduleKey}:${permission.action}`, permission);
  }

  const [modules, actions] = await Promise.all([
    prisma.moduloSistema.findMany({
      where: {
        Clave: { in: [...rbacModuleKeys] },
        Anulado: false,
      },
      select: { Id: true, Clave: true },
    }),
    prisma.accionSistema.findMany({
      where: {
        Clave: { in: [...rbacActionKeys] },
        Anulado: false,
      },
      select: { Id: true, Clave: true },
    }),
  ]);

  const moduleIdByKey = new Map(modules.map((item) => [item.Clave, item.Id]));
  const actionIdByKey = new Map(actions.map((item) => [item.Clave, item.Id]));

  await prisma.$transaction(async (tx) => {
    for (const permission of deduped.values()) {
      const moduleId = moduleIdByKey.get(permission.moduleKey);
      const actionId = actionIdByKey.get(permission.action);

      if (!moduleId || !actionId) {
        throw new Error('Catalogo de modulos/acciones incompleto');
      }

      const existing = await tx.rolPermiso.findFirst({
        where: {
          IdRol: idRol,
          IdModuloSistema: moduleId,
          IdAccionSistema: actionId,
        },
        orderBy: { Id: 'desc' },
        select: {
          Id: true,
          Anulado: true,
          Permitido: true,
        },
      });

      if (permission.permitido) {
        if (!existing) {
          await tx.rolPermiso.create({
            data: {
              IdRol: idRol,
              IdModuloSistema: moduleId,
              IdAccionSistema: actionId,
              Permitido: true,
              IdUsuario: idUsuarioModificador,
              Anulado: false,
            },
          });
          continue;
        }

        await tx.rolPermiso.update({
          where: { Id: existing.Id },
          data: {
            Permitido: true,
            Anulado: false,
            IdUsuarioModificador: idUsuarioModificador,
            FechaModificacion: new Date(),
            IdUsuarioAnulador: null,
            FechaAnulacion: null,
          },
        });

        continue;
      }

      if (!existing || existing.Anulado) {
        continue;
      }

      await tx.rolPermiso.update({
        where: { Id: existing.Id },
        data: {
          Permitido: false,
          Anulado: true,
          IdUsuarioModificador: idUsuarioModificador,
          FechaModificacion: new Date(),
          IdUsuarioAnulador: idUsuarioModificador,
          FechaAnulacion: new Date(),
        },
      });
    }
  });

  return listRolePermissions(idRol);
}
