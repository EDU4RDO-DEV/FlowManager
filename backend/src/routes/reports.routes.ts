import { NextFunction, Request, Response, Router } from 'express';

import {
  executeReportController,
  exportReportExcelController,
  exportReportPdfController,
  getCatalogController,
  getCategoryReportsController,
  getReportHistoryController,
} from '../controllers/reports.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { getReportModulePermission, reportExists } from '../services/reports.service';

const reportsRouter = Router();

// Primero exige el permiso base del módulo "reportes"; luego, dinámicamente, el permiso
// de lectura del módulo dueño de los datos (ej. un reporte de Ventas también exige
// ventas:read). Así no se crea un segundo sistema de permisos: se reutiliza por completo
// requireModulePermission + RolPermiso/ModuloSistema/AccionSistema existentes.
function requireReportDataPermission(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);

  if (!reportExists(id)) {
    return res.status(404).json({ ok: false, message: `El reporte "${id}" no existe` });
  }

  const moduloPermiso = getReportModulePermission(id);
  return requireModulePermission(moduloPermiso, 'read')(req, res, next);
}

reportsRouter.get('/catalog', requireModulePermission('reportes', 'read'), getCatalogController);
reportsRouter.get(
  '/catalog/:categoria',
  requireModulePermission('reportes', 'read'),
  getCategoryReportsController,
);
reportsRouter.get('/history', requireModulePermission('reportes', 'read'), getReportHistoryController);

reportsRouter.post(
  '/:id/execute',
  requireModulePermission('reportes', 'read'),
  requireReportDataPermission,
  executeReportController,
);
reportsRouter.post(
  '/:id/export/pdf',
  requireModulePermission('reportes', 'read'),
  requireReportDataPermission,
  exportReportPdfController,
);
reportsRouter.post(
  '/:id/export/excel',
  requireModulePermission('reportes', 'read'),
  requireReportDataPermission,
  exportReportExcelController,
);

export default reportsRouter;
