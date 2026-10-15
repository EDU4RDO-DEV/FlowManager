import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createClient,
  deleteClient,
  getClientById,
  listClients,
  listAnulatedClients,
  restoreClient,
  updateClient,
} from '../services/client.service';
import {
  clientIdParamsSchema,
  createClientSchema,
  deleteClientBodySchema,
  restoreClientBodySchema,
  updateClientSchema,
} from '../validators/client.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function uploadClientImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const rutaImagen = `/uploads/clients/${req.file.filename}`;
    const host = req.get('host');
    const url = host ? `${req.protocol}://${host}${rutaImagen}` : rutaImagen;

    return res.status(201).json({
      ok: true,
      message: 'Imagen cargada correctamente',
      data: {
        rutaImagen,
        url,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listClientsController(_req: Request, res: Response) {
  try {
    const data = await listClients();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedClientsController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedClients();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getClientByIdController(req: Request, res: Response) {
  try {
    const { id } = clientIdParamsSchema.parse(req.params);

    const data = await getClientById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createClientController(req: Request, res: Response) {
  try {
    const payload = createClientSchema.parse(req.body);

    const data = await createClient({
      idUsuario: payload.idUsuario,
      habilitadoCredito: payload.habilitadoCredito,
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

export async function updateClientController(req: Request, res: Response) {
  try {
    const { id } = clientIdParamsSchema.parse(req.params);
    const payload = updateClientSchema.parse(req.body);

    const data = await updateClient(id, {
      ...payload,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Cliente no existe' ||
      message === 'Usuario no existe'
    ) {
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

export async function deleteClientController(req: Request, res: Response) {
  try {
    const { id } = clientIdParamsSchema.parse(req.params);
    deleteClientBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    await deleteClient(id, req.auth.userId);

    return res.status(200).json({ ok: true, message: 'Cliente anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreClientController(req: Request, res: Response) {
  try {
    const { id } = clientIdParamsSchema.parse(req.params);
    restoreClientBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await restoreClient(id, req.auth.userId);

    return res.status(200).json({ ok: true, data, message: 'Cliente restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}