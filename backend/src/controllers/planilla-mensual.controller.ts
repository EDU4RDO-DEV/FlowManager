import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  closePayroll,
  deletePayroll,
  generatePayroll,
  getPayrollById,
  listPayrolls,
  previewPayroll,
  restorePayroll,
  updatePayroll,
} from '../services/planilla-mensual.service';
import {
  closePayrollBodySchema,
  deletePayrollBodySchema,
  generatePayrollSchema,
  listPayrollQuerySchema,
  planillaIdParamsSchema,
  previewPayrollSchema,
  restorePayrollBodySchema,
  updatePayrollSchema,
} from '../validators/planilla-mensual.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listPayrollsController(req: Request, res: Response) {
  try {
    const query = listPayrollQuerySchema.parse(req.query);
    const data = await listPayrolls(query);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getPayrollByIdController(req: Request, res: Response) {
  try {
    const { id } = planillaIdParamsSchema.parse(req.params);
    const data = await getPayrollById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Planilla no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function previewPayrollController(req: Request, res: Response) {
  try {
    const payload = previewPayrollSchema.parse(req.body);
    const data = await previewPayroll(payload);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Mes inválido' ||
      message === 'Año inválido' ||
      message === 'Monto de ajuste inválido'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (
      message === 'Empleado no existe' ||
      message.includes('no tiene usuario vinculado') ||
      message.includes('no tiene configuración de comisión')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function generatePayrollController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const payload = generatePayrollSchema.parse(req.body);
    const data = await generatePayroll({
      ...payload,
      idUsuarioGenerador: req.auth.userId,
    });

    return res.status(201).json({ ok: true, data, message: 'Planilla generada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Mes inválido' ||
      message === 'Año inválido' ||
      message === 'Monto de ajuste inválido'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (
      message === 'Usuario no existe' ||
      message === 'Empleado no existe' ||
      message.includes('no tiene usuario vinculado') ||
      message.includes('no tiene configuración de comisión')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.includes('Ya existe planilla activa para empleado')) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updatePayrollController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const { id } = planillaIdParamsSchema.parse(req.params);
    const payload = updatePayrollSchema.parse(req.body);

    const data = await updatePayroll(id, {
      ...payload,
      idUsuarioModificador: req.auth.userId,
    });

    return res.status(200).json({ ok: true, data, message: 'Planilla actualizada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Planilla no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'Planilla anulada no se puede editar' ||
      message === 'Planilla cerrada es inmutable'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function closePayrollController(req: Request, res: Response) {
  try {
    const { id } = planillaIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = closePayrollBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await closePayroll(id, userId);

    return res.status(200).json({ ok: true, data, message: 'Planilla cerrada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Planilla no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deletePayrollController(req: Request, res: Response) {
  try {
    const { id } = planillaIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deletePayrollBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioAnulador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioAnulador es requerido' });
    }

    await deletePayroll(id, userId);

    return res.status(200).json({ ok: true, message: 'Planilla anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Planilla no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restorePayrollController(req: Request, res: Response) {
  try {
    const { id } = planillaIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restorePayrollBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await restorePayroll(id, userId);

    return res.status(200).json({ ok: true, data, message: 'Planilla restaurada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Planilla anulada no existe' ||
      message === 'Usuario no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una planilla activa para el mismo empleado y período') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
