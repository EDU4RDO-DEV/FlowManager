import { z } from 'zod';

import { dateString, positiveInt } from './validation';

const entityCreateSchema = z.object({
  nombreCompleto: z.string().trim().min(1, 'entidad.nombreCompleto es obligatorio').max(255, 'entidad.nombreCompleto demasiado largo'),
  sexo: z.enum(['M', 'F'], { message: 'entidad.sexo debe ser M o F' }).optional(),
  fechaNacimiento: dateString.optional(),
  telefono1: z.string().trim().max(20, 'entidad.telefono1 demasiado largo').optional(),
  telefono2: z.string().trim().max(20, 'entidad.telefono2 demasiado largo').optional(),
  correoElectronico: z.string().trim().email('entidad.correoElectronico inválido').max(100, 'entidad.correoElectronico demasiado largo').optional(),
  rutaImagen: z.string().trim().max(255, 'entidad.rutaImagen demasiado larga').optional(),
  nit: z.string().trim().max(25, 'entidad.nit demasiado largo').optional(),
  dpi: z.string().trim().max(25, 'entidad.dpi demasiado largo').optional(),
});

const entityUpdateSchema = z.object({
  nombreCompleto: z.string().trim().min(1, 'entidad.nombreCompleto no puede ir vacío').max(255, 'entidad.nombreCompleto demasiado largo').optional(),
  sexo: z.enum(['M', 'F'], { message: 'entidad.sexo debe ser M o F' }).optional(),
  fechaNacimiento: dateString.optional(),
  telefono1: z.string().trim().max(20, 'entidad.telefono1 demasiado largo').optional(),
  telefono2: z.string().trim().max(20, 'entidad.telefono2 demasiado largo').optional(),
  correoElectronico: z.string().trim().email('entidad.correoElectronico inválido').max(100, 'entidad.correoElectronico demasiado largo').optional(),
  rutaImagen: z.string().trim().max(255, 'entidad.rutaImagen demasiado larga').optional(),
  nit: z.string().trim().max(25, 'entidad.nit demasiado largo').optional(),
  dpi: z.string().trim().max(25, 'entidad.dpi demasiado largo').optional(),
});

export const providerIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const createProviderSchema = z.object({
  idUsuario: positiveInt,
  entidad: entityCreateSchema,
});

export const updateProviderSchema = z
  .object({
    idUsuario: positiveInt.optional(),
    idUsuarioModificador: positiveInt.optional(),
    entidad: entityUpdateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteProviderBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreProviderBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
