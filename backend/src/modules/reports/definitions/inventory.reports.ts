import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, withDateRangeValidation } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'inventario';
const CATEGORIA_LABEL = 'Inventario';

// Reporte de referencia para validar el layout "inventory-landscape": muchas filas,
// varias columnas numéricas, agrupación por categoría con subtotales y total general.
// Usa únicamente campos reales de `InventarioItem` (Nombre, Categoria, Existencia,
// CostoPromedio, PrecioVenta) — no existe tabla de categorías ni de lotes (ver auditoría).
const existenciasValorizadasSchema = z.object({
  categoria: z.string().trim().min(1).optional(),
  idProveedor: optionalPositiveIntParam,
  incluirAnulados: z.coerce.boolean().optional(),
});

type ExistenciasValorizadasParams = z.infer<typeof existenciasValorizadasSchema>;

const existenciasValorizadas: ReportDefinition<ExistenciasValorizadasParams> = {
  id: 'existencias-valorizadas',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Existencias valorizadas',
  descripcion: '¿Cuánto inventario tenemos y cuál es su valor? Existencias agrupadas por categoría.',
  moduloPermiso: 'inventario',
  orientacionPdf: 'landscape',
  layout: 'inventory-landscape',
  papelFormato: 'letter',
  parametros: [
    { key: 'categoria', label: 'Categoría', type: 'text', placeholder: 'Ej. PRODUCTO_TERMINADO' },
    { key: 'idProveedor', label: 'Proveedor', type: 'select', optionsEndpoint: '/api/providers' },
    { key: 'incluirAnulados', label: 'Incluir anulados', type: 'boolean' },
  ],
  schema: existenciasValorizadasSchema,
  async run(params) {
    const items = await prisma.inventarioItem.findMany({
      where: {
        ...(params.incluirAnulados ? {} : { Anulado: false }),
        ...(params.categoria ? { Categoria: params.categoria } : {}),
        ...(params.idProveedor ? { IdProveedor: params.idProveedor } : {}),
      },
      orderBy: [{ Categoria: 'asc' }, { Nombre: 'asc' }],
      select: {
        Nombre: true,
        Categoria: true,
        Existencia: true,
        CostoPromedio: true,
        PrecioVenta: true,
        Anulado: true,
        Proveedor: { select: { Entidad: { select: { NombreCompleto: true } } } },
      },
      take: 5000,
    });

    const rows = items.map((item) => {
      const costoPromedio = Number(item.CostoPromedio);
      const valorInventario = round2(item.Existencia * costoPromedio);
      return {
        producto: item.Nombre,
        categoria: item.Categoria,
        proveedor: item.Proveedor?.Entidad?.NombreCompleto ?? 'Sin proveedor',
        existencia: round2(item.Existencia),
        costoPromedio: round2(costoPromedio),
        precioVenta: round2(Number(item.PrecioVenta)),
        valorInventario,
        estado: item.Anulado ? 'Anulado' : 'Activo',
      };
    });

    const groupsMap = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = groupsMap.get(row.categoria) ?? [];
      list.push(row);
      groupsMap.set(row.categoria, list);
    }

    const groups = Array.from(groupsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoria, groupRows]) => ({
        key: categoria,
        label: categoria,
        rows: groupRows,
        subtotals: {
          existencia: sumByKey(groupRows, (r) => Number(r.existencia)),
          valorInventario: sumByKey(groupRows, (r) => Number(r.valorInventario)),
        },
      }));

    const valorTotal = sumByKey(rows, (r) => Number(r.valorInventario));
    const existenciaTotal = sumByKey(rows, (r) => Number(r.existencia));

    return {
      columns: [
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'categoria', label: 'Categoría', type: 'text' },
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'existencia', label: 'Existencia', type: 'number' },
        { key: 'costoPromedio', label: 'Costo promedio', type: 'currency' },
        { key: 'precioVenta', label: 'Precio venta', type: 'currency' },
        { key: 'valorInventario', label: 'Valor inventario', type: 'currency' },
        { key: 'estado', label: 'Estado', type: 'badge' },
      ],
      rows: [],
      groups,
      totals: { existencia: existenciaTotal, valorInventario: valorTotal },
      indicators: [
        { label: 'Productos', value: rows.length },
        { label: 'Existencia total', value: round2(existenciaTotal) },
        { label: 'Valor total de inventario', value: `Q ${valorTotal.toFixed(2)}` },
      ],
      meta: { totalRegistros: rows.length, truncado: items.length >= 5000, generadoEn: nowIso() },
    };
  },
};

const movimientosInventarioSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idInventarioItem: optionalPositiveIntParam,
    tipoMovimiento: z.enum(['ENTRADA', 'SALIDA']).optional(),
  }),
);
type MovimientosInventarioParams = z.infer<typeof movimientosInventarioSchema>;

type MovimientoInventarioReportRow = {
  fecha: Date | null;
  producto: string;
  categoria: string;
  tipo: 'Entrada' | 'Salida';
  movimiento: string;
  documento: string;
  existenciaAnterior: number;
  cantidad: number;
  nuevaExistencia: number;
  usuario: string;
};

const movimientosInventario: ReportDefinition<MovimientosInventarioParams> = {
  id: 'movimientos-inventario-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Movimientos de inventario por período',
  descripcion: 'Entradas y salidas de inventario registradas en la bitácora.',
  moduloPermiso: 'inventario',
  orientacionPdf: 'landscape',
  layout: 'inventory-landscape',
  papelFormato: 'letter',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    { key: 'idInventarioItem', label: 'Producto', type: 'select', optionsEndpoint: '/api/products' },
    {
      key: 'tipoMovimiento',
      label: 'Tipo de movimiento',
      type: 'select',
      options: [
        { value: 'ENTRADA', label: 'Entrada' },
        { value: 'SALIDA', label: 'Salida' },
      ],
    },
  ],
  schema: movimientosInventarioSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const movimientos = await prisma.bitacoraInventario.findMany({
      where: {
        Anulado: false,
        ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}),
        ...(params.idInventarioItem ? { IdInventarioItem: params.idInventarioItem } : {}),
        ...(params.tipoMovimiento ? { TipoMovimiento: params.tipoMovimiento === 'ENTRADA' } : {}),
      },
      include: {
        InventarioItem: { select: { Nombre: true, Categoria: true } },
        Usuario: { select: { Nombre: true } },
      },
      orderBy: [{ FechaRegistro: 'desc' }, { Id: 'desc' }],
      take: 5000,
    });

    const rows: MovimientoInventarioReportRow[] = movimientos.map((movimiento) => ({
      fecha: movimiento.FechaRegistro,
      producto: movimiento.InventarioItem.Nombre,
      categoria: movimiento.InventarioItem.Categoria,
      tipo: movimiento.TipoMovimiento ? 'Entrada' : 'Salida',
      movimiento: movimiento.Nombre,
      documento: [movimiento.TipoDocumento, movimiento.Documento].filter(Boolean).join(' ') || '—',
      existenciaAnterior: round2(movimiento.ExistenciaAnterior),
      cantidad: round2(movimiento.Cantidad),
      nuevaExistencia: round2(movimiento.NuevaExistencia),
      usuario: movimiento.Usuario.Nombre,
    }));

    const grupos = ([
      { key: 'entrada', label: 'Entradas', tipo: 'Entrada' },
      { key: 'salida', label: 'Salidas', tipo: 'Salida' },
    ] as const)
      .map(({ key, label, tipo }) => {
        const groupRows = rows.filter((row) => row.tipo === tipo);
        return {
          key,
          label,
          rows: groupRows,
          subtotals: { cantidad: sumByKey(groupRows, (row) => row.cantidad) },
        };
      })
      .filter((group) => group.rows.length > 0);

    const entradas = rows.filter((row) => row.tipo === 'Entrada');
    const salidas = rows.filter((row) => row.tipo === 'Salida');
    const cantidadEntradas = sumByKey(entradas, (row) => row.cantidad);
    const cantidadSalidas = sumByKey(salidas, (row) => row.cantidad);

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'categoria', label: 'Categoría', type: 'text' },
        { key: 'tipo', label: 'Tipo', type: 'badge' },
        { key: 'movimiento', label: 'Movimiento', type: 'text' },
        { key: 'documento', label: 'Documento', type: 'text' },
        { key: 'existenciaAnterior', label: 'Existencia anterior', type: 'number' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'nuevaExistencia', label: 'Nueva existencia', type: 'number' },
        { key: 'usuario', label: 'Usuario', type: 'text' },
      ],
      rows: [],
      groups: grupos,
      indicators: [
        { label: 'Movimientos', value: rows.length },
        { label: 'Unidades de entrada', value: cantidadEntradas.toFixed(2) },
        { label: 'Unidades de salida', value: cantidadSalidas.toFixed(2) },
        { label: 'Variación neta', value: round2(cantidadEntradas - cantidadSalidas).toFixed(2) },
      ],
      meta: { totalRegistros: rows.length, truncado: movimientos.length >= 5000, generadoEn: nowIso() },
    };
  },
};

export const inventoryReports = [existenciasValorizadas, movimientosInventario];
