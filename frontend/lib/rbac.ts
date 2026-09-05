import type { AuthUser } from '@/types/auth';

export type AppModuleKey =
  | 'resumen'
  | 'usuarios'
  | 'roles'
  | 'empleados'
  | 'clientes'
  | 'logistica'
  | 'proveedores'
  | 'compras'
  | 'planilla'
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
  'logistica',
  'proveedores',
  'compras',
  'planilla',
  'sesiones',
  'produccion',
  'inventario',
];

export const RBAC_PREVIEW_MODE =
  false;

export function getAllowedModulesByRole(user: AuthUser | null | undefined): AppModuleKey[] {
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

  const granted = user.permisos?.[moduleKey] ?? [];
  return granted.includes(action);
}
