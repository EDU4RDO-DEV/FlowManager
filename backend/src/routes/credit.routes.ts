import { Router } from 'express';

import {
  anulateCreditPaymentController,
  createCreditPaymentController,
  getCreditByIdController,
  getCustomerCreditAuthorizationController,
  getCreditsPortfolioController,
  listCreditPaymentsController,
  listCreditsByCustomerController,
  listCreditsController,
} from '../controllers/credit.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { requireAssignedCreditAccess } from '../middlewares/operational-scope.middleware';

const creditRouter = Router();

creditRouter.get('/', requireModulePermission('ventas', 'read'), listCreditsController);
creditRouter.get('/portfolio', requireModulePermission('ventas', 'read'), getCreditsPortfolioController);
creditRouter.get('/customer/:idCliente', requireModulePermission('ventas', 'read'), listCreditsByCustomerController);
creditRouter.get(
  '/customer/:idCliente/authorization',
  requireModulePermission('ventas', 'read'),
  getCustomerCreditAuthorizationController,
);
creditRouter.get('/:id', requireModulePermission('ventas', 'read'), requireAssignedCreditAccess(), getCreditByIdController);
creditRouter.get(
  '/:id/payments',
  requireModulePermission('ventas', 'read'),
  requireAssignedCreditAccess(),
  listCreditPaymentsController,
);
creditRouter.post(
  '/:id/payments',
  requireModulePermission('ventas', 'create'),
  requireAssignedCreditAccess(),
  createCreditPaymentController,
);
creditRouter.patch(
  '/:id/payments/:idPago/anular',
  requireModulePermission('ventas', 'delete'),
  requireAssignedCreditAccess(),
  anulateCreditPaymentController,
);

export default creditRouter;
