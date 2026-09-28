import { Router } from 'express';

import {
  anulateCreditPaymentController,
  createCreditPaymentController,
  getCreditByIdController,
  getCreditsPortfolioController,
  listCreditPaymentsController,
  listCreditsByCustomerController,
  listCreditsController,
} from '../controllers/credit.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const creditRouter = Router();

creditRouter.get('/', requireModulePermission('ventas', 'read'), listCreditsController);
creditRouter.get('/portfolio', requireModulePermission('ventas', 'read'), getCreditsPortfolioController);
creditRouter.get('/customer/:idCliente', requireModulePermission('ventas', 'read'), listCreditsByCustomerController);
creditRouter.get('/:id', requireModulePermission('ventas', 'read'), getCreditByIdController);
creditRouter.get('/:id/payments', requireModulePermission('ventas', 'read'), listCreditPaymentsController);
creditRouter.post('/:id/payments', requireModulePermission('ventas', 'create'), createCreditPaymentController);
creditRouter.patch(
  '/:id/payments/:idPago/anular',
  requireModulePermission('ventas', 'delete'),
  anulateCreditPaymentController,
);

export default creditRouter;
