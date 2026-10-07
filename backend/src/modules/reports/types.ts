import type { ZodTypeAny } from 'zod';

import type { rbacModuleKeys } from '../../validators/role-permission.validators';

export type ReportModuleKey = (typeof rbacModuleKeys)[number];

export type ReportParamFieldType =
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiselect'
  | 'text'
  | 'number'
  | 'boolean';

export type ReportParamOption = {
  value: string;
  label: string;
};

// `optionsEndpoint` le indica al frontend de dónde cargar las opciones dinámicas
// (ej. '/api/clients' para listar clientes). `options` son valores estáticos (ej. estados).
export type ReportParamField = {
  key: string;
  label: string;
  type: ReportParamFieldType;
  required?: boolean;
  optionsEndpoint?: string;
  options?: ReportParamOption[];
  placeholder?: string;
  helpText?: string;
};

export type ReportColumnType = 'text' | 'number' | 'currency' | 'date' | 'percent' | 'badge';

export type ReportColumn = {
  key: string;
  label: string;
  type: ReportColumnType;
  align?: 'left' | 'right' | 'center';
};

export type ReportGroup = {
  key: string;
  label: string;
  rows: Array<Record<string, unknown>>;
  subtotals?: Record<string, number>;
};

export type ReportIndicator = {
  label: string;
  value: string | number;
};

export type ReportResult = {
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
};

export type ReportDefinition<TParams = Record<string, unknown>> = {
  id: string;
  categoria: string;
  categoriaLabel: string;
  nombre: string;
  descripcion: string;
  moduloPermiso: ReportModuleKey;
  parametros: ReportParamField[];
  schema: ZodTypeAny;
  orientacionPdf?: 'portrait' | 'landscape';
  papelFormato?: 'letter' | 'a4' | 'legal';
  layout?: 'standard' | 'financial' | 'inventory-landscape';
  run: (params: TParams) => Promise<ReportResult>;
};

// Versión sin genéricos para almacenarse homogéneamente en el registro.
export type AnyReportDefinition = ReportDefinition<Record<string, unknown>>;

export type ReportCatalogEntry = {
  id: string;
  categoria: string;
  categoriaLabel: string;
  nombre: string;
  descripcion: string;
  parametros: ReportParamField[];
};

export type ReportCategorySummary = {
  categoria: string;
  categoriaLabel: string;
  totalReportes: number;
};
