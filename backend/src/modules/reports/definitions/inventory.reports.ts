import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { nowIso, round2, sumByKey } from '../helpers';
import { optionalPositiveIntParam } from '../params';
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

export const inventoryReports = [existenciasValorizadas];
