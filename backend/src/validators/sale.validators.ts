import { z } from 'zod';

const positiveInt = z.number().int('debe ser entero').positive('debe ser mayor a 0');

const finitePositiveNumber = z
  .number()
  .finite('debe ser un número válido')
  .positive('debe ser mayor a 0');

const optionalPageFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'page debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'page debe ser mayor a 0')
  .optional();

const optionalLimitFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'limit debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value >= 1 && value <= 100, 'limit debe estar entre 1 y 100')
  .optional();

const optionalPositiveIntFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'debe ser mayor a 0')
  .optional();

const optionalBooleanFromQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const optionalDateFromQuery = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener formato YYYY-MM-DD')
  .optional();

const paymentMethodSchema = z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS']);
const condicionPagoSchema = z.enum(['CONTADO', 'CREDITO']);
const estadoEntregaSchema = z.enum(['PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'PARCIAL']);
const tipoRegistroSchema = z.enum(['VENTA', 'PROFORMA']);

const saleDetailItemSchema = z.object({
  idInventarioItem: positiveInt,
  cantidad: finitePositiveNumber,
  precioUnitario: finitePositiveNumber.optional(),
  esBonificacion: z.boolean().optional().default(false),
});

const salePaymentSchema = z
  .object({
    monto: finitePositiveNumber,
    metodoPago: paymentMethodSchema,
    numeroReferencia: z.string().trim().max(100, 'numeroReferencia demasiado largo').optional(),
    banco: z.string().trim().max(100, 'banco demasiado largo').optional(),
    fechaPago: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaPago inválida').optional(),
    rutaFirma: z.string().trim().max(255, 'rutaFirma demasiado larga').optional(),
    observaciones: z.string().trim().max(255, 'observaciones demasiado largas').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.metodoPago === 'TRANSFERENCIA' || data.metodoPago === 'CHEQUE' || data.metodoPago === 'POS') {
      if (!data.numeroReferencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'numeroReferencia es obligatoria para este método de pago',
          path: ['numeroReferencia'],
        });
      }
    }

    if (data.metodoPago === 'TRANSFERENCIA' || data.metodoPago === 'CHEQUE') {
      if (!data.banco) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'banco es obligatorio para este método de pago',
          path: ['banco'],
        });
      }
    }
  });

export const saleIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const salePaymentIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idPago: z.coerce.number().int('idPago debe ser entero').positive('idPago debe ser mayor a 0'),
});

export const listSalesQuerySchema = z
  .object({
    page: optionalPageFromQuery,
    limit: optionalLimitFromQuery,
    numeroVenta: optionalPositiveIntFromQuery,
    idCliente: optionalPositiveIntFromQuery,
    idUsuario: optionalPositiveIntFromQuery,
    idRutaSesion: optionalPositiveIntFromQuery,
    condicionPago: condicionPagoSchema.optional(),
    estadoPago: z.enum(['PENDIENTE', 'PARCIAL', 'PAGADO']).optional(),
    estadoEntrega: estadoEntregaSchema.optional(),
    requiereFactura: optionalBooleanFromQuery,
    anulado: optionalBooleanFromQuery,
    fechaDesde: optionalDateFromQuery,
    fechaHasta: optionalDateFromQuery,
    busqueda: z.string().trim().min(1, 'busqueda no puede ir vacía').max(255).optional(),
  })
  .refine(
    (data) => {
      if (!data.fechaDesde || !data.fechaHasta) {
        return true;
      }

      return data.fechaDesde <= data.fechaHasta;
    },
    {
      message: 'fechaDesde debe ser menor o igual a fechaHasta',
      path: ['fechaDesde'],
    },
  );

export const createSaleSchema = z
  .object({
    idUsuario: positiveInt,
    idCliente: positiveInt,
    idRutaSesion: positiveInt.optional(),
    idTalonario: positiveInt.optional(),
    numeroProForma: positiveInt.optional(),
    tipoRegistro: tipoRegistroSchema.default('VENTA'),
    estadoEntrega: estadoEntregaSchema.default('PENDIENTE'),
    condicionPago: condicionPagoSchema,
    requiereFactura: z.boolean().default(false),
    nitFacturado: z.string().trim().max(255, 'nitFacturado demasiado largo').optional(),
    nombreClienteFacturado: z.string().trim().max(255, 'nombreClienteFacturado demasiado largo').optional(),
    direccionClienteFacturado: z.string().trim().max(255, 'direccionClienteFacturado demasiado larga').optional(),
    lugarEntrega: z.string().trim().max(255, 'lugarEntrega demasiado largo').optional(),
    fechaEntregaEsperada: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaEntregaEsperada inválida').optional(),
    detalle: z.array(saleDetailItemSchema).min(1, 'detalle debe incluir al menos un producto'),
    pagoInicial: salePaymentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const uniqueIds = new Set<number>();

    for (const [index, item] of data.detalle.entries()) {
      if (item.esBonificacion) {
        continue;
      }

      if (uniqueIds.has(item.idInventarioItem)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No se permite repetir producto vendido en detalle',
          path: ['detalle', index, 'idInventarioItem'],
        });
      }

      uniqueIds.add(item.idInventarioItem);
    }

    if (data.condicionPago === 'CONTADO' && !data.pagoInicial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pagoInicial es obligatorio para ventas de contado',
        path: ['pagoInicial'],
      });
    }
  });

export const updateSaleSchema = z
  .object({
    estadoEntrega: estadoEntregaSchema.optional(),
    requiereFactura: z.boolean().optional(),
    lugarEntrega: z.string().trim().max(255, 'lugarEntrega demasiado largo').optional(),
    fechaEntregaEsperada: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaEntregaEsperada inválida')
      .optional(),
    idUsuarioModificador: positiveInt.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const anulateSaleBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const createSalePaymentSchema = salePaymentSchema.extend({
  idUsuario: positiveInt,
});

export const anulateSalePaymentBodySchema = z.object({
  idUsuarioAnulador: positiveInt.optional(),
});

export const felPingSchema = z.object({
  nitReceptor: z.string().trim().min(1, 'nitReceptor no puede ir vacío').max(25).optional(),
  validarNit: z.boolean().optional().default(true),
});
