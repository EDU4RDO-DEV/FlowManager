import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createProvider,
  deleteProvider,
  getProviderById,
  listAnulatedProviders,
  listProviders,
  restoreProvider,
  updateProvider,
} from '../services/provider.service';
import {
  createProviderSchema,
  deleteProviderBodySchema,
  providerIdParamsSchema,
  restoreProviderBodySchema,
  updateProviderSchema,
} from '../validators/provider.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listProvidersController(_req: Request, res: Response) {
  try {
    const data = await listProviders();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getProviderByIdController(req: Request, res: Response) {
  try {
    const { id } = providerIdParamsSchema.parse(req.params);

    const data = await getProviderById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Proveedor no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createProviderController(req: Request, res: Response) {
  try {
    const payload = createProviderSchema.parse(req.body);

    const data = await createProvider({
      idUsuario: payload.idUsuario,
      nombre: payload.nombre,
      entidad: payload.entidad,
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

    if (message === 'fechaNacimiento inválida') {
      return res
        .status(400)
        .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateProviderController(req: Request, res: Response) {
  try {
    const { id } = providerIdParamsSchema.parse(req.params);
    const payload = updateProviderSchema.parse(req.body);

    const data = await updateProvider(id, {
      ...payload,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Proveedor no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'fechaNacimiento inválida') {
      return res
        .status(400)
        .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteProviderController(req: Request, res: Response) {
  try {
    const { id } = providerIdParamsSchema.parse(req.params);
    deleteProviderBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    await deleteProvider(id, req.auth.userId);

    return res.status(200).json({ ok: true, message: 'Proveedor anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Proveedor no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedProvidersController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedProviders();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreProviderController(req: Request, res: Response) {
  try {
    const { id } = providerIdParamsSchema.parse(req.params);
    restoreProviderBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await restoreProvider(id, req.auth.userId);

    return res.status(200).json({ ok: true, data, message: 'Proveedor restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Proveedor anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}