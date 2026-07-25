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
  | 'clientes'
  | 'proveedores'
  | 'sesiones'
  | 'produccion'
  | 'inventario';

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
  produccion: ['PERSONAL DE PRODUCCION'],
  logistica: ['PERSONAL DE LOGISTICA / REPARTIDOR'],
  cajeroVendedor: ['CAJERO / VENDEDOR (PUNTO DE VENTA)'],
  inventario: ['ENCARGADO DE INVENTARIO'],
  sinRol: [],
};

const moduleByRole: Record<RoleGroup, AppModuleKey[]> = {
  adminGerencia: ['resumen', 'usuarios', 'roles', 'clientes', 'proveedores', 'sesiones', 'produccion', 'inventario'],
  produccion: ['resumen', 'produccion'],
  logistica: ['resumen', 'clientes', 'sesiones'],
  cajeroVendedor: ['resumen', 'clientes', 'sesiones'],
  inventario: ['resumen', 'proveedores', 'inventario'],
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
  const group = getRoleGroup(nombreRol);
  return moduleByRole[group];
}
