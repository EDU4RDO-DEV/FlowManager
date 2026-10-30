import { z } from 'zod';

import {
  dateString,
  finitePositiveNumber,
  optionalBooleanFromQuery,
  positiveInt,
} from './validation';

const uniqueTransferItems = (
  items: { idInventarioItem: number; estadoEnvase?: 'VACIO' | 'LLENO' }[],
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const key = `${item.idInventarioItem}|${item.estadoEnvase ?? ''}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No se permite repetir el mismo producto y estado de envase',
        path: [index, 'idInventarioItem'],
      });
    }
    seen.add(key);
  }
};

export const createJornadaSchema = z.object({
  fecha: dateString,
  idUsuarioResponsable: positiveInt.optional(),
  observaciones: z.string().trim().max(255).optional(),
});

export const listJornadasQuerySchema = z.object({
  anulado: optionalBooleanFromQuery,
  estado: z.enum(['ABIERTA', 'CERRADA']).optional(),
});

export const jornadaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const routeInventoryHandoffParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const transferDetailLineSchema = z.object({
  idInventarioItem: positiveInt,
  cantidad: finitePositiveNumber,
  estadoEnvase: z.enum(['VACIO', 'LLENO']).optional(),
});

export const createVehicleTransferSchema = z.object({
  idRutaSesionOrigen: positiveInt,
  idRutaSesionDestino: positiveInt,
  motivo: z.string().trim().min(3).max(255),
  detalle: z
    .array(transferDetailLineSchema)
    .min(1, 'detalle debe incluir al menos un producto')
    .superRefine(uniqueTransferItems),
});

export const transferIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const transferDecisionSchema = z.object({
  motivo: z.string().trim().min(3).max(255).optional(),
});

export const cancelTransferSchema = z.object({
  motivo: z.string().trim().min(3).max(255),
});

export const listTransfersQuerySchema = z.object({
  idRutaSesion: z.coerce.number().int().positive().optional(),
  estadoConfirmacion: z.enum(['PENDIENTE', 'CONFIRMADA', 'RECHAZADA']).optional(),
});

export const createVehicleHandoffSchema = z.object({
  motivo: z.string().trim().min(3).max(255),
  idRuta: positiveInt,
  idVehiculo: positiveInt,
  idUsuarioChofer: positiveInt,
  idUsuarioVendedor: positiveInt,
  kmInicialEntrante: z.number().finite('kmInicialEntrante debe ser válido').min(0),
  detalle: z
    .array(transferDetailLineSchema)
    .superRefine(uniqueTransferItems)
    .optional(),
});
