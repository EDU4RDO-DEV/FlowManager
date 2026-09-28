import { Router } from 'express';

import {
  createReglaBonificacionController,
  createReglaPrecioClienteController,
  createTipoCreditoController,
  deleteReglaBonificacionController,
  deleteReglaPrecioClienteController,
  deleteTipoCreditoController,
  getReglaBonificacionByIdController,
  getReglaPrecioClienteByIdController,
  getTipoCreditoByIdController,
  listAnulatedReglasBonificacionController,
  listAnulatedReglasPrecioClienteController,
  listAnulatedTiposCreditoController,
  listReglasBonificacionController,
  listReglasPrecioClienteController,
  listTiposCreditoController,
  restoreReglaBonificacionController,
  restoreReglaPrecioClienteController,
  restoreTipoCreditoController,
  updateReglaBonificacionController,
  updateReglaPrecioClienteController,
  updateTipoCreditoController,
} from '../controllers/commercial-rule.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const commercialRuleRouter = Router();

commercialRuleRouter.get('/tipos-credito', requireModulePermission('ventas', 'read'), listTiposCreditoController);
commercialRuleRouter.get(
  '/tipos-credito/anulados',
  requireModulePermission('ventas', 'read'),
  listAnulatedTiposCreditoController,
);
commercialRuleRouter.get(
  '/tipos-credito/:id',
  requireModulePermission('ventas', 'read'),
  getTipoCreditoByIdController,
);
commercialRuleRouter.post(
  '/tipos-credito',
  requireModulePermission('ventas', 'create'),
  createTipoCreditoController,
);
commercialRuleRouter.patch(
  '/tipos-credito/:id',
  requireModulePermission('ventas', 'update'),
  updateTipoCreditoController,
);
commercialRuleRouter.delete(
  '/tipos-credito/:id',
  requireModulePermission('ventas', 'delete'),
  deleteTipoCreditoController,
);
commercialRuleRouter.patch(
  '/tipos-credito/:id/restaurar',
  requireModulePermission('ventas', 'update'),
  restoreTipoCreditoController,
);

commercialRuleRouter.get(
  '/precios-cliente',
  requireModulePermission('ventas', 'read'),
  listReglasPrecioClienteController,
);
commercialRuleRouter.get(
  '/precios-cliente/anulados',
  requireModulePermission('ventas', 'read'),
  listAnulatedReglasPrecioClienteController,
);
commercialRuleRouter.get(
  '/precios-cliente/:id',
  requireModulePermission('ventas', 'read'),
  getReglaPrecioClienteByIdController,
);
commercialRuleRouter.post(
  '/precios-cliente',
  requireModulePermission('ventas', 'create'),
  createReglaPrecioClienteController,
);
commercialRuleRouter.patch(
  '/precios-cliente/:id',
  requireModulePermission('ventas', 'update'),
  updateReglaPrecioClienteController,
);
commercialRuleRouter.delete(
  '/precios-cliente/:id',
  requireModulePermission('ventas', 'delete'),
  deleteReglaPrecioClienteController,
);
commercialRuleRouter.patch(
  '/precios-cliente/:id/restaurar',
  requireModulePermission('ventas', 'update'),
  restoreReglaPrecioClienteController,
);

commercialRuleRouter.get(
  '/bonificaciones',
  requireModulePermission('ventas', 'read'),
  listReglasBonificacionController,
);
commercialRuleRouter.get(
  '/bonificaciones/anulados',
  requireModulePermission('ventas', 'read'),
  listAnulatedReglasBonificacionController,
);
commercialRuleRouter.get(
  '/bonificaciones/:id',
  requireModulePermission('ventas', 'read'),
  getReglaBonificacionByIdController,
);
commercialRuleRouter.post(
  '/bonificaciones',
  requireModulePermission('ventas', 'create'),
  createReglaBonificacionController,
);
commercialRuleRouter.patch(
  '/bonificaciones/:id',
  requireModulePermission('ventas', 'update'),
  updateReglaBonificacionController,
);
commercialRuleRouter.delete(
  '/bonificaciones/:id',
  requireModulePermission('ventas', 'delete'),
  deleteReglaBonificacionController,
);
commercialRuleRouter.patch(
  '/bonificaciones/:id/restaurar',
  requireModulePermission('ventas', 'update'),
  restoreReglaBonificacionController,
);

export default commercialRuleRouter;
