import { Router } from 'express';

import {
  createProductController,
  deleteProductController,
  getProductByIdController,
  listProductsController,
  updateProductController,
} from '../controllers/product.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const productRouter = Router();

productRouter.get('/', requireModulePermission('inventario', 'read'), listProductsController);
productRouter.get('/:id', requireModulePermission('inventario', 'read'), getProductByIdController);
productRouter.post('/', requireModulePermission('inventario', 'create'), createProductController);
productRouter.patch('/:id', requireModulePermission('inventario', 'update'), updateProductController);
productRouter.delete('/:id', requireModulePermission('inventario', 'delete'), deleteProductController);

export default productRouter;
