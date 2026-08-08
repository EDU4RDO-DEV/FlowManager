import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from '../services/product.service';
import {
  createProductSchema,
  deleteProductBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from '../validators/product.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function uploadProductImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const rutaImagen = `/uploads/products/${req.file.filename}`;
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

export async function listProductsController(req: Request, res: Response) {
  try {
    const query = listProductsQuerySchema.parse(req.query);

    const data = await listProducts({
      page: query.page,
      limit: query.limit,
      busqueda: query.busqueda,
      categoria: query.categoria,
      esProductoFinal: query.esProductoFinal,
      anulado: query.anulado,
      idProveedor: query.idProveedor,
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getProductByIdController(req: Request, res: Response) {
  try {
    const { id } = productIdParamsSchema.parse(req.params);

    const data = await getProductById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Producto no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createProductController(req: Request, res: Response) {
  try {
    const dataInput = createProductSchema.parse(req.body);

    const data = await createProduct({
      ...dataInput,
      nombre: dataInput.nombre.trim(),
      rutaImagen: dataInput.rutaImagen?.trim() || undefined,
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe' ||
      message === 'Ya existe un producto activo con el mismo nombre y categoría'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateProductController(req: Request, res: Response) {
  try {
    const { id } = productIdParamsSchema.parse(req.params);
    const dataInput = updateProductSchema.parse(req.body);

    const data = await updateProduct(id, {
      ...dataInput,
      ...(dataInput.nombre !== undefined ? { nombre: dataInput.nombre.trim() } : {}),
      ...(dataInput.rutaImagen !== undefined
        ? { rutaImagen: dataInput.rutaImagen.trim() || undefined }
        : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Producto no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'Usuario no existe' ||
      message === 'Proveedor no existe' ||
      message === 'Ya existe un producto activo con el mismo nombre y categoría'
    ) {
      return res.status(409).json({ ok: false, message });
    }

    if (message === 'precioVenta debe ser mayor o igual a costoPromedio') {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteProductController(req: Request, res: Response) {
  try {
    const { id } = productIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = deleteProductBodySchema.parse(req.body ?? {});

    await deleteProduct(id, idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Producto anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Producto no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message === 'Usuario no existe') {
      return res.status(409).json({ ok: false, message });
    }

    if (
      message === 'No se puede anular un producto con existencia mayor a 0' ||
      message === 'No se puede anular porque tiene movimientos registrados en bitácora' ||
      message === 'No se puede anular porque participa en una estructura de producto activa'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
