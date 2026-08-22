import { Router } from 'express';

import {
  closePayrollController,
  deletePayrollController,
  generatePayrollController,
  getPayrollByIdController,
  listPayrollsController,
  previewPayrollController,
  restorePayrollController,
  updatePayrollController,
} from '../controllers/planilla-mensual.controller';
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
  '/mensuales',
  requireModulePermission('planilla', 'read'),
  listPayrollsController,
);
planillaRouter.get(
  '/mensuales/:id',
  requireModulePermission('planilla', 'read'),
  getPayrollByIdController,
);
planillaRouter.post(
  '/mensuales/previsualizar',
  requireModulePermission('planilla', 'read'),
  previewPayrollController,
);
planillaRouter.post(
  '/mensuales/generar',
  requireModulePermission('planilla', 'create'),
  generatePayrollController,
);
planillaRouter.patch(
  '/mensuales/:id',
  requireModulePermission('planilla', 'update'),
  updatePayrollController,
);
planillaRouter.patch(
  '/mensuales/:id/cerrar',
  requireModulePermission('planilla', 'update'),
  closePayrollController,
);
planillaRouter.delete(
  '/mensuales/:id',
  requireModulePermission('planilla', 'delete'),
  deletePayrollController,
);
planillaRouter.patch(
  '/mensuales/:id/restaurar',
  requireModulePermission('planilla', 'update'),
  restorePayrollController,
);

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
