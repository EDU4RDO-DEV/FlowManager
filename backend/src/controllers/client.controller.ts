import { Request, Response } from 'express';

import {
  createClient,
  deleteClient,
  getClientById,
  listClients,
  updateClient,
} from '../services/client.service';

function parseId(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

function isValidPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
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

export async function getClientByIdController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const data = await getClientById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createClientController(req: Request, res: Response) {
  try {
    const { idUsuario, entidad } = req.body as {
      idUsuario?: number;
      entidad?: {
        nombreCompleto?: string;
        sexo?: string;
        fechaNacimiento?: string;
        telefono1?: string;
        telefono2?: string;
        correoElectronico?: string;
        rutaImagen?: string;
        nit?: string;
        dpi?: string;
      };
    };

    if (!isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario es obligatorio y debe ser entero positivo',
      });
    }

    if (!entidad || !entidad.nombreCompleto || !entidad.nombreCompleto.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'entidad.nombreCompleto es obligatorio',
      });
    }

    if (entidad.fechaNacimiento !== undefined) {
      const parsedDate = new Date(entidad.fechaNacimiento);
      if (Number.isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
      }
    }

    const data = await createClient({
      idUsuario: Number(idUsuario),
      entidad: {
        nombreCompleto: entidad.nombreCompleto.trim(),
        sexo: entidad.sexo,
        fechaNacimiento: entidad.fechaNacimiento,
        telefono1: entidad.telefono1,
        telefono2: entidad.telefono2,
        correoElectronico: entidad.correoElectronico,
        rutaImagen: entidad.rutaImagen,
        nit: entidad.nit,
        dpi: entidad.dpi,
      },
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
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
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { idUsuario, idUsuarioModificador, entidad } = req.body as {
      idUsuario?: number;
      idUsuarioModificador?: number;
      entidad?: {
        nombreCompleto?: string;
        sexo?: string;
        fechaNacimiento?: string;
        telefono1?: string;
        telefono2?: string;
        correoElectronico?: string;
        rutaImagen?: string;
        nit?: string;
        dpi?: string;
      };
    };

    if (idUsuario !== undefined && !isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario debe ser entero positivo cuando se envía',
      });
    }

    if (
      idUsuarioModificador !== undefined &&
      !isValidPositiveInteger(idUsuarioModificador)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioModificador debe ser entero positivo cuando se envía',
      });
    }

    if (
      entidad?.nombreCompleto !== undefined &&
      !entidad.nombreCompleto.trim()
    ) {
      return res.status(400).json({
        ok: false,
        message: 'entidad.nombreCompleto no puede ir vacío',
      });
    }

    if (entidad?.fechaNacimiento !== undefined) {
      const parsedDate = new Date(entidad.fechaNacimiento);
      if (Number.isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
      }
    }

    const data = await updateClient(id, {
      ...(idUsuario !== undefined ? { idUsuario: Number(idUsuario) } : {}),
      ...(idUsuarioModificador !== undefined
        ? { idUsuarioModificador: Number(idUsuarioModificador) }
        : {}),
      ...(entidad !== undefined
        ? {
            entidad: {
              ...(entidad.nombreCompleto !== undefined
                ? { nombreCompleto: entidad.nombreCompleto.trim() }
                : {}),
              ...(entidad.sexo !== undefined ? { sexo: entidad.sexo } : {}),
              ...(entidad.fechaNacimiento !== undefined
                ? { fechaNacimiento: entidad.fechaNacimiento }
                : {}),
              ...(entidad.telefono1 !== undefined ? { telefono1: entidad.telefono1 } : {}),
              ...(entidad.telefono2 !== undefined ? { telefono2: entidad.telefono2 } : {}),
              ...(entidad.correoElectronico !== undefined
                ? { correoElectronico: entidad.correoElectronico }
                : {}),
              ...(entidad.rutaImagen !== undefined ? { rutaImagen: entidad.rutaImagen } : {}),
              ...(entidad.nit !== undefined ? { nit: entidad.nit } : {}),
              ...(entidad.dpi !== undefined ? { dpi: entidad.dpi } : {}),
            },
          }
        : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe' || message === 'Usuario no existe') {
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
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { idUsuarioAnulador } = req.body as { idUsuarioAnulador?: number };

    if (idUsuarioAnulador !== undefined && !isValidPositiveInteger(idUsuarioAnulador)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioAnulador debe ser entero positivo cuando se envía',
      });
    }

    await deleteClient(
      id,
      idUsuarioAnulador !== undefined ? Number(idUsuarioAnulador) : undefined,
    );

    return res.status(200).json({ ok: true, message: 'Cliente anulado correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}