import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listAnulatedEmployees,
  listEmployeesAvailableForUserLink,
  listEmployees,
  listWorkerTypes,
  restoreEmployee,
  updateEmployee,
} from '../services/employee.service';
import {
  createEmployeeSchema,
  deleteEmployeeBodySchema,
  employeeIdParamsSchema,
  restoreEmployeeBodySchema,
  updateEmployeeSchema,
} from '../validators/employee.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function uploadEmployeeImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const rutaImagen = `/uploads/employees/${req.file.filename}`;
    const host = req.get('host');
    const url = host ? `${req.protocol}://${host}${rutaImagen}` : rutaImagen;

    return res.status(201).json({
      ok: true,
      message: 'Imagen cargada correctamente',
      data: {
        rutaImagen,
        url,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listEmployeesController(_req: Request, res: Response) {
  try {
    const data = await listEmployees();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listWorkerTypesController(_req: Request, res: Response) {
  try {
    const data = await listWorkerTypes();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

function parseId(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

export async function listAvailableEmployeesController(req: Request, res: Response) {
  try {
    const includeUserIdRaw = req.query.includeUserId;
    const includeUserId = includeUserIdRaw !== undefined ? parseId(includeUserIdRaw) : undefined;

    if (
      includeUserIdRaw !== undefined &&
      (typeof includeUserId !== 'number' || !Number.isInteger(includeUserId) || includeUserId <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'includeUserId debe ser un entero positivo cuando se envía',
      });
    }

    const data = await listEmployeesAvailableForUserLink(
      includeUserId !== undefined ? { includeUserId } : {},
    );
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedEmployeesController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedEmployees();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getEmployeeByIdController(req: Request, res: Response) {
  try {
    const { id } = employeeIdParamsSchema.parse(req.params);

    const data = await getEmployeeById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Empleado no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createEmployeeController(req: Request, res: Response) {
  try {
    const payload = createEmployeeSchema.parse(req.body);

    const data = await createEmployee({
      ...payload,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Configuracion de comision no existe' ||
      message === 'Tipo de trabajador no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'La entidad ya está vinculada a otro empleado') {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'fechaNacimiento inválida' ||
      message === 'fechaContratacion inválida' ||
      message === 'fechaSalida inválida' ||
      message === 'fechaInicioVigenciaSueldo inválida'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (message === 'Usuario vinculado no tiene entidad') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateEmployeeController(req: Request, res: Response) {
  try {
    const { id } = employeeIdParamsSchema.parse(req.params);
    const payload = updateEmployeeSchema.parse(req.body);

    const data = await updateEmployee(id, {
      ...payload,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Empleado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Configuracion de comision no existe' ||
      message === 'Tipo de trabajador no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'La entidad ya está vinculada a otro empleado') {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'fechaNacimiento inválida' ||
      message === 'fechaContratacion inválida' ||
      message === 'fechaSalida inválida' ||
      message === 'fechaInicioVigenciaSueldo inválida' ||
      message === 'fechaInicioVigenciaSueldo es obligatoria al cambiar el sueldo' ||
      message === 'La vigencia del nuevo sueldo debe ser posterior a la vigencia actual'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteEmployeeController(req: Request, res: Response) {
  try {
    const { id } = employeeIdParamsSchema.parse(req.params);
    deleteEmployeeBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    await deleteEmployee(id, req.auth.userId);

    return res.status(200).json({ ok: true, message: 'Empleado anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Empleado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreEmployeeController(req: Request, res: Response) {
  try {
    const { id } = employeeIdParamsSchema.parse(req.params);
    restoreEmployeeBodySchema.parse(req.body ?? {});

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await restoreEmployee(id, req.auth.userId);

    return res.status(200).json({ ok: true, data, message: 'Empleado restaurado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Empleado anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
