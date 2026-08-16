import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createAdjustment,
  deleteAdjustment,
  getAdjustmentById,
  listAdjustments,
  listAnulatedAdjustments,
  restoreAdjustment,
} from '../services/adjustment.service';
import {
  adjustmentIdParamsSchema,
  createAdjustmentSchema,
  deleteAdjustmentBodySchema,
  listAdjustmentsQuerySchema,
  restoreAdjustmentBodySchema,
} from '../validators/adjustment.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listAdjustmentsController(req: Request, res: Response) {
  try {
    const query = listAdjustmentsQuerySchema.parse(req.query);

    const data = await listAdjustments({
      page: query.page,
      limit: query.limit,
      busqueda: query.busqueda,
      tipoAjuste: query.tipoAjuste,
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

export async function listAnulatedAdjustmentsController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedAdjustments();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getAdjustmentByIdController(req: Request, res: Response) {
  try {
    const { id } = adjustmentIdParamsSchema.parse(req.params);

    const data = await getAdjustmentById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Ajuste de inventario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createAdjustmentController(req: Request, res: Response) {
  try {
    const dataInput = createAdjustmentSchema.parse(req.body);

    const data = await createAdjustment({
      ...dataInput,
      nombreAjuste: dataInput.nombreAjuste.trim(),
      observacion: dataInput.observacion.trim(),
    });

    return res.status(201).json({ ok: true, data, message: 'Ajuste por lote registrado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe' || message === 'Item de inventario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('Stock insuficiente')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteAdjustmentController(req: Request, res: Response) {
  try {
    const { id } = adjustmentIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteAdjustmentBodySchema.parse(req.body ?? {});

    await deleteAdjustment(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Ajuste anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Ajuste de inventario no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('No se puede anular')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreAdjustmentController(req: Request, res: Response) {
  try {
    const { id } = adjustmentIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreAdjustmentBodySchema.parse(req.body ?? {});

    const data = await restoreAdjustment(id, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({ ok: true, data, message: 'Ajuste restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Ajuste anulado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Item de inventario no encontrado'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('No se puede restaurar')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
