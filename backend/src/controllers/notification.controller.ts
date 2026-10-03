import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { sendNotification } from '../services/notification.service';
import { testNotificationBodySchema } from '../validators/notification.validators';
import { getZodErrorMessage } from '../validators/validation';

function statusForFailureReason(reason: string): number {
  switch (reason) {
    case 'not_configured':
      return 503;
    case 'timeout':
      return 504;
    default:
      return 502;
  }
}

// Endpoint de prueba (Fase 17): confirma que Backend -> n8n -> Telegram funciona
// de punta a punta sin acoplar lógica de negocio real todavía.
export async function testNotificationController(req: Request, res: Response) {
  try {
    const body = testNotificationBodySchema.parse(req.body ?? {});

    const result = await sendNotification({
      tipo: 'prueba',
      titulo: body.titulo ?? 'Prueba de notificación',
      mensaje: body.mensaje ?? 'Prueba de integración BASAN → n8n → Telegram',
      metadata: body.metadata,
    });

    if (result.ok) {
      return res.status(200).json({ ok: true, message: 'Evento enviado a n8n', data: result });
    }

    return res.status(statusForFailureReason(result.reason)).json({ ok: false, message: result.message, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}
