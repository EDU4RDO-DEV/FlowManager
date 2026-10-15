import { z } from 'zod';

import { dateString, finitePositiveNumber, positiveInt } from './validation';

const optionalString255 = z.string().trim().max(255, 'demasiado largo').optional();

export const employeeIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const employeeEntityCreateSchema = z.object({
  nombreCompleto: z.string().trim().min(1, 'entidad.nombreCompleto es obligatorio').max(255, 'entidad.nombreCompleto demasiado largo'),
  sexo: z.enum(['M', 'F'], { message: 'entidad.sexo debe ser M o F' }).optional(),
  fechaNacimiento: dateString.optional(),
  telefono1: z.string().trim().max(20, 'entidad.telefono1 demasiado largo').optional(),
  telefono2: z.string().trim().max(20, 'entidad.telefono2 demasiado largo').optional(),
  correoElectronico: z.string().trim().email('entidad.correoElectronico inválido').max(100, 'entidad.correoElectronico demasiado largo').optional(),
  rutaImagen: optionalString255,
  nit: z.string().trim().max(25, 'entidad.nit demasiado largo').optional(),
  dpi: z.string().trim().max(25, 'entidad.dpi demasiado largo').optional(),
});

export const employeeEntityUpdateSchema = z.object({
  nombreCompleto: z.string().trim().min(1, 'entidad.nombreCompleto no puede ir vacío').max(255, 'entidad.nombreCompleto demasiado largo').optional(),
  sexo: z.enum(['M', 'F'], { message: 'entidad.sexo debe ser M o F' }).optional(),
  fechaNacimiento: dateString.optional(),
  telefono1: z.string().trim().max(20, 'entidad.telefono1 demasiado largo').optional(),
  telefono2: z.string().trim().max(20, 'entidad.telefono2 demasiado largo').optional(),
  correoElectronico: z.string().trim().email('entidad.correoElectronico inválido').max(100, 'entidad.correoElectronico demasiado largo').optional(),
  rutaImagen: optionalString255,
  nit: z.string().trim().max(25, 'entidad.nit demasiado largo').optional(),
  dpi: z.string().trim().max(25, 'entidad.dpi demasiado largo').optional(),
});

export const createEmployeeSchema = z.object({
  idUsuario: positiveInt,
  idUsuarioVinculado: positiveInt.optional(),
  idConfiguracionComision: positiveInt.optional(),
  idTipoTrabajador: positiveInt,
  puestoTrabajo: z.string().trim().min(1, 'puestoTrabajo es obligatorio').max(255, 'puestoTrabajo demasiado largo'),
  descripcionPuesto: optionalString255,
  fechaContratacion: dateString,
  fechaSalida: dateString.optional(),
  sueldoBase: finitePositiveNumber,
  entidad: employeeEntityCreateSchema,
});

export const updateEmployeeSchema = z
  .object({
    idUsuario: positiveInt.optional(),
    idUsuarioVinculado: z.union([positiveInt, z.null()]).optional(),
    idUsuarioModificador: positiveInt.optional(),
    idConfiguracionComision: z.union([positiveInt, z.null()]).optional(),
    idTipoTrabajador: z.union([positiveInt, z.null()]).optional(),
    puestoTrabajo: z.string().trim().min(1, 'puestoTrabajo no puede ir vacío').max(255, 'puestoTrabajo demasiado largo').optional(),
    descripcionPuesto: z.union([z.string().trim().max(255, 'descripcionPuesto demasiado larga'), z.null()]).optional(),
    fechaContratacion: dateString.optional(),
    fechaSalida: z.union([dateString, z.null()]).optional(),
    sueldoBase: finitePositiveNumber.optional(),
    fechaInicioVigenciaSueldo: dateString.optional(),
    entidad: employeeEntityUpdateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const deleteEmployeeBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const restoreEmployeeBodySchema = z.object({
  idUsuarioModificador: positiveInt.optional(),
});
