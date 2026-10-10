import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

import { prisma } from '../config/prisma';
import { getAllReportDefinitions, getCatalog, getCategorySummaries, getReportDefinition } from '../modules/reports/registry';
import { resolveCompanyInfo } from '../modules/reports/export/company-info';
import { streamReportExcel } from '../modules/reports/export/excel.renderer';
import { streamReportPdf } from '../modules/reports/export/pdf.renderer';
import { logReportGeneration } from '../modules/reports/history.service';
import type { ReportParamField, ReportResult } from '../modules/reports/types';
import { detectImageMimeFromBuffer, extensionFromMime } from '../utils/image-signature';
import { uploadsRootPath } from '../utils/paths';

export class ReportNotFoundError extends Error {
  constructor(id: string) {
    super(`El reporte "${id}" no existe`);
  }
}

export function listCatalog() {
  return {
    categorias: getCategorySummaries(),
    reportes: getCatalog(),
  };
}

export function listCatalogByCategory(categoria: string) {
  return getCatalog().filter((report) => report.categoria === categoria);
}

function getReportOrThrow(id: string) {
  const report = getReportDefinition(id);
  if (!report) {
    throw new ReportNotFoundError(id);
  }
  return report;
}

function parseReportParams(report: ReturnType<typeof getReportOrThrow>, rawParams: Record<string, unknown>): Record<string, unknown> {
  return report.schema.parse(rawParams ?? {}) as Record<string, unknown>;
}

function summarizeParams(report: ReturnType<typeof getReportOrThrow>, rawParams: Record<string, unknown>): string[] {
  const fields: ReportParamField[] = report.parametros;
  const resumen: string[] = [];

  for (const field of fields) {
    const value = rawParams[field.key];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const option = field.options?.find((opt) => opt.value === String(value));
    resumen.push(`${field.label}: ${option ? option.label : String(value)}`);
  }

  return resumen;
}

export async function executeReport(
  id: string,
  rawParams: Record<string, unknown>,
  context: { idUsuario: number },
): Promise<ReportResult & { parametrosResumen: string[]; reportNombre: string; categoriaLabel: string; orientacionPdf: 'portrait' | 'landscape' }> {
  const report = getReportOrThrow(id);
  const params = parseReportParams(report, rawParams);
  const result = await report.run(params);

  await logReportGeneration({
    idUsuario: context.idUsuario,
    claveReporte: report.id,
    categoria: report.categoria,
    nombreReporte: report.nombre,
    parametros: params as Record<string, unknown>,
    totalRegistros: result.meta.totalRegistros,
  });

  return {
    ...result,
    parametrosResumen: summarizeParams(report, params as Record<string, unknown>),
    reportNombre: report.nombre,
    categoriaLabel: report.categoriaLabel,
    orientacionPdf: report.orientacionPdf ?? 'portrait',
  };
}

export async function exportReportPdf(
  id: string,
  rawParams: Record<string, unknown>,
  context: { idUsuario: number; generatedByName: string },
  res: Response,
): Promise<void> {
  const report = getReportOrThrow(id);
  const params = parseReportParams(report, rawParams);
  const result = await report.run(params);
  const company = await resolveCompanyInfo();

  await logReportGeneration({
    idUsuario: context.idUsuario,
    claveReporte: report.id,
    categoria: report.categoria,
    nombreReporte: report.nombre,
    parametros: params as Record<string, unknown>,
    totalRegistros: result.meta.totalRegistros,
    formatoExportado: 'PDF',
  });

  await streamReportPdf(res, {
    reportNombre: report.nombre,
    reportDescripcion: report.descripcion,
    categoriaLabel: report.categoriaLabel,
    parametrosResumen: summarizeParams(report, params as Record<string, unknown>),
    result,
    company,
    generatedByName: context.generatedByName,
    orientation: report.orientacionPdf ?? 'portrait',
    papelFormato: report.papelFormato ?? 'letter',
    layout: report.layout ?? 'standard',
  });
}

export async function exportReportExcel(
  id: string,
  rawParams: Record<string, unknown>,
  context: { idUsuario: number; generatedByName: string },
  res: Response,
): Promise<void> {
  const report = getReportOrThrow(id);
  const params = parseReportParams(report, rawParams);
  const result = await report.run(params);
  const company = await resolveCompanyInfo();

  await logReportGeneration({
    idUsuario: context.idUsuario,
    claveReporte: report.id,
    categoria: report.categoria,
    nombreReporte: report.nombre,
    parametros: params as Record<string, unknown>,
    totalRegistros: result.meta.totalRegistros,
    formatoExportado: 'EXCEL',
  });

  await streamReportExcel(res, {
    reportNombre: report.nombre,
    reportDescripcion: report.descripcion,
    categoriaLabel: report.categoriaLabel,
    parametrosResumen: summarizeParams(report, params as Record<string, unknown>),
    result,
    company,
    generatedByName: context.generatedByName,
  });
}

