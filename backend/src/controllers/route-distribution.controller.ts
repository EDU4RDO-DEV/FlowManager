import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  cancelVehicleTransfer,
  confirmVehicleTransfer,
  createVehicleTransfer,
  listVehicleTransfers,
  rejectVehicleTransfer,
} from '../services/route-transfer.service';
import { createVehicleHandoff } from '../services/route-handoff.service';
import {
  cancelTransferSchema,
  createVehicleHandoffSchema,
  createVehicleTransferSchema,
  listTransfersQuerySchema,
  routeInventoryHandoffParamsSchema,
  transferDecisionSchema,
  transferIdParamsSchema,
} from '../validators/route-distribution.validators';
import { getZodErrorMessage } from '../validators/validation';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno';
}

function handleError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  ) {
    return res.status(409).json({
      ok: false,
      message: 'La ruta o las existencias cambiaron por una operación concurrente. Verifique el estado antes de reintentar.',
    });
  }
  const message = getErrorMessage(error);
  if (message.includes('no existe')) {
    return res.status(404).json({ ok: false, message });
  }
  if (
    message.includes('debe estar') ||
    message.includes('Existencia insuficiente') ||
    message.includes('diferentes') ||
    message.includes('mayor a cero') ||
    message.includes('Solo una transferencia') ||
    message.includes('no está configurado') ||
    message.includes('Indica el estado') ||
    message.includes('debe cerrarse') ||
    message.includes('No se puede') ||
    message.includes('tiene productos pendientes') ||
    message.includes('no disponible')
  ) {
    return res.status(409).json({ ok: false, message });
  }
  return res.status(500).json({ ok: false, message });
}

export async function listVehicleTransfersController(req: Request, res: Response) {
  try {
    const query = listTransfersQuerySchema.parse(req.query);
    const data = await listVehicleTransfers(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createVehicleTransferController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const input = createVehicleTransferSchema.parse(req.body);
    const data = await createVehicleTransfer(idUsuario, input);
    return res.status(201).json({ ok: true, data, message: 'Transferencia registrada en estado PENDIENTE' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function confirmVehicleTransferController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = transferIdParamsSchema.parse(req.params);
    transferDecisionSchema.parse(req.body ?? {});
    const data = await confirmVehicleTransfer(id, idUsuario);
    return res.status(200).json({ ok: true, data, message: 'Transferencia confirmada' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function rejectVehicleTransferController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = transferIdParamsSchema.parse(req.params);
    const input = transferDecisionSchema.parse(req.body ?? {});
    const data = await rejectVehicleTransfer(id, idUsuario, input.motivo ?? 'Rechazada por el vehículo destino');
    return res.status(200).json({ ok: true, data, message: 'Transferencia rechazada' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function cancelVehicleTransferController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = transferIdParamsSchema.parse(req.params);
    const input = cancelTransferSchema.parse(req.body);
    const data = await cancelVehicleTransfer(id, idUsuario, input.motivo);
    return res.status(200).json({ ok: true, data, message: 'Transferencia anulada' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createVehicleHandoffController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryHandoffParamsSchema.parse(req.params);
    const input = createVehicleHandoffSchema.parse(req.body);
    const data = await createVehicleHandoff(id, idUsuario, input);
    return res.status(201).json({ ok: true, data, message: 'Relevo de vehículo registrado' });
  } catch (error) {
    return handleError(error, res);
  }
}
