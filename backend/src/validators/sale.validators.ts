import { z } from 'zod';

import {
  finitePositiveNumber,
  optionalBooleanFromQuery,
  optionalDateFromQuery,
  optionalLimitFromQuery,
  optionalPageFromQuery,
  optionalPositiveIntFromQuery,
  positiveInt,
} from './validation';
import { paymentDetailsFields, validatePaymentMethodRequirements } from './payment.validators';

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
    ...paymentDetailsFields,
  })
  .superRefine(validatePaymentMethodRequirements);

export const saleIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
});

export const salePaymentIdParamsSchema = z.object({
  id: z.coerce.number().int('id debe ser entero').positive('id debe ser mayor a 0'),
  idPago: z.coerce.number().int('idPago debe ser entero').positive('idPago debe ser mayor a 0'),
});

export const createCommercialReturnIdempotencyKeySchema = z.string().uuid();

export const createCommercialReturnSchema = z.object({
  detalle: z.array(z.object({
    idDetalleVenta: positiveInt,
    cantidad: finitePositiveNumber,
    motivo: z.string().trim().min(3).max(255),
    condicionFisica: z.enum(['VENDIBLE', 'DANADO', 'NO_VENDIBLE']),
    ubicacionNoVendible: z.string().trim().min(1).max(255).optional(),
  }).superRefine((detail, ctx) => {
    if (detail.condicionFisica !== 'VENDIBLE' && !detail.ubicacionNoVendible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ubicacionNoVendible es obligatoria para productos no vendibles',
        path: ['ubicacionNoVendible'],
      });
    }
  })).min(1).superRefine((details, ctx) => {
    const seen = new Set<number>();
    for (const [index, detail] of details.entries()) {
      if (seen.has(detail.idDetalleVenta)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No se permite repetir el detalle de venta',
          path: [index, 'idDetalleVenta'],
        });
      }
      seen.add(detail.idDetalleVenta);
    }
  }),
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
    fechaExpiracionProforma: z.string().datetime({ offset: true }).optional(),
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
    const isRouteProforma = Boolean(data.idRutaSesion && data.tipoRegistro === 'PROFORMA');
    if (isRouteProforma && !data.fechaExpiracionProforma) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaExpiracionProforma es obligatoria para proformas de ruta',
        path: ['fechaExpiracionProforma'],
      });
    } else if (!isRouteProforma && data.fechaExpiracionProforma) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaExpiracionProforma solo aplica a proformas asociadas a una ruta',
        path: ['fechaExpiracionProforma'],
      });
    } else if (data.fechaExpiracionProforma && new Date(data.fechaExpiracionProforma) <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fechaExpiracionProforma debe ser futura',
        path: ['fechaExpiracionProforma'],
      });
    }

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

const requiredPositiveIntFromQuery = z
  .string()
  .trim()
  .regex(/^\d+$/, 'debe ser entero positivo')
  .transform((value) => Number(value))
  .refine((value) => value > 0, 'debe ser mayor a 0');

export const resolveSalePriceQuerySchema = z.object({
  idCliente: requiredPositiveIntFromQuery,
  idInventarioItem: requiredPositiveIntFromQuery,
});

export const previewSaleBonusesBodySchema = z.object({
  detalle: z
    .array(
      z.object({
        idInventarioItem: positiveInt,
        cantidad: finitePositiveNumber,
      }),
    )
    .min(1, 'detalle debe incluir al menos un producto'),
});

export const listAvailableRutaSesionesQuerySchema = z.object({
  idUsuarioVendedor: optionalPositiveIntFromQuery,
});

export const felReceptorQuerySchema = z.object({
  nit: z.string().trim().min(1, 'nit no puede ir vacío').max(25, 'nit demasiado largo'),
});
