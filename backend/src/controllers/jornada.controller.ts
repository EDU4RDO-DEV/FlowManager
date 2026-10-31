import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  closeJornada,
  createJornada,
  getJornadaById,
  listJornadas,
} from '../services/jornada.service';
import type { OperationalActor } from '../services/operational-scope.service';
import {
  createJornadaSchema,
  jornadaIdParamsSchema,
  listJornadasQuerySchema,
} from '../validators/route-distribution.validators';
import { getZodErrorMessage } from '../validators/validation';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno';
}

function getActor(req: Request): OperationalActor | null {
  if (!req.auth?.userId) return null;
  return { userId: req.auth.userId, roleName: req.auth.nombreRol };
}

function handleError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
  }
  const message = getErrorMessage(error);
  if (message.includes('no existe')) {
    return res.status(404).json({ ok: false, message });
  }
  if (
    message.includes('debe estar') ||
    message.includes('ya está cerrada') ||
    message.includes('No se puede cerrar')
  ) {
    return res.status(409).json({ ok: false, message });
  }
  return res.status(500).json({ ok: false, message });
}

export async function listJornadasController(req: Request, res: Response) {
  try {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const query = listJornadasQuerySchema.parse(req.query);
    const data = await listJornadas(query, actor);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function getJornadaByIdController(req: Request, res: Response) {
  try {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = jornadaIdParamsSchema.parse(req.params);
    const data = await getJornadaById(id, actor);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createJornadaController(req: Request, res: Response) {
  try {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const input = createJornadaSchema.parse(req.body);
    const data = await createJornada(input, actor);
    return res.status(201).json({ ok: true, data, message: 'Jornada creada' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function closeJornadaController(req: Request, res: Response) {
  try {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = jornadaIdParamsSchema.parse(req.params);
    const data = await closeJornada(id, actor.userId, actor);
    return res.status(200).json({ ok: true, data, message: 'Jornada cerrada' });
  } catch (error) {
    return handleError(error, res);
  }
}
