import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import { buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, optionalTopNParam, withDateRangeValidation } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'envases';
const CATEGORIA_LABEL = 'Envases / Garrafones';

const tipoMovimientoOptions = [
  { value: 'PRESTAMO', label: 'Préstamo' },
  { value: 'DEVOLUCION', label: 'Devolución' },
];

function clienteParam(): ReportParamField {
  return { key: 'idCliente', label: 'Cliente', type: 'select', optionsEndpoint: '/api/clients' };
}

function productoParam(): ReportParamField {
  return { key: 'idInventarioItem', label: 'Producto (envase)', type: 'select', optionsEndpoint: '/api/products' };
}

// 32. Saldo de envases por cliente -----------------------------------------------------------
const saldoEnvasesSchema = z.object({
  idCliente: optionalPositiveIntParam,
  idInventarioItem: optionalPositiveIntParam,
});
type SaldoEnvasesParams = z.infer<typeof saldoEnvasesSchema>;

const saldoEnvasesPorCliente: ReportDefinition<SaldoEnvasesParams> = {
  id: 'saldo-envases-cliente',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Saldo de envases por cliente',
  descripcion: '¿Cuántos garrafones están en préstamo?',
  moduloPermiso: 'envases',
  parametros: [clienteParam(), productoParam()],
  schema: saldoEnvasesSchema,
  async run(params) {
    const saldos = await prisma.envaseClienteSaldo.findMany({
      where: {
        CantidadPrestada: { gt: 0 },
        ...(params.idCliente ? { IdCliente: params.idCliente } : {}),
        ...(params.idInventarioItem ? { IdInventarioItem: params.idInventarioItem } : {}),
      },
      include: {
        Cliente: { select: { Entidad: { select: { NombreCompleto: true } } } },
        InventarioItem: { select: { Nombre: true } },
      },
      orderBy: { CantidadPrestada: 'desc' },
      take: 5000,
    });

    const rows = saldos.map((saldo) => ({
      cliente: saldo.Cliente.Entidad.NombreCompleto,
      producto: saldo.InventarioItem.Nombre,
      cantidadPrestada: round2(saldo.CantidadPrestada),
      fechaActualizacion: saldo.FechaActualizacion,
    }));

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'cantidadPrestada', label: 'Cantidad prestada', type: 'number' },
        { key: 'fechaActualizacion', label: 'Última actualización', type: 'date' },
      ],
      rows,
      totals: { cantidadPrestada: sumByKey(rows, (r) => Number(r.cantidadPrestada)) },
      meta: { totalRegistros: rows.length, truncado: saldos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 33. Movimientos de envases ------------------------------------------------------------------
const movimientosEnvasesSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idCliente: optionalPositiveIntParam,
    idInventarioItem: optionalPositiveIntParam,
    tipoMovimiento: z.enum(['PRESTAMO', 'DEVOLUCION']).optional(),
  }),
);
type MovimientosEnvasesParams = z.infer<typeof movimientosEnvasesSchema>;

