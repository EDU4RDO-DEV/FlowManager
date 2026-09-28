import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createClienteCondicionCredito,
  createTipoCliente,
  deleteClienteCondicionCredito,
  deleteTipoCliente,
  getClienteCondicionCreditoById,
  getTipoClienteById,
  listAnulatedClienteCondicionesCredito,
  listAnulatedTiposCliente,
  listClienteCondicionesCredito,
  listTiposCliente,
  restoreClienteCondicionCredito,
  restoreTipoCliente,
  updateClienteCondicionCredito,
  updateTipoCliente,
} from '../services/client-catalog.service';
import {
  condicionCreditoIdParamsSchema,
  createCondicionCreditoSchema,
  createTipoClienteSchema,
  deleteCondicionCreditoBodySchema,
  deleteTipoClienteBodySchema,
  listCondicionesCreditoQuerySchema,
  restoreCondicionCreditoBodySchema,
  restoreTipoClienteBodySchema,
  tipoClienteIdParamsSchema,
  updateCondicionCreditoSchema,
  updateTipoClienteSchema,
} from '../validators/client-catalog.validators';
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

// ===== TipoCliente =====

export async function listTiposClienteController(_req: Request, res: Response) {
  try {
    const data = await listTiposCliente();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedTiposClienteController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedTiposCliente();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getTipoClienteByIdController(req: Request, res: Response) {
  try {
    const { id } = tipoClienteIdParamsSchema.parse(req.params);
    const data = await getTipoClienteById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Tipo de cliente no existe') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function createTipoClienteController(req: Request, res: Response) {
  try {
    const payload = createTipoClienteSchema.parse(req.body);
    const data = await createTipoCliente(payload);
    return res.status(201).json({ ok: true, data, message: 'Tipo de cliente creado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'Ya existe un tipo de cliente con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function updateTipoClienteController(req: Request, res: Response) {
  try {
    const { id } = tipoClienteIdParamsSchema.parse(req.params);
    const payload = updateTipoClienteSchema.parse(req.body);
    const data = await updateTipoCliente(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Tipo de cliente actualizado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Tipo de cliente no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'Ya existe un tipo de cliente con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteTipoClienteController(req: Request, res: Response) {
  try {
    const { id } = tipoClienteIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteTipoClienteBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteTipoCliente(id, userId);
    return res.status(200).json({ ok: true, message: 'Tipo de cliente anulado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Tipo de cliente no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreTipoClienteController(req: Request, res: Response) {
  try {
    const { id } = tipoClienteIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreTipoClienteBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreTipoCliente(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Tipo de cliente restaurado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Tipo de cliente anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'Ya existe un tipo de cliente con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

// ===== ClienteCondicionCredito =====

export async function listCondicionesCreditoController(req: Request, res: Response) {
  try {
    const query = listCondicionesCreditoQuerySchema.parse(req.query);
    const data = await listClienteCondicionesCredito(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedCondicionesCreditoController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedClienteCondicionesCredito();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getCondicionCreditoByIdController(req: Request, res: Response) {
  try {
    const { id } = condicionCreditoIdParamsSchema.parse(req.params);
    const data = await getClienteCondicionCreditoById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Condición de crédito no existe') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function createCondicionCreditoController(req: Request, res: Response) {
  try {
    const payload = createCondicionCreditoSchema.parse(req.body);
    const data = await createClienteCondicionCredito(payload);
    return res.status(201).json({ ok: true, data, message: 'Condición de crédito creada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (
      message === 'Usuario no existe' ||
      message === 'Cliente no existe' ||
      message === 'Tipo de crédito no existe o no está activo'
    ) {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message === 'fechaFinVigencia no puede ser anterior a fechaInicioVigencia' ||
      message === 'El cliente ya tiene una condición de crédito vigente sin fecha de fin'
    ) {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function updateCondicionCreditoController(req: Request, res: Response) {
  try {
    const { id } = condicionCreditoIdParamsSchema.parse(req.params);
    const payload = updateCondicionCreditoSchema.parse(req.body);
    const data = await updateClienteCondicionCredito(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Condición de crédito actualizada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (
      message === 'Condición de crédito no existe' ||
      message === 'Usuario no existe' ||
      message === 'Tipo de crédito no existe o no está activo'
    ) {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message === 'fechaFinVigencia no puede ser anterior a fechaInicioVigencia' ||
      message === 'El cliente ya tiene una condición de crédito vigente sin fecha de fin'
    ) {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteCondicionCreditoController(req: Request, res: Response) {
  try {
    const { id } = condicionCreditoIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteCondicionCreditoBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteClienteCondicionCredito(id, userId);
    return res.status(200).json({ ok: true, message: 'Condición de crédito anulada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Condición de crédito no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreCondicionCreditoController(req: Request, res: Response) {
  try {
    const { id } = condicionCreditoIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreCondicionCreditoBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreClienteCondicionCredito(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Condición de crédito restaurada correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    if (message === 'Condición de crédito anulada no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'El cliente ya tiene una condición de crédito vigente sin fecha de fin') {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}
