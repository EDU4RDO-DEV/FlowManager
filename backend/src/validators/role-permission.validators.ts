import { z } from 'zod';

import { positiveInt } from './validation';

export const rbacModuleKeys = [
  'resumen',
  'usuarios',
  'roles',
  'clientes',
  'ventas',
  'logistica',
  'empleados',
  'proveedores',
  'compras',
  'inventario',
  'planilla',
  'sesiones',
  'produccion',
  'envases',
  'calidad',
  'reportes',
] as const;

export const rbacActionKeys = ['read', 'create', 'update', 'delete'] as const;

export const roleIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const rolePermissionEntrySchema = z.object({
  moduleKey: z.enum(rbacModuleKeys),
  action: z.enum(rbacActionKeys),
  permitido: z.boolean(),
});

export const updateRolePermissionsSchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
  permissions: z.array(rolePermissionEntrySchema).min(1, 'permissions debe incluir al menos un permiso'),
});
