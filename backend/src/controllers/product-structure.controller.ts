import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createProductStructure,
  deleteProductStructure,
  getStructureById,
  listAnulatedStructureByProduct,
  listStructureByProduct,
  restoreProductStructure,
  updateProductStructure,
} from '../services/product-structure.service';
import {
  createProductStructureSchema,
  deleteProductStructureBodySchema,
  listStructureByProductQuerySchema,
  productIdParamsSchema,
  restoreProductStructureBodySchema,
  structureIdParamsSchema,
  updateProductStructureSchema,
} from '../validators/product-structure.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function listStructureByProductController(req: Request, res: Response) {
  try {
    const { idProducto } = productIdParamsSchema.parse(req.params);
    const query = listStructureByProductQuerySchema.parse(req.query);

    const data = await listStructureByProduct({
      idProducto,
      anulado: query.anulado,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Producto terminado no existe o no es un producto final') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listAnulatedStructureByProductController(req: Request, res: Response) {
  try {
    const { idProducto } = productIdParamsSchema.parse(req.params);

    const data = await listAnulatedStructureByProduct(idProducto);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Producto terminado no existe o no es un producto final') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function getStructureByIdController(req: Request, res: Response) {
  try {
    const { id } = structureIdParamsSchema.parse(req.params);

    const data = await getStructureById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Componente de estructura no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createProductStructureController(req: Request, res: Response) {
  try {
    const dataInput = createProductStructureSchema.parse(req.body);

    const data = await createProductStructure({
      idProductoTerminado: dataInput.idProductoTerminado,
      idMateriaPrima: dataInput.idMateriaPrima,
      cantidadRequerida: dataInput.cantidadRequerida,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Producto terminado no existe o no es un producto final' ||
      message === 'Materia prima no existe' ||
      message === 'El componente debe ser una materia prima o insumo activo' ||
      message === 'Un producto no puede ser componente de sí mismo' ||
      message === 'Este componente ya existe en la estructura del producto'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateProductStructureController(req: Request, res: Response) {
  try {
    const { id } = structureIdParamsSchema.parse(req.params);
    const dataInput = updateProductStructureSchema.parse(req.body);

    const data = await updateProductStructure(id, {
      cantidadRequerida: dataInput.cantidadRequerida,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Componente de estructura no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteProductStructureController(req: Request, res: Response) {
  try {
    const { id } = structureIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteProductStructureBodySchema.parse(req.body ?? {});

    await deleteProductStructure(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Componente de estructura anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Componente de estructura no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function restoreProductStructureController(req: Request, res: Response) {
  try {
    const { id } = structureIdParamsSchema.parse(req.params);
    const { idUsuarioModificador } = restoreProductStructureBodySchema.parse(req.body ?? {});

    const data = await restoreProductStructure(id, req.auth?.userId ?? idUsuarioModificador);

    return res.status(200).json({
      ok: true,
      data,
      message: 'Componente de estructura restaurado correctamente',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Componente anulado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Producto terminado no existe o no es un producto final' ||
      message === 'El componente debe ser una materia prima o insumo activo'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Este componente ya existe en la estructura del producto') {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
