import type { AuthUser } from '@/types/auth';

export type AppModuleKey =
  | 'resumen'
  | 'usuarios'
  | 'roles'
  | 'empleados'
  | 'clientes'
  | 'ventas'
  | 'logistica'
  | 'proveedores'
  | 'compras'
  | 'planilla'
  | 'sesiones'
  | 'produccion'
  | 'inventario'
  | 'envases'
  | 'calidad';

export type CrudAction = 'read' | 'create' | 'update' | 'delete';

const ALL_MODULES: AppModuleKey[] = [
  'resumen',
  'usuarios',
  'roles',
  'empleados',
  'clientes',
  'ventas',
  'logistica',
  'proveedores',
  'compras',
  'planilla',
  'sesiones',
  'produccion',
  'inventario',
  'envases',
  'calidad',
];

export const RBAC_PREVIEW_MODE =
  false;

export function getAllowedModulesByRole(user: AuthUser | null | undefined): AppModuleKey[] {
  if (!user) {
    return [];
  }

  if (RBAC_PREVIEW_MODE) {
    return ALL_MODULES;
  }

  return ALL_MODULES.filter((moduleKey) => hasModulePermission(user, moduleKey, 'read'));
}

export function hasModulePermission(
  user: AuthUser | null | undefined,
  moduleKey: AppModuleKey,
  action: CrudAction,
): boolean {
  if (!user) {
    return false;
  }

  if (RBAC_PREVIEW_MODE) {
    return true;
  }

  const granted = user.permisos?.[moduleKey] ?? [];
  return granted.includes(action);
}
