import type { AnyReportDefinition, ReportCatalogEntry, ReportCategorySummary, ReportDefinition } from './types';
import { clientsReports } from './definitions/clients.reports';
import { creditReports } from './definitions/credit.reports';
import { envasesReports } from './definitions/envases.reports';
import { inventoryReports } from './definitions/inventory.reports';
import { administrationReports } from './definitions/administration.reports';
import { invoicingReports } from './definitions/invoicing.reports';
import { logisticsReports } from './definitions/logistics.reports';
import { payrollReports } from './definitions/payroll.reports';
import { productionQualityReports } from './definitions/production-quality.reports';
import { providersReports } from './definitions/providers.reports';
import { purchasesReports } from './definitions/purchases.reports';
import { salesReports } from './definitions/sales.reports';

// Catálogo central del módulo de reportes. Cada categoría vive en su propio archivo en
// ./definitions; para agregar una nueva categoría, crear el archivo y sumarlo aquí.
const ALL_REPORTS: AnyReportDefinition[] = [
  ...salesReports,
  ...clientsReports,
  ...creditReports,
  ...invoicingReports,
  ...envasesReports,
  ...inventoryReports,
  ...purchasesReports,
  ...providersReports,
  ...productionQualityReports,
  ...logisticsReports,
  ...payrollReports,
  ...administrationReports,
] as unknown as AnyReportDefinition[];

const REPORTS_BY_ID = new Map<string, AnyReportDefinition>(ALL_REPORTS.map((report) => [report.id, report]));

export function getReportDefinition(id: string): AnyReportDefinition | undefined {
  return REPORTS_BY_ID.get(id);
}

export function getAllReportDefinitions(): AnyReportDefinition[] {
  return ALL_REPORTS;
}

export function toCatalogEntry(report: ReportDefinition<Record<string, unknown>>): ReportCatalogEntry {
  return {
    id: report.id,
    categoria: report.categoria,
    categoriaLabel: report.categoriaLabel,
    nombre: report.nombre,
    descripcion: report.descripcion,
    parametros: report.parametros,
  };
}

export function getCatalog(): ReportCatalogEntry[] {
  return ALL_REPORTS.map(toCatalogEntry);
}

export function getCategorySummaries(): ReportCategorySummary[] {
  const byCategory = new Map<string, ReportCategorySummary>();

  for (const report of ALL_REPORTS) {
    const existing = byCategory.get(report.categoria);
    if (existing) {
      existing.totalReportes += 1;
      continue;
    }
    byCategory.set(report.categoria, {
      categoria: report.categoria,
      categoriaLabel: report.categoriaLabel,
      totalReportes: 1,
    });
  }

  return Array.from(byCategory.values());
}
