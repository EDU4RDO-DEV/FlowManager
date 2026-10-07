import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  executeReport,
  exportReportExcel,
  exportReportPdf,
  listCatalog,
  listCatalogByCategory,
  ReportNotFoundError,
} from '../services/reports.service';
import { listReportHistory } from '../modules/reports/history.service';
import {
  executeReportBodySchema,
  reportCategoryParamsSchema,
  reportHistoryQuerySchema,
  reportIdParamsSchema,
} from '../validators/reports.validators';
import { getZodErrorMessage } from '../validators/validation';

function resolveGeneratedByName(req: Request): string {
  return req.auth?.nombre || req.auth?.correo || 'Usuario del sistema';
}

export async function getCatalogController(_req: Request, res: Response) {
  return res.status(200).json({ ok: true, data: listCatalog() });
}

export async function getCategoryReportsController(req: Request, res: Response) {
  try {
    const { categoria } = reportCategoryParamsSchema.parse(req.params);
    return res.status(200).json({ ok: true, data: listCatalogByCategory(categoria) });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function executeReportController(req: Request, res: Response) {
  try {
    const { id } = reportIdParamsSchema.parse(req.params);
    const { params } = executeReportBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    const data = await executeReport(id, params, { idUsuario: req.auth.userId });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    if (error instanceof ReportNotFoundError) {
      return res.status(404).json({ ok: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function exportReportPdfController(req: Request, res: Response) {
  try {
    const { id } = reportIdParamsSchema.parse(req.params);
    const { params } = executeReportBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    await exportReportPdf(id, params, { idUsuario: req.auth.userId, generatedByName: resolveGeneratedByName(req) }, res);
    return undefined;
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    if (error instanceof ReportNotFoundError) {
      return res.status(404).json({ ok: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function exportReportExcelController(req: Request, res: Response) {
  try {
    const { id } = reportIdParamsSchema.parse(req.params);
    const { params } = executeReportBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    await exportReportExcel(id, params, { idUsuario: req.auth.userId, generatedByName: resolveGeneratedByName(req) }, res);
    return undefined;
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    if (error instanceof ReportNotFoundError) {
      return res.status(404).json({ ok: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getReportHistoryController(req: Request, res: Response) {
  try {
    const query = reportHistoryQuerySchema.parse(req.query);
    const data = await listReportHistory(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}
