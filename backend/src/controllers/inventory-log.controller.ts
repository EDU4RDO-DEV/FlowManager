import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { listAnulatedInventoryLog, listInventoryLog } from '../services/inventory-log.service';
import { listInventoryLogQuerySchema } from '../validators/inventory-log.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listInventoryLogController(req: Request, res: Response) {
  try {
    const query = listInventoryLogQuerySchema.parse(req.query);

    const data = await listInventoryLog({
      page: query.page,
      limit: query.limit,
      busqueda: query.busqueda,
      tipoMovimiento: query.tipoMovimiento,
      anulado: query.anulado,
      idInventarioItem: query.idInventarioItem,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedInventoryLogController(_req: Request, res: Response) {
  try {
    const query = listInventoryLogQuerySchema.parse(_req.query);

    const data = await listAnulatedInventoryLog({
      busqueda: query.busqueda,
      tipoMovimiento: query.tipoMovimiento,
      idInventarioItem: query.idInventarioItem,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}
