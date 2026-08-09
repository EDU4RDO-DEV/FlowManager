import { Router } from 'express';

import {
  createComisionConfigController,
  createReglaComisionController,
  deleteComisionConfigController,
  deleteReglaComisionController,
  getComisionConfigByIdController,
  listAnulatedComisionConfigsController,
  listComisionConfigsController,
  listReglasComisionAnuladasController,
  listReglasComisionController,
  restoreComisionConfigController,
  restoreReglaComisionController,
  updateComisionConfigController,
  updateReglaComisionController,
} from '../controllers/planilla-comision.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const planillaRouter = Router();

planillaRouter.get(
  '/comisiones',
  requireModulePermission('planilla', 'read'),
  listComisionConfigsController,
);
planillaRouter.get(
  '/comisiones/anulados',
  requireModulePermission('planilla', 'read'),
  listAnulatedComisionConfigsController,
);
planillaRouter.get(
  '/comisiones/:id',
  requireModulePermission('planilla', 'read'),
  getComisionConfigByIdController,
);
planillaRouter.post(
  '/comisiones',
  requireModulePermission('planilla', 'create'),
  createComisionConfigController,
);
planillaRouter.patch(
  '/comisiones/:id',
  requireModulePermission('planilla', 'update'),
  updateComisionConfigController,
);
planillaRouter.delete(
  '/comisiones/:id',
  requireModulePermission('planilla', 'delete'),
  deleteComisionConfigController,
);
planillaRouter.patch(
  '/comisiones/:id/restaurar',
  requireModulePermission('planilla', 'update'),
  restoreComisionConfigController,
);

planillaRouter.get(
  '/comisiones/:id/reglas',
  requireModulePermission('planilla', 'read'),
  listReglasComisionController,
);
planillaRouter.get(
  '/comisiones/:id/reglas/anuladas',
  requireModulePermission('planilla', 'read'),
  listReglasComisionAnuladasController,
);
planillaRouter.post(
  '/comisiones/:id/reglas',
  requireModulePermission('planilla', 'create'),
  createReglaComisionController,
);
planillaRouter.patch(
  '/comisiones/:id/reglas/:idRegla',
  requireModulePermission('planilla', 'update'),
  updateReglaComisionController,
);
planillaRouter.delete(
  '/comisiones/:id/reglas/:idRegla',
  requireModulePermission('planilla', 'delete'),
  deleteReglaComisionController,
);
planillaRouter.patch(
  '/comisiones/:id/reglas/:idRegla/restaurar',
  requireModulePermission('planilla', 'update'),
  restoreReglaComisionController,
);

export default planillaRouter;
