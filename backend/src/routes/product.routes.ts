import { Router } from 'express';

import {
  createProductController,
  deleteProductController,
  getProductByIdController,
  listAnulatedProductsController,
  listProductsController,
  restoreProductController,
  uploadProductImageController,
  updateProductController,
} from '../controllers/product.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadProductImage } from '../middlewares/upload.middleware';

const productRouter = Router();

productRouter.get('/', requireModulePermission('inventario', 'read'), listProductsController);
productRouter.get('/anulados', requireModulePermission('inventario', 'read'), listAnulatedProductsController);
productRouter.get('/:id', requireModulePermission('inventario', 'read'), getProductByIdController);
productRouter.post(
  '/upload-image',
  requireModulePermission('inventario', 'create'),
  uploadProductImage.single('file'),
  uploadProductImageController,
);
productRouter.post('/', requireModulePermission('inventario', 'create'), createProductController);
productRouter.patch('/:id', requireModulePermission('inventario', 'update'), updateProductController);
productRouter.delete('/:id', requireModulePermission('inventario', 'delete'), deleteProductController);
productRouter.patch('/:id/restaurar', requireModulePermission('inventario', 'update'), restoreProductController);

export default productRouter;
