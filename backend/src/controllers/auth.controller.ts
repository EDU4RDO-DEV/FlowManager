import { Request, Response } from 'express';

import { login, register } from '../services/auth.service';

export async function loginController(req: Request, res: Response) {
  try {
    const { correo, clave } = req.body as { correo?: string; clave?: string };

    if (!correo || !clave) {
      return res.status(400).json({
        ok: false,
        message: 'correo y clave son requeridos',
      });
    }

    const result = await login({ correo, clave });

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
