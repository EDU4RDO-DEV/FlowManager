import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, withDateRangeValidation } from '../params';
import {
  VENTA_REPORT_INCLUDE,
  getClienteNombre,
  prisma,
  ventaSubtotal,
  ventaTotalBonificado,
  type VentaReportRow,
} from './_shared';

const CATEGORIA = 'facturacion';
const CATEGORIA_LABEL = 'Facturación';

// La FEL vive embebida en Venta (NumeroFel, SerieFel, AutorizacionFel, QrFel,
// FechaEmisionFel); no existe un modelo de Factura independiente. Estos reportes
// se derivan de `Venta` filtrando documentos con FEL emitida.
function ventaFacturadaTotal(venta: VentaReportRow): number {
  return round2(ventaSubtotal(venta) + ventaTotalBonificado(venta));
}

// 26. Documentos FEL emitidos -----------------------------------------------------------------
const documentosFelSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type DocumentosFelParams = z.infer<typeof documentosFelSchema>;

const documentosFelEmitidos: ReportDefinition<DocumentosFelParams> = {
  id: 'documentos-fel-emitidos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Documentos FEL emitidos',
  descripcion: 'Ventas con autorización FEL emitida en el período.',
  moduloPermiso: 'ventas',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: documentosFelSchema,
  orientacionPdf: 'landscape',
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const ventas = await prisma.venta.findMany({
      where: {
        Anulado: false,
        NumeroFel: { not: null },
        ...(fechaFilter ? { FechaEmisionFel: fechaFilter } : {}),
      },
      include: VENTA_REPORT_INCLUDE,
      orderBy: { FechaEmisionFel: 'desc' },
      take: 5000,
    });

    const rows = ventas.map((venta) => ({
      fechaEmision: venta.FechaEmisionFel,
      numeroVenta: venta.NumeroVenta,
      cliente: getClienteNombre(venta),
      serieFel: venta.SerieFel ?? '—',
      numeroFel: venta.NumeroFel ?? '—',
      total: ventaFacturadaTotal(venta),
    }));

    return {
      columns: [
        { key: 'fechaEmision', label: 'Fecha emisión', type: 'date' },
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'serieFel', label: 'Serie', type: 'text' },
        { key: 'numeroFel', label: 'Número FEL', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      indicators: [{ label: 'Documentos emitidos', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: ventas.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 27. Facturación por cliente -------------------------------------------------------------------
const facturacionPorClienteSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type FacturacionPorClienteParams = z.infer<typeof facturacionPorClienteSchema>;

const facturacionPorCliente: ReportDefinition<FacturacionPorClienteParams> = {
  id: 'facturacion-por-cliente',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Facturación por cliente',
  descripcion: 'Monto facturado (con FEL) agrupado por cliente.',
  moduloPermiso: 'ventas',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: facturacionPorClienteSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const ventas = await prisma.venta.findMany({
      where: { Anulado: false, NumeroFel: { not: null }, ...(fechaFilter ? { FechaEmisionFel: fechaFilter } : {}) },
      include: VENTA_REPORT_INCLUDE,
      take: 5000,
    });

    const byCliente = new Map<string, { total: number; documentos: number }>();
    for (const venta of ventas) {
      const nombre = getClienteNombre(venta);
      const entry = byCliente.get(nombre) ?? { total: 0, documentos: 0 };
      entry.total += ventaFacturadaTotal(venta);
      entry.documentos += 1;
      byCliente.set(nombre, entry);
    }

    const rows = Array.from(byCliente.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([cliente, entry]) => ({ cliente, documentos: entry.documentos, total: round2(entry.total) }));

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'documentos', label: '# Documentos', type: 'number' },
        { key: 'total', label: 'Total facturado', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 28. Facturación por producto ------------------------------------------------------------------
const facturacionPorProductoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type FacturacionPorProductoParams = z.infer<typeof facturacionPorProductoSchema>;

const facturacionPorProducto: ReportDefinition<FacturacionPorProductoParams> = {
  id: 'facturacion-por-producto',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Facturación por producto',
  descripcion: 'Monto facturado (con FEL) agrupado por producto.',
  moduloPermiso: 'ventas',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: facturacionPorProductoSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const ventas = await prisma.venta.findMany({
      where: { Anulado: false, NumeroFel: { not: null }, ...(fechaFilter ? { FechaEmisionFel: fechaFilter } : {}) },
      include: VENTA_REPORT_INCLUDE,
      take: 5000,
    });

    const byProducto = new Map<string, { cantidad: number; monto: number }>();
    for (const venta of ventas) {
      for (const detalle of venta.DetalleVenta) {
        const nombre = detalle.InventarioItem?.Nombre ?? detalle.Nombre;
        const entry = byProducto.get(nombre) ?? { cantidad: 0, monto: 0 };
        entry.cantidad += detalle.Cantidad;
        entry.monto += detalle.Cantidad * Number(detalle.PrecioUnitario);
        byProducto.set(nombre, entry);
      }
    }

    const rows = Array.from(byProducto.entries())
      .sort(([, a], [, b]) => b.monto - a.monto)
      .map(([producto, entry]) => ({ producto, cantidad: round2(entry.cantidad), monto: round2(entry.monto) }));

    return {
      columns: [
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'monto', label: 'Monto facturado', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 29. Facturación contado/crédito ---------------------------------------------------------------
const facturacionContadoCreditoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type FacturacionContadoCreditoParams = z.infer<typeof facturacionContadoCreditoSchema>;

const facturacionContadoCredito: ReportDefinition<FacturacionContadoCreditoParams> = {
  id: 'facturacion-contado-credito',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Facturación contado/crédito',
  descripcion: 'Distribución de la facturación según condición de pago.',
  moduloPermiso: 'ventas',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: facturacionContadoCreditoSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const ventas = await prisma.venta.findMany({
      where: { Anulado: false, NumeroFel: { not: null }, ...(fechaFilter ? { FechaEmisionFel: fechaFilter } : {}) },
      include: VENTA_REPORT_INCLUDE,
      take: 5000,
    });

    const byCondicion = new Map<string, { documentos: number; total: number }>();
    for (const venta of ventas) {
      const entry = byCondicion.get(venta.CondicionPago) ?? { documentos: 0, total: 0 };
      entry.documentos += 1;
      entry.total += ventaFacturadaTotal(venta);
      byCondicion.set(venta.CondicionPago, entry);
    }

    const totalGeneral = Array.from(byCondicion.values()).reduce((sum, c) => sum + c.total, 0);
    const rows = Array.from(byCondicion.entries()).map(([condicion, entry]) => ({
      condicionPago: condicion === 'CONTADO' ? 'Contado' : 'Crédito',
      documentos: entry.documentos,
      total: round2(entry.total),
      porcentaje: totalGeneral > 0 ? round2((entry.total / totalGeneral) * 100) : 0,
    }));

    return {
      columns: [
        { key: 'condicionPago', label: 'Condición de pago', type: 'badge' },
        { key: 'documentos', label: '# Documentos', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'porcentaje', label: '% del total', type: 'percent' },
      ],
      rows,
      totals: { total: round2(totalGeneral) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 30. Ventas pendientes de facturar ---------------------------------------------------------------
const ventasPendientesFacturarSchema = z.object({});
type VentasPendientesFacturarParams = z.infer<typeof ventasPendientesFacturarSchema>;

const ventasPendientesFacturar: ReportDefinition<VentasPendientesFacturarParams> = {
  id: 'ventas-pendientes-facturar',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas pendientes de facturar',
  descripcion: 'Ventas que requieren factura pero aún no tienen FEL emitida.',
  moduloPermiso: 'ventas',
  parametros: [],
  schema: ventasPendientesFacturarSchema,
  async run() {
    const ventas = await prisma.venta.findMany({
      where: { Anulado: false, RequiereFactura: true, NumeroFel: null },
      include: VENTA_REPORT_INCLUDE,
      orderBy: { FechaRegistro: 'desc' },
      take: 5000,
    });

    const rows = ventas.map((venta) => ({
      fecha: venta.FechaRegistro,
      numeroVenta: venta.NumeroVenta,
      cliente: getClienteNombre(venta),
      total: ventaFacturadaTotal(venta),
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      indicators: [{ label: 'Ventas pendientes de facturar', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 31. Detalle de documentos FEL ------------------------------------------------------------------
const detalleDocumentosFelSchema = z.object({ idCliente: optionalPositiveIntParam });
type DetalleDocumentosFelParams = z.infer<typeof detalleDocumentosFelSchema>;

const detalleDocumentosFel: ReportDefinition<DetalleDocumentosFelParams> = {
  id: 'detalle-documentos-fel',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Detalle de documentos FEL',
  descripcion: 'Serie, número, autorización y QR de cada documento emitido.',
  moduloPermiso: 'ventas',
  parametros: [{ key: 'idCliente', label: 'Cliente', type: 'select', optionsEndpoint: '/api/clients' }],
  schema: detalleDocumentosFelSchema,
  orientacionPdf: 'landscape',
  async run(params) {
    const ventas = await prisma.venta.findMany({
      where: { Anulado: false, NumeroFel: { not: null }, ...(params.idCliente ? { IdCliente: params.idCliente } : {}) },
      include: VENTA_REPORT_INCLUDE,
      orderBy: { FechaEmisionFel: 'desc' },
      take: 5000,
    });

    const rows = ventas.map((venta) => ({
      fechaEmision: venta.FechaEmisionFel,
      cliente: getClienteNombre(venta),
      serieFel: venta.SerieFel ?? '—',
      numeroFel: venta.NumeroFel ?? '—',
      autorizacionFel: venta.AutorizacionFel ?? '—',
      nitFacturado: venta.NitFacturado ?? '—',
    }));

    return {
      columns: [
        { key: 'fechaEmision', label: 'Fecha emisión', type: 'date' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'serieFel', label: 'Serie', type: 'text' },
        { key: 'numeroFel', label: 'Número', type: 'text' },
        { key: 'autorizacionFel', label: 'Autorización', type: 'text' },
        { key: 'nitFacturado', label: 'NIT facturado', type: 'text' },
      ],
      rows,
      meta: { totalRegistros: rows.length, truncado: ventas.length >= 5000, generadoEn: nowIso() },
    };
  },
};

export const invoicingReports = [
  documentosFelEmitidos,
  facturacionPorCliente,
  facturacionPorProducto,
  facturacionContadoCredito,
  ventasPendientesFacturar,
  detalleDocumentosFel,
];
