import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  closePayroll,
  deletePayroll,
  generatePayroll,
  getPayrollById,
  getMyPayrollById,
  listMyPayrolls,
  listPayrolls,
  previewPayroll,
  reopenPayroll,
  restorePayroll,
  updatePayroll,
} from '../services/planilla-mensual.service';
import { renderPayrollReceipt } from '../services/payroll-receipt.service';
import {
  getPayrollPayments,
  registerPayrollPayment,
} from '../services/payroll-payment.service';
import {
  closePayrollBodySchema,
  deletePayrollBodySchema,
  generatePayrollSchema,
  listPayrollQuerySchema,
  planillaIdParamsSchema,
  previewPayrollSchema,
  restorePayrollBodySchema,
  reopenPayrollBodySchema,
  updatePayrollSchema,
} from '../validators/planilla-mensual.validators';
import { getZodErrorMessage } from '../validators/validation';
import {
  payrollPaymentBodySchema,
  payrollPaymentIdParamsSchema,
} from '../validators/payroll-payment.validators';

export async function getPayrollPaymentsController(req: Request, res: Response) {
  try {
    const { id } = payrollPaymentIdParamsSchema.parse(req.params);
    const data = await getPayrollPayments(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(message === 'Planilla no existe' ? 404 : 500).json({ ok: false, message });
  }
}

export async function registerPayrollPaymentController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const { id } = payrollPaymentIdParamsSchema.parse(req.params);
    const input = payrollPaymentBodySchema.parse(req.body);
    const rawKey = req.header('Idempotency-Key');
    const idempotencyKey = rawKey?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return res.status(400).json({
        ok: false,
        message: 'El encabezado Idempotency-Key es obligatorio y debe tener entre 8 y 200 caracteres',
      });
    }
    const data = await registerPayrollPayment(id, req.auth.userId, input, idempotencyKey);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = [
      'Planilla no existe',
      'Solo se puede pagar una planilla cerrada',
    ].includes(message) ? 409 : [
      'El pago no puede superar el saldo pendiente de la planilla',
      'La planilla ya está pagada',
      'La clave idempotente ya fue utilizada con otros datos',
      'Debe abrir la caja antes de registrar un pago en efectivo',
    ].includes(message) ? 400 : 500;
    return res.status(status).json({ ok: false, message });
  }
}

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

export async function listMyPayrollsController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const data = await listMyPayrolls(req.auth.userId);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getMyPayrollReceiptController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const { id } = planillaIdParamsSchema.parse(req.params);
    const payroll = await getMyPayrollById(req.auth.userId, id);
    const pdf = await renderPayrollReceipt(payroll);
    return res
      .status(200)
      .type('application/pdf')
      .attachment(`recibo-planilla-${id}.pdf`)
      .send(pdf);
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

export async function getPayrollReceiptController(req: Request, res: Response) {
  try {
    const { id } = planillaIdParamsSchema.parse(req.params);
    const payroll = await getPayrollById(id);
    const pdf = await renderPayrollReceipt(payroll);
    return res
      .status(200)
      .type('application/pdf')
      .attachment(`recibo-planilla-${id}.pdf`)
      .send(pdf);
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
      message === 'Monto de ajuste inválido' ||
      message === 'Empleado inválido en los parámetros individuales.' ||
      message === 'No se puede repetir un empleado en la previsualización.' ||
      message === 'Los días trabajados deben ser un entero entre 0 y 31.' ||
      message === 'No existe una vigencia salarial válida para todos los días trabajados del período.' ||
      message === 'Solo se permiten bonos manuales; viáticos y descuentos se calculan por empleado.' ||
      message === 'Hay parámetros individuales para un empleado que no está incluido.'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (message === 'Empleado no existe') {
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

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto de unicidad al generar; vuelva a previsualizar y verifique el período antes de reintentar.',
      });
    }

    if (
      message === 'Mes inválido' ||
      message === 'Año inválido' ||
      message === 'Monto de ajuste inválido' ||
      message === 'Empleado inválido en los parámetros individuales.' ||
      message === 'No se puede repetir un empleado en la previsualización.' ||
      message === 'Los días trabajados deben ser un entero entre 0 y 31.' ||
      message === 'No existe una vigencia salarial válida para todos los días trabajados del período.' ||
      message === 'Solo se permiten bonos manuales; viáticos y descuentos se calculan por empleado.' ||
      message === 'Hay parámetros individuales para un empleado que no está incluido.' ||
      message === 'No hay empleados activos para incluir en el período.'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (message === 'Usuario no existe' || message === 'Empleado no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message.includes('Ya existe planilla activa para empleado') ||
      message === 'La previsualización cambió; vuelva a previsualizar antes de generar.' ||
      message === 'Hay validaciones pendientes; corrija los datos indicados antes de generar.'
    ) {
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

export async function reopenPayrollController(req: Request, res: Response) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
    const { id } = planillaIdParamsSchema.parse(req.params);
    const { motivo } = reopenPayrollBodySchema.parse(req.body);
    const data = await reopenPayroll(id, req.auth.userId, motivo);
    return res.status(200).json({ ok: true, data, message: 'Planilla reabierta correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'Planilla no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'Solo se puede reabrir una planilla cerrada.') {
      return res.status(409).json({ ok: false, message });
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
    if (message === 'No se puede anular una planilla cerrada; reábrala primero.') {
      return res.status(409).json({ ok: false, message });
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
