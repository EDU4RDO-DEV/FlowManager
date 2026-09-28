import { prisma } from '../src/config/prisma';
import { ensureCatalogEntries } from '../src/services/role-permission.service';
import { rbacActionKeys, rbacModuleKeys } from '../src/validators/role-permission.validators';

type ModuleKey = (typeof rbacModuleKeys)[number];
type ActionKey = (typeof rbacActionKeys)[number];

const ALL_MODULES = [...rbacModuleKeys] as ModuleKey[];
const ALL_ACTIONS = [...rbacActionKeys] as ActionKey[];

// Los 5 roles oficiales del sistema (Fase 2). No crear roles adicionales.
const ROLE_ORDER = [
  'Administrador',
  'Vendedor',
  'Chofer',
  'Encargado de Producción',
  'Auxiliar de Planta',
] as const;

// Matriz Rol -> Módulo -> Acciones permitidas. Administrador se calcula aparte (acceso total).
const ROLE_PERMISSIONS: Record<Exclude<(typeof ROLE_ORDER)[number], 'Administrador'>, Partial<Record<ModuleKey, ActionKey[]>>> = {
  Vendedor: {
    resumen: ['read'],
    clientes: ['read', 'create', 'update', 'delete'],
    ventas: ['read', 'create', 'update', 'delete'],
    inventario: ['read'],
    logistica: ['read', 'create', 'update'],
    envases: ['read', 'create'],
  },
  Chofer: {
    resumen: ['read'],
    logistica: ['read', 'create', 'update'],
    envases: ['read', 'create'],
  },
  'Encargado de Producción': {
    resumen: ['read'],
    produccion: ['read', 'create', 'update', 'delete'],
    inventario: ['read'],
  },
  'Auxiliar de Planta': {
    resumen: ['read'],
    produccion: ['read'],
    inventario: ['read'],
  },
};

function permissionsForRole(nombre: (typeof ROLE_ORDER)[number]): Partial<Record<ModuleKey, ActionKey[]>> {
  if (nombre === 'Administrador') {
    return Object.fromEntries(ALL_MODULES.map((moduleKey) => [moduleKey, [...ALL_ACTIONS]]));
  }

  return ROLE_PERMISSIONS[nombre];
}

async function main() {
  const creator = await prisma.usuario.findFirst({
    where: { Anulado: false },
    orderBy: { Id: 'asc' },
    select: { Id: true, IdRol: true },
  });

  if (!creator) {
    throw new Error(
      'No existe ningún usuario activo. Registra el primer usuario (POST /api/auth/register) antes de ejecutar el seed de roles.',
    );
  }

  await ensureCatalogEntries();

  const [modules, actions] = await Promise.all([
    prisma.moduloSistema.findMany({
      where: { Clave: { in: ALL_MODULES }, Anulado: false },
      select: { Id: true, Clave: true },
    }),
    prisma.accionSistema.findMany({
      where: { Clave: { in: ALL_ACTIONS }, Anulado: false },
      select: { Id: true, Clave: true },
    }),
  ]);

  const moduleIdByKey = new Map(modules.map((item) => [item.Clave as ModuleKey, item.Id]));
  const actionIdByKey = new Map(actions.map((item) => [item.Clave as ActionKey, item.Id]));

  const roleIdByName = new Map<string, number>();

  for (const nombre of ROLE_ORDER) {
    const existing = await prisma.rol.findFirst({
      where: { Nombre: nombre },
      select: { Id: true, Anulado: true },
    });

    if (!existing) {
      const created = await prisma.rol.create({
        data: {
          IdUsuario: creator.Id,
          Nombre: nombre,
          Descripcion: `Rol oficial: ${nombre}`,
          Anulado: false,
        },
        select: { Id: true },
      });
      roleIdByName.set(nombre, created.Id);
      continue;
    }

    if (existing.Anulado) {
      await prisma.rol.update({
        where: { Id: existing.Id },
        data: { Anulado: false, IdUsuarioAnulador: null, FechaAnulacion: null },
      });
    }

    roleIdByName.set(nombre, existing.Id);
  }

  for (const nombre of ROLE_ORDER) {
    const idRol = roleIdByName.get(nombre);
    if (!idRol) {
      continue;
    }

    const granted = permissionsForRole(nombre);

    for (const moduleKey of ALL_MODULES) {
      const idModuloSistema = moduleIdByKey.get(moduleKey);
      if (!idModuloSistema) {
        continue;
      }

      for (const actionKey of ALL_ACTIONS) {
        const idAccionSistema = actionIdByKey.get(actionKey);
        if (!idAccionSistema) {
          continue;
        }

        const permitido = Boolean(granted[moduleKey]?.includes(actionKey));

        const existingPermiso = await prisma.rolPermiso.findFirst({
          where: { IdRol: idRol, IdModuloSistema: idModuloSistema, IdAccionSistema: idAccionSistema },
          select: { Id: true },
        });

        if (existingPermiso) {
          await prisma.rolPermiso.update({
            where: { Id: existingPermiso.Id },
            data: {
              Permitido: permitido,
              Anulado: false,
              IdUsuarioModificador: creator.Id,
              FechaModificacion: new Date(),
            },
          });
        } else {
          await prisma.rolPermiso.create({
            data: {
              IdRol: idRol,
              IdModuloSistema: idModuloSistema,
              IdAccionSistema: idAccionSistema,
              Permitido: permitido,
              IdUsuario: creator.Id,
              Anulado: false,
            },
          });
        }
      }
    }
  }

  if (!creator.IdRol) {
    const adminId = roleIdByName.get('Administrador');
    if (adminId) {
      await prisma.usuario.update({
        where: { Id: creator.Id },
        data: { IdRol: adminId },
      });
    }
  }

  console.log('Seed de roles y permisos completado.');
  console.log(
    Object.fromEntries(
      ROLE_ORDER.map((nombre) => [nombre, roleIdByName.get(nombre)]),
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
