import { Router } from 'express';

import {
  createMaintenanceController,
  deleteMaintenanceController,
  getMaintenanceByIdController,
  listAnulatedMaintenancesController,
  listMaintenancesController,
  restoreMaintenanceController,
  updateMaintenanceController,
} from '../controllers/maintenance.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const maintenanceRouter = Router();

maintenanceRouter.get(
  '/mantenimientos',
  requireModulePermission('logistica', 'read'),
  listMaintenancesController,
);
maintenanceRouter.get(
  '/mantenimientos/anulados',
  requireModulePermission('logistica', 'read'),
  listAnulatedMaintenancesController,
);
maintenanceRouter.get(
  '/mantenimientos/:id',
  requireModulePermission('logistica', 'read'),
  getMaintenanceByIdController,
);
maintenanceRouter.post(
  '/mantenimientos',
  requireModulePermission('logistica', 'create'),
  createMaintenanceController,
);
maintenanceRouter.patch(
  '/mantenimientos/:id',
  requireModulePermission('logistica', 'update'),
  updateMaintenanceController,
);
maintenanceRouter.delete(
  '/mantenimientos/:id',
  requireModulePermission('logistica', 'delete'),
  deleteMaintenanceController,
);
maintenanceRouter.patch(
  '/mantenimientos/:id/restaurar',
  requireModulePermission('logistica', 'update'),
  restoreMaintenanceController,
);

export default maintenanceRouter;
