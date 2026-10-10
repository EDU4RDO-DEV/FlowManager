import { z } from 'zod';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe usar el formato AAAA-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha no es válida');

export const dashboardQuerySchema = z
  .object({
    fechaInicio: dateOnlySchema,
    fechaFin: dateOnlySchema,
  })
  .superRefine(({ fechaInicio, fechaFin }, context) => {
    const start = Date.parse(`${fechaInicio}T00:00:00.000Z`);
    const end = Date.parse(`${fechaFin}T00:00:00.000Z`);
    const differenceInDays = (end - start) / 86_400_000;

    if (differenceInDays < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha inicial debe ser anterior o igual a la fecha final',
        path: ['fechaInicio'],
      });
    } else if (differenceInDays > 365) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El rango no puede superar 366 días',
        path: ['fechaFin'],
      });
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
