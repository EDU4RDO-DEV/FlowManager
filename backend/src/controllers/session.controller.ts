import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createSession,
  deleteSession,
  getSessionById,
  listSessions,
  updateSession,
} from '../services/session.service';
import {
  createSessionSchema,
  sessionIdParamsSchema,
  updateSessionSchema,
} from '../validators/session.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listSessionsController(_req: Request, res: Response) {
  try {
    const data = await listSessions();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getSessionByIdController(req: Request, res: Response) {
  try {
    const { id } = sessionIdParamsSchema.parse(req.params);

    const data = await getSessionById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Sesion no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createSessionController(req: Request, res: Response) {
  try {
    const dataInput = createSessionSchema.parse(req.body);

    const data = await createSession({
      ...dataInput,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'fechaExpiracionToken inválida') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateSessionController(req: Request, res: Response) {
  try {
    const { id } = sessionIdParamsSchema.parse(req.params);
    const dataInput = updateSessionSchema.parse(req.body);

    const data = await updateSession(id, dataInput);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Sesion no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'fechaExpiracionToken inválida') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteSessionController(req: Request, res: Response) {
  try {
    const { id } = sessionIdParamsSchema.parse(req.params);

    await deleteSession(id);
    return res.status(200).json({ ok: true, message: 'Sesion anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Sesion no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}