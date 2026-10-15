import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { roleHasModulePermission } from '../middlewares/auth.middleware';
import {
  cancelProductionOrder,
  confirmProductionOrder,
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  listProductionRecipes,
} from '../services/production.service';
import {
  createProductionOrderSchema,
  listProductionOrdersQuerySchema,
  productionOrderIdParamsSchema,
} from '../validators/production.validators';
import { getZodErrorMessage } from '../validators/validation';

function getStatusForProductionError(error: unknown, message: string): number {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2028', 'P2034'].includes(error.code)
  ) {
    return 409;
  }
  if (message === 'Orden de producción no existe') {
    return 404;
  }
  if (
    message.includes('cambió') ||
    message.includes('ya fue confirmada') ||
    message.includes('Sólo se pueden cancelar') ||
    message.includes('movimientos de inventario') ||
    message.includes('Existencia insuficiente')
  ) {
    return 409;
  }
  if (
    message.includes('Falta definir') ||
    message.includes('no tiene una receta') ||
    message.includes('no es una materia prima') ||
    message.includes('unidad') ||
    message.includes('cantidad') ||
    message.includes('Producto terminado no existe')
  ) {
    return 400;
  }
  return 500;
}

function getProductionErrorMessage(error: unknown, message: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
    return 'Conflicto concurrente de producción; consulta el estado de la orden antes de reintentar';
  }
  return message;
}

export async function listProductionRecipesController(_req: Request, res: Response) {
  try {
    const data = await listProductionRecipes();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listProductionOrdersController(req: Request, res: Response) {
  try {
    const query = listProductionOrdersQuerySchema.parse(req.query);
    const data = await listProductionOrders(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getProductionOrderController(req: Request, res: Response) {
  try {
    const { id } = productionOrderIdParamsSchema.parse(req.params);
    const data = await getProductionOrder(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res
      .status(getStatusForProductionError(error, message))
      .json({ ok: false, message: getProductionErrorMessage(error, message) });
  }
}

export async function createProductionOrderController(req: Request, res: Response) {
  try {
    const input = createProductionOrderSchema.parse(req.body);
    const idUsuario = req.auth?.userId;
    if (!idUsuario) {
      return res.status(401).json({ ok: false, message: 'Sesión no válida' });
    }

    const data = await createProductionOrder({ ...input, idUsuario });
    return res.status(201).json({ ok: true, data, message: 'Orden de producción creada' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res
      .status(getStatusForProductionError(error, message))
      .json({ ok: false, message: getProductionErrorMessage(error, message) });
  }
}

export async function confirmProductionOrderController(req: Request, res: Response) {
  try {
    const { id } = productionOrderIdParamsSchema.parse(req.params);
    const idUsuario = req.auth?.userId;
    if (!idUsuario) {
      return res.status(401).json({ ok: false, message: 'Sesión no válida' });
    }

    const allowNegativeStock = await roleHasModulePermission(
      req.auth?.idRol,
      'produccion',
      'allow-negative-stock',
    );
    const data = await confirmProductionOrder(id, idUsuario, allowNegativeStock);
    return res.status(200).json({ ok: true, data, message: 'Fabricación confirmada' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res
      .status(getStatusForProductionError(error, message))
      .json({ ok: false, message: getProductionErrorMessage(error, message) });
  }
}

export async function cancelProductionOrderController(req: Request, res: Response) {
  try {
    const { id } = productionOrderIdParamsSchema.parse(req.params);
    const idUsuario = req.auth?.userId;
    if (!idUsuario) {
      return res.status(401).json({ ok: false, message: 'Sesión no válida' });
    }
    const data = await cancelProductionOrder(id, idUsuario);
    return res.status(200).json({ ok: true, data, message: 'Orden cancelada' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res
      .status(getStatusForProductionError(error, message))
      .json({ ok: false, message: getProductionErrorMessage(error, message) });
  }
}
