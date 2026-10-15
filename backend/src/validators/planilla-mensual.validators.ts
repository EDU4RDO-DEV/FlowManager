import { z } from 'zod';

import { optionalBooleanFromQuery, positiveInt } from './validation';

const ajusteTipoSchema = z.enum(['BONO_META']);

const ajusteSchema = z.object({
  tipoAjuste: ajusteTipoSchema,
  descripcion: z
    .string()
    .trim()
    .min(3, 'descripcion debe tener al menos 3 caracteres')
    .max(255, 'descripcion demasiado larga'),
  monto: z.number().finite('monto inválido').nonnegative('monto debe ser mayor o igual a 0'),
});

const payrollEmployeeInputSchema = z.object({
  idEmpleado: positiveInt,
  diasTrabajados: z.number().int().min(0).max(31).optional(),
  ajustes: z.array(ajusteSchema).optional(),
});

export const planillaIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const listPayrollQuerySchema = z.object({
  mes: z.coerce.number().int('mes debe ser entero').min(1, 'mes debe ser >= 1').max(12, 'mes debe ser <= 12').optional(),
  anio: z.coerce.number().int('año debe ser entero').min(2000, 'año inválido').max(9999, 'año inválido').optional(),
  anulado: optionalBooleanFromQuery,
  idEmpleado: z.coerce.number().int('idEmpleado debe ser entero').positive('idEmpleado debe ser mayor a 0').optional(),
});

export const previewPayrollSchema = z.object({
  mes: z.number().int('mes debe ser entero').min(1, 'mes debe ser >= 1').max(12, 'mes debe ser <= 12'),
  anio: z.number().int('año debe ser entero').min(2000, 'año inválido').max(9999, 'año inválido'),
  idEmpleado: positiveInt.optional(),
  empleados: z.array(payrollEmployeeInputSchema).optional(),
});

export const generatePayrollSchema = z.object({
  mes: z.number().int('mes debe ser entero').min(1, 'mes debe ser >= 1').max(12, 'mes debe ser <= 12'),
  anio: z.number().int('año debe ser entero').min(2000, 'año inválido').max(9999, 'año inválido'),
  previewId: z.string().length(64, 'previsualización inválida'),
  idEmpleado: positiveInt.optional(),
  observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
  empleados: z.array(payrollEmployeeInputSchema).optional(),
});

export const updatePayrollSchema = z
  .object({
    observaciones: z.union([z.string().trim().max(255, 'observaciones demasiado largas'), z.null()]).optional(),
    ajustes: z.array(ajusteSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deletePayrollBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restorePayrollBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const closePayrollBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});

export const reopenPayrollBodySchema = z.object({
  motivo: z.string().trim().min(5, 'motivo debe tener al menos 5 caracteres').max(255),
});
