import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  anulateCreditPayment,
  createCreditPayment,
  getCreditById,
  getCreditsPortfolio,
  listCreditPayments,
  listCredits,
  listCreditsByCustomer,
} from '../services/credit.service';
import {
  anulateCreditPaymentBodySchema,
  createCreditPaymentSchema,
  creditIdParamsSchema,
  creditPaymentIdParamsSchema,
  customerIdParamsSchema,
  listCreditsQuerySchema,
} from '../validators/credit.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listCreditsController(req: Request, res: Response) {
  try {
    const query = listCreditsQuerySchema.parse(req.query);
    const data = await listCredits(query);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getCreditByIdController(req: Request, res: Response) {
  try {
    const { id } = creditIdParamsSchema.parse(req.params);
    const data = await getCreditById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'CuentaPorCobrar no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listCreditsByCustomerController(req: Request, res: Response) {
  try {
    const { idCliente } = customerIdParamsSchema.parse(req.params);
    const data = await listCreditsByCustomer(idCliente);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getCreditsPortfolioController(_req: Request, res: Response) {
  try {
    const data = await getCreditsPortfolio();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listCreditPaymentsController(req: Request, res: Response) {
  try {
    const { id } = creditIdParamsSchema.parse(req.params);
    const data = await listCreditPayments(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'CuentaPorCobrar no existe' || message === 'Venta no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createCreditPaymentController(req: Request, res: Response) {
  try {
    const { id } = creditIdParamsSchema.parse(req.params);
    const payload = createCreditPaymentSchema.parse(req.body);

    const data = await createCreditPayment(id, {
      ...payload,
      numeroReferencia: payload.numeroReferencia?.trim(),
      banco: payload.banco?.trim(),
      observaciones: payload.observaciones?.trim(),
      rutaFirma: payload.rutaFirma?.trim(),
    });

    return res.status(201).json({ ok: true, data, message: 'Pago registrado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'CuentaPorCobrar no existe' || message === 'Venta no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al registrar el pago; consulte el saldo antes de reintentar',
      });
    }

    if (message.startsWith('Pago no puede ser mayor') || message.includes('obligatorio')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function anulateCreditPaymentController(req: Request, res: Response) {
  try {
    const { id, idPago } = creditPaymentIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulateCreditPaymentBodySchema.parse(req.body ?? {});

    await anulateCreditPayment(id, idPago, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Pago anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'CuentaPorCobrar no existe' || message === 'Pago no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
