import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  cancelRouteDispatch,
  cancelRouteReturn,
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  getRouteInventory,
  getRouteSettlement,
} from '../services/route-inventory.service';
import { listEnvasePlantBucketBalances } from '../services/envase.service';
import { listProducts } from '../services/product.service';
import {
  cancelRouteDispatchSchema,
  cancelRouteReturnSchema,
  createRouteAdjustmentSchema,
  createRouteDispatchSchema,
  createRouteReturnSchema,
  dispatchProductsQuerySchema,
  routeInventoryIdParamsSchema,
} from '../validators/route-inventory.validators';
import { getZodErrorMessage } from '../validators/validation';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error interno';
}

function handleError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  ) {
    return res.status(409).json({
      ok: false,
      message: 'La ruta o las existencias cambiaron por una operación concurrente. Verifique el estado antes de reintentar.',
    });
  }

  const message = getErrorMessage(error);
  if (message === 'RutaSesion no existe') {
    return res.status(404).json({ ok: false, message });
  }
  if (
    message.includes('no existe o está anulado') ||
    message.includes('no forma parte del despacho')
  ) {
    return res.status(404).json({ ok: false, message });
  }
  if (
    message.includes('debe estar EN_CURSO') ||
    message.includes('ya tiene') ||
    message.includes('anular') ||
    message.includes('restaurar el estado del envase') ||
    message.includes('No se puede despachar') ||
    message.includes('Stock insuficiente') ||
    message.includes('Stock físico verificado insuficiente') ||
    message.includes('Existencia insuficiente del envase') ||
    message.includes('superior') ||
    message.includes('supera la diferencia') ||
    message.includes('Registre primero')
  ) {
    return res.status(409).json({ ok: false, message });
  }
  return res.status(500).json({ ok: false, message });
}

export async function getRouteInventoryController(req: Request, res: Response) {
  try {
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const data = await getRouteInventory(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function listDispatchProductsController(req: Request, res: Response) {
  try {
    const query = dispatchProductsQuerySchema.parse(req.query);
    const productList = await listProducts({
      ...query,
      anulado: false,
      esVendible: true,
    });
    const returnableProductIds = productList.items
      .filter((product) => product.esEnvaseRetornable)
      .map((product) => product.id);
    const bucketBalances = await listEnvasePlantBucketBalances(returnableProductIds);
    const bucketsByProduct = new Map<number, Map<string, number>>();
    for (const balance of bucketBalances) {
      const states = bucketsByProduct.get(balance.idInventarioItem) ?? new Map<string, number>();
      states.set(balance.estado, balance.cantidad);
      bucketsByProduct.set(balance.idInventarioItem, states);
    }
    const data = {
      ...productList,
      items: productList.items.map((product) => {
        if (!product.esEnvaseRetornable) return product;
        const states = bucketsByProduct.get(product.id);
        const vacio = states?.get('VACIO') ?? 0;
        const lleno = states?.get('LLENO') ?? 0;
        const pending = states?.get('PENDIENTE_CONTEO') ?? 0;
        const difference = Number((product.existencia - lleno).toFixed(2));
        const unclassifiedCatalogBalance = Number(
          (product.existencia - vacio - lleno - pending).toFixed(2),
        );
        return {
          ...product,
          stockEnvasePlanta: {
            vacio,
            lleno,
            pendienteClasificacion: pending + Math.max(0, unclassifiedCatalogBalance),
            diferenciaCatalogo: difference,
          },
        };
      }),
    };
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    return res.status(500).json({ ok: false, message: getErrorMessage(error) });
  }
}

export async function getRouteSettlementController(req: Request, res: Response) {
  try {
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const data = await getRouteSettlement(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createRouteDispatchController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const input = createRouteDispatchSchema.parse(req.body);
    const data = await createRouteDispatch(id, idUsuario, input);
    return res.status(201).json({ ok: true, data, message: 'Despacho de ruta confirmado' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function cancelRouteDispatchController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const input = cancelRouteDispatchSchema.parse(req.body);
    const data = await cancelRouteDispatch(id, idUsuario, input.motivo);
    return res.status(200).json({
      ok: true,
      data,
      message: 'Despacho anulado con reversión auditada; puede registrarse nuevamente',
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function cancelRouteReturnController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const input = cancelRouteReturnSchema.parse(req.body);
    const data = await cancelRouteReturn(id, idUsuario, input.motivo);
    return res.status(200).json({
      ok: true,
      data,
      message: 'Devolución anulada con trazabilidad; puede registrarse nuevamente',
    });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createRouteReturnController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const input = createRouteReturnSchema.parse(req.body);
    const data = await createRouteReturn(id, idUsuario, input);
    return res.status(201).json({ ok: true, data, message: 'Devolución de ruta registrada' });
  } catch (error) {
    return handleError(error, res);
  }
}

export async function createRouteAdjustmentController(req: Request, res: Response) {
  try {
    const idUsuario = req.auth?.userId;
    if (!idUsuario) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });
    const { id } = routeInventoryIdParamsSchema.parse(req.params);
    const input = createRouteAdjustmentSchema.parse(req.body);
    const data = await createRouteAdjustment(id, idUsuario, input);
    return res.status(201).json({ ok: true, data, message: 'Diferencia autorizada y registrada' });
  } catch (error) {
    return handleError(error, res);
  }
}
