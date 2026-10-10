import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  getCompanySettings,
  updateCompanyLogo,
  updateCompanySettings,
} from '../services/company.service';
import { updateCompanySettingsSchema } from '../validators/company.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function getCompanySettingsController(_req: Request, res: Response) {
  try {
    return res.status(200).json({ ok: true, data: await getCompanySettings() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'No existe configuración de empresa activa') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function updateCompanySettingsController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    const input = updateCompanySettingsSchema.parse(req.body);
    const data = await updateCompanySettings(input, req.auth.userId);
    return res.status(200).json({ ok: true, message: 'Configuración empresarial actualizada', data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'No existe configuración de empresa activa') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function uploadCompanyLogoController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida' });
    }

    if (!req.file?.buffer || !req.file.originalname) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const data = await updateCompanyLogo({
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      declaredMimeType: req.file.mimetype,
      modifiedByUserId: req.auth.userId,
    });
    return res.status(200).json({ ok: true, message: 'Logotipo actualizado correctamente', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'No existe configuración de empresa activa') {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message === 'El archivo no contiene una imagen válida (PNG, JPG o WEBP)' ||
      message === 'El tipo declarado no coincide con el contenido real de la imagen'
    ) {
      return res.status(400).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}
