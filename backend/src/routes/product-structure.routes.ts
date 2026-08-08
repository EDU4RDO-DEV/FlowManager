import { Router } from 'express';

import {
  createProductStructureController,
  deleteProductStructureController,
  getStructureByIdController,
  listAnulatedStructureByProductController,
  listStructureByProductController,
  restoreProductStructureController,
  updateProductStructureController,
} from '../controllers/product-structure.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const productStructureRouter = Router();

productStructureRouter.get(
  '/product/:idProducto',
  requireModulePermission('inventario', 'read'),
  listStructureByProductController,
);
productStructureRouter.get(
  '/product/:idProducto/anulados',
  requireModulePermission('inventario', 'read'),
  listAnulatedStructureByProductController,
);
productStructureRouter.get(
  '/:id',
  requireModulePermission('inventario', 'read'),
  getStructureByIdController,
);
productStructureRouter.post(
  '/',
  requireModulePermission('inventario', 'create'),
  createProductStructureController,
);
productStructureRouter.patch(
  '/:id',
  requireModulePermission('inventario', 'update'),
  updateProductStructureController,
);
productStructureRouter.delete(
  '/:id',
  requireModulePermission('inventario', 'delete'),
  deleteProductStructureController,
);
productStructureRouter.patch(
  '/:id/restaurar',
  requireModulePermission('inventario', 'update'),
  restoreProductStructureController,
);

export default productStructureRouter;
