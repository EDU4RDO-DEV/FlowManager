import type { Response } from 'express';

import { prisma } from '../config/prisma';
import { getAllReportDefinitions, getCatalog, getCategorySummaries, getReportDefinition } from '../modules/reports/registry';
import { resolveCompanyInfo } from '../modules/reports/export/company-info';
import { streamReportExcel } from '../modules/reports/export/excel.renderer';
import { streamReportPdf } from '../modules/reports/export/pdf.renderer';
import { logReportGeneration } from '../modules/reports/history.service';
import type { ReportParamField, ReportResult } from '../modules/reports/types';

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
