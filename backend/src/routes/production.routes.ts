import { Router } from 'express';

import {
  cancelProductionOrderController,
  confirmProductionOrderController,
  createProductionOrderController,
  getProductionOrderController,
  listProductionOrdersController,
  listProductionRecipesController,
} from '../controllers/production.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const productionRouter = Router();

productionRouter.get('/recipes', requireModulePermission('produccion', 'read'), listProductionRecipesController);
productionRouter.get('/orders', requireModulePermission('produccion', 'read'), listProductionOrdersController);
productionRouter.get('/orders/:id', requireModulePermission('produccion', 'read'), getProductionOrderController);
productionRouter.post('/orders', requireModulePermission('produccion', 'create'), createProductionOrderController);
productionRouter.post(
  '/orders/:id/confirm',
  requireModulePermission('produccion', 'update'),
  confirmProductionOrderController,
);
productionRouter.patch(
  '/orders/:id/cancel',
  requireModulePermission('produccion', 'delete'),
  cancelProductionOrderController,
);

export default productionRouter;
