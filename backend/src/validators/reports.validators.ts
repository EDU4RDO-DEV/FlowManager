import { z } from 'zod';

export const reportIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'id es requerido'),
});

export const reportCategoryParamsSchema = z.object({
  categoria: z.string().trim().min(1, 'categoria es requerida'),
});

// Los parámetros propios de cada reporte se validan con el `schema` de su propia
// definición (ver modules/reports/definitions/*); aquí solo validamos el sobre genérico.
export const executeReportBodySchema = z.object({
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

export const reportHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  claveReporte: z.string().trim().optional(),
});
