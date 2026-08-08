import { Router } from 'express';

import {
  createAdjustmentController,
  deleteAdjustmentController,
  getAdjustmentByIdController,
  listAdjustmentsController,
  listAnulatedAdjustmentsController,
  restoreAdjustmentController,
} from '../controllers/adjustment.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const adjustmentRouter = Router();

adjustmentRouter.get('/', requireModulePermission('inventario', 'read'), listAdjustmentsController);
adjustmentRouter.get(
  '/anulados',
  requireModulePermission('inventario', 'read'),
  listAnulatedAdjustmentsController,
);
adjustmentRouter.get('/:id', requireModulePermission('inventario', 'read'), getAdjustmentByIdController);
adjustmentRouter.post('/', requireModulePermission('inventario', 'create'), createAdjustmentController);
adjustmentRouter.delete(
  '/:id',
  requireModulePermission('inventario', 'delete'),
  deleteAdjustmentController,
);
adjustmentRouter.patch(
  '/:id/restaurar',
  requireModulePermission('inventario', 'update'),
  restoreAdjustmentController,
);

export default adjustmentRouter;
