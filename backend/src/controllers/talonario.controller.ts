import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  anulateTalonario,
  createTalonario,
  getTalonarioById,
  listAnulatedTalonarios,
  listTalonarios,
  restoreTalonario,
  updateTalonario,
} from '../services/talonario.service';
import {
  anulateTalonarioBodySchema,
  createTalonarioSchema,
  restoreTalonarioBodySchema,
  talonarioIdParamsSchema,
  updateTalonarioSchema,
} from '../validators/talonario.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listTalonariosController(_req: Request, res: Response) {
  try {
    const data = await listTalonarios();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedTalonariosController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedTalonarios();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getTalonarioByIdController(req: Request, res: Response) {
  try {
    const { id } = talonarioIdParamsSchema.parse(req.params);
    const data = await getTalonarioById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Talonario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createTalonarioController(req: Request, res: Response) {
  try {
    const payload = createTalonarioSchema.parse(req.body);
    const data = await createTalonario({
      ...payload,
      nombre: payload.nombre.trim(),
    });

    return res.status(201).json({ ok: true, data, message: 'Talonario registrado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Ya existe un talonario activo con ese nombre'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.includes('correlativo') || message.includes('rango')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateTalonarioController(req: Request, res: Response) {
  try {
    const { id } = talonarioIdParamsSchema.parse(req.params);
    const payload = updateTalonarioSchema.parse(req.body);

    const data = await updateTalonario(id, {
      ...payload,
      ...(payload.nombre !== undefined ? { nombre: payload.nombre.trim() } : {}),
    });

    return res.status(200).json({ ok: true, data, message: 'Talonario actualizado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Talonario no existe' ||
      message === 'Usuario no existe' ||
      message === 'Ya existe un talonario activo con ese nombre'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.includes('modificado concurrentemente')) {
      return res.status(409).json({ ok: false, message });
    }

    if (message.includes('correlativo') || message.includes('rango')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function anulateTalonarioController(req: Request, res: Response) {
  try {
    const { id } = talonarioIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulateTalonarioBodySchema.parse(req.body ?? {});

    await anulateTalonario(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Talonario anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Talonario no existe o ya está anulado' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreTalonarioController(req: Request, res: Response) {
  try {
    const { id } = talonarioIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreTalonarioBodySchema.parse(req.body ?? {});

    const data = await restoreTalonario(id, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({ ok: true, data, message: 'Talonario restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Talonario anulado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Ya existe un talonario activo con ese nombre'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
