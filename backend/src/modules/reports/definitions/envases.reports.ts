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
  { value: 'DEVOLUCION_DANADA', label: 'Devolución dañada' },
  { value: 'PERDIDA', label: 'Pérdida' },
  { value: 'BAJA', label: 'Baja' },
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
    tipoMovimiento: z.enum(['PRESTAMO', 'DEVOLUCION', 'DEVOLUCION_DANADA', 'PERDIDA', 'BAJA']).optional(),
  }),
);
type MovimientosEnvasesParams = z.infer<typeof movimientosEnvasesSchema>;

const movimientosEnvases: ReportDefinition<MovimientosEnvasesParams> = {
  id: 'movimientos-envases',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Movimientos de envases',
  descripcion: 'Préstamos, devoluciones, pérdidas y bajas registradas en el período.',
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
      cliente: mov.Cliente?.Entidad.NombreCompleto ?? 'Inventario empresa',
      producto: mov.InventarioItem.Nombre,
      tipoMovimiento: mov.TipoMovimiento,
      estadoEnvase: mov.EstadoEnvase,
      ubicacionEnvase: mov.UbicacionEnvase,
      cantidad: round2(mov.Cantidad),
      saldoNuevo: round2(mov.SaldoNuevo),
    }));

    const entradas = rows
      .filter((r) => r.tipoMovimiento === 'DEVOLUCION' || r.tipoMovimiento === 'DEVOLUCION_DANADA')
      .reduce((s, r) => s + Number(r.cantidad), 0);
    const salidas = rows.filter((r) => r.tipoMovimiento === 'PRESTAMO').reduce((s, r) => s + Number(r.cantidad), 0);
    const perdidas = rows.filter((r) => r.tipoMovimiento === 'PERDIDA').reduce((s, r) => s + Number(r.cantidad), 0);
    const bajas = rows.filter((r) => r.tipoMovimiento === 'BAJA').reduce((s, r) => s + Number(r.cantidad), 0);

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'tipoMovimiento', label: 'Tipo', type: 'badge' },
        { key: 'estadoEnvase', label: 'Estado', type: 'text' },
        { key: 'ubicacionEnvase', label: 'Ubicación', type: 'text' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'saldoNuevo', label: 'Saldo resultante', type: 'number' },
      ],
      rows,
      indicators: [
        { label: 'Devoluciones', value: round2(entradas) },
        { label: 'Préstamos', value: round2(salidas) },
        { label: 'Pérdidas', value: round2(perdidas) },
        { label: 'Bajas', value: round2(bajas) },
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
  descripcion: 'Préstamos, devoluciones, pérdidas y bajas por artículo.',
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

    const byProducto = new Map<string, { prestamos: number; devoluciones: number; perdidas: number; bajas: number }>();
    for (const mov of movimientos) {
      const nombre = mov.InventarioItem.Nombre;
      const entry = byProducto.get(nombre) ?? { prestamos: 0, devoluciones: 0, perdidas: 0, bajas: 0 };
      if (mov.TipoMovimiento === 'PRESTAMO') entry.prestamos += mov.Cantidad;
      if (mov.TipoMovimiento === 'DEVOLUCION' || mov.TipoMovimiento === 'DEVOLUCION_DANADA') {
        entry.devoluciones += mov.Cantidad;
      }
      if (mov.TipoMovimiento === 'PERDIDA') entry.perdidas += mov.Cantidad;
      if (mov.TipoMovimiento === 'BAJA') entry.bajas += mov.Cantidad;
      byProducto.set(nombre, entry);
    }

    const rows = Array.from(byProducto.entries()).map(([producto, entry]) => ({
      producto,
      prestamos: round2(entry.prestamos),
      devoluciones: round2(entry.devoluciones),
      perdidas: round2(entry.perdidas),
      bajas: round2(entry.bajas),
    }));

    return {
      columns: [
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'prestamos', label: 'Préstamos', type: 'number' },
        { key: 'devoluciones', label: 'Devoluciones', type: 'number' },
        { key: 'perdidas', label: 'Pérdidas', type: 'number' },
        { key: 'bajas', label: 'Bajas físicas', type: 'number' },
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
