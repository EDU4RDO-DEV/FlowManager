import fs from 'fs';
import path from 'path';

import type { Response } from 'express';

import type { ReportResult } from '../types';
import type { CompanyInfo } from './company-info';
import { renderHtmlToPdf, type PdfPaperFormat } from './browser';
import { renderReportHtml, renderRunningFooter, renderRunningHeader, type ReportLayoutName } from './templates/handlebars';

export type RenderPdfInput = {
  reportNombre: string;
  reportDescripcion: string;
  categoriaLabel: string;
  parametrosResumen: string[];
  result: ReportResult;
  company: CompanyInfo;
  generatedByName: string;
  orientation: 'portrait' | 'landscape';
  papelFormato?: PdfPaperFormat;
  layout?: ReportLayoutName;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

// Convierte el logo guardado en disco a data URI para que Chromium lo pueda renderizar
// sin depender de una ruta de archivo o de que el servidor estático esté accesible
// (sección 24: el PDF debe funcionar sin importar dónde corra el backend).
function resolveLogoDataUri(logoPath: string | null): string | null {
  if (!logoPath) return null;

  try {
    const extension = path.extname(logoPath).toLowerCase();
    const mime = MIME_BY_EXTENSION[extension];
    if (!mime) return null;

    const buffer = fs.readFileSync(logoPath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// "Label: value" -> { label, value }. `summarizeParams` (reports.service.ts) sigue
// produciendo ese formato de cadena para no romper la exportación Excel, que lo
// consume igual; aquí solo lo partimos para mostrarlo en la grilla de metadatos del PDF.
function parseMetaItems(parametrosResumen: string[]): Array<{ label: string; value: string }> {
  return parametrosResumen.map((entry) => {
    const separatorIndex = entry.indexOf(': ');
    if (separatorIndex === -1) {
      return { label: entry, value: '' };
    }
    return {
      label: entry.slice(0, separatorIndex),
      value: entry.slice(separatorIndex + 2),
    };
  });
}

const PAPER_MARGIN = { top: '16mm', bottom: '22mm', left: '12mm', right: '12mm' };

// Construye el buffer del PDF sin tocar Express; `streamReportPdf` lo envuelve para
// la respuesta HTTP. Separado así para poder generar/validar PDFs fuera de una request
// real (scripts de verificación, pruebas).
export async function buildReportPdfBuffer(input: RenderPdfInput): Promise<Buffer> {
  const layout: ReportLayoutName = input.layout ?? 'standard';
  const columnCount = input.result.columns.length;

  const html = renderReportHtml(layout, {
    company: {
      nombreComercial: input.company.nombreComercial,
      direccion: input.company.direccion,
      logoDataUri: resolveLogoDataUri(input.company.logoPath),
    },
    report: {
      nombre: input.reportNombre,
      descripcion: input.reportDescripcion,
      categoriaLabel: input.categoriaLabel,
    },
    metaItems: parseMetaItems(input.parametrosResumen),
    indicators: input.result.indicators ?? [],
    columns: input.result.columns,
    columnCount,
    rows: input.result.rows,
    groups: input.result.groups ?? [],
    totals: input.result.totals ?? null,
    hasData: input.result.rows.length > 0 || (input.result.groups ?? []).length > 0,
    truncado: input.result.meta.truncado,
  });

  const headerTemplate = renderRunningHeader({
    companyName: input.company.nombreComercial,
    reportName: input.reportNombre,
  });

  const footerTemplate = renderRunningFooter({
    companyName: input.company.nombreComercial,
    generatedBy: input.generatedByName,
  });

  return renderHtmlToPdf(html, {
    format: input.papelFormato ?? 'letter',
    landscape: input.orientation === 'landscape',
    headerTemplate,
    footerTemplate,
    margin: PAPER_MARGIN,
  });
}

export async function streamReportPdf(res: Response, input: RenderPdfInput): Promise<void> {
  const pdfBuffer = await buildReportPdfBuffer(input);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${slugify(input.reportNombre)}.pdf"`);
  res.send(pdfBuffer);
}
