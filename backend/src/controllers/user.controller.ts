import { Request, Response } from 'express';

import {
  changeUserPassword,
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../services/user.service';

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

export async function listUsersController(_req: Request, res: Response) {
  try {
    const data = await listUsers();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getUserByIdController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const data = await getUserById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createUserController(req: Request, res: Response) {
  try {
    const { nombre, correo, clave, idUsuario, idRol, entidad } = req.body as {
      nombre?: string;
      correo?: string;
      clave?: string;
      idUsuario?: number;
      idRol?: number;
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

    if (!nombre || !nombre.trim() || !correo || !correo.trim() || !clave) {
      return res.status(400).json({
        ok: false,
        message: 'nombre, correo y clave son obligatorios',
      });
    }

    if (idUsuario !== undefined && !isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario debe ser entero positivo cuando se envía',
      });
    }

    if (idRol !== undefined && !isValidPositiveInteger(idRol)) {
      return res.status(400).json({
        ok: false,
        message: 'idRol debe ser entero positivo cuando se envía',
      });
    }

    if (entidad?.fechaNacimiento !== undefined) {
      const parsedDate = new Date(entidad.fechaNacimiento);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          ok: false,
          message: 'entidad.fechaNacimiento inválida',
        });
      }
    }

    const data = await createUser({
      nombre: nombre.trim(),
      correo: correo.trim(),
      clave,
      idUsuario,
      idRol,
      entidad,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'El correo ya está registrado') {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'Usuario no existe' ||
      message === 'Rol no existe' ||
      message === 'Entidad no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'fechaNacimiento inválida') {
      return res.status(400).json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateUserController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { nombre, correo, clave, idUsuario, idEntidad, idRol, idUsuarioModificador } =
      req.body as {
        nombre?: string;
        correo?: string;
        clave?: string;
        idUsuario?: number | null;
        idEntidad?: number | null;
        idRol?: number | null;
        idUsuarioModificador?: number;
      };

    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ ok: false, message: 'nombre no puede ir vacío' });
    }

    if (correo !== undefined && !correo.trim()) {
      return res.status(400).json({ ok: false, message: 'correo no puede ir vacío' });
    }

    if (idUsuario !== undefined && idUsuario !== null && !isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario debe ser entero positivo cuando se envía',
      });
    }

    if (idEntidad !== undefined && idEntidad !== null && !isValidPositiveInteger(idEntidad)) {
      return res.status(400).json({
        ok: false,
        message: 'idEntidad debe ser entero positivo cuando se envía',
      });
    }

    if (idRol !== undefined && idRol !== null && !isValidPositiveInteger(idRol)) {
      return res.status(400).json({
        ok: false,
        message: 'idRol debe ser entero positivo cuando se envía',
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

    const data = await updateUser(id, {
      ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
      ...(correo !== undefined ? { correo: correo.trim() } : {}),
      ...(clave !== undefined ? { clave } : {}),
      ...(idUsuario !== undefined ? { idUsuario } : {}),
      ...(idEntidad !== undefined ? { idEntidad } : {}),
      ...(idRol !== undefined ? { idRol } : {}),
      ...(idUsuarioModificador !== undefined ? { idUsuarioModificador } : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'El correo ya está registrado') {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'Usuario no existe' ||
      message === 'Rol no existe' ||
      message === 'Entidad no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'idUsuario padre no puede ser el mismo usuario') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteUserController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { idUsuarioAnulador } = req.body as { idUsuarioAnulador?: number };

    if (
      idUsuarioAnulador !== undefined &&
      !isValidPositiveInteger(idUsuarioAnulador)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioAnulador debe ser entero positivo cuando se envía',
      });
    }

    await deleteUser(
      id,
      idUsuarioAnulador !== undefined ? Number(idUsuarioAnulador) : undefined,
    );
    return res.status(200).json({ ok: true, message: 'Usuario anulado correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function changeUserPasswordController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { claveActual, nuevaClave, idUsuarioModificador } = req.body as {
      claveActual?: string;
      nuevaClave?: string;
      idUsuarioModificador?: number;
    };

    if (!claveActual || !nuevaClave) {
      return res.status(400).json({
        ok: false,
        message: 'claveActual y nuevaClave son obligatorias',
      });
    }

    if (nuevaClave.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'nuevaClave debe tener al menos 8 caracteres',
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

    await changeUserPassword(id, {
      claveActual,
      nuevaClave,
      ...(idUsuarioModificador !== undefined
        ? { idUsuarioModificador: Number(idUsuarioModificador) }
        : {}),
    });

    return res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Usuario modificador no existe' ||
      message === 'Clave actual incorrecta' ||
      message === 'La nueva clave debe ser diferente a la actual'
    ) {
      return res.status(
        message.includes('no existe') ? 404 : 400,
      ).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function resetUserPasswordController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { nuevaClave, idUsuarioModificador } = req.body as {
      nuevaClave?: string;
      idUsuarioModificador?: number;
    };

    if (!nuevaClave) {
      return res.status(400).json({
        ok: false,
        message: 'nuevaClave es obligatoria',
      });
    }

    if (nuevaClave.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'nuevaClave debe tener al menos 8 caracteres',
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

    await resetUserPassword(id, {
      nuevaClave,
      ...(idUsuarioModificador !== undefined
        ? { idUsuarioModificador: Number(idUsuarioModificador) }
        : {}),
    });

    return res.status(200).json({
      ok: true,
      message: 'Contraseña restablecida correctamente',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Usuario modificador no existe' ||
      message === 'La nueva clave debe ser diferente a la actual'
    ) {
      return res.status(
        message.includes('no existe') ? 404 : 400,
      ).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}