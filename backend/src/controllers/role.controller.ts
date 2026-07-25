import { Request, Response } from 'express';

import {
  createRole,
  deleteRole,
  getRoleById,
  listRoles,
  updateRole,
} from '../services/role.service';

function parseId(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

export async function listRolesController(_req: Request, res: Response) {
  try {
    const data = await listRoles();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getRoleByIdController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const data = await getRoleById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Rol no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createRoleController(req: Request, res: Response) {
  try {
    const { idUsuario, nombre, descripcion } = req.body as {
      idUsuario?: number;
      nombre?: string;
      descripcion?: string;
    };

    if (!Number.isInteger(idUsuario) || Number(idUsuario) <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario es obligatorio y debe ser entero positivo',
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'nombre es obligatorio',
      });
    }

    const data = await createRole({
      idUsuario: Number(idUsuario),
      nombre: nombre.trim(),
      descripcion,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe un rol con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateRoleController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { nombre, descripcion, idUsuarioModificador } = req.body as {
      nombre?: string;
      descripcion?: string | null;
      idUsuarioModificador?: number;
    };

    if (
      idUsuarioModificador !== undefined &&
      (!Number.isInteger(idUsuarioModificador) || Number(idUsuarioModificador) <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioModificador debe ser entero positivo cuando se envía',
      });
    }

    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ ok: false, message: 'nombre no puede ir vacío' });
    }

    const data = await updateRole(id, {
      ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(idUsuarioModificador !== undefined
        ? { idUsuarioModificador: Number(idUsuarioModificador) }
        : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Rol no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe un rol con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteRoleController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { idUsuarioAnulador } = req.body as { idUsuarioAnulador?: number };

    if (
      idUsuarioAnulador !== undefined &&
      (!Number.isInteger(idUsuarioAnulador) || Number(idUsuarioAnulador) <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioAnulador debe ser entero positivo cuando se envía',
      });
    }

    await deleteRole(
      id,
      idUsuarioAnulador !== undefined ? Number(idUsuarioAnulador) : undefined,
    );

    return res.status(200).json({ ok: true, message: 'Rol anulado correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Rol no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}