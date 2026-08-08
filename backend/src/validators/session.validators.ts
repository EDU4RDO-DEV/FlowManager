import { z } from 'zod';

const positiveInt = z
  .number()
  .int('debe ser entero')
  .positive('debe ser mayor a 0');

const optionalFiniteNumber = z
  .number()
  .finite('debe ser un número válido')
  .optional();

export const sessionIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const createSessionSchema = z.object({
  idUsuario: positiveInt,
  ip: z.string().trim().min(1, 'ip es requerida').max(100, 'ip demasiado larga'),
  nombreDispositivo: z
    .string()
    .trim()
    .min(1, 'nombreDispositivo es requerido')
    .max(255, 'nombreDispositivo demasiado largo'),
  tokenSesion: z.string().trim().min(1, 'tokenSesion es requerido'),
  latitud: optionalFiniteNumber,
  longitud: optionalFiniteNumber,
  precision: optionalFiniteNumber,
  fechaExpiracionToken: z.string().datetime('fechaExpiracionToken inválida'),
});

export const updateSessionSchema = z
  .object({
    idUsuario: positiveInt.optional(),
    ip: z.string().trim().min(1).max(100, 'ip demasiado larga').optional(),
    nombreDispositivo: z.string().trim().min(1).max(255, 'nombreDispositivo demasiado largo').optional(),
    tokenSesion: z.string().trim().min(1).optional(),
    latitud: optionalFiniteNumber,
    longitud: optionalFiniteNumber,
    precision: optionalFiniteNumber,
    fechaExpiracionToken: z.string().datetime('fechaExpiracionToken inválida').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });
