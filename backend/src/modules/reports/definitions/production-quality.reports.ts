import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { buildDateOnlyRangeFilter, nowIso, round2 } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam } from '../params';
import { prisma } from './_shared';

// Auditoría (Fase 1): el sistema NO tiene módulo de producción real (sin Lote,
// OrdenProduccion, consumo real ni merma). Por eso aquí solo se implementan los
// reportes que sí tienen datos reales: la estructura estática de producto (BOM) y el
// control de calidad del agua. No se inventan reportes de producción/merma/rendimiento.

const CATEGORIA_PRODUCCION = 'produccion';
const CATEGORIA_PRODUCCION_LABEL = 'Producción';
const CATEGORIA_CALIDAD = 'calidad';
const CATEGORIA_CALIDAD_LABEL = 'Calidad';

// 55. Estructura de producto (BOM) ----------------------------------------------------------------
const estructuraProductoSchema = z.object({ idProductoTerminado: optionalPositiveIntParam });
type EstructuraProductoParams = z.infer<typeof estructuraProductoSchema>;

const estructuraProducto: ReportDefinition<EstructuraProductoParams> = {
  id: 'estructura-producto-bom',
  categoria: CATEGORIA_PRODUCCION,
  categoriaLabel: CATEGORIA_PRODUCCION_LABEL,
  nombre: 'Estructura de producto (BOM)',
  descripcion: 'Materia prima requerida para fabricar cada producto terminado.',
  moduloPermiso: 'produccion',
  parametros: [{ key: 'idProductoTerminado', label: 'Producto terminado', type: 'select', optionsEndpoint: '/api/products' }],
  schema: estructuraProductoSchema,
  async run(params) {
    const estructuras = await prisma.estructuraProducto.findMany({
      where: {
        Anulado: false,
        ...(params.idProductoTerminado ? { IdProductoTerminado: params.idProductoTerminado } : {}),
      },
      select: {
        CantidadRequerida: true,
        InventarioItem_EstructuraProducto_IdProductoTerminadoToInventarioItem: { select: { Nombre: true } },
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: { select: { Nombre: true } },
      },
      orderBy: { Id: 'desc' },
      take: 5000,
    });

    const rows = estructuras.map((e) => ({
      productoTerminado: e.InventarioItem_EstructuraProducto_IdProductoTerminadoToInventarioItem?.Nombre ?? 'Producto',
      materiaPrima: e.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem?.Nombre ?? 'Materia prima',
      cantidadRequerida: round2(e.CantidadRequerida),
    }));

    const groupsMap = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = groupsMap.get(row.productoTerminado) ?? [];
      list.push(row);
      groupsMap.set(row.productoTerminado, list);
    }

    const groups = Array.from(groupsMap.entries()).map(([producto, groupRows]) => ({
      key: producto,
      label: producto,
      rows: groupRows,
    }));

    return {
      columns: [
        { key: 'productoTerminado', label: 'Producto terminado', type: 'text' },
        { key: 'materiaPrima', label: 'Materia prima / insumo', type: 'text' },
        { key: 'cantidadRequerida', label: 'Cantidad requerida', type: 'number' },
      ],
      rows: [],
      groups,
      indicators: [{ label: 'Productos con receta definida', value: groupsMap.size }],
      meta: { totalRegistros: rows.length, truncado: estructuras.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 56. Control de calidad del agua -----------------------------------------------------------------
const controlCalidadSchema = z.object({
  fechaInicio: optionalDateParam,
  fechaFin: optionalDateParam,
  validado: z.enum(['true', 'false']).optional(),
});
type ControlCalidadParams = z.infer<typeof controlCalidadSchema>;

const controlCalidadAgua: ReportDefinition<ControlCalidadParams> = {
  id: 'control-calidad-agua',
  categoria: CATEGORIA_CALIDAD,
  categoriaLabel: CATEGORIA_CALIDAD_LABEL,
  nombre: 'Control de calidad del agua',
  descripcion: 'Registro diario de cloro y pH antes/después de filtrado.',
  moduloPermiso: 'calidad',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    {
      key: 'validado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'true', label: 'Validado' },
        { value: 'false', label: 'Pendiente' },
      ],
    },
  ],
  schema: controlCalidadSchema,
  async run(params) {
    const fechaFilter = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const registros = await prisma.controlCalidadAgua.findMany({
      where: {
        Anulado: false,
        ...(fechaFilter ? { Fecha: fechaFilter } : {}),
        ...(params.validado !== undefined ? { Validado: params.validado === 'true' } : {}),
      },
      orderBy: { Fecha: 'desc' },
      take: 5000,
    });

    const rows = registros.map((r) => ({
      fecha: r.Fecha,
      diaNoLaborado: r.DiaNoLaborado ? 'Sí' : 'No',
      cloroAntes: r.CloroAntesFiltrado !== null ? round2(Number(r.CloroAntesFiltrado)) : null,
      cloroDespues: r.CloroDespuesFiltrado !== null ? round2(Number(r.CloroDespuesFiltrado)) : null,
      phAntes: r.PhAntesFiltrado !== null ? round2(Number(r.PhAntesFiltrado)) : null,
      phDespues: r.PhDespuesFiltrado !== null ? round2(Number(r.PhDespuesFiltrado)) : null,
      estado: r.Validado ? 'Validado' : 'Pendiente',
    }));

    const validados = rows.filter((r) => r.estado === 'Validado').length;

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'diaNoLaborado', label: 'Día no laborado', type: 'badge' },
        { key: 'cloroAntes', label: 'Cloro antes', type: 'number' },
        { key: 'cloroDespues', label: 'Cloro después', type: 'number' },
        { key: 'phAntes', label: 'pH antes', type: 'number' },
        { key: 'phDespues', label: 'pH después', type: 'number' },
        { key: 'estado', label: 'Estado', type: 'badge' },
      ],
      rows,
      indicators: [
        { label: 'Registros', value: rows.length },
        { label: 'Validados', value: validados },
        { label: 'Pendientes', value: rows.length - validados },
      ],
      meta: { totalRegistros: rows.length, truncado: registros.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 57. Días sin registro de control de calidad -------------------------------------------------------
const diasFaltantesSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});
type DiasFaltantesParams = z.infer<typeof diasFaltantesSchema>;

