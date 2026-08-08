import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  assignUserRoleEntity,
  login,
  refreshAuthTokens,
  register,
  revokeAllUserSessions,
  revokeRefreshToken,
} from '../services/auth.service';
import {
  assignUserRoleEntityBodySchema,
  assignUserRoleEntityParamsSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '../validators/auth.validators';
import { getZodErrorMessage } from '../validators/validation';

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
    const { correo, clave } = loginSchema.parse(req.body);

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
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Credenciales inválidas') {
      return res.status(401).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function refreshController(req: Request, res: Response) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const result = await refreshAuthTokens({ refreshToken });

    return res.status(200).json({
      ok: true,
      message: 'Token renovado correctamente',
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

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

    const { refreshToken } = logoutSchema.parse(req.body ?? {});

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
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function registerController(req: Request, res: Response) {
  try {
    const { nombre, correo, clave, idRol, idEntidad } = registerSchema.parse(req.body);

    const created = await register({ nombre, correo, clave, idRol, idEntidad });

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente',
      data: created,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

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
    const { idUsuario } = assignUserRoleEntityParamsSchema.parse(req.params);
    const { idRol, idEntidad } = assignUserRoleEntityBodySchema.parse(req.body);

    const updated = await assignUserRoleEntity({
      idUsuario,
      idRol,
      idEntidad,
    });

    return res.status(200).json({
      ok: true,
      message: 'Asignación de rol/entidad actualizada correctamente',
      data: updated,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

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
