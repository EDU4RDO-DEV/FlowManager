import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createReglaBonificacion,
  createReglaPrecioCliente,
  createTipoCredito,
  deleteReglaBonificacion,
  deleteReglaPrecioCliente,
  deleteTipoCredito,
  getReglaBonificacionById,
  getReglaPrecioClienteById,
  getTipoCreditoById,
  listAnulatedReglasBonificacion,
  listAnulatedReglasPrecioCliente,
  listAnulatedTiposCredito,
  listReglasBonificacion,
  listReglasPrecioCliente,
  listTiposCredito,
  restoreReglaBonificacion,
  restoreReglaPrecioCliente,
  restoreTipoCredito,
  updateReglaBonificacion,
  updateReglaPrecioCliente,
  updateTipoCredito,
} from '../services/commercial-rule.service';
import {
  createReglaBonificacionSchema,
  createReglaPrecioClienteSchema,
  createTipoCreditoSchema,
  deleteReglaBonificacionBodySchema,
  deleteReglaPrecioClienteBodySchema,
  deleteTipoCreditoBodySchema,
  listReglasBonificacionQuerySchema,
  listReglasPrecioClienteQuerySchema,
  listTiposCreditoQuerySchema,
  reglaBonificacionIdParamsSchema,
  reglaPrecioClienteIdParamsSchema,
  restoreReglaBonificacionBodySchema,
  restoreReglaPrecioClienteBodySchema,
  restoreTipoCreditoBodySchema,
  tipoCreditoIdParamsSchema,
  updateReglaBonificacionSchema,
  updateReglaPrecioClienteSchema,
  updateTipoCreditoSchema,
} from '../validators/commercial-rule.validators';
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
  'Tipo de crédito no existe',
  'Tipo de crédito anulado no existe',
  'Tipo de cliente no existe',
  'InventarioItem no existe',
  'Regla de precio no existe',
  'Regla de precio anulada no existe',
  'Regla de bonificación no existe',
  'Regla de bonificación anulada no existe',
]);

const CONFLICT_MESSAGES = new Set([
  'Ya existe un tipo de crédito con ese nombre',
  'fechaFin no puede ser anterior a fechaInicio',
  'cantidadMaxima no puede ser menor a cantidadMinima',
]);

function mapErrorStatus(message: string): number {
  if (NOT_FOUND_MESSAGES.has(message)) return 404;
  if (CONFLICT_MESSAGES.has(message)) return 409;
  return 500;
}

// ===== TipoCredito =====

export async function listTiposCreditoController(req: Request, res: Response) {
  try {
    const query = listTiposCreditoQuerySchema.parse(req.query);
    const data = await listTiposCredito(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedTiposCreditoController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedTiposCredito();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getTipoCreditoByIdController(req: Request, res: Response) {
  try {
    const { id } = tipoCreditoIdParamsSchema.parse(req.params);
    const data = await getTipoCreditoById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function createTipoCreditoController(req: Request, res: Response) {
  try {
    const payload = createTipoCreditoSchema.parse(req.body);
    const data = await createTipoCredito(payload);
    return res.status(201).json({ ok: true, data, message: 'Tipo de crédito creado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function updateTipoCreditoController(req: Request, res: Response) {
  try {
    const { id } = tipoCreditoIdParamsSchema.parse(req.params);
    const payload = updateTipoCreditoSchema.parse(req.body);
    const data = await updateTipoCredito(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Tipo de crédito actualizado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function deleteTipoCreditoController(req: Request, res: Response) {
  try {
    const { id } = tipoCreditoIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteTipoCreditoBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteTipoCredito(id, userId);
    return res.status(200).json({ ok: true, message: 'Tipo de crédito anulado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function restoreTipoCreditoController(req: Request, res: Response) {
  try {
    const { id } = tipoCreditoIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreTipoCreditoBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreTipoCredito(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Tipo de crédito restaurado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

// ===== ReglaPrecioCliente =====

export async function listReglasPrecioClienteController(req: Request, res: Response) {
  try {
    const query = listReglasPrecioClienteQuerySchema.parse(req.query);
    const data = await listReglasPrecioCliente(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedReglasPrecioClienteController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedReglasPrecioCliente();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getReglaPrecioClienteByIdController(req: Request, res: Response) {
  try {
    const { id } = reglaPrecioClienteIdParamsSchema.parse(req.params);
    const data = await getReglaPrecioClienteById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function createReglaPrecioClienteController(req: Request, res: Response) {
  try {
    const payload = createReglaPrecioClienteSchema.parse(req.body);
    const data = await createReglaPrecioCliente(payload);
    return res.status(201).json({ ok: true, data, message: 'Regla de precio creada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function updateReglaPrecioClienteController(req: Request, res: Response) {
  try {
    const { id } = reglaPrecioClienteIdParamsSchema.parse(req.params);
    const payload = updateReglaPrecioClienteSchema.parse(req.body);
    const data = await updateReglaPrecioCliente(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Regla de precio actualizada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function deleteReglaPrecioClienteController(req: Request, res: Response) {
  try {
    const { id } = reglaPrecioClienteIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteReglaPrecioClienteBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteReglaPrecioCliente(id, userId);
    return res.status(200).json({ ok: true, message: 'Regla de precio anulada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function restoreReglaPrecioClienteController(req: Request, res: Response) {
  try {
    const { id } = reglaPrecioClienteIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreReglaPrecioClienteBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreReglaPrecioCliente(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Regla de precio restaurada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

// ===== ReglaBonificacion =====

export async function listReglasBonificacionController(req: Request, res: Response) {
  try {
    const query = listReglasBonificacionQuerySchema.parse(req.query);
    const data = await listReglasBonificacion(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedReglasBonificacionController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedReglasBonificacion();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getReglaBonificacionByIdController(req: Request, res: Response) {
  try {
    const { id } = reglaBonificacionIdParamsSchema.parse(req.params);
    const data = await getReglaBonificacionById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function createReglaBonificacionController(req: Request, res: Response) {
  try {
    const payload = createReglaBonificacionSchema.parse(req.body);
    const data = await createReglaBonificacion(payload);
    return res.status(201).json({ ok: true, data, message: 'Regla de bonificación creada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function updateReglaBonificacionController(req: Request, res: Response) {
  try {
    const { id } = reglaBonificacionIdParamsSchema.parse(req.params);
    const payload = updateReglaBonificacionSchema.parse(req.body);
    const data = await updateReglaBonificacion(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Regla de bonificación actualizada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function deleteReglaBonificacionController(req: Request, res: Response) {
  try {
    const { id } = reglaBonificacionIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteReglaBonificacionBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteReglaBonificacion(id, userId);
    return res.status(200).json({ ok: true, message: 'Regla de bonificación anulada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function restoreReglaBonificacionController(req: Request, res: Response) {
  try {
    const { id } = reglaBonificacionIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreReglaBonificacionBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreReglaBonificacion(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Regla de bonificación restaurada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}
