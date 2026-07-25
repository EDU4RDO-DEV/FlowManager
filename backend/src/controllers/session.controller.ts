import { Request, Response } from 'express';

import {
  createSession,
  deleteSession,
  getSessionById,
  listSessions,
  updateSession,
} from '../services/session.service';

function parseId(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const data = await getSessionById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Sesion no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createSessionController(req: Request, res: Response) {
  try {
    const {
      idUsuario,
      ip,
      nombreDispositivo,
      tokenSesion,
      latitud,
      longitud,
      precision,
      fechaExpiracionToken,
    } = req.body as {
      idUsuario?: number;
      ip?: string;
      nombreDispositivo?: string;
      tokenSesion?: string;
      latitud?: number;
      longitud?: number;
      precision?: number;
      fechaExpiracionToken?: string;
    };

    if (!Number.isInteger(idUsuario) || Number(idUsuario) <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario es obligatorio y debe ser entero positivo',
      });
    }

    if (!ip || !nombreDispositivo || !tokenSesion || !fechaExpiracionToken) {
      return res.status(400).json({
        ok: false,
        message:
          'ip, nombreDispositivo, tokenSesion y fechaExpiracionToken son obligatorios',
      });
    }

    if (latitud !== undefined && !isValidNumber(latitud)) {
      return res.status(400).json({ ok: false, message: 'latitud inválida' });
    }

    if (longitud !== undefined && !isValidNumber(longitud)) {
      return res.status(400).json({ ok: false, message: 'longitud inválida' });
    }

    if (precision !== undefined && !isValidNumber(precision)) {
      return res.status(400).json({ ok: false, message: 'precision inválida' });
    }

    const data = await createSession({
      idUsuario: Number(idUsuario),
      ip,
      nombreDispositivo,
      tokenSesion,
      latitud,
      longitud,
      precision,
      fechaExpiracionToken,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
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
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const {
      idUsuario,
      ip,
      nombreDispositivo,
      tokenSesion,
      latitud,
      longitud,
      precision,
      fechaExpiracionToken,
    } = req.body as {
      idUsuario?: number;
      ip?: string;
      nombreDispositivo?: string;
      tokenSesion?: string;
      latitud?: number;
      longitud?: number;
      precision?: number;
      fechaExpiracionToken?: string;
    };

    if (idUsuario !== undefined && (!Number.isInteger(idUsuario) || Number(idUsuario) <= 0)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario debe ser entero positivo cuando se envía',
      });
    }

    if (latitud !== undefined && !isValidNumber(latitud)) {
      return res.status(400).json({ ok: false, message: 'latitud inválida' });
    }

    if (longitud !== undefined && !isValidNumber(longitud)) {
      return res.status(400).json({ ok: false, message: 'longitud inválida' });
    }

    if (precision !== undefined && !isValidNumber(precision)) {
      return res.status(400).json({ ok: false, message: 'precision inválida' });
    }

    const data = await updateSession(id, {
      ...(idUsuario !== undefined ? { idUsuario: Number(idUsuario) } : {}),
      ...(ip !== undefined ? { ip } : {}),
      ...(nombreDispositivo !== undefined ? { nombreDispositivo } : {}),
      ...(tokenSesion !== undefined ? { tokenSesion } : {}),
      ...(latitud !== undefined ? { latitud } : {}),
      ...(longitud !== undefined ? { longitud } : {}),
      ...(precision !== undefined ? { precision } : {}),
      ...(fechaExpiracionToken !== undefined ? { fechaExpiracionToken } : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
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
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    await deleteSession(id);
    return res.status(200).json({ ok: true, message: 'Sesion anulada correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Sesion no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}