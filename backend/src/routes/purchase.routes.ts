import { Router } from 'express';

import {
  anulatePurchaseController,
  createPurchaseController,
  createPurchaseExpenseController,
  deletePurchaseExpenseController,
  getPurchaseByIdController,
  listPurchaseExpensesController,
  listPurchasesController,
  updatePurchaseExpenseController,
} from '../controllers/purchase.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const purchaseRouter = Router();

purchaseRouter.get('/', requireModulePermission('compras', 'read'), listPurchasesController);
purchaseRouter.get('/:id', requireModulePermission('compras', 'read'), getPurchaseByIdController);
purchaseRouter.post('/', requireModulePermission('compras', 'create'), createPurchaseController);
purchaseRouter.patch(
  '/:id/anular',
  requireModulePermission('compras', 'delete'),
  anulatePurchaseController,
);

purchaseRouter.get(
  '/:id/gastos',
  requireModulePermission('compras', 'read'),
  listPurchaseExpensesController,
);
purchaseRouter.post(
  '/:id/gastos',
  requireModulePermission('compras', 'create'),
  createPurchaseExpenseController,
);
purchaseRouter.patch(
  '/:id/gastos/:idGasto',
  requireModulePermission('compras', 'update'),
  updatePurchaseExpenseController,
);
purchaseRouter.delete(
  '/:id/gastos/:idGasto',
  requireModulePermission('compras', 'delete'),
  deletePurchaseExpenseController,
);

export default purchaseRouter;
