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

const moduleByRole: Record<RoleGroup, AppModuleKey[]> = {
  adminGerencia: ['resumen', 'usuarios', 'roles', 'empleados', 'clientes', 'proveedores', 'compras', 'sesiones', 'produccion', 'inventario'],
  produccion: ['resumen', 'empleados', 'produccion'],
  logistica: ['resumen', 'clientes', 'sesiones'],
  cajeroVendedor: ['resumen', 'clientes', 'sesiones'],
  inventario: ['resumen', 'proveedores', 'compras', 'inventario'],
  sinRol: ['resumen'],
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

export function getAllowedModulesByRole(nombreRol: string | null | undefined): AppModuleKey[] {
  if (RBAC_PREVIEW_MODE) {
    return ALL_MODULES;
  }

  const group = getRoleGroup(nombreRol);
  return moduleByRole[group];
}
