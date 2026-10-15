import { Router } from 'express';

import {
  anulateMovimientoEnvaseController,
  getMovimientoEnvaseByIdController,
  listEnvaseSaldosController,
  listEnvasePhysicalBalancesController,
  listMovimientosEnvaseController,
  registerEnvasePhysicalCountController,
  regularizeEnvasePhysicalCountController,
  registrarDevolucionEnvaseController,
  registrarBajaEnvaseController,
  registrarPerdidaEnvaseController,
  registrarPrestamoEnvaseController,
  reconcileEnvasePhysicalStockController,
  restoreMovimientoEnvaseController,
} from '../controllers/envase.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const envaseRouter = Router();

envaseRouter.get('/movimientos', requireModulePermission('envases', 'read'), listMovimientosEnvaseController);
envaseRouter.get(
  '/movimientos/:id',
  requireModulePermission('envases', 'read'),
  getMovimientoEnvaseByIdController,
);
envaseRouter.get('/saldos', requireModulePermission('envases', 'read'), listEnvaseSaldosController);
envaseRouter.get(
  '/existencias',
  requireModulePermission('envases', 'read'),
  listEnvasePhysicalBalancesController,
);
envaseRouter.post(
  '/existencias/reconciliar',
  requireModulePermission('envases', 'update'),
  reconcileEnvasePhysicalStockController,
);
envaseRouter.post(
  '/existencias/conteo',
  requireModulePermission('envases', 'update'),
  registerEnvasePhysicalCountController,
);
envaseRouter.post(
  '/existencias/regularizar',
  requireModulePermission('envases', 'delete'),
  regularizeEnvasePhysicalCountController,
);
envaseRouter.post(
  '/prestamos',
  requireModulePermission('envases', 'create'),
  registrarPrestamoEnvaseController,
);
envaseRouter.post(
  '/devoluciones',
  requireModulePermission('envases', 'create'),
  registrarDevolucionEnvaseController,
);
envaseRouter.post(
  '/perdidas',
  requireModulePermission('envases', 'delete'),
  registrarPerdidaEnvaseController,
);
envaseRouter.post(
  '/bajas',
  requireModulePermission('envases', 'delete'),
  registrarBajaEnvaseController,
);
envaseRouter.patch(
  '/movimientos/:id/anular',
  requireModulePermission('envases', 'delete'),
  anulateMovimientoEnvaseController,
);
envaseRouter.patch(
  '/movimientos/:id/restaurar',
  requireModulePermission('envases', 'update'),
  restoreMovimientoEnvaseController,
);

export default envaseRouter;
