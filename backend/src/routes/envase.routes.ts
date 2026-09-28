import { Router } from 'express';

import {
  anulateMovimientoEnvaseController,
  getMovimientoEnvaseByIdController,
  listEnvaseSaldosController,
  listMovimientosEnvaseController,
  registrarDevolucionEnvaseController,
  registrarPrestamoEnvaseController,
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
