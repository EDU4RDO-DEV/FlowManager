import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  listCommissionAccruals,
  listCommissionReversalRequests,
  cancelCommissionReversalRequest,
  reviewCommissionReversalRequest,
} from '../services/commission-accrual.service';
import {
  commissionAccrualQuerySchema,
  commissionReversalIdParamsSchema,
  reviewCommissionReversalSchema,
} from '../validators/commission-accrual.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listCommissionAccrualsController(req: Request, res: Response) {
  try {
    const query = commissionAccrualQuerySchema.parse(req.query);
    const data = await listCommissionAccruals(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listCommissionReversalRequestsController(_req: Request, res: Response) {
  try {
    const data = await listCommissionReversalRequests();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function reviewCommissionReversalRequestController(req: Request, res: Response) {
  try {
    const { id } = commissionReversalIdParamsSchema.parse(req.params);
    const input = reviewCommissionReversalSchema.parse(req.body);
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const data = await reviewCommissionReversalRequest(
      id,
      req.auth.userId,
      input.decision,
      input.observaciones,
    );
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = [
      'Solicitud de reversión no existe',
      'La solicitud ya fue revisada',
      'No puede aprobar su propia solicitud de reversión',
    ].includes(message) ? 409 : 500;
    return res.status(status).json({ ok: false, message });
  }
}

export async function cancelCommissionReversalRequestController(req: Request, res: Response) {
  try {
    const { id } = commissionReversalIdParamsSchema.parse(req.params);
    const input = reviewCommissionReversalSchema.pick({ observaciones: true }).parse(req.body);
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const data = await cancelCommissionReversalRequest(id, req.auth.userId, input.observaciones);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = [
      'Solicitud de reversión no existe',
      'Solo se pueden anular solicitudes pendientes',
      'Solo quien solicitó la reversión puede anularla',
    ].includes(message) ? 409 : 500;
    return res.status(status).json({ ok: false, message });
  }
}
