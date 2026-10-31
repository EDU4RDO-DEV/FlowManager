import { z } from 'zod';

export const employeeAdvancesQuerySchema = z.object({
  idEmpleado: z.coerce.number().int().positive().optional(),
});

export const createEmployeeAdvanceSchema = z.object({
  idEmpleado: z.number().int().positive(),
  monto: z.number().finite().positive().max(99999999),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe tener formato YYYY-MM-DD'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']),
  numeroReferencia: z.string().trim().max(100).optional(),
  banco: z.string().trim().max(100).optional(),
  observacion: z.string().trim().max(255).optional(),
}).superRefine((value, context) => {
  if (value.metodoPago === 'TRANSFERENCIA' && !value.numeroReferencia) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['numeroReferencia'],
      message: 'La referencia es obligatoria para transferencias',
    });
  }
});