export function getReportModulePermission(id: string) {
  return getReportOrThrow(id).moduloPermiso;
}

export function reportExists(id: string): boolean {
  return Boolean(getReportDefinition(id));
}

export function countReports(): number {
  return getAllReportDefinitions().length;
}

export type ReportCompanySettings = {
  id: number;
  nombre: string;
  nombreComercial: string;
  rutaLogo: string | null;
};

function sanitizeBaseName(originalName: string): string {
  return path
    .parse(originalName)
    .name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function resolveLogoAbsolutePath(rutaLogo: string | null): string | null {
  if (!rutaLogo) {
    return null;
  }

  const relativePath = rutaLogo.replace(/^\/?uploads\/?/, '');
  const absolutePath = path.resolve(uploadsRootPath, relativePath);
  if (!absolutePath.startsWith(uploadsRootPath)) {
    return null;
  }

  return absolutePath;
}

async function getActiveCompanyOrThrow() {
  const empresa = await prisma.empresa.findFirst({
    where: { Anulado: false },
    orderBy: { Id: 'asc' },
    select: {
      Id: true,
      Nombre: true,
      NombreComercial: true,
      RutaLogo: true,
    },
  });

  if (!empresa) {
    throw new Error('No existe configuración de empresa activa');
  }

  return empresa;
}

export async function getReportCompanySettings(): Promise<ReportCompanySettings> {
  const empresa = await getActiveCompanyOrThrow();
  return {
    id: empresa.Id,
    nombre: empresa.Nombre,
    nombreComercial: empresa.NombreComercial,
    rutaLogo: empresa.RutaLogo,
  };
}

type UpdateCompanyLogoInput = {
  fileBuffer: Buffer;
  originalName: string;
  declaredMimeType: string;
  modifiedByUserId: number;
};

export async function updateReportCompanyLogo(input: UpdateCompanyLogoInput): Promise<ReportCompanySettings> {
  const detectedMime = detectImageMimeFromBuffer(input.fileBuffer);
  if (!detectedMime) {
    throw new Error('El archivo no contiene una imagen válida (PNG, JPG o WEBP)');
  }

  if (input.declaredMimeType && input.declaredMimeType !== detectedMime) {
    throw new Error('El tipo declarado no coincide con el contenido real de la imagen');
  }

  const empresa = await getActiveCompanyOrThrow();
  const logosDir = path.join(uploadsRootPath, 'company-logos');
  await fs.promises.mkdir(logosDir, { recursive: true });

  const extension = extensionFromMime(detectedMime);
  const baseName = sanitizeBaseName(input.originalName) || 'logo-empresa';
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const fileName = `${baseName}-${uniqueSuffix}${extension}`;
  const nextRutaLogo = `/uploads/company-logos/${fileName}`;
  const nextAbsolutePath = path.join(logosDir, fileName);
  const previousAbsolutePath = resolveLogoAbsolutePath(empresa.RutaLogo);

  await fs.promises.writeFile(nextAbsolutePath, input.fileBuffer);

  try {
    const updated = await prisma.empresa.update({
      where: { Id: empresa.Id },
      data: {
        RutaLogo: nextRutaLogo,
        IdUsuarioModificador: input.modifiedByUserId,
        FechaModificacion: new Date(),
      },
      select: {
        Id: true,
        Nombre: true,
        NombreComercial: true,
        RutaLogo: true,
      },
    });

    if (previousAbsolutePath && previousAbsolutePath.startsWith(logosDir) && previousAbsolutePath !== nextAbsolutePath) {
      try {
        await fs.promises.unlink(previousAbsolutePath);
      } catch {
        // Ignorar: el logo anterior pudo haber sido eliminado manualmente.
      }
    }

    return {
      id: updated.Id,
      nombre: updated.Nombre,
      nombreComercial: updated.NombreComercial,
      rutaLogo: updated.RutaLogo,
    };
  } catch (error) {
    try {
      await fs.promises.unlink(nextAbsolutePath);
    } catch {
      // Ignorar errores de limpieza para no ocultar el error principal.
    }
    throw error;
  }
}
