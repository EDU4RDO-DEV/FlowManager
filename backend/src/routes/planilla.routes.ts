import { Router } from 'express';

import {
  closePayrollController,
  deletePayrollController,
  generatePayrollController,
  getPayrollByIdController,
  getPayrollPaymentsController,
  getPayrollReceiptController,
  getMyPayrollReceiptController,
  listMyPayrollsController,
  listPayrollsController,
  previewPayrollController,
  restorePayrollController,
  reopenPayrollController,
  updatePayrollController,
  registerPayrollPaymentController,
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
import {
  createEmployeeAdvanceController,
  listEmployeeAdvancesController,
} from '../controllers/employee-advance.controller';
import {
  listCommissionAccrualsController,
  listCommissionReversalRequestsController,
  cancelCommissionReversalRequestController,
  reviewCommissionReversalRequestController,
} from '../controllers/commission-accrual.controller';
import {
  getPayrollPaymentReceiptController,
  uploadPayrollPaymentReceiptController,
} from '../controllers/payroll-payment-receipt.controller';
import { uploadPayrollPaymentReceipt } from '../middlewares/upload.middleware';

const planillaRouter = Router();

planillaRouter.post(
  '/comprobantes',
  requireModulePermission('planilla', 'create'),
  (req, res, next) => uploadPayrollPaymentReceipt.single('file')(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Comprobante inválido',
      });
    }
    next();
  }),
  uploadPayrollPaymentReceiptController,
);
planillaRouter.get(
  '/comprobantes/:fileName',
  requireModulePermission('planilla', 'read'),
  getPayrollPaymentReceiptController,
);
planillaRouter.get(
  '/adelantos',
  requireModulePermission('planilla', 'read'),
  listEmployeeAdvancesController,
);
planillaRouter.post(
  '/adelantos',
  requireModulePermission('planilla', 'create'),
  createEmployeeAdvanceController,
);
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
planillaRouter.get(
  '/mensuales/:id/pagos',
  requireModulePermission('planilla', 'read'),
  getPayrollPaymentsController,
);
planillaRouter.post(
  '/mensuales/:id/pagos',
  requireModulePermission('planilla', 'create'),
  registerPayrollPaymentController,
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
  '/comisiones/devengadas',
  requireModulePermission('planilla', 'read'),
  listCommissionAccrualsController,
);
planillaRouter.get(
  '/comisiones/reversiones',
  requireModulePermission('planilla', 'read'),
  listCommissionReversalRequestsController,
);
planillaRouter.post(
  '/comisiones/reversiones/:id/revisar',
  requireModulePermission('planilla', 'update'),
  reviewCommissionReversalRequestController,
);
planillaRouter.patch(
  '/comisiones/reversiones/:id/anular',
  requireModulePermission('planilla', 'update'),
  cancelCommissionReversalRequestController,
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