const diasFaltantesCalidad: ReportDefinition<DiasFaltantesParams> = {
  id: 'dias-faltantes-calidad',
  categoria: CATEGORIA_CALIDAD,
  categoriaLabel: CATEGORIA_CALIDAD_LABEL,
  nombre: 'Días sin registro de control de calidad',
  descripcion: '¿Qué días del mes no tienen control de calidad registrado?',
  moduloPermiso: 'calidad',
  parametros: [
    { key: 'anio', label: 'Año', type: 'number', required: true },
    { key: 'mes', label: 'Mes (1-12)', type: 'number', required: true },
  ],
  schema: diasFaltantesSchema,
  async run(params) {
    const registros = await prisma.controlCalidadAgua.findMany({
      where: { Anulado: false },
      select: { Fecha: true },
    });

    const registradas = new Set(
      registros
        .filter((r) => r.Fecha.getUTCFullYear() === params.anio && r.Fecha.getUTCMonth() + 1 === params.mes)
        .map((r) => r.Fecha.getUTCDate()),
    );

    const hoy = new Date();
    const esMesActual = hoy.getUTCFullYear() === params.anio && hoy.getUTCMonth() + 1 === params.mes;
    const diasEnMes = new Date(Date.UTC(params.anio, params.mes, 0)).getUTCDate();
    const ultimoDia = esMesActual ? hoy.getUTCDate() : diasEnMes;

    const rows: Array<Record<string, unknown>> = [];
    for (let dia = 1; dia <= ultimoDia; dia += 1) {
      if (!registradas.has(dia)) {
        rows.push({ fecha: new Date(Date.UTC(params.anio, params.mes - 1, dia)) });
      }
    }

    return {
      columns: [{ key: 'fecha', label: 'Fecha sin registro', type: 'date' }],
      rows,
      indicators: [
        { label: 'Días evaluados', value: ultimoDia },
        { label: 'Días sin registro', value: rows.length },
      ],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const productionQualityReports = [estructuraProducto, controlCalidadAgua, diasFaltantesCalidad];
