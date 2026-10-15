import { Router } from 'express';

import {
  closePayrollController,
  deletePayrollController,
  generatePayrollController,
  getPayrollByIdController,
  getPayrollReceiptController,
  getMyPayrollReceiptController,
  listMyPayrollsController,
  listPayrollsController,
  previewPayrollController,
  restorePayrollController,
  reopenPayrollController,
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
  listCommissionCategoriesController,
  listCategoryCommissionRulesController,
  listReglasComisionAnuladasController,
  listReglasComisionController,
  restoreComisionConfigController,
  restoreReglaComisionController,
  updateComisionConfigController,
  updateReglaComisionController,
  setCategoryCommissionRulesController,
} from '../controllers/planilla-comision.controller';
import { requireAuth, requireModulePermission } from '../middlewares/auth.middleware';

const planillaRouter = Router();

planillaRouter.get('/mis-planillas', requireAuth, listMyPayrollsController);
planillaRouter.get('/mis-planillas/:id/recibo.pdf', requireAuth, getMyPayrollReceiptController);
planillaRouter.get(
  '/mensuales',
  requireModulePermission('planilla', 'read'),
  listPayrollsController,
);
planillaRouter.get(
  '/mensuales/:id/recibo.pdf',
  requireModulePermission('planilla', 'read'),
  getPayrollReceiptController,
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
planillaRouter.patch(
  '/mensuales/:id/reabrir',
  requireModulePermission('planilla', 'update'),
  reopenPayrollController,
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
  '/comisiones/categorias',
  requireModulePermission('planilla', 'read'),
  listCommissionCategoriesController,
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
  '/comisiones/:id/reglas-categoria',
  requireModulePermission('planilla', 'read'),
  listCategoryCommissionRulesController,
);
planillaRouter.put(
  '/comisiones/:id/reglas-categoria',
  requireModulePermission('planilla', 'update'),
  setCategoryCommissionRulesController,
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
