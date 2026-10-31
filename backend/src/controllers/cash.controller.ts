import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
} from '../services/cash.service';
import {
  cashSessionIdSchema,
  closeCashSessionSchema,
  openCashSessionSchema,
} from '../validators/cash.validators';
import { getZodErrorMessage } from '../validators/validation';

function handleError(res: Response, error: unknown) {
  if (error instanceof ZodError) {
    return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
  }
  const message = error instanceof Error ? error.message : 'Error interno';
  const status = [
    'Ya existe una caja abierta',
    'La caja no existe o ya está cerrada',
    'La caja ya fue cerrada por otro usuario',
  ].includes(message) ? 409 : 500;
  return res.status(status).json({ ok: false, message });
}

export async function getCurrentCashSessionController(_req: Request, res: Response) {
  try {
    const data = await getCurrentCashSession();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listCashSessionsController(_req: Request, res: Response) {
  try {
    const data = await listCashSessions();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function openCashSessionController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const body = openCashSessionSchema.parse(req.body);
    const data = await openCashSession(req.auth.userId, body.saldoInicial);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function closeCashSessionController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const { id } = cashSessionIdSchema.parse(req.params);
    const body = closeCashSessionSchema.parse(req.body);
    const data = await closeCashSession(
      id,
      req.auth.userId,
      body.efectivoContado,
      body.observaciones,
    );
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error);
  }
}
