import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createMaintenance,
  deleteMaintenance,
  getMaintenanceById,
  listAnulatedMaintenances,
  listMaintenances,
  restoreMaintenance,
  updateMaintenance,
} from '../services/maintenance.service';
import {
  createMaintenanceSchema,
  deleteMaintenanceBodySchema,
  listMaintenanceQuerySchema,
  maintenanceIdParamsSchema,
  restoreMaintenanceBodySchema,
  updateMaintenanceSchema,
} from '../validators/maintenance.validators';
import { getZodErrorMessage } from '../validators/validation';

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error interno';
}

function handleZodOr500(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    return true;
  }
  return false;
}

const NOT_FOUND_MESSAGES = new Set([
  'Usuario no existe',
  'Vehiculo no existe',
  'Proveedor no existe',
  'Mantenimiento no existe',
  'Mantenimiento anulado no existe',
]);

function mapErrorStatus(message: string): number {
  if (NOT_FOUND_MESSAGES.has(message)) return 404;
  if (message === 'costo es obligatorio cuando el mantenimiento está REALIZADO') return 400;
  return 500;
}

export async function listMaintenancesController(req: Request, res: Response) {
  try {
    const query = listMaintenanceQuerySchema.parse(req.query);
    const data = await listMaintenances(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listAnulatedMaintenancesController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedMaintenances();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getMaintenanceByIdController(req: Request, res: Response) {
  try {
    const { id } = maintenanceIdParamsSchema.parse(req.params);
    const data = await getMaintenanceById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function createMaintenanceController(req: Request, res: Response) {
  try {
    const payload = createMaintenanceSchema.parse(req.body);

    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }

    const data = await createMaintenance({ ...payload, idUsuario: req.auth.userId });
    return res.status(201).json({ ok: true, data, message: 'Mantenimiento registrado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function updateMaintenanceController(req: Request, res: Response) {
  try {
    const { id } = maintenanceIdParamsSchema.parse(req.params);
    const payload = updateMaintenanceSchema.parse(req.body);
    const data = await updateMaintenance(id, {
      ...payload,
      idUsuarioModificador: req.auth?.userId ?? payload.idUsuarioModificador,
    });
    return res.status(200).json({ ok: true, data, message: 'Mantenimiento actualizado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function deleteMaintenanceController(req: Request, res: Response) {
  try {
    const { id } = maintenanceIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteMaintenanceBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioAnulador;
    await deleteMaintenance(id, userId);
    return res.status(200).json({ ok: true, message: 'Mantenimiento anulado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}

export async function restoreMaintenanceController(req: Request, res: Response) {
  try {
    const { id } = maintenanceIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreMaintenanceBodySchema.parse(req.body ?? {});
    const userId = req.auth?.userId ?? idUsuarioModificador;
    const data = await restoreMaintenance(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Mantenimiento restaurado correctamente' });
  } catch (error) {
    if (handleZodOr500(error, res)) return;
    const message = getMessage(error);
    return res.status(mapErrorStatus(message)).json({ ok: false, message });
  }
}
