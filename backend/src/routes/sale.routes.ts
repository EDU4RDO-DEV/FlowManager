import { Router } from 'express';

import {
  anulateSaleController,
  anulateSalePaymentController,
  createSaleController,
  createSalePaymentController,
  getSaleByIdController,
  listAvailableRutaSesionesController,
  listSalePaymentsController,
  listSalesController,
  pingFelController,
  previewSaleBonusesController,
  resolveSalePriceController,
  uploadSaleImageController,
  updateSaleController,
} from '../controllers/sale.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadSaleProofImage } from '../middlewares/upload.middleware';

const saleRouter = Router();

saleRouter.post('/fel/ping', requireModulePermission('ventas', 'read'), pingFelController);
saleRouter.post(
  '/upload-image',
  requireModulePermission('ventas', 'read'),
  uploadSaleProofImage.single('file'),
  uploadSaleImageController,
);
saleRouter.get('/precio', requireModulePermission('ventas', 'read'), resolveSalePriceController);
saleRouter.post('/bonificaciones/preview', requireModulePermission('ventas', 'read'), previewSaleBonusesController);
saleRouter.get(
  '/rutas-sesiones',
  requireModulePermission('ventas', 'read'),
  listAvailableRutaSesionesController,
);
saleRouter.get('/', requireModulePermission('ventas', 'read'), listSalesController);
saleRouter.get('/:id', requireModulePermission('ventas', 'read'), getSaleByIdController);
saleRouter.post('/', requireModulePermission('ventas', 'create'), createSaleController);
saleRouter.patch('/:id', requireModulePermission('ventas', 'update'), updateSaleController);
saleRouter.patch('/:id/anular', requireModulePermission('ventas', 'delete'), anulateSaleController);

saleRouter.get('/:id/pagos', requireModulePermission('ventas', 'read'), listSalePaymentsController);
saleRouter.post('/:id/pagos', requireModulePermission('ventas', 'create'), createSalePaymentController);
saleRouter.patch(
  '/:id/pagos/:idPago/anular',
  requireModulePermission('ventas', 'delete'),
  anulateSalePaymentController,
);

export default saleRouter;
