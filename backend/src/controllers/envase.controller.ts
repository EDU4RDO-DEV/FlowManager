import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  anulateMovimientoEnvase,
  getMovimientoEnvaseById,
  listEnvaseClienteSaldos,
  listMovimientosEnvase,
  registrarDevolucionEnvase,
  registrarPrestamoEnvase,
  restoreMovimientoEnvase,
} from '../services/envase.service';
import {
  anulateMovimientoEnvaseBodySchema,
  listEnvaseSaldosQuerySchema,
  listMovimientosEnvaseQuerySchema,
  movimientoEnvaseIdParamsSchema,
  registrarDevolucionEnvaseSchema,
  registrarPrestamoEnvaseSchema,
  restoreMovimientoEnvaseBodySchema,
} from '../validators/envase.validators';
import { getZodErrorMessage } from '../validators/validation';

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error interno';
}

function handleZodOr500(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    return true;
  }
  return false;
}

const NOT_FOUND_MESSAGES = new Set([
  'Usuario no existe',
  'Cliente no existe',
  'InventarioItem no existe',
  'Venta no existe',
  'Movimiento de envase no existe',
  'Movimiento de envase anulado no existe',
]);

const CONFLICT_MESSAGES = new Set([
  'El InventarioItem indicado no es de categoría ENVASE',
  'La venta indicada no pertenece al cliente',
  'La cantidad devuelta no puede ser mayor al saldo prestado',
  'No es posible anular: el saldo del cliente quedaría negativo',
  'No es posible anular: la existencia en bodega quedaría negativa',
  'No es posible restaurar: el saldo del cliente quedaría negativo',
  'No es posible restaurar: la existencia en bodega quedaría negativa',
]);

function mapErrorStatus(error: unknown, message: string): number {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return 409;
  if (NOT_FOUND_MESSAGES.has(message)) return 404;
  if (CONFLICT_MESSAGES.has(message)) return 409;
  if (message.startsWith('Stock insuficiente')) return 409;
  if (message === 'cantidad debe ser mayor a 0') return 400;
  return 500;
}

export async function listMovimientosEnvaseController(req: Request, res: Response) {
  try {
    const query = listMovimientosEnvaseQuerySchema.parse(req.query);
    const data = await listMovimientosEnvase(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getMovimientoEnvaseByIdController(req: Request, res: Response) {
  try {
    const { id } = movimientoEnvaseIdParamsSchema.parse(req.params);
    const data = await getMovimientoEnvaseById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(error, message)).json({ ok: false, message });
  }
}

export async function listEnvaseSaldosController(req: Request, res: Response) {
  try {
    const query = listEnvaseSaldosQuerySchema.parse(req.query);
    const data = await listEnvaseClienteSaldos(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function registrarPrestamoEnvaseController(req: Request, res: Response) {
  try {
    const payload = registrarPrestamoEnvaseSchema.parse(req.body);

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await registrarPrestamoEnvase({ ...payload, idUsuario: req.auth.userId });
    return res.status(201).json({ ok: true, data, message: 'Préstamo de envase registrado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(error, message)).json({ ok: false, message });
  }
}

export async function registrarDevolucionEnvaseController(req: Request, res: Response) {
  try {
    const payload = registrarDevolucionEnvaseSchema.parse(req.body);

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await registrarDevolucionEnvase({ ...payload, idUsuario: req.auth.userId });
    return res.status(201).json({ ok: true, data, message: 'Devolución de envase registrada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(error, message)).json({ ok: false, message });
  }
}

export async function anulateMovimientoEnvaseController(req: Request, res: Response) {
  try {
    const { id } = movimientoEnvaseIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulateMovimientoEnvaseBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await anulateMovimientoEnvase(id, userId);
    return res.status(200).json({ ok: true, message: 'Movimiento de envase anulado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(error, message)).json({ ok: false, message });
  }
}

export async function restoreMovimientoEnvaseController(req: Request, res: Response) {
  try {
    const { id } = movimientoEnvaseIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreMovimientoEnvaseBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreMovimientoEnvase(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Movimiento de envase restaurado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(error, message)).json({ ok: false, message });
  }
}
