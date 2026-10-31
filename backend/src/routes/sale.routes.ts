import { Router } from 'express';

import {
  anulateSaleController,
  anulateSalePaymentController,
  confirmRouteProformaController,
  createSaleController,
  createSalePaymentController,
  getSaleByIdController,
  listAvailableRutaSesionesController,
  listSalePaymentsController,
  listSalesController,
  pingFelController,
  previewSaleBonusesController,
  resolveFelReceptorController,
  resolveSalePriceController,
  uploadSaleImageController,
  updateSaleController,
} from '../controllers/sale.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadSaleProofImage } from '../middlewares/upload.middleware';
import { createCommercialReturnController } from '../controllers/commercial-return.controller';
import { requireAssignedSaleAccess } from '../middlewares/operational-scope.middleware';

const saleRouter = Router();

saleRouter.post('/fel/ping', requireModulePermission('ventas', 'read'), pingFelController);
saleRouter.get('/fel/receptor', requireModulePermission('ventas', 'read'), resolveFelReceptorController);
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
saleRouter.get('/:id', requireModulePermission('ventas', 'read'), requireAssignedSaleAccess(), getSaleByIdController);
saleRouter.post('/', requireModulePermission('ventas', 'create'), createSaleController);
saleRouter.patch('/:id', requireModulePermission('ventas', 'update'), requireAssignedSaleAccess(), updateSaleController);
saleRouter.post(
  '/:id/confirmar-proforma',
  requireModulePermission('ventas', 'update'),
  requireAssignedSaleAccess(),
  confirmRouteProformaController,
);
saleRouter.post(
  '/:id/devoluciones-comerciales',
  requireModulePermission('ventas', 'update'),
  requireAssignedSaleAccess(),
  createCommercialReturnController,
);
saleRouter.patch(
  '/:id/anular',
  requireModulePermission('ventas', 'delete'),
  requireAssignedSaleAccess(),
  anulateSaleController,
);

saleRouter.get(
  '/:id/pagos',
  requireModulePermission('ventas', 'read'),
  requireAssignedSaleAccess(),
  listSalePaymentsController,
);
saleRouter.post(
  '/:id/pagos',
  requireModulePermission('ventas', 'create'),
  requireAssignedSaleAccess(),
  createSalePaymentController,
);
saleRouter.patch(
  '/:id/pagos/:idPago/anular',
  requireModulePermission('ventas', 'delete'),
  requireAssignedSaleAccess(),
  anulateSalePaymentController,
);

export default saleRouter;
