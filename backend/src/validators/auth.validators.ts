import { z } from 'zod';

import { positiveInt } from './validation';

export const passwordSchema = z
  .string()
  .min(8, 'clave debe tener al menos 8 caracteres')
  .max(128, 'clave demasiado larga');

export const loginSchema = z.object({
  correo: z.string().trim().email('correo inválido').max(255, 'correo demasiado largo'),
  clave: passwordSchema,
});

export const registerSchema = z.object({
  nombre: z.string().trim().min(3, 'nombre debe tener al menos 3 caracteres').max(255, 'nombre demasiado largo'),
  correo: z.string().trim().email('correo inválido').max(255, 'correo demasiado largo'),
  clave: passwordSchema
    .regex(/[A-Z]/, 'clave debe incluir al menos una mayúscula')
    .regex(/[a-z]/, 'clave debe incluir al menos una minúscula')
    .regex(/[0-9]/, 'clave debe incluir al menos un número'),
  idRol: positiveInt.optional(),
  idEntidad: positiveInt.optional(),
});

export const assignUserRoleEntityParamsSchema = z.object({
  idUsuario: z.coerce.number().int('idUsuario debe ser entero').positive('idUsuario debe ser mayor a 0'),
});

export const assignUserRoleEntityBodySchema = z.object({
  idRol: positiveInt,
  idEntidad: positiveInt.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'refreshToken es requerido'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
});
