import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import { buildDateOnlyRangeFilter, buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'logistica';
const CATEGORIA_LABEL = 'Rutas / Logística';

const estadoSesionOptions = [
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'CERRADA', label: 'Cerrada' },
];

const estadoVehiculoOptions = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'EN_RUTA', label: 'En ruta' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'NO_DISPONIBLE', label: 'No disponible' },
];

const tipoMantenimientoOptions = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
];

const estadoMantenimientoOptions = [
  { value: 'PROGRAMADO', label: 'Programado' },
  { value: 'REALIZADO', label: 'Realizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

function vehiculoParam(): ReportParamField {
  return { key: 'idVehiculo', label: 'Vehículo', type: 'select', optionsEndpoint: '/api/logistics/vehiculos' };
}

function rutaParam(): ReportParamField {
  return { key: 'idRuta', label: 'Ruta', type: 'select', optionsEndpoint: '/api/logistics/rutas' };
}

// 58. Sesiones de ruta por período ------------------------------------------------------------------
const sesionesRutaSchema = z.object({
  fechaInicio: optionalDateParam,
  fechaFin: optionalDateParam,
  idRuta: optionalPositiveIntParam,
  idVehiculo: optionalPositiveIntParam,
  estado: z.enum(['PROGRAMADA', 'EN_CURSO', 'CERRADA']).optional(),
});
type SesionesRutaParams = z.infer<typeof sesionesRutaSchema>;

const sesionesRuta: ReportDefinition<SesionesRutaParams> = {
  id: 'sesiones-ruta-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Sesiones de ruta por período',
  descripcion: 'Rutas realizadas con vehículo, chofer, vendedor y kilómetros recorridos.',
  moduloPermiso: 'logistica',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    rutaParam(),
    vehiculoParam(),
    { key: 'estado', label: 'Estado', type: 'select', options: estadoSesionOptions },
  ],
  schema: sesionesRutaSchema,
  async run(params) {
    const fechaFilter = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const sesiones = await prisma.rutaSesion.findMany({
      where: {
        Anulado: false,
        ...(fechaFilter ? { FechaSesion: fechaFilter } : {}),
        ...(params.idRuta ? { IdRuta: params.idRuta } : {}),
        ...(params.idVehiculo ? { IdVehiculo: params.idVehiculo } : {}),
        ...(params.estado ? { Estado: params.estado } : {}),
      },
      include: {
        Ruta: { select: { Nombre: true } },
        Vehiculo: { select: { Placa: true } },
        Usuario_RutaSesion_IdUsuarioChoferToUsuario: { select: { Nombre: true } },
        Usuario_RutaSesion_IdUsuarioVendedorToUsuario: { select: { Nombre: true } },
      },
      orderBy: { FechaSesion: 'desc' },
      take: 5000,
    });

    const rows = sesiones.map((s) => ({
      fecha: s.FechaSesion,
      ruta: s.Ruta.Nombre,
      vehiculo: s.Vehiculo.Placa,
      chofer: s.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Nombre,
      vendedor: s.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Nombre,
      estado: s.Estado,
      kmRecorridos: s.KmInicial !== null && s.KmFinal !== null ? round2(s.KmFinal - s.KmInicial) : null,
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'ruta', label: 'Ruta', type: 'text' },
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'chofer', label: 'Chofer', type: 'text' },
        { key: 'vendedor', label: 'Vendedor', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'kmRecorridos', label: 'Km recorridos', type: 'number' },
      ],
      rows,
      indicators: [{ label: 'Sesiones de ruta', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: sesiones.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 59. Gastos de vehículo por período -----------------------------------------------------------------
const gastosVehiculoSchema = z.object({
  fechaInicio: optionalDateParam,
  fechaFin: optionalDateParam,
  idVehiculo: optionalPositiveIntParam,
  idRuta: optionalPositiveIntParam,
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS']).optional(),
});
type GastosVehiculoParams = z.infer<typeof gastosVehiculoSchema>;

const gastosVehiculo: ReportDefinition<GastosVehiculoParams> = {
  id: 'gastos-vehiculo-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Gastos de vehículo por período',
  descripcion: 'Todos los gastos registrados por sesión de ruta/vehículo (incluye vales).',
  moduloPermiso: 'logistica',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    vehiculoParam(),
    rutaParam(),
    {
      key: 'metodoPago',
      label: 'Método de pago',
      type: 'select',
      options: [
        { value: 'EFECTIVO', label: 'Efectivo' },
        { value: 'TRANSFERENCIA', label: 'Transferencia' },
        { value: 'CHEQUE', label: 'Cheque' },
        { value: 'POS', label: 'POS' },
      ],
    },
  ],
  schema: gastosVehiculoSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const gastos = await prisma.gastoVehiculo.findMany({
      where: {
        Anulado: false,
        ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}),
        ...(params.metodoPago ? { MetodoPago: params.metodoPago } : {}),
        RutaSesion: {
          ...(params.idVehiculo ? { IdVehiculo: params.idVehiculo } : {}),
          ...(params.idRuta ? { IdRuta: params.idRuta } : {}),
        },
      },
      include: { RutaSesion: { select: { Vehiculo: { select: { Placa: true } }, Ruta: { select: { Nombre: true } } } } },
      orderBy: { FechaRegistro: 'desc' },
      take: 5000,
    });

    const rows = gastos.map((g) => ({
      fecha: g.FechaRegistro,
      vehiculo: g.RutaSesion.Vehiculo.Placa,
      ruta: g.RutaSesion.Ruta.Nombre,
      descripcion: g.Descripcion,
      metodoPago: g.MetodoPago,
      numeroVale: g.NumeroVale ?? '—',
      monto: round2(Number(g.Monto)),
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'ruta', label: 'Ruta', type: 'text' },
        { key: 'descripcion', label: 'Descripción', type: 'text' },
        { key: 'metodoPago', label: 'Método de pago', type: 'badge' },
        { key: 'numeroVale', label: '# Vale', type: 'text' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: gastos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 60. Gastos con vale (heurística de combustible) --------------------------------------------------
const gastosConValeSchema = z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, idVehiculo: optionalPositiveIntParam });
type GastosConValeParams = z.infer<typeof gastosConValeSchema>;

const gastosConVale: ReportDefinition<GastosConValeParams> = {
  id: 'gastos-con-vale',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Gastos con número de vale (aprox. combustible)',
  descripcion:
    'El sistema no distingue "combustible" como categoría propia de gasto; esta es una aproximación basada en gastos que registran número de vale.',
  moduloPermiso: 'logistica',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    vehiculoParam(),
  ],
  schema: gastosConValeSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const gastos = await prisma.gastoVehiculo.findMany({
      where: {
        Anulado: false,
        NumeroVale: { not: null },
        ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}),
        ...(params.idVehiculo ? { RutaSesion: { IdVehiculo: params.idVehiculo } } : {}),
      },
      include: { RutaSesion: { select: { Vehiculo: { select: { Placa: true } } } } },
      take: 5000,
    });

    const byVehiculo = new Map<string, { conteo: number; monto: number }>();
    for (const g of gastos) {
      const placa = g.RutaSesion.Vehiculo.Placa;
      const entry = byVehiculo.get(placa) ?? { conteo: 0, monto: 0 };
      entry.conteo += 1;
      entry.monto += Number(g.Monto);
      byVehiculo.set(placa, entry);
    }

    const rows = Array.from(byVehiculo.entries())
      .sort(([, a], [, b]) => b.monto - a.monto)
      .map(([vehiculo, entry]) => ({ vehiculo, vales: entry.conteo, monto: round2(entry.monto) }));

    return {
      columns: [
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'vales', label: '# Vales', type: 'number' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: gastos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 61. Comparación de gasto entre vehículos -----------------------------------------------------------
const comparacionVehiculosSchema = z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam });
type ComparacionVehiculosParams = z.infer<typeof comparacionVehiculosSchema>;

const comparacionVehiculos: ReportDefinition<ComparacionVehiculosParams> = {
  id: 'comparacion-gasto-vehiculos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Comparación de gasto entre vehículos',
  descripcion: '¿Qué vehículo genera más gasto?',
  moduloPermiso: 'logistica',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: comparacionVehiculosSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const gastos = await prisma.gastoVehiculo.findMany({
      where: { Anulado: false, ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}) },
      include: { RutaSesion: { select: { Vehiculo: { select: { Placa: true, Marca: true, Modelo: true } } } } },
      take: 5000,
    });

    const byVehiculo = new Map<string, { conteo: number; monto: number }>();
    for (const g of gastos) {
      const v = g.RutaSesion.Vehiculo;
      const key = `${v.Placa} (${v.Marca} ${v.Modelo})`;
      const entry = byVehiculo.get(key) ?? { conteo: 0, monto: 0 };
      entry.conteo += 1;
      entry.monto += Number(g.Monto);
      byVehiculo.set(key, entry);
    }

    const rows = Array.from(byVehiculo.entries())
      .sort(([, a], [, b]) => b.monto - a.monto)
      .map(([vehiculo, entry], index) => ({
        ranking: index + 1,
        vehiculo,
        gastos: entry.conteo,
        monto: round2(entry.monto),
        promedio: round2(entry.monto / entry.conteo),
      }));

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'gastos', label: '# Gastos', type: 'number' },
        { key: 'monto', label: 'Monto total', type: 'currency' },
        { key: 'promedio', label: 'Promedio por gasto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 62. Mantenimientos por vehículo ---------------------------------------------------------------------
const mantenimientosSchema = z.object({
  idVehiculo: optionalPositiveIntParam,
  tipoMantenimiento: z.enum(['PREVENTIVO', 'CORRECTIVO']).optional(),
  estado: z.enum(['PROGRAMADO', 'REALIZADO', 'CANCELADO']).optional(),
  fechaInicio: optionalDateParam,
  fechaFin: optionalDateParam,
});
type MantenimientosParams = z.infer<typeof mantenimientosSchema>;

const mantenimientosPorVehiculo: ReportDefinition<MantenimientosParams> = {
  id: 'mantenimientos-por-vehiculo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Mantenimientos por vehículo',
  descripcion: 'Historial de mantenimientos preventivos y correctivos.',
  moduloPermiso: 'logistica',
  parametros: [
    vehiculoParam(),
    { key: 'tipoMantenimiento', label: 'Tipo', type: 'select', options: tipoMantenimientoOptions },
    { key: 'estado', label: 'Estado', type: 'select', options: estadoMantenimientoOptions },
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: mantenimientosSchema,
  async run(params) {
    const fechaFilter = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const mantenimientos = await prisma.mantenimientoVehiculo.findMany({
      where: {
        Anulado: false,
        ...(params.idVehiculo ? { IdVehiculo: params.idVehiculo } : {}),
        ...(params.tipoMantenimiento ? { TipoMantenimiento: params.tipoMantenimiento } : {}),
        ...(params.estado ? { Estado: params.estado } : {}),
        ...(fechaFilter ? { FechaMantenimiento: fechaFilter } : {}),
      },
      include: { Vehiculo: { select: { Placa: true } }, Proveedor: { select: { Entidad: { select: { NombreCompleto: true } } } } },
      orderBy: { FechaMantenimiento: 'desc' },
      take: 5000,
    });

    const rows = mantenimientos.map((m) => ({
      fecha: m.FechaMantenimiento,
      vehiculo: m.Vehiculo.Placa,
      tipo: m.TipoMantenimiento,
      descripcion: m.Descripcion,
      proveedor: m.Proveedor?.Entidad?.NombreCompleto ?? '—',
      costo: m.Costo !== null ? round2(Number(m.Costo)) : null,
      estado: m.Estado,
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'tipo', label: 'Tipo', type: 'badge' },
        { key: 'descripcion', label: 'Descripción', type: 'text' },
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'costo', label: 'Costo', type: 'currency' },
        { key: 'estado', label: 'Estado', type: 'badge' },
      ],
      rows,
      totals: { costo: sumByKey(rows, (r) => Number(r.costo ?? 0)) },
      meta: { totalRegistros: rows.length, truncado: mantenimientos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 63. Próximos mantenimientos ---------------------------------------------------------------------------
const proximosMantenimientosSchema = z.object({ fechaCorte: optionalDateParam });
type ProximosMantenimientosParams = z.infer<typeof proximosMantenimientosSchema>;

const proximosMantenimientos: ReportDefinition<ProximosMantenimientosParams> = {
  id: 'proximos-mantenimientos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Próximos mantenimientos programados',
  descripcion: 'Mantenimientos con fecha próxima registrada a partir de la fecha de corte.',
  moduloPermiso: 'logistica',
  parametros: [{ key: 'fechaCorte', label: 'Fecha de corte', type: 'date' }],
  schema: proximosMantenimientosSchema,
  async run(params) {
    const fechaCorte = params.fechaCorte ? new Date(`${params.fechaCorte}T00:00:00`) : new Date();
    const mantenimientos = await prisma.mantenimientoVehiculo.findMany({
      where: { Anulado: false, ProximoMantenimiento: { gte: fechaCorte } },
      include: { Vehiculo: { select: { Placa: true } } },
      orderBy: { ProximoMantenimiento: 'asc' },
      take: 5000,
    });

    const rows = mantenimientos.map((m) => ({
      vehiculo: m.Vehiculo.Placa,
      ultimoTipo: m.TipoMantenimiento,
      proximoMantenimiento: m.ProximoMantenimiento,
    }));

    return {
      columns: [
        { key: 'vehiculo', label: 'Vehículo', type: 'text' },
        { key: 'ultimoTipo', label: 'Último tipo', type: 'badge' },
        { key: 'proximoMantenimiento', label: 'Próximo mantenimiento', type: 'date' },
      ],
      rows,
      indicators: [{ label: 'Mantenimientos próximos', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 64. Vehículos por estado -----------------------------------------------------------------------------
const vehiculosPorEstadoSchema = z.object({ estado: z.enum(['DISPONIBLE', 'EN_RUTA', 'MANTENIMIENTO', 'NO_DISPONIBLE']).optional() });
type VehiculosPorEstadoParams = z.infer<typeof vehiculosPorEstadoSchema>;

const vehiculosPorEstado: ReportDefinition<VehiculosPorEstadoParams> = {
  id: 'vehiculos-por-estado',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Vehículos por estado',
  descripcion: 'Distribución de la flota según su estado actual.',
  moduloPermiso: 'logistica',
  parametros: [{ key: 'estado', label: 'Estado', type: 'select', options: estadoVehiculoOptions }],
  schema: vehiculosPorEstadoSchema,
  async run(params) {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { Anulado: false, ...(params.estado ? { Estado: params.estado } : {}) },
      select: { Estado: true },
    });

    const byEstado = new Map<string, number>();
    for (const v of vehiculos) {
      byEstado.set(v.Estado, (byEstado.get(v.Estado) ?? 0) + 1);
    }

    const rows = Array.from(byEstado.entries()).map(([estado, conteo]) => ({ estado, conteo }));

    return {
      columns: [
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'conteo', label: '# Vehículos', type: 'number' },
      ],
      rows,
      totals: { conteo: rows.reduce((s, r) => s + r.conteo, 0) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const logisticsReports = [
  sesionesRuta,
  gastosVehiculo,
  gastosConVale,
  comparacionVehiculos,
  mantenimientosPorVehiculo,
  proximosMantenimientos,
  vehiculosPorEstado,
];
