import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import { buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, withDateRangeValidation } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'creditos';
const CATEGORIA_LABEL = 'Créditos / Cuentas por Cobrar';

const estadoCreditoOptions = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'ANULADO', label: 'Anulado' },
];

function tipoCreditoParam(): ReportParamField {
  return { key: 'idTipoCredito', label: 'Tipo de crédito', type: 'select', optionsEndpoint: '/api/commercial-rules/tipos-credito' };
}

function clienteParam(): ReportParamField {
  return { key: 'idCliente', label: 'Cliente', type: 'select', optionsEndpoint: '/api/clients' };
}

const CUENTA_INCLUDE = {
  TipoCredito: { select: { Id: true, Nombre: true } },
  Venta: {
    select: {
      Id: true,
      NumeroVenta: true,
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      PagoVenta: { where: { Anulado: false }, select: { Monto: true, FechaPago: true } },
    },
  },
} as const;

function creditoAbonado(cuenta: { Venta: { PagoVenta: Array<{ Monto: unknown }> } }): number {
  return cuenta.Venta.PagoVenta.reduce((sum, p) => sum + Number(p.Monto), 0);
}

// 18. Cartera total ------------------------------------------------------------------------------
const carteraTotalSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idTipoCredito: optionalPositiveIntParam,
    estado: z.enum(['ACTIVO', 'PAGADO', 'ANULADO']).optional(),
  }),
);

type CarteraTotalParams = z.infer<typeof carteraTotalSchema>;

