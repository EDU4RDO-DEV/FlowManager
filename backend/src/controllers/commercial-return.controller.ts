import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { createCommercialReturn } from '../services/commercial-return.service';
import {
  createCommercialReturnIdempotencyKeySchema,
  createCommercialReturnSchema,
  saleIdParamsSchema,
} from '../validators/sale.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function createCommercialReturnController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) {
      return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    }

    const { id } = saleIdParamsSchema.parse(req.params);
    const idempotencyKey = createCommercialReturnIdempotencyKeySchema.parse(req.get('Idempotency-Key'));
    const input = createCommercialReturnSchema.parse(req.body);
    const result = await createCommercialReturn(id, idUsuario, idempotencyKey, input);

    return res.status(result.replayed ? 200 : 201).json({
      ok: true,
      data: {
        id: result.data.Id,
        idVenta: result.data.IdVenta,
        idUsuarioAutorizacion: result.data.IdUsuarioAutorizacion,
        fechaAutorizacion: result.data.FechaAutorizacion,
        detalle: result.data.Detalles.map((detail) => ({
          id: detail.Id,
          idDetalleVenta: detail.IdDetalleVenta,
          cantidad: detail.Cantidad,
          motivo: detail.Motivo,
          condicionFisica: detail.CondicionFisica,
          ubicacionNoVendible: detail.UbicacionNoVendible,
        })),
      },
      message: result.replayed ? 'Devolución comercial existente' : 'Devolución comercial autorizada y registrada',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      return res.status(409).json({
        ok: false,
        message: 'La venta o la devolución cambió por una operación concurrente. Verifique el estado antes de reintentar.',
      });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    if (message.includes('no existe') || message.includes('no pertenece')) {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message.includes('ruta') ||
      message.includes('cantidad devuelta') ||
      message.includes('Idempotency-Key')
    ) {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}
