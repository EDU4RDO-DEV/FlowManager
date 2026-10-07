import { z } from 'zod';

// Primitivas Zod compartidas por las definiciones de reportes. Los parámetros llegan
// en el body de la petición (POST /api/reports/:id/execute), por eso se usan versiones
// "body-friendly" (z.coerce) en vez de las variantes *FromQuery de validation.ts.
export const optionalDateParam = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener formato YYYY-MM-DD')
  .optional();

export const optionalPositiveIntParam = z.coerce
  .number()
  .int('debe ser entero')
  .positive('debe ser mayor a 0')
  .optional();

export const optionalTopNParam = z.coerce
  .number()
  .int('debe ser entero')
  .positive('debe ser mayor a 0')
  .max(500, 'top no puede ser mayor a 500')
  .optional();

export const optionalBooleanParam = z.coerce.boolean().optional();

type DateRangeShape = {
  fechaInicio?: string;
  fechaFin?: string;
};

// Cada definición de reporte declara sus propios campos fechaInicio/fechaFin (con
// optionalDateParam) y envuelve el z.object resultante con este helper para obtener
// la validación cruzada "fechaInicio <= fechaFin" sin perder los demás campos del schema.
export function withDateRangeValidation<T extends DateRangeShape>(schema: z.ZodType<T>): z.ZodType<T> {
  return schema.superRefine((data, ctx) => {
    if (data.fechaInicio && data.fechaFin && new Date(data.fechaInicio) > new Date(data.fechaFin)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaInicio debe ser menor o igual a fechaFin',
        path: ['fechaFin'],
      });
    }
  }) as unknown as z.ZodType<T>;
}
