import type { AuthUser } from '@/types/auth';

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

export function getAllowedModulesByRole(user: AuthUser | null | undefined): AppModuleKey[] {
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
  if (RBAC_PREVIEW_MODE) {
    return true;
  }

  if (!user) {
    return false;
  }

  const granted = user.permisos?.[moduleKey] ?? [];
  return granted.includes(action);
}
