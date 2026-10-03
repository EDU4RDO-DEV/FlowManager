import { z, ZodError } from 'zod';

export function getZodErrorMessage(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Datos inválidos';
  }

  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
  return `${path}${firstIssue.message}`;
}

// Primitivas Zod compartidas (Fase 14): antes duplicadas en casi todos los validators.
export const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

export const finitePositiveNumber = z
  .number()
  .finite('debe ser un número válido')
  .positive('debe ser mayor a 0');

export const nonNegativeNumber = z
  .number()
  .finite('debe ser un número válido')
  .nonnegative('debe ser mayor o igual a 0');

export const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'fecha inválida');

export const optionalBooleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const optionalPositiveIntFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'debe ser mayor a 0')
  .optional();

export const optionalPageFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'page debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'page debe ser mayor a 0')
  .optional();

export const optionalLimitFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'limit debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value >= 1 && value <= 100, 'limit debe estar entre 1 y 100')
  .optional();

export const optionalDateFromQuery = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener formato YYYY-MM-DD')
  .optional();
