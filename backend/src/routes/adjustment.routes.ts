import { Router } from 'express';

import {
  createAdjustmentController,
  deleteAdjustmentController,
  deleteAdjustmentOperationController,
  getAdjustmentByIdController,
  getAdjustmentOperationController,
  listAdjustmentsController,
  listAdjustmentOperationsController,
  listAnulatedAdjustmentsController,
  restoreAdjustmentController,
  restoreAdjustmentOperationController,
} from '../controllers/adjustment.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const adjustmentRouter = Router();

adjustmentRouter.get('/', requireModulePermission('inventario', 'read'), listAdjustmentsController);
adjustmentRouter.get(
  '/operaciones',
  requireModulePermission('inventario', 'read'),
  listAdjustmentOperationsController,
);
adjustmentRouter.get(
  '/operaciones/:numeroAjuste',
  requireModulePermission('inventario', 'read'),
  getAdjustmentOperationController,
);
adjustmentRouter.delete(
  '/operaciones/:numeroAjuste',
  requireModulePermission('inventario', 'delete'),
  deleteAdjustmentOperationController,
);
adjustmentRouter.patch(
  '/operaciones/:numeroAjuste/restaurar',
  requireModulePermission('inventario', 'update'),
  restoreAdjustmentOperationController,
);
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
