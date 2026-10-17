import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  createAdjustment,
  deleteAdjustment,
  deleteAdjustmentOperation,
  getAdjustmentById,
  getAdjustmentOperation,
  listAdjustments,
  listAdjustmentOperations,
  listAnulatedAdjustments,
  restoreAdjustment,
  restoreAdjustmentOperation,
} from '../services/adjustment.service';
import {
  adjustmentIdParamsSchema,
  adjustmentNumberParamsSchema,
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

export async function listAdjustmentOperationsController(req: Request, res: Response) {
  try {
    const query = listAdjustmentsQuerySchema.parse(req.query);
    const data = await listAdjustmentOperations({
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

export async function getAdjustmentOperationController(req: Request, res: Response) {
  try {
    const { numeroAjuste } = adjustmentNumberParamsSchema.parse(req.params);
    const data = await getAdjustmentOperation(numeroAjuste);
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

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente de inventario; consulte las existencias antes de reintentar',
      });
    }

    if (message === 'Usuario no existe' || message === 'Item de inventario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('Stock insuficiente')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteAdjustmentOperationController(req: Request, res: Response) {
  try {
    const { numeroAjuste } = adjustmentNumberParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteAdjustmentBodySchema.parse(req.body ?? {});
    await deleteAdjustmentOperation(numeroAjuste, req.auth?.userId ?? idUsuarioAnulador);
    return res.status(200).json({ ok: true, message: 'Ajuste anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente de inventario; consulte las existencias antes de reintentar',
      });
    }
    if (
      message === 'Ajuste de inventario no existe' ||
      message === 'Usuario no existe' ||
      message === 'Item de inventario no encontrado'
    ) {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message.startsWith('No se puede anular') ||
      message.startsWith('La cantidad') ||
      message.startsWith('Existencia insuficiente')
    ) {
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

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente de inventario; consulte las existencias antes de reintentar',
      });
    }

    if (message === 'Ajuste de inventario no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('No se puede anular')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreAdjustmentOperationController(req: Request, res: Response) {
  try {
    const { numeroAjuste } = adjustmentNumberParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreAdjustmentBodySchema.parse(req.body ?? {});
    await restoreAdjustmentOperation(numeroAjuste, req.auth?.userId ?? idUsuarioModificador);
    return res.status(200).json({ ok: true, message: 'Ajuste restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente de inventario; consulte las existencias antes de reintentar',
      });
    }
    if (
      message === 'Ajuste anulado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Item de inventario no encontrado'
    ) {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message.startsWith('No se puede restaurar') ||
      message.startsWith('La cantidad') ||
      message.startsWith('Existencia insuficiente')
    ) {
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

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente de inventario; consulte las existencias antes de reintentar',
      });
    }

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
