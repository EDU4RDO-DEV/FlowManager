import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  anulateSale,
  anulateSalePayment,
  createSale,
  createSalePayment,
  getSaleById,
  listSalePayments,
  listSales,
  previewSaleBonuses,
  resolveSalePrice,
  updateSale,
} from '../services/sale.service';
import { getReceptorInfo, pingFelProvider } from '../services/fel.service';
import { listRutaSesiones } from '../services/logistics.service';
import {
  anulateSaleBodySchema,
  anulateSalePaymentBodySchema,
  createSalePaymentSchema,
  createSaleSchema,
  felPingSchema,
  felReceptorQuerySchema,
  listAvailableRutaSesionesQuerySchema,
  listSalesQuerySchema,
  previewSaleBonusesBodySchema,
  resolveSalePriceQuerySchema,
  saleIdParamsSchema,
  salePaymentIdParamsSchema,
  updateSaleSchema,
} from '../validators/sale.validators';
import { getZodErrorMessage } from '../validators/validation';

function isNumeroVentaUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;
  return (
    (Array.isArray(target) && target.includes('NumeroVenta')) ||
    (typeof target === 'string' && target.includes('NumeroVenta'))
  );
}

export async function uploadSaleImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Debe adjuntar una imagen en el campo file' });
    }

    const rutaImagen = `/uploads/sales/${req.file.filename}`;
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

export async function resolveFelReceptorController(req: Request, res: Response) {
  try {
    const { nit } = felReceptorQuerySchema.parse(req.query);
    const data = await getReceptorInfo(nit);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message.startsWith('FEL:')) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function resolveSalePriceController(req: Request, res: Response) {
  try {
    const { idCliente, idInventarioItem } = resolveSalePriceQuerySchema.parse(req.query);
    const data = await resolveSalePrice(idCliente, idInventarioItem);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Cliente no existe' || message.includes('no existe o está anulado')) {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function previewSaleBonusesController(req: Request, res: Response) {
  try {
    const { detalle } = previewSaleBonusesBodySchema.parse(req.body);
    const data = await previewSaleBonuses(detalle);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function listAvailableRutaSesionesController(req: Request, res: Response) {
  try {
    const { idUsuarioVendedor } = listAvailableRutaSesionesQuerySchema.parse(req.query);
    const rows = await listRutaSesiones({ anulado: false });
    const data = rows.filter((sesion) => {
      if (sesion.estado === 'CERRADA') {
        return false;
      }

      if (idUsuarioVendedor !== undefined && sesion.idUsuarioVendedor !== idUsuarioVendedor) {
        return false;
      }

      return true;
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

export async function listSalesController(req: Request, res: Response) {
  try {
    const query = listSalesQuerySchema.parse(req.query);
    const data = await listSales(query);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getSaleByIdController(req: Request, res: Response) {
  try {
    const { id } = saleIdParamsSchema.parse(req.params);
    const data = await getSaleById(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Venta no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createSaleController(req: Request, res: Response) {
  try {
    const payload = createSaleSchema.parse(req.body);
    const data = await createSale({
      ...payload,
      nitFacturado: payload.nitFacturado?.trim(),
      nombreClienteFacturado: payload.nombreClienteFacturado?.trim(),
      direccionClienteFacturado: payload.direccionClienteFacturado?.trim(),
      lugarEntrega: payload.lugarEntrega?.trim(),
      detalle: payload.detalle.map((item) => ({
        ...item,
        esBonificacion: item.esBonificacion ?? false,
      })),
      pagoInicial: payload.pagoInicial
        ? {
            ...payload.pagoInicial,
            numeroReferencia: payload.pagoInicial.numeroReferencia?.trim(),
            banco: payload.pagoInicial.banco?.trim(),
            observaciones: payload.pagoInicial.observaciones?.trim(),
            rutaFirma: payload.pagoInicial.rutaFirma?.trim(),
          }
        : undefined,
    });

    return res.status(201).json({ ok: true, data, message: 'Venta registrada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    if (isNumeroVentaUniqueConflict(error)) {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto al asignar el número de venta; consulte el estado antes de reintentar',
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al registrar la venta; consulte el estado antes de reintentar',
      });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Usuario no existe' ||
      message === 'Cliente no existe' ||
      message === 'RutaSesion no existe' ||
      message === 'RutaSesion está cerrada' ||
      message === 'Talonario no existe' ||
      message === 'Talonario sin correlativos disponibles' ||
      message.includes('no existe o está anulado')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message.startsWith('Stock insuficiente') ||
      message.startsWith('Venta de contado') ||
      message.startsWith('Pago inicial') ||
      message === 'Cliente no habilitado para crédito' ||
      message.includes('No fue posible reservar correlativo de talonario')
    ) {
      return res.status(400).json({ ok: false, message });
    }

    if (message.startsWith('FEL:')) {
      return res.status(502).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateSaleController(req: Request, res: Response) {
  try {
    const { id } = saleIdParamsSchema.parse(req.params);
    const payload = updateSaleSchema.parse(req.body);

    const data = await updateSale(id, {
      ...payload,
      lugarEntrega: payload.lugarEntrega?.trim(),
    });

    return res.status(200).json({ ok: true, data, message: 'Venta actualizada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Venta no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('No se puede modificar')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function anulateSaleController(req: Request, res: Response) {
  try {
    const { id } = saleIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulateSaleBodySchema.parse(req.body ?? {});

    await anulateSale(id, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Venta anulada correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Venta no existe o ya está anulada' ||
      message === 'Usuario no existe' ||
      message.includes('no existe o está anulado')
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (message.startsWith('FEL:')) {
      return res.status(502).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function listSalePaymentsController(req: Request, res: Response) {
  try {
    const { id } = saleIdParamsSchema.parse(req.params);
    const data = await listSalePayments(id);

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Venta no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createSalePaymentController(req: Request, res: Response) {
  try {
    const { id } = saleIdParamsSchema.parse(req.params);
    const payload = createSalePaymentSchema.parse(req.body);

    const data = await createSalePayment(id, {
      ...payload,
      numeroReferencia: payload.numeroReferencia?.trim(),
      banco: payload.banco?.trim(),
      observaciones: payload.observaciones?.trim(),
      rutaFirma: payload.rutaFirma?.trim(),
    });

    return res.status(201).json({ ok: true, data, message: 'Pago registrado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Venta no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return res.status(409).json({
        ok: false,
        message: 'Conflicto concurrente al registrar el pago; consulte el saldo antes de reintentar',
      });
    }

    if (message.startsWith('Pago no puede ser mayor') || message.includes('obligatorio')) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function anulateSalePaymentController(req: Request, res: Response) {
  try {
    const { id, idPago } = salePaymentIdParamsSchema.parse(req.params);
    const { idUsuarioAnulador } = anulateSalePaymentBodySchema.parse(req.body ?? {});

    await anulateSalePayment(id, idPago, req.auth?.userId ?? idUsuarioAnulador);

    return res.status(200).json({ ok: true, message: 'Pago anulado correctamente' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Pago no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function pingFelController(req: Request, res: Response) {
  try {
    const payload = felPingSchema.parse(req.body ?? {});
    const data = await pingFelProvider({
      nitReceptor: payload.nitReceptor,
      validarNit: payload.validarNit,
    });

    return res.status(200).json({ ok: true, data, message: 'Diagnóstico FEL completado' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }

    const message = error instanceof Error ? error.message : 'Error interno';

    if (message.startsWith('FEL:')) {
      return res.status(502).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
