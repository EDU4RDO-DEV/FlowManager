import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  anulatePurchase,
  createPurchase,
  createPurchaseExpense,
  deletePurchaseExpense,
  getPurchaseById,
  listPurchaseExpenses,
  listPurchases,
  restorePurchase,
  restorePurchaseExpense,
  updatePurchaseExpense,
} from '../services/purchase.service';
import {
  anulatePurchaseBodySchema,
  createPurchaseExpenseSchema,
  createPurchaseSchema,
  deletePurchaseExpenseBodySchema,
  listPurchasesQuerySchema,
  purchaseExpenseIdParamsSchema,
  purchaseIdParamsSchema,
  restorePurchaseBodySchema,
  restorePurchaseExpenseBodySchema,
  updatePurchaseExpenseSchema,
} from '../validators/purchase.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listPurchasesController(req: Request, res: Response) {
  try {
    const query = listPurchasesQuerySchema.parse(req.query);

    const data = await listPurchases({
      page: query.page,
      limit: query.limit,
      busqueda: query.busqueda,
      idProveedor: query.idProveedor,
      esGasto: query.esGasto,
      anulado: query.anulado,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
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

export async function getPurchaseByIdController(req: Request, res: Response) {
  try {
    const { id } = purchaseIdParamsSchema.parse(req.params);
    const data = await getPurchaseById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Compra no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createPurchaseController(req: Request, res: Response) {
  try {
    const dataInput = createPurchaseSchema.parse(req.body);

    const data = await createPurchase({
      ...dataInput,
      numeroFactura: dataInput.numeroFactura.trim(),
      observaciones: dataInput.observaciones?.trim(),
      detalleGasto: dataInput.detalleGasto?.map((item) => ({
        ...item,
        descripcion: item.descripcion.trim(),
      })),
    });

    return res.status(201).json({ ok: true, data, message: 'Compra registrada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al registrar la compra; verifique el resultado antes de reintentar',
      });
    }

    if (
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe' ||
      message === 'Debe enviar al menos un detalle para registrar la compra' ||
      message.includes('no existe o está anulado')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una compra activa con ese numeroFactura para este proveedor') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function anulatePurchaseController(req: Request, res: Response) {
  try {
    const { id } = purchaseIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulatePurchaseBodySchema.parse(req.body ?? {});

    await anulatePurchase(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Compra anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al anular la compra; verifique el resultado antes de reintentar',
      });
    }

    if (
      message === 'Compra no existe o ya está anulada' ||
      message === 'Usuario no existe' ||
      message.includes('no existe o está anulado')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('No se puede anular compra: stock insuficiente')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restorePurchaseController(req: Request, res: Response) {
  try {
    const { id } = purchaseIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restorePurchaseBodySchema.parse(req.body ?? {});

    const data = await restorePurchase(id, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({ ok: true, data, message: 'Compra restaurada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al restaurar la compra; verifique el resultado antes de reintentar',
      });
    }

    if (
      message === 'Compra anulada no existe' ||
      message === 'Usuario no existe' ||
      message.includes('no existe o está anulado')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listPurchaseExpensesController(req: Request, res: Response) {
  try {
    const { id } = purchaseIdParamsSchema.parse(req.params);
    const data = await listPurchaseExpenses(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Compra no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createPurchaseExpenseController(req: Request, res: Response) {
  try {
    const { id } = purchaseIdParamsSchema.parse(req.params);
    const dataInput = createPurchaseExpenseSchema.parse(req.body);

    const data = await createPurchaseExpense(id, {
      ...dataInput,
      descripcion: dataInput.descripcion.trim(),
    });

    return res.status(201).json({ ok: true, data, message: 'Gasto asociado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Compra no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Solo se pueden asociar gastos en compras marcadas como gasto') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updatePurchaseExpenseController(req: Request, res: Response) {
  try {
    const { id, idGasto } = purchaseExpenseIdParamsSchema.parse(req.params);
    const dataInput = updatePurchaseExpenseSchema.parse(req.body);

    const data = await updatePurchaseExpense(id, idGasto, {
      ...dataInput,
      ...(dataInput.descripcion !== undefined
        ? { descripcion: dataInput.descripcion.trim() }
        : {}),
      idUsuarioModificador: req.auth?.userId ?? dataInput.idUsuarioModificador,
    });

    return res.status(200).json({ ok: true, data, message: 'Gasto actualizado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Detalle de gasto no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deletePurchaseExpenseController(req: Request, res: Response) {
  try {
    const { id, idGasto } = purchaseExpenseIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deletePurchaseExpenseBodySchema.parse(req.body ?? {});

    await deletePurchaseExpense(id, idGasto, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Gasto anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Detalle de gasto no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restorePurchaseExpenseController(req: Request, res: Response) {
  try {
    const { id, idGasto } = purchaseExpenseIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restorePurchaseExpenseBodySchema.parse(req.body ?? {});

    const data = await restorePurchaseExpense(
      id,
      idGasto,
      req.auth?.userId ?? idUsuarioModificador,
    );

    return res.status(200).json({ ok: true, data, message: 'Gasto restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Detalle de gasto anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
