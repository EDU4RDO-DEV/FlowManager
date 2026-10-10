import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  executeReport,
  exportReportExcel,
  exportReportPdf,
  getReportCompanySettings,
  listCatalog,
  listCatalogByCategory,
  ReportNotFoundError,
  updateReportCompanyLogo,
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

export async function getReportCompanySettingsController(_req: Request, res: Response) {
  try {
    const data = await getReportCompanySettings();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'No existe configuración de empresa activa') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function uploadReportCompanyLogoController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    if (!req.file?.buffer || !req.file.originalname) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const data = await updateReportCompanyLogo({
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      declaredMimeType: req.file.mimetype,
      modifiedByUserId: req.auth.userId,
    });

    const host = req.get('host');
    const logoUrl = data.rutaLogo && host ? `${req.protocol}://${host}${data.rutaLogo}` : data.rutaLogo;

    return res.status(200).json({
      ok: true,
      message: 'Logotipo actualizado correctamente',
      data: {
        ...data,
        logoUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'No existe configuración de empresa activa') {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message === 'El archivo no contiene una imagen válida (PNG, JPG o WEBP)' ||
      message === 'El tipo declarado no coincide con el contenido real de la imagen'
    ) {
      return res.status(400).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
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