const movimientosEnvases: ReportDefinition<MovimientosEnvasesParams> = {
  id: 'movimientos-envases',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Movimientos de envases',
  descripcion: 'Préstamos y devoluciones registradas en el período.',
  moduloPermiso: 'envases',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    clienteParam(),
    productoParam(),
    { key: 'tipoMovimiento', label: 'Tipo de movimiento', type: 'select', options: tipoMovimientoOptions },
  ],
  schema: movimientosEnvasesSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const movimientos = await prisma.movimientoEnvase.findMany({
      where: {
        Anulado: false,
        ...(params.idCliente ? { IdCliente: params.idCliente } : {}),
        ...(params.idInventarioItem ? { IdInventarioItem: params.idInventarioItem } : {}),
        ...(params.tipoMovimiento ? { TipoMovimiento: params.tipoMovimiento } : {}),
        ...(fechaFilter ? { FechaMovimiento: fechaFilter } : {}),
      },
      include: {
        Cliente: { select: { Entidad: { select: { NombreCompleto: true } } } },
        InventarioItem: { select: { Nombre: true } },
      },
      orderBy: { FechaMovimiento: 'desc' },
      take: 5000,
    });

    const rows = movimientos.map((mov) => ({
      fecha: mov.FechaMovimiento,
      cliente: mov.Cliente.Entidad.NombreCompleto,
      producto: mov.InventarioItem.Nombre,
      tipoMovimiento: mov.TipoMovimiento,
      cantidad: round2(mov.Cantidad),
      saldoNuevo: round2(mov.SaldoNuevo),
    }));

    const entradas = rows.filter((r) => r.tipoMovimiento === 'DEVOLUCION').reduce((s, r) => s + Number(r.cantidad), 0);
    const salidas = rows.filter((r) => r.tipoMovimiento === 'PRESTAMO').reduce((s, r) => s + Number(r.cantidad), 0);

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'tipoMovimiento', label: 'Tipo', type: 'badge' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'saldoNuevo', label: 'Saldo resultante', type: 'number' },
      ],
      rows,
      indicators: [
        { label: 'Devoluciones', value: round2(entradas) },
        { label: 'Préstamos', value: round2(salidas) },
      ],
      meta: { totalRegistros: rows.length, truncado: movimientos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 34. Garrafones pendientes (ranking) -----------------------------------------------------------
const garrafonesPendientesSchema = z.object({ top: optionalTopNParam });
type GarrafonesPendientesParams = z.infer<typeof garrafonesPendientesSchema>;

const garrafonesPendientesRanking: ReportDefinition<GarrafonesPendientesParams> = {
  id: 'garrafones-pendientes-ranking',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Garrafones pendientes (ranking)',
  descripcion: '¿Quién tiene más garrafones en préstamo?',
  moduloPermiso: 'envases',
  parametros: [{ key: 'top', label: 'Mostrar top N', type: 'number' }],
  schema: garrafonesPendientesSchema,
  async run(params) {
    const saldos = await prisma.envaseClienteSaldo.findMany({
      where: { CantidadPrestada: { gt: 0 } },
      include: { Cliente: { select: { Entidad: { select: { NombreCompleto: true } } } } },
      take: 5000,
    });

    const byCliente = new Map<string, number>();
    for (const saldo of saldos) {
      const nombre = saldo.Cliente.Entidad.NombreCompleto;
      byCliente.set(nombre, (byCliente.get(nombre) ?? 0) + saldo.CantidadPrestada);
    }

    let rows = Array.from(byCliente.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([cliente, cantidad], index) => ({ ranking: index + 1, cliente, cantidadPrestada: round2(cantidad) }));

    if (params.top) {
      rows = rows.slice(0, params.top);
    }

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'cantidadPrestada', label: 'Cantidad prestada', type: 'number' },
      ],
      rows,
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 35. Rotación de envases -------------------------------------------------------------------------
const rotacionEnvasesSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type RotacionEnvasesParams = z.infer<typeof rotacionEnvasesSchema>;

const rotacionEnvases: ReportDefinition<RotacionEnvasesParams> = {
  id: 'rotacion-envases',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Rotación de envases',
  descripcion: 'Entradas (devoluciones) vs. salidas (préstamos) por producto.',
  moduloPermiso: 'envases',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: rotacionEnvasesSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const movimientos = await prisma.movimientoEnvase.findMany({
      where: { Anulado: false, ...(fechaFilter ? { FechaMovimiento: fechaFilter } : {}) },
      include: { InventarioItem: { select: { Nombre: true } } },
      take: 5000,
    });

    const byProducto = new Map<string, { entradas: number; salidas: number }>();
    for (const mov of movimientos) {
      const nombre = mov.InventarioItem.Nombre;
      const entry = byProducto.get(nombre) ?? { entradas: 0, salidas: 0 };
      if (mov.TipoMovimiento === 'DEVOLUCION') {
        entry.entradas += mov.Cantidad;
      } else {
        entry.salidas += mov.Cantidad;
      }
      byProducto.set(nombre, entry);
    }

    const rows = Array.from(byProducto.entries()).map(([producto, entry]) => ({
      producto,
      entradas: round2(entry.entradas),
      salidas: round2(entry.salidas),
      neto: round2(entry.entradas - entry.salidas),
    }));

    return {
      columns: [
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'entradas', label: 'Entradas (devoluciones)', type: 'number' },
        { key: 'salidas', label: 'Salidas (préstamos)', type: 'number' },
        { key: 'neto', label: 'Neto', type: 'number' },
      ],
      rows,
      meta: { totalRegistros: rows.length, truncado: movimientos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

export const envasesReports = [
  saldoEnvasesPorCliente,
  movimientosEnvases,
  garrafonesPendientesRanking,
  rotacionEnvases,
];
