import { Router } from 'express';

import {
  createCondicionCreditoController,
  createTipoClienteController,
  deleteCondicionCreditoController,
  deleteTipoClienteController,
  getCondicionCreditoByIdController,
  getTipoClienteByIdController,
  listAnulatedCondicionesCreditoController,
  listAnulatedTiposClienteController,
  listCondicionesCreditoController,
  listTiposClienteController,
  restoreCondicionCreditoController,
  restoreTipoClienteController,
  updateCondicionCreditoController,
  updateTipoClienteController,
} from '../controllers/client-catalog.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const clientCatalogRouter = Router();

clientCatalogRouter.get('/tipos-cliente', requireModulePermission('clientes', 'read'), listTiposClienteController);
clientCatalogRouter.get(
  '/tipos-cliente/anulados',
  requireModulePermission('clientes', 'read'),
  listAnulatedTiposClienteController,
);
clientCatalogRouter.get(
  '/tipos-cliente/:id',
  requireModulePermission('clientes', 'read'),
  getTipoClienteByIdController,
);
clientCatalogRouter.post(
  '/tipos-cliente',
  requireModulePermission('clientes', 'create'),
  createTipoClienteController,
);
clientCatalogRouter.patch(
  '/tipos-cliente/:id',
  requireModulePermission('clientes', 'update'),
  updateTipoClienteController,
);
clientCatalogRouter.delete(
  '/tipos-cliente/:id',
  requireModulePermission('clientes', 'delete'),
  deleteTipoClienteController,
);
clientCatalogRouter.patch(
  '/tipos-cliente/:id/restaurar',
  requireModulePermission('clientes', 'update'),
  restoreTipoClienteController,
);

clientCatalogRouter.get(
  '/condiciones-credito',
  requireModulePermission('clientes', 'read'),
  listCondicionesCreditoController,
);
clientCatalogRouter.get(
  '/condiciones-credito/anulados',
  requireModulePermission('clientes', 'read'),
  listAnulatedCondicionesCreditoController,
);
clientCatalogRouter.get(
  '/condiciones-credito/:id',
  requireModulePermission('clientes', 'read'),
  getCondicionCreditoByIdController,
);
clientCatalogRouter.post(
  '/condiciones-credito',
  requireModulePermission('clientes', 'create'),
  createCondicionCreditoController,
);
clientCatalogRouter.patch(
  '/condiciones-credito/:id',
  requireModulePermission('clientes', 'update'),
  updateCondicionCreditoController,
);
clientCatalogRouter.delete(
  '/condiciones-credito/:id',
  requireModulePermission('clientes', 'delete'),
  deleteCondicionCreditoController,
);
clientCatalogRouter.patch(
  '/condiciones-credito/:id/restaurar',
  requireModulePermission('clientes', 'update'),
  restoreCondicionCreditoController,
);

export default clientCatalogRouter;
