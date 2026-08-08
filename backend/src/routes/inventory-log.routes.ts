import { Router } from 'express';

import {
  listAnulatedInventoryLogController,
  listInventoryLogController,
} from '../controllers/inventory-log.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const inventoryLogRouter = Router();

inventoryLogRouter.get('/', requireModulePermission('inventario', 'read'), listInventoryLogController);
inventoryLogRouter.get(
  '/anulados',
  requireModulePermission('inventario', 'read'),
  listAnulatedInventoryLogController,
);

export default inventoryLogRouter;
