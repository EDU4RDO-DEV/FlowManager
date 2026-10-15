import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createGastoVehiculo,
  createRuta,
  createRutaSesion,
  createVehiculo,
  deleteGastoVehiculo,
  deleteRuta,
  deleteRutaSesion,
  deleteVehiculo,
  getGastoVehiculoById,
  getRutaById,
  getRutaSesionById,
  getVehiculoById,
  listGastosVehiculo,
  listRutas,
  listRutaSesiones,
  listVehiculos,
  restoreGastoVehiculo,
  restoreRuta,
  restoreRutaSesion,
  restoreVehiculo,
  updateGastoVehiculo,
  updateRuta,
  updateRutaSesion,
  updateVehiculo,
} from '../services/logistics.service';
import {
  createGastoVehiculoSchema,
  createRutaSchema,
  createRutaSesionSchema,
  createVehiculoSchema,
  deleteGastoVehiculoBodySchema,
  deleteRutaBodySchema,
  deleteRutaSesionBodySchema,
  deleteVehiculoBodySchema,
  gastoVehiculoFiltersSchema,
  logisticsIdParamsSchema,
  logisticsTwoIdParamsSchema,
  restoreGastoVehiculoBodySchema,
  restoreRutaBodySchema,
  restoreRutaSesionBodySchema,
  restoreVehiculoBodySchema,
  rutaFiltersSchema,
  rutaSesionFiltersSchema,
  updateGastoVehiculoSchema,
  updateRutaSchema,
  updateRutaSesionSchema,
  updateVehiculoSchema,
  vehiculoFiltersSchema,
} from '../validators/logistics.validators';
import { getZodErrorMessage } from '../validators/validation';

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno';
}

