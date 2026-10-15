import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createComisionConfig,
  createReglaComision,
  deleteComisionConfig,
  deleteReglaComision,
  getComisionConfigById,
  listAnulatedComisionConfigs,
  listComisionConfigs,
  listCommissionCategories,
  listReglasByComisionConfig,
  restoreComisionConfig,
  restoreReglaComision,
  updateComisionConfig,
  updateReglaComision,
  setCategoryCommissionSchedule,
} from '../services/planilla-comision.service';
import {
  comisionConfigIdParamsSchema,
  comisionRuleIdParamsSchema,
  categoryCommissionScheduleSchema,
  createComisionConfigSchema,
  createReglaComisionSchema,
  deleteComisionConfigBodySchema,
  deleteReglaComisionBodySchema,
  listComisionConfigsQuerySchema,
  restoreComisionConfigBodySchema,
  restoreReglaComisionBodySchema,
  updateComisionConfigSchema,
  updateReglaComisionSchema,
} from '../validators/planilla-comision.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listComisionConfigsController(req: Request, res: Response) {
  try {
    const query = listComisionConfigsQuerySchema.parse(req.query);
    const data = await listComisionConfigs(query.anulado);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listCommissionCategoriesController(_req: Request, res: Response) {
  try {
    const data = await listCommissionCategories();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedComisionConfigsController(_req: Request, res: Response) {
  try {
    const data = await listAnulatedComisionConfigs();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getComisionConfigByIdController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const data = await getComisionConfigById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Configuracion de comision no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listCategoryCommissionRulesController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const config = await getComisionConfigById(id);
    return res.status(200).json({ ok: true, data: config.reglasPorCategoria });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'Configuracion de comision no existe') {
      return res.status(404).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function setCategoryCommissionRulesController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const payload = categoryCommissionScheduleSchema.parse(req.body);
    const data = await setCategoryCommissionSchedule(id, payload);
    return res.status(200).json({
      ok: true,
      data: data.reglasPorCategoria,
      message: 'Escalas de comisión actualizadas correctamente',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    if (message === 'Configuracion de comision no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }
    if (
      message.startsWith('Debe configurar exactamente') ||
      message.startsWith('Cada escala debe comenzar') ||
      message.startsWith('Ya existe una escala') ||
      message === 'fechaInicioVigencia inválida'
    ) {
      return res.status(409).json({ ok: false, message });
    }
    return res.status(500).json({ ok: false, message });
  }
}

export async function createComisionConfigController(req: Request, res: Response) {
  try {
    const dataInput = createComisionConfigSchema.parse(req.body);

    const data = await createComisionConfig({
      idUsuario: dataInput.idUsuario,
      nombre: dataInput.nombre.trim(),
      esGeneral: dataInput.esGeneral,
      fechaInicioVigencia: dataInput.fechaInicioVigencia,
    });

    return res.status(201).json({ ok: true, data, message: 'Configuración creada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una configuracion de comision con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }
    if (
      message === 'Ya existe una configuración general de comisión activa.' ||
      message === 'Faltan las categorías de comisión iniciales.'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateComisionConfigController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const dataInput = updateComisionConfigSchema.parse(req.body);

    const data = await updateComisionConfig(id, {
      ...(dataInput.nombre !== undefined ? { nombre: dataInput.nombre.trim() } : {}),
      ...(dataInput.esGeneral !== undefined ? { esGeneral: dataInput.esGeneral } : {}),
      ...(dataInput.idUsuarioModificador !== undefined
        ? { idUsuarioModificador: dataInput.idUsuarioModificador }
        : {}),
    });

    return res.status(200).json({ ok: true, data, message: 'Configuración actualizada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Configuracion de comision no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una configuracion de comision con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteComisionConfigController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteComisionConfigBodySchema.parse(req.body ?? {});

    await deleteComisionConfig(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Configuración anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Configuracion de comision no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreComisionConfigController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreComisionConfigBodySchema.parse(req.body ?? {});

    const data = await restoreComisionConfig(id, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({ ok: true, data, message: 'Configuración restaurada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Configuracion de comision anulada no existe' ||
      message === 'Usuario no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Ya existe una configuracion de comision con ese nombre') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listReglasComisionController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const data = await listReglasByComisionConfig(id, false);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Configuracion de comision no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listReglasComisionAnuladasController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const data = await listReglasByComisionConfig(id, true);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Configuracion de comision no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createReglaComisionController(req: Request, res: Response) {
  try {
    const { id } = comisionConfigIdParamsSchema.parse(req.params);
    const dataInput = createReglaComisionSchema.parse(req.body);

    const data = await createReglaComision(id, {
      idInventarioItem: dataInput.idInventarioItem,
      cantidadMinima: dataInput.cantidadMinima,
      cantidadMaxima: dataInput.cantidadMaxima,
      tipoCalculo: dataInput.tipoCalculo,
      porcentaje: dataInput.porcentaje,
      montoPorUnidad: dataInput.montoPorUnidad,
    });

    return res.status(201).json({ ok: true, data, message: 'Regla creada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Configuracion de comision no existe' ||
      message === 'InventarioItem no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'La regla se solapa con otra regla activa para el mismo producto') {
      return res.status(409).json({ ok: false, message });
    }

    if (message === 'cantidadMaxima debe ser mayor o igual a cantidadMinima') {
      return res.status(400).json({ ok: false, message });
    }

    if (
      message === 'porcentaje debe ser mayor a 0 para PORCENTAJE_VENTA' ||
      message === 'montoPorUnidad debe ser mayor a 0 para MONTO_POR_UNIDAD'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateReglaComisionController(req: Request, res: Response) {
  try {
    const { id, idRegla } = comisionRuleIdParamsSchema.parse(req.params);
    const dataInput = updateReglaComisionSchema.parse(req.body);

    const data = await updateReglaComision(id, idRegla, dataInput);

    return res.status(200).json({ ok: true, data, message: 'Regla actualizada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Configuracion de comision no existe' ||
      message === 'Regla de comision no existe' ||
      message === 'InventarioItem no existe' ||
      message === 'Usuario no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'La regla se solapa con otra regla activa para el mismo producto') {
      return res.status(409).json({ ok: false, message });
    }

    if (message === 'cantidadMaxima debe ser mayor o igual a cantidadMinima') {
      return res.status(400).json({ ok: false, message });
    }

    if (
      message === 'porcentaje debe ser mayor a 0 para PORCENTAJE_VENTA' ||
      message === 'montoPorUnidad debe ser mayor a 0 para MONTO_POR_UNIDAD'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteReglaComisionController(req: Request, res: Response) {
  try {
    const { id, idRegla } = comisionRuleIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteReglaComisionBodySchema.parse(req.body ?? {});

    await deleteReglaComision(id, idRegla, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Regla anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Configuracion de comision no existe' ||
      message === 'Regla de comision no existe' ||
      message === 'Usuario no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreReglaComisionController(req: Request, res: Response) {
  try {
    const { id, idRegla } = comisionRuleIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreReglaComisionBodySchema.parse(req.body ?? {});

    const data = await restoreReglaComision(id, idRegla, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({ ok: true, data, message: 'Regla restaurada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Configuracion de comision no existe' ||
      message === 'Regla de comision anulada no existe' ||
      message === 'Usuario no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'La regla se solapa con otra regla activa para el mismo producto') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
