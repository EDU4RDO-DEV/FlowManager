import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createControlCalidad,
  deleteControlCalidad,
  getControlCalidadById,
  listAnulatedControlCalidad,
  listControlCalidad,
  listFechasFaltantes,
  restoreControlCalidad,
  updateControlCalidad,
  validateControlCalidadRegistro,
} from '../services/quality.service';
import {
  controlCalidadIdParamsSchema,
  createControlCalidadSchema,
  deleteControlCalidadBodySchema,
  listControlCalidadQuerySchema,
  listFechasFaltantesQuerySchema,
  restoreControlCalidadBodySchema,
  updateControlCalidadSchema,
  validateControlCalidadBodySchema,
} from '../validators/quality.validators';
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
  'Registro de control de calidad no existe',
  'Registro anulado no existe',
]);

const CONFLICT_MESSAGES = new Set([
  'Ya existe un registro activo de control de calidad para esa fecha',
  'No se puede editar un registro ya validado',
]);

function mapErrorStatus(message: string): number {
  if (NOT_FOUND_MESSAGES.has(message)) return 404;
  if (CONFLICT_MESSAGES.has(message)) return 409;
  if (message.startsWith('Debe registrar las 4 mediciones')) return 400;
  return 500;
}

export async function listControlCalidadController(req: Request, res: Response) {
  try {
    const query = listControlCalidadQuerySchema.parse(req.query);
    const data = await listControlCalidad(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedControlCalidadController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedControlCalidad();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listFechasFaltantesController(req: Request, res: Response) {
  try {
    const { anio, mes } = listFechasFaltantesQuerySchema.parse(req.query);
    const data = await listFechasFaltantes(anio, mes);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getControlCalidadByIdController(req: Request, res: Response) {
  try {
    const { id } = controlCalidadIdParamsSchema.parse(req.params);
    const data = await getControlCalidadById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function createControlCalidadController(req: Request, res: Response) {
  try {
    const payload = createControlCalidadSchema.parse(req.body);
    const data = await createControlCalidad(payload);
    return res.status(201).json({ ok: true, data, message: 'Registro de control de calidad creado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function updateControlCalidadController(req: Request, res: Response) {
  try {
    const { id } = controlCalidadIdParamsSchema.parse(req.params);
    const payload = updateControlCalidadSchema.parse(req.body);
    const data = await updateControlCalidad(id, {
      ...payload,
      idUsuarioModificador: req.auth?.userId ?? payload.idUsuarioModificador,
    });
    return res.status(200).json({ ok: true, data, message: 'Registro actualizado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function validateControlCalidadController(req: Request, res: Response) {
  try {
    const { id } = controlCalidadIdParamsSchema.parse(req.params);
    const { idUsuarioValidador } = validateControlCalidadBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioValidador;

    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioValidador es requerido' });
    }

    const data = await validateControlCalidadRegistro(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Registro validado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function deleteControlCalidadController(req: Request, res: Response) {
  try {
    const { id } = controlCalidadIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteControlCalidadBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteControlCalidad(id, userId);
    return res.status(200).json({ ok: true, message: 'Registro anulado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function restoreControlCalidadController(req: Request, res: Response) {
  try {
    const { id } = controlCalidadIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreControlCalidadBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreControlCalidad(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Registro restaurado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}
