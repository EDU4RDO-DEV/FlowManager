import type { AuthUser } from '@/types/auth';

export type RoleGroup =
  | 'adminGerencia'
  | 'produccion'
  | 'logistica'
  | 'cajeroVendedor'
  | 'inventario'
  | 'sinRol';

export type AppModuleKey =
  | 'resumen'
  | 'usuarios'
  | 'roles'
  | 'empleados'
  | 'clientes'
  | 'proveedores'
  | 'compras'
  | 'sesiones'
  | 'produccion'
  | 'inventario';

export type CrudAction = 'read' | 'create' | 'update' | 'delete';

const ALL_MODULES: AppModuleKey[] = [
  'resumen',
  'usuarios',
  'roles',
  'empleados',
  'clientes',
  'proveedores',
  'compras',
  'sesiones',
  'produccion',
  'inventario',
];

export const RBAC_PREVIEW_MODE =
  process.env.NEXT_PUBLIC_RBAC_PREVIEW_MODE === 'true';

function normalizeRoleName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const roleMap: Record<RoleGroup, string[]> = {
  adminGerencia: ['ADMINISTRADOR / GERENTE', 'ADMINISTRADOR', 'GERENTE'],
  produccion: ['PERSONAL DE PRODUCCION', 'ENCARGADO DE PRODUCCION'],
  logistica: ['PERSONAL DE LOGISTICA / REPARTIDOR', 'REPARTIDOR / LOGISTICA'],
  cajeroVendedor: ['CAJERO / VENDEDOR (PUNTO DE VENTA)', 'CAJERO / VENTAS'],
  inventario: ['ENCARGADO DE INVENTARIO'],
  sinRol: [],
};

const actionMatrix: Record<RoleGroup, Partial<Record<AppModuleKey, readonly CrudAction[]>>> = {
  adminGerencia: {
    usuarios: ['read', 'create', 'update', 'delete'],
    roles: ['read', 'create', 'update', 'delete'],
    empleados: ['read', 'create', 'update', 'delete'],
    clientes: ['read', 'create', 'update', 'delete'],
    proveedores: ['read', 'create', 'update', 'delete'],
    compras: ['read', 'create', 'update', 'delete'],
    sesiones: ['read', 'create', 'update', 'delete'],
    inventario: ['read', 'create', 'update', 'delete'],
    produccion: ['read'],
    resumen: ['read'],
  },
  produccion: {
    empleados: ['read'],
    inventario: ['read'],
    produccion: ['read'],
    resumen: ['read'],
  },
  logistica: {
    clientes: ['read'],
    sesiones: ['read'],
    inventario: ['read'],
    resumen: ['read'],
  },
  cajeroVendedor: {
    clientes: ['read', 'create', 'update'],
    sesiones: ['read'],
    inventario: ['read'],
    resumen: ['read'],
  },
  inventario: {
    proveedores: ['read', 'create', 'update'],
    compras: ['read', 'create', 'update', 'delete'],
    inventario: ['read', 'create', 'update', 'delete'],
    resumen: ['read'],
  },
  sinRol: {
    resumen: ['read'],
  },
};

export function getRoleGroup(nombreRol: string | null | undefined): RoleGroup {
  if (!nombreRol) {
    return 'sinRol';
  }

  const normalized = normalizeRoleName(nombreRol);

  for (const [group, names] of Object.entries(roleMap) as [RoleGroup, string[]][]) {
    if (names.map(normalizeRoleName).includes(normalized)) {
      return group;
    }
  }

  return 'sinRol';
}

function getFallbackPermission(
  nombreRol: string | null | undefined,
  moduleKey: AppModuleKey,
  action: CrudAction,
): boolean {
  const group = getRoleGroup(nombreRol);
  const actions = actionMatrix[group][moduleKey] ?? [];
  return actions.includes(action);
}

export function getAllowedModulesByRole(userOrRole: AuthUser | string | null | undefined): AppModuleKey[] {
  if (RBAC_PREVIEW_MODE) {
    return ALL_MODULES;
  }

  return ALL_MODULES.filter((moduleKey) => hasModulePermission(userOrRole, moduleKey, 'read'));
}

export function hasModulePermission(
  userOrRole: AuthUser | string | null | undefined,
  moduleKey: AppModuleKey,
  action: CrudAction,
): boolean {
  if (RBAC_PREVIEW_MODE) {
    return true;
  }

  if (typeof userOrRole === 'object' && userOrRole !== null) {
    const granted = userOrRole.permisos?.[moduleKey] ?? [];
    if (granted.includes(action)) {
      return true;
    }
    if (userOrRole.permisos) {
      return false;
    }
    return getFallbackPermission(userOrRole.nombreRol, moduleKey, action);
  }

  return getFallbackPermission(userOrRole, moduleKey, action);
}
