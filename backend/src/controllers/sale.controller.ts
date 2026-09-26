import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  anulateSale,
  anulateSalePayment,
  createSale,
  createSalePayment,
  getSaleById,
  listSalePayments,
  listSales,
  updateSale,
} from '../services/sale.service';
import { pingFelProvider } from '../services/fel.service';
import {
  anulateSaleBodySchema,
  anulateSalePaymentBodySchema,
  createSalePaymentSchema,
  createSaleSchema,
  felPingSchema,
  listSalesQuerySchema,
  saleIdParamsSchema,
  salePaymentIdParamsSchema,
  updateSaleSchema,
} from '../validators/sale.validators';
import { getZodErrorMessage } from '../validators/validation';

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
