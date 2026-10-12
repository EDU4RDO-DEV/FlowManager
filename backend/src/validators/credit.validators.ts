import { z } from 'zod';

import {
  optionalDateFromQuery,
  optionalBooleanFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
  positiveInt,
} from './validation';
import { paymentDetailsFields, validatePaymentMethodRequirements } from './payment.validators';

const creditPaymentSchema = z
  .object({
    idUsuario: positiveInt,
    ...paymentDetailsFields,
  })
  .superRefine(validatePaymentMethodRequirements);

function isValidDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const creditIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const creditPaymentIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idPago: z.coerce.number().int('idPago debe ser entero').positive('idPago debe ser mayor a 0'),
});

export const customerIdParamsSchema = z.object({
  idCliente: z.coerce.number().int('idCliente debe ser entero').positive('idCliente debe ser mayor a 0'),
});

export const listCreditsQuerySchema = z
  .object({
    page: optionalPageFromQuery,
    limit: optionalLimitFromQuery,
    idCliente: optionalPositiveIntFromQuery,
    estado: z.enum(['ACTIVO', 'PAGADO', 'ANULADO']).optional(),
    estadoPago: z.enum(['PENDIENTE', 'PARCIAL', 'PAGADO']).optional(),
    anulado: optionalBooleanFromQuery,
    incluirAnulados: optionalBooleanFromQuery,
    fechaDesde: optionalDateFromQuery,
    fechaHasta: optionalDateFromQuery,
    busqueda: z.string().trim().min(1).max(255).optional(),
  })
  .refine(
    (query) =>
      (!query.fechaDesde || isValidDateOnly(query.fechaDesde)) &&
      (!query.fechaHasta || isValidDateOnly(query.fechaHasta)),
    { message: 'Las fechas deben ser válidas' },
  )
  .refine(
    (query) => !query.fechaDesde || !query.fechaHasta || query.fechaDesde <= query.fechaHasta,
    { message: 'fechaDesde no puede ser posterior a fechaHasta' },
  );

export const createCreditPaymentSchema = creditPaymentSchema;

export const anulateCreditPaymentBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});
