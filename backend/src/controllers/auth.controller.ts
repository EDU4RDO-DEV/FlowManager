import { Request, Response } from 'express';

import {
  assignUserRoleEntity,
  login,
  refreshAuthTokens,
  register,
  revokeAllUserSessions,
  revokeRefreshToken,
} from '../services/auth.service';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  return req.ip || '0.0.0.0';
}

function getDeviceName(req: Request): string {
  const userAgent = req.headers['user-agent'];

  if (typeof userAgent === 'string' && userAgent.trim().length > 0) {
    return userAgent;
  }

  if (Array.isArray(userAgent) && userAgent.length > 0) {
    return userAgent[0];
  }

  return 'Desconocido';
}

export async function loginController(req: Request, res: Response) {
  try {
    const { correo, clave } = req.body as { correo?: string; clave?: string };

    if (!correo || !clave) {
      return res.status(400).json({
        ok: false,
        message: 'correo y clave son requeridos',
      });
    }

    const result = await login({
      correo,
      clave,
      ip: getClientIp(req),
      nombreDispositivo: getDeviceName(req),
    });

    return res.status(200).json({
      ok: true,
      message: 'Login exitoso',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Credenciales inválidas') {
      return res.status(401).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function refreshController(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        message: 'refreshToken es requerido',
      });
    }

    const result = await refreshAuthTokens({ refreshToken });

    return res.status(200).json({
      ok: true,
      message: 'Token renovado correctamente',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Refresh token inválido o expirado') {
      return res.status(401).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function logoutController(req: Request, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    const { refreshToken } = req.body as { refreshToken?: string };

    if (refreshToken) {
      const revoked = await revokeRefreshToken(refreshToken, userId);
      if (!revoked) {
        return res.status(404).json({
          ok: false,
          message: 'No se encontró una sesión activa para revocar',
        });
      }
    } else {
      await revokeAllUserSessions(userId, userId);
    }

    return res.status(200).json({
      ok: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function registerController(req: Request, res: Response) {
  try {
    const { nombre, correo, clave, idRol, idEntidad } = req.body as {
      nombre?: string;
      correo?: string;
      clave?: string;
      idRol?: number;
      idEntidad?: number;
    };

    if (!nombre || !correo || !clave) {
      return res.status(400).json({
        ok: false,
        message: 'nombre, correo y clave son requeridos',
      });
    }

    const created = await register({ nombre, correo, clave, idRol, idEntidad });

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente',
      data: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'El correo ya está registrado') {
      return res.status(409).json({ ok: false, message });
    }

    if (message.includes('FK_Usuario_Rol')) {
      return res.status(400).json({
        ok: false,
        message: 'El idRol enviado no existe en la tabla Rol',
      });
    }

    if (message.includes('FK_Usuario_Entidad')) {
      return res.status(400).json({
        ok: false,
        message: 'El idEntidad enviado no existe en la tabla Entidad',
      });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function assignUserRoleEntityController(req: Request, res: Response) {
  try {
    const idUsuario = Number(req.params.idUsuario);
    const { idRol, idEntidad } = req.body as {
      idRol?: number;
      idEntidad?: number;
    };

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario en URL debe ser un entero positivo',
      });
    }

    if (!Number.isInteger(idRol) || Number(idRol) <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'idRol es obligatorio y debe ser un entero positivo',
      });
    }

    const idRolValue = Number(idRol);

    if (
      idEntidad !== undefined &&
      (!Number.isInteger(idEntidad) || Number(idEntidad) <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idEntidad debe ser un entero positivo cuando se envía',
      });
    }

    const idEntidadValue = idEntidad !== undefined ? Number(idEntidad) : undefined;

    const updated = await assignUserRoleEntity({
      idUsuario,
      idRol: idRolValue,
      idEntidad: idEntidadValue,
    });

    return res.status(200).json({
      ok: true,
      message: 'Asignación de rol/entidad actualizada correctamente',
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Rol no existe' || message === 'Entidad no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'El usuario ya tiene la misma asignación de rol/entidad') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