function handleValidationError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
  }

  return null;
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function uploadGastoVehiculoImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const rutaImagen = `/uploads/vehicles/${req.file.filename}`;
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
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function listVehiculosController(req: Request, res: Response) {
  try {
    const query = vehiculoFiltersSchema.parse(req.query);
    const data = await listVehiculos(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getVehiculoByIdController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const data = await getVehiculoById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Vehiculo no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createVehiculoController(req: Request, res: Response) {
  try {
    const payload = createVehiculoSchema.parse(req.body);
    const data = await createVehiculo(payload);
    return res.status(201).json({ ok: true, data, message: 'Vehiculo registrado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Usuario no existe' || message === 'Vehiculo no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe un vehiculo activo con esa placa') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const payload = updateVehiculoSchema.parse(req.body);
    const data = await updateVehiculo(id, payload);

    return res.status(200).json({ ok: true, data, message: 'Vehiculo actualizado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Vehiculo no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe un vehiculo activo con esa placa') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteVehiculoBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioAnulador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioAnulador es requerido' });
    }

    await deleteVehiculo(id, userId);
    return res.status(200).json({ ok: true, message: 'Vehiculo anulado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Vehiculo no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Vehiculo tiene sesiones activas y no puede anularse') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreVehiculoBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await restoreVehiculo(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Vehiculo restaurado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Vehiculo anulado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe un vehiculo activo con esa placa') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listRutasController(req: Request, res: Response) {
  try {
    const query = rutaFiltersSchema.parse(req.query);
    const data = await listRutas(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getRutaByIdController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const data = await getRutaById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Ruta no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createRutaController(req: Request, res: Response) {
  try {
    const payload = createRutaSchema.parse(req.body);
    const data = await createRuta(payload);
    return res.status(201).json({ ok: true, data, message: 'Ruta registrada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Ya existe una ruta activa con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateRutaController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const payload = updateRutaSchema.parse(req.body);
    const data = await updateRuta(id, payload);

    return res.status(200).json({ ok: true, data, message: 'Ruta actualizada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Ruta no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una ruta activa con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteRutaController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteRutaBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioAnulador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioAnulador es requerido' });
    }

    await deleteRuta(id, userId);
    return res.status(200).json({ ok: true, message: 'Ruta anulada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Ruta no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ruta tiene sesiones activas y no puede anularse') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreRutaController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreRutaBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await restoreRuta(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Ruta restaurada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'Ruta anulada no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una ruta activa con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listRutaSesionesController(req: Request, res: Response) {
  try {
    const query = rutaSesionFiltersSchema.parse(req.query);
    const data = await listRutaSesiones(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getRutaSesionByIdController(req: Request, res: Response) {
  try {
    const { idSesion } = logisticsTwoIdParamsSchema.parse(req.params);
    const data = await getRutaSesionById(idSesion);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'RutaSesion no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createRutaSesionController(req: Request, res: Response) {
  try {
    const payload = createRutaSesionSchema.parse(req.body);
    const data = await createRutaSesion(payload);

    return res.status(201).json({ ok: true, data, message: 'Sesion de ruta registrada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    if (isSerializationConflict(error)) {
      return res.status(409).json({
        ok: false,
        message: 'La sesión cambió por una operación concurrente. Verifique su estado antes de reintentar.',
      });
    }

    const message = getMessage(error);
    if (
      message === 'Ruta no existe' ||
      message === 'Vehiculo no existe' ||
      message === 'Usuario no existe' ||
      message === 'Chofer no tiene empleado activo vinculado' ||
      message === 'Vendedor no tiene empleado activo vinculado'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'Vehiculo no disponible para la fecha seleccionada' ||
      message === 'Vehiculo no disponible por estado actual'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'kmInicial es requerido cuando la sesión está EN_CURSO' ||
      message === 'kmInicial es requerido cuando la sesión está CERRADA' ||
      message === 'kmFinal es requerido cuando la sesión está CERRADA' ||
      message === 'kmFinal no puede ser menor que kmInicial' ||
      message === 'Fecha de sesión inválida' ||
      message === 'No se puede crear una sesión directamente en estado CERRADA'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateRutaSesionController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { idSesion } = logisticsTwoIdParamsSchema.parse(req.params);
    const payload = updateRutaSesionSchema.parse(req.body);

    const data = await updateRutaSesion(idSesion, {
      ...payload,
      idUsuarioModificador: idUsuario,
    });
    return res.status(200).json({ ok: true, data, message: 'Sesion de ruta actualizada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    if (isSerializationConflict(error)) {
      return res.status(409).json({
        ok: false,
        message: 'La sesión cambió por una operación concurrente. Verifique su estado antes de reintentar.',
      });
    }

    const message = getMessage(error);
    if (
      message === 'RutaSesion no existe' ||
      message === 'Ruta no existe' ||
      message === 'Vehiculo no existe' ||
      message === 'Usuario no existe' ||
      message === 'Chofer no tiene empleado activo vinculado' ||
      message === 'Vendedor no tiene empleado activo vinculado'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'Vehiculo no disponible para la fecha seleccionada' ||
      message === 'Vehiculo no disponible por estado actual' ||
      message === 'La sesión está cerrada y no admite modificaciones' ||
      message === 'No se puede modificar la asignación de una sesión con operaciones registradas' ||
      message === 'La ruta tiene productos pendientes de devolución o ajuste autorizado'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'kmInicial es requerido cuando la sesión está EN_CURSO' ||
      message === 'kmInicial es requerido cuando la sesión está CERRADA' ||
      message === 'kmFinal es requerido cuando la sesión está CERRADA' ||
      message === 'kmFinal no puede ser menor que kmInicial' ||
      message === 'Fecha de sesión inválida' ||
      message === 'No se puede crear una sesión directamente en estado CERRADA' ||
      message === 'El usuario responsable del cierre es requerido'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteRutaSesionController(req: Request, res: Response) {
  try {
    const { idSesion } = logisticsTwoIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteRutaSesionBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioAnulador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioAnulador es requerido' });
    }

    await deleteRutaSesion(idSesion, userId);
    return res.status(200).json({ ok: true, message: 'Sesion de ruta anulada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    if (isSerializationConflict(error)) {
      return res.status(409).json({
        ok: false,
        message: 'La sesión cambió por una operación concurrente. Verifique su estado antes de reintentar.',
      });
    }

    const message = getMessage(error);
    if (message === 'RutaSesion no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (message === 'No se puede anular una sesión con operaciones de inventario o ventas') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreRutaSesionController(req: Request, res: Response) {
  try {
    const { idSesion } = logisticsTwoIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreRutaSesionBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await restoreRutaSesion(idSesion, userId);
    return res.status(200).json({ ok: true, data, message: 'Sesion de ruta restaurada correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    if (isSerializationConflict(error)) {
      return res.status(409).json({
        ok: false,
        message: 'La sesión cambió por una operación concurrente. Verifique su estado antes de reintentar.',
      });
    }

    const message = getMessage(error);
    if (
      message === 'RutaSesion anulada no existe' ||
      message === 'Ruta no existe' ||
      message === 'Usuario no existe' ||
      message === 'Chofer no tiene empleado activo vinculado' ||
      message === 'Vendedor no tiene empleado activo vinculado'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'Vehiculo no disponible para la fecha seleccionada' ||
      message === 'Vehiculo no disponible por estado actual'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listGastosVehiculoController(req: Request, res: Response) {
  try {
    const query = gastoVehiculoFiltersSchema.parse(req.query);
    const data = await listGastosVehiculo(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;
    return res.status(500).json({ ok: false, message: getMessage(error) });
  }
}

export async function getGastoVehiculoByIdController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const data = await getGastoVehiculoById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'GastoVehiculo no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createGastoVehiculoController(req: Request, res: Response) {
  try {
    const payload = createGastoVehiculoSchema.parse(req.body);
    const data = await createGastoVehiculo(payload);

    return res.status(201).json({ ok: true, data, message: 'Gasto de vehiculo registrado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (
      message === 'RutaSesion no existe' ||
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateGastoVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const payload = updateGastoVehiculoSchema.parse(req.body);

    const data = await updateGastoVehiculo(id, payload);
    return res.status(200).json({ ok: true, data, message: 'Gasto de vehiculo actualizado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (
      message === 'GastoVehiculo no existe' ||
      message === 'RutaSesion no existe' ||
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteGastoVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteGastoVehiculoBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioAnulador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioAnulador es requerido' });
    }

    await deleteGastoVehiculo(id, userId);
    return res.status(200).json({ ok: true, message: 'Gasto de vehiculo anulado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (message === 'GastoVehiculo no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreGastoVehiculoController(req: Request, res: Response) {
  try {
    const { id } = logisticsIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreGastoVehiculoBodySchema.parse(req.body ?? {});

    const userId = req.auth?.userId ?? idUsuarioModificador;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'idUsuarioModificador es requerido' });
    }

    const data = await restoreGastoVehiculo(id, userId);
    return res.status(200).json({ ok: true, data, message: 'Gasto de vehiculo restaurado correctamente' });
  } catch (error) {
    const parsed = handleValidationError(error, res);
    if (parsed) return parsed;

    const message = getMessage(error);
    if (
      message === 'GastoVehiculo anulado no existe' ||
      message === 'RutaSesion no existe' ||
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
