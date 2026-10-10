// Tipos del Módulo de Reportes, alineados al backend (modules/reports/types.ts).

export type ReportParamFieldType =
  | "date"
  | "dateRange"
  | "select"
  | "multiselect"
  | "text"
  | "number"
  | "boolean";

export interface ReportParamOption {
  value: string;
  label: string;
}

export interface ReportParamField {
  key: string;
  label: string;
  type: ReportParamFieldType;
  required?: boolean;
  optionsEndpoint?: string;
  options?: ReportParamOption[];
  placeholder?: string;
  helpText?: string;
}

export interface ReportCatalogEntry {
  id: string;
  categoria: string;
  categoriaLabel: string;
  nombre: string;
  descripcion: string;
  parametros: ReportParamField[];
}

export interface ReportCategorySummary {
  categoria: string;
  categoriaLabel: string;
  totalReportes: number;
}

export interface ReportCatalogResponse {
  categorias: ReportCategorySummary[];
  reportes: ReportCatalogEntry[];
}

export interface ReportCompanySettings {
  id: number;
  nombre: string;
  nombreComercial: string;
  rutaLogo: string | null;
  logoUrl?: string | null;
}

export type ReportColumnType = "text" | "number" | "currency" | "date" | "percent" | "badge";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
  align?: "left" | "right" | "center";
}

export interface ReportGroup {
  key: string;
  label: string;
  rows: Array<Record<string, unknown>>;
  subtotals?: Record<string, number>;
}

export interface ReportIndicator {
  label: string;
  value: string | number;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  groups?: ReportGroup[];
  totals?: Record<string, number>;
  indicators?: ReportIndicator[];
  meta: {
    totalRegistros: number;
    truncado: boolean;
    generadoEn: string;
  };
  parametrosResumen: string[];
  reportNombre: string;
  categoriaLabel: string;
  orientacionPdf: "portrait" | "landscape";
}
