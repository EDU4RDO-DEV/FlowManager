import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createEmployeeAdvance,
  listEmployeeAdvances,
} from '../services/employee-advance.service';
import {
  createEmployeeAdvanceSchema,
  employeeAdvancesQuerySchema,
} from '../validators/employee-advance.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listEmployeeAdvancesController(req: Request, res: Response) {
  try {
    const query = employeeAdvancesQuerySchema.parse(req.query);
    const data = await listEmployeeAdvances(query.idEmpleado);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function createEmployeeAdvanceController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const input = createEmployeeAdvanceSchema.parse(req.body);
    const idempotencyKey = req.header('Idempotency-Key')?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return res.status(400).json({
        ok: false,
        message: 'El encabezado Idempotency-Key es obligatorio y debe tener entre 8 y 200 caracteres',
      });
    }
    const result = await createEmployeeAdvance(req.auth.userId, input, idempotencyKey);
    return res.status(result.replayed ? 200 : 201).json({ ok: true, data: result.advances });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = [
      'Empleado no existe o ya fue retirado',
      'La clave idempotente ya fue utilizada con otros datos',
      'Debe abrir la caja antes de registrar un pago en efectivo',
    ].includes(message) ? 409 : 500;
    return res.status(status).json({ ok: false, message });
  }
}