const carteraTotal: ReportDefinition<CarteraTotalParams> = {
  id: 'cartera-total',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Cartera total',
  descripcion: '¿Cuánto nos deben? Saldo agrupado por tipo de crédito.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    tipoCreditoParam(),
    { key: 'estado', label: 'Estado', type: 'select', options: estadoCreditoOptions },
  ],
  schema: carteraTotalSchema,
  async run(params) {
    const fechaCreacionFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: {
        Anulado: false,
        ...(params.idTipoCredito ? { IdTipoCreditoAplicado: params.idTipoCredito } : {}),
        ...(params.estado ? { Estado: params.estado } : {}),
        ...(fechaCreacionFilter ? { FechaCreacion: fechaCreacionFilter } : {}),
      },
      include: CUENTA_INCLUDE,
      take: 5000,
    });

    const byTipo = new Map<string, { original: number; abonado: number; cuentas: number }>();
    for (const cuenta of cuentas) {
      const nombre = cuenta.TipoCredito?.Nombre ?? 'Sin tipo de crédito';
      const entry = byTipo.get(nombre) ?? { original: 0, abonado: 0, cuentas: 0 };
      entry.original += Number(cuenta.TotalOriginal);
      entry.abonado += creditoAbonado(cuenta);
      entry.cuentas += 1;
      byTipo.set(nombre, entry);
    }

    const rows = Array.from(byTipo.entries()).map(([tipoCredito, entry]) => ({
      tipoCredito,
      cuentas: entry.cuentas,
      totalOtorgado: round2(entry.original),
      totalAbonado: round2(entry.abonado),
      saldo: round2(Math.max(0, entry.original - entry.abonado)),
    }));

    const totalOtorgado = sumByKey(rows, (r) => Number(r.totalOtorgado));
    const totalAbonado = sumByKey(rows, (r) => Number(r.totalAbonado));
    const saldo = round2(Math.max(0, totalOtorgado - totalAbonado));

    return {
      columns: [
        { key: 'tipoCredito', label: 'Tipo de crédito', type: 'text' },
        { key: 'cuentas', label: '# Créditos', type: 'number' },
        { key: 'totalOtorgado', label: 'Otorgado', type: 'currency' },
        { key: 'totalAbonado', label: 'Abonado', type: 'currency' },
        { key: 'saldo', label: 'Saldo', type: 'currency' },
      ],
      rows,
      totals: { totalOtorgado, totalAbonado, saldo },
      indicators: [{ label: 'Saldo total de cartera', value: `Q ${saldo.toFixed(2)}` }],
      meta: { totalRegistros: rows.length, truncado: cuentas.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 19. Créditos por cliente -------------------------------------------------------------------------
const creditosPorClienteSchema = z.object({ idCliente: optionalPositiveIntParam.refine((v) => v !== undefined, 'idCliente es obligatorio') });
type CreditosPorClienteParams = z.infer<typeof creditosPorClienteSchema>;

const creditosPorCliente: ReportDefinition<CreditosPorClienteParams> = {
  id: 'creditos-por-cliente',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Créditos por cliente',
  descripcion: 'Créditos y saldo vigente de un cliente específico.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [clienteParam()],
  schema: creditosPorClienteSchema,
  async run(params) {
    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: { Venta: { IdCliente: params.idCliente as number }, Anulado: false },
      include: CUENTA_INCLUDE,
      orderBy: { FechaCreacion: 'desc' },
      take: 5000,
    });

    const rows = cuentas.map((cuenta) => {
      const abonado = creditoAbonado(cuenta);
      return {
        numeroVenta: cuenta.Venta.NumeroVenta,
        tipoCredito: cuenta.TipoCredito?.Nombre ?? 'Sin tipo',
        estado: cuenta.Estado,
        fechaCreacion: cuenta.FechaCreacion,
        fechaVencimiento: cuenta.FechaVencimiento,
        totalOriginal: round2(Number(cuenta.TotalOriginal)),
        abonado: round2(abonado),
        saldo: round2(Math.max(0, Number(cuenta.TotalOriginal) - abonado)),
      };
    });

    return {
      columns: [
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'tipoCredito', label: 'Tipo de crédito', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'fechaCreacion', label: 'Fecha creación', type: 'date' },
        { key: 'fechaVencimiento', label: 'Vencimiento', type: 'date' },
        { key: 'totalOriginal', label: 'Original', type: 'currency' },
        { key: 'abonado', label: 'Abonado', type: 'currency' },
        { key: 'saldo', label: 'Saldo', type: 'currency' },
      ],
      rows,
      totals: { saldo: sumByKey(rows, (r) => Number(r.saldo)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 20. Créditos por estado ---------------------------------------------------------------------------
const creditosPorEstadoSchema = z.object({ estado: z.enum(['ACTIVO', 'PAGADO', 'ANULADO']).optional() });
type CreditosPorEstadoParams = z.infer<typeof creditosPorEstadoSchema>;

const creditosPorEstado: ReportDefinition<CreditosPorEstadoParams> = {
  id: 'creditos-por-estado',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Créditos por estado',
  descripcion: 'Conteo y monto de créditos agrupados por estado.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [{ key: 'estado', label: 'Estado', type: 'select', options: estadoCreditoOptions }],
  schema: creditosPorEstadoSchema,
  async run(params) {
    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: { Anulado: false, ...(params.estado ? { Estado: params.estado } : {}) },
      select: { Estado: true, TotalOriginal: true },
      take: 5000,
    });

    const byEstado = new Map<string, { conteo: number; monto: number }>();
    for (const cuenta of cuentas) {
      const entry = byEstado.get(cuenta.Estado) ?? { conteo: 0, monto: 0 };
      entry.conteo += 1;
      entry.monto += Number(cuenta.TotalOriginal);
      byEstado.set(cuenta.Estado, entry);
    }

    const rows = Array.from(byEstado.entries()).map(([estado, entry]) => ({
      estado,
      conteo: entry.conteo,
      monto: round2(entry.monto),
    }));

    return {
      columns: [
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'conteo', label: '# Créditos', type: 'number' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { conteo: rows.reduce((s, r) => s + r.conteo, 0), monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 21. Créditos vencidos -------------------------------------------------------------------------------
const creditosVencidosSchema = z.object({ fechaCorte: optionalDateParam });
type CreditosVencidosParams = z.infer<typeof creditosVencidosSchema>;

const creditosVencidos: ReportDefinition<CreditosVencidosParams> = {
  id: 'creditos-vencidos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Créditos vencidos',
  descripcion: '¿Qué créditos están vencidos a la fecha de corte?',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [{ key: 'fechaCorte', label: 'Fecha de corte', type: 'date' }],
  schema: creditosVencidosSchema,
  async run(params) {
    const fechaCorte = params.fechaCorte ? new Date(`${params.fechaCorte}T00:00:00`) : new Date();

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: { Anulado: false, Estado: 'ACTIVO', FechaVencimiento: { lt: fechaCorte } },
      include: CUENTA_INCLUDE,
      orderBy: { FechaVencimiento: 'asc' },
      take: 5000,
    });

    const rows = cuentas.map((cuenta) => {
      const abonado = creditoAbonado(cuenta);
      const saldo = round2(Math.max(0, Number(cuenta.TotalOriginal) - abonado));
      const diasVencido = cuenta.FechaVencimiento
        ? Math.floor((fechaCorte.getTime() - cuenta.FechaVencimiento.getTime()) / 86400000)
        : 0;
      return {
        cliente: cuenta.Venta.Cliente?.Entidad?.NombreCompleto ?? 'Sin nombre',
        numeroVenta: cuenta.Venta.NumeroVenta,
        fechaVencimiento: cuenta.FechaVencimiento,
        diasVencido,
        saldo,
      };
    });

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'fechaVencimiento', label: 'Vencimiento', type: 'date' },
        { key: 'diasVencido', label: 'Días vencido', type: 'number' },
        { key: 'saldo', label: 'Saldo', type: 'currency' },
      ],
      rows,
      totals: { saldo: sumByKey(rows, (r) => Number(r.saldo)) },
      indicators: [{ label: 'Créditos vencidos', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 22. Antigüedad de saldos ------------------------------------------------------------------------------
const antiguedadSaldosSchema = z.object({ fechaCorte: optionalDateParam });
type AntiguedadSaldosParams = z.infer<typeof antiguedadSaldosSchema>;

const RANGOS = [
  { label: '0-30 días', min: 0, max: 30 },
  { label: '31-60 días', min: 31, max: 60 },
  { label: '61-90 días', min: 61, max: 90 },
  { label: '90+ días', min: 91, max: Infinity },
];

const antiguedadSaldos: ReportDefinition<AntiguedadSaldosParams> = {
  id: 'antiguedad-saldos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Antigüedad de saldos',
  descripcion: 'Saldo pendiente agrupado por rango de días vencidos.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [{ key: 'fechaCorte', label: 'Fecha de corte', type: 'date' }],
  schema: antiguedadSaldosSchema,
  async run(params) {
    const fechaCorte = params.fechaCorte ? new Date(`${params.fechaCorte}T00:00:00`) : new Date();

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: { Anulado: false, Estado: 'ACTIVO' },
      include: CUENTA_INCLUDE,
      take: 5000,
    });

    const byRango = new Map<string, number>(RANGOS.map((r) => [r.label, 0]));
    for (const cuenta of cuentas) {
      const saldo = round2(Math.max(0, Number(cuenta.TotalOriginal) - creditoAbonado(cuenta)));
      if (saldo <= 0 || !cuenta.FechaVencimiento) continue;
      const dias = Math.max(0, Math.floor((fechaCorte.getTime() - cuenta.FechaVencimiento.getTime()) / 86400000));
      const rango = RANGOS.find((r) => dias >= r.min && dias <= r.max) ?? RANGOS[RANGOS.length - 1];
      byRango.set(rango.label, (byRango.get(rango.label) ?? 0) + saldo);
    }

    const rows = RANGOS.map((r) => ({ rango: r.label, saldo: round2(byRango.get(r.label) ?? 0) }));

    return {
      columns: [
        { key: 'rango', label: 'Rango de antigüedad', type: 'text' },
        { key: 'saldo', label: 'Saldo', type: 'currency' },
      ],
      rows,
      totals: { saldo: sumByKey(rows, (r) => Number(r.saldo)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 23. Abonos / pagos por período --------------------------------------------------------------------------
const abonosPorPeriodoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, idCliente: optionalPositiveIntParam }),
);
type AbonosPorPeriodoParams = z.infer<typeof abonosPorPeriodoSchema>;

const abonosPorPeriodo: ReportDefinition<AbonosPorPeriodoParams> = {
  id: 'abonos-por-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Abonos a crédito por período',
  descripcion: 'Pagos recibidos sobre cuentas por cobrar en el rango de fechas.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    clienteParam(),
  ],
  schema: abonosPorPeriodoSchema,
  async run(params) {
    const pagos = await prisma.pagoVenta.findMany({
      where: {
        Anulado: false,
        ...(buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin)
          ? { FechaPago: buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin) }
          : {}),
        Venta: {
          CondicionPago: 'CREDITO',
          ...(params.idCliente ? { IdCliente: params.idCliente } : {}),
        },
      },
      include: {
        Venta: { select: { NumeroVenta: true, Cliente: { select: { Entidad: { select: { NombreCompleto: true } } } } } },
      },
      orderBy: { FechaPago: 'desc' },
      take: 5000,
    });

    const rows = pagos.map((pago) => ({
      fecha: pago.FechaPago,
      cliente: pago.Venta.Cliente?.Entidad?.NombreCompleto ?? 'Sin nombre',
      numeroVenta: pago.Venta.NumeroVenta,
      metodoPago: pago.MetodoPago,
      monto: round2(Number(pago.Monto)),
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'metodoPago', label: 'Método de pago', type: 'badge' },
        { key: 'monto', label: 'Monto abonado', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: pagos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 24. Recuperación de cartera -------------------------------------------------------------------------
const recuperacionCarteraSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
).refine((data) => Boolean(data.fechaInicio && data.fechaFin), { message: 'fechaInicio y fechaFin son obligatorios' });
type RecuperacionCarteraParams = z.infer<typeof recuperacionCarteraSchema>;

const recuperacionCartera: ReportDefinition<RecuperacionCarteraParams> = {
  id: 'recuperacion-cartera',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Recuperación de cartera',
  descripcion: 'Créditos otorgados vs. monto efectivamente cobrado en el período.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date', required: true },
    { key: 'fechaFin', label: 'Fecha final', type: 'date', required: true },
  ],
  schema: recuperacionCarteraSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);

    const otorgado = await prisma.cuentaPorCobrar.aggregate({
      where: { Anulado: false, FechaCreacion: fechaFilter },
      _sum: { TotalOriginal: true },
      _count: true,
    });

    const pagos = await prisma.pagoVenta.aggregate({
      where: { Anulado: false, FechaPago: fechaFilter, Venta: { CondicionPago: 'CREDITO' } },
      _sum: { Monto: true },
      _count: true,
    });

    const totalOtorgado = round2(Number(otorgado._sum.TotalOriginal ?? 0));
    const totalCobrado = round2(Number(pagos._sum.Monto ?? 0));
    const porcentajeRecuperacion = totalOtorgado > 0 ? round2((totalCobrado / totalOtorgado) * 100) : 0;

    return {
      columns: [
        { key: 'concepto', label: 'Concepto', type: 'text' },
        { key: 'conteo', label: '# Movimientos', type: 'number' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows: [
        { concepto: 'Créditos otorgados', conteo: otorgado._count, monto: totalOtorgado },
        { concepto: 'Abonos cobrados', conteo: pagos._count, monto: totalCobrado },
      ],
      indicators: [{ label: '% de recuperación', value: `${porcentajeRecuperacion.toFixed(2)} %` }],
      meta: { totalRegistros: 2, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 25. Resumen financiero de crédito por tipo -----------------------------------------------------------
const resumenFinancieroSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, idTipoCredito: optionalPositiveIntParam }),
);
type ResumenFinancieroParams = z.infer<typeof resumenFinancieroSchema>;

const resumenFinancieroCredito: ReportDefinition<ResumenFinancieroParams> = {
  id: 'resumen-financiero-credito',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Resumen financiero de crédito por tipo',
  descripcion: 'Otorgado, cobrado y pendiente agrupado por tipo de crédito.',
  moduloPermiso: 'ventas',
  layout: 'financial',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    tipoCreditoParam(),
  ],
  schema: resumenFinancieroSchema,
  async run(params) {
    const fechaCreacionFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: {
        Anulado: false,
        ...(params.idTipoCredito ? { IdTipoCreditoAplicado: params.idTipoCredito } : {}),
        ...(fechaCreacionFilter ? { FechaCreacion: fechaCreacionFilter } : {}),
      },
      include: CUENTA_INCLUDE,
      take: 5000,
    });

    const byTipo = new Map<string, { otorgado: number; cobrado: number }>();
    for (const cuenta of cuentas) {
      const nombre = cuenta.TipoCredito?.Nombre ?? 'Sin tipo';
      const entry = byTipo.get(nombre) ?? { otorgado: 0, cobrado: 0 };
      entry.otorgado += Number(cuenta.TotalOriginal);
      entry.cobrado += creditoAbonado(cuenta);
      byTipo.set(nombre, entry);
    }

    const rows = Array.from(byTipo.entries()).map(([tipoCredito, entry]) => ({
      tipoCredito,
      otorgado: round2(entry.otorgado),
      cobrado: round2(entry.cobrado),
      pendiente: round2(Math.max(0, entry.otorgado - entry.cobrado)),
    }));

    return {
      columns: [
        { key: 'tipoCredito', label: 'Tipo de crédito', type: 'text' },
        { key: 'otorgado', label: 'Otorgado', type: 'currency' },
        { key: 'cobrado', label: 'Cobrado', type: 'currency' },
        { key: 'pendiente', label: 'Pendiente', type: 'currency' },
      ],
      rows,
      totals: {
        otorgado: sumByKey(rows, (r) => Number(r.otorgado)),
        cobrado: sumByKey(rows, (r) => Number(r.cobrado)),
        pendiente: sumByKey(rows, (r) => Number(r.pendiente)),
      },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const creditReports = [
  carteraTotal,
  creditosPorCliente,
  creditosPorEstado,
  creditosVencidos,
  antiguedadSaldos,
  abonosPorPeriodo,
  recuperacionCartera,
  resumenFinancieroCredito,
];
