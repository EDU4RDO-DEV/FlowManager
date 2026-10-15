import { z } from 'zod';

import { finitePositiveNumber, positiveInt } from './validation';

const routeIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const uniqueItems = <T extends { idInventarioItem: number }>(items: T[], ctx: z.RefinementCtx) => {
  const ids = new Set<number>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.idInventarioItem)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No se permite repetir producto',
        path: [index, 'idInventarioItem'],
      });
    }
    ids.add(item.idInventarioItem);
  }
};

export const routeInventoryIdParamsSchema = routeIdParamsSchema;

export const createRouteDispatchSchema = z.object({
  observaciones: z.string().trim().max(255).optional(),
  detalle: z
    .array(z.object({ idInventarioItem: positiveInt, cantidad: finitePositiveNumber }))
    .min(1, 'detalle debe incluir al menos un producto')
    .superRefine(uniqueItems),
});

export const createRouteReturnSchema = z.object({
  observaciones: z.string().trim().max(255).optional(),
  detalle: z
    .array(
      z.object({
        idInventarioItem: positiveInt,
        cantidadRecibida: finitePositiveNumber,
        cantidadDanada: z.number().finite().min(0).default(0),
        observaciones: z.string().trim().max(255).optional(),
        ubicacionDanada: z.string().trim().min(1).max(255).optional(),
      }).superRefine((detail, ctx) => {
        if (detail.cantidadDanada > 0 && !detail.ubicacionDanada) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'ubicacionDanada es obligatoria si hay producto dañado',
            path: ['ubicacionDanada'],
          });
        }
      }),
    )
    .default([])
    .superRefine(uniqueItems),
});

export const createRouteAdjustmentSchema = z.object({
  idInventarioItem: positiveInt,
  clasificacion: z.enum(['FALTANTE', 'DANADO', 'OTRO']),
  cantidad: finitePositiveNumber,
  motivo: z.string().trim().min(3).max(255),
});
