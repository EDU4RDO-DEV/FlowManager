import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import { buildDateOnlyRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, optionalTopNParam, withDateRangeValidation } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'compras';
const CATEGORIA_LABEL = 'Compras';

function proveedorParam(): ReportParamField {
  return { key: 'idProveedor', label: 'Proveedor', type: 'select', optionsEndpoint: '/api/providers' };
}

function productoParam(): ReportParamField {
  return { key: 'idProducto', label: 'Producto', type: 'select', optionsEndpoint: '/api/products' };
}

const COMPRA_INCLUDE = {
  Proveedor: { select: { Entidad: { select: { NombreCompleto: true } } } },
  DetalleCompra: {
    where: { Anulado: false },
    select: {
      IdInventarioItem: true,
      Cantidad: true,
      CostoUnitario: true,
      InventarioItem: { select: { Nombre: true, Categoria: true } },
    },
  },
  DetalleGasto: { where: { Anulado: false }, select: { Descripcion: true, Cantidad: true, PrecioUnitario: true } },
} as const;

type CompraRow = Awaited<ReturnType<typeof fetchCompras>>[number];

function compraProveedorNombre(compra: CompraRow): string {
  return compra.Proveedor?.Entidad?.NombreCompleto ?? 'Proveedor sin nombre';
}

function compraTotalDetalle(compra: CompraRow): number {
  return compra.DetalleCompra.reduce((sum, d) => sum + d.Cantidad * Number(d.CostoUnitario), 0);
}

function compraTotalGasto(compra: CompraRow): number {
  return compra.DetalleGasto.reduce((sum, g) => sum + Number(g.Cantidad) * Number(g.PrecioUnitario), 0);
}

async function fetchCompras(where: Record<string, unknown>) {
  return prisma.compra.findMany({
    where,
    include: COMPRA_INCLUDE,
    orderBy: { FechaFactura: 'desc' },
    take: 5000,
  });
}

function buildCompraWhere(params: {
  fechaInicio?: string;
  fechaFin?: string;
  idProveedor?: number;
  esGasto?: boolean;
  incluirAnuladas?: boolean;
}) {
  const fechaFilter = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
  return {
    ...(params.incluirAnuladas ? {} : { Anulado: false }),
    ...(params.idProveedor ? { IdProveedor: params.idProveedor } : {}),
    ...(params.esGasto !== undefined ? { EsGasto: params.esGasto } : {}),
    ...(fechaFilter ? { FechaFactura: fechaFilter } : {}),
  };
}

// 1. Compras por período (resumen/detalle) --------------------------------------------------
const comprasPorPeriodoSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idProveedor: optionalPositiveIntParam,
    idProducto: optionalPositiveIntParam,
    vista: z.enum(['resumen', 'detalle']).default('resumen'),
  }),
);
type ComprasPorPeriodoParams = z.infer<typeof comprasPorPeriodoSchema>;

const comprasPorPeriodo: ReportDefinition<ComprasPorPeriodoParams> = {
  id: 'compras-por-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Compras por período',
  descripcion: '¿Cuánto compramos? Detalle o resumen de compras en el rango de fechas.',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    proveedorParam(),
    productoParam(),
    {
      key: 'vista',
      label: 'Vista',
      type: 'select',
      options: [
        { value: 'resumen', label: 'Resumen (una fila por compra)' },
        { value: 'detalle', label: 'Detalle (una fila por producto)' },
      ],
    },
  ],
  schema: comprasPorPeriodoSchema,
  async run(params) {
    let compras = await fetchCompras(buildCompraWhere(params));

    if (params.idProducto) {
      compras = compras.filter((c) => c.DetalleCompra.some((d) => d.IdInventarioItem === params.idProducto));
    }

    const rows: Array<Record<string, unknown>> =
      params.vista === 'detalle'
        ? compras.flatMap((compra) =>
            compra.DetalleCompra.filter((d) => !params.idProducto || d.IdInventarioItem === params.idProducto).map((d) => ({
              fecha: compra.FechaFactura,
              numeroCompra: compra.NumeroCompra,
              proveedor: compraProveedorNombre(compra),
              producto: d.InventarioItem?.Nombre ?? 'Producto',
              cantidad: round2(d.Cantidad),
              costoUnitario: round2(Number(d.CostoUnitario)),
              subtotal: round2(d.Cantidad * Number(d.CostoUnitario)),
            })),
          )
        : compras.map((compra) => ({
            fecha: compra.FechaFactura,
            numeroCompra: compra.NumeroCompra,
            numeroFactura: compra.NumeroFactura,
            proveedor: compraProveedorNombre(compra),
            esGasto: compra.EsGasto ? 'Sí' : 'No',
            total: round2(compraTotalDetalle(compra) + compraTotalGasto(compra)),
          }));

    const totalGeneral = sumByKey(rows, (r) => Number(r.subtotal ?? r.total ?? 0));

    const columns =
      params.vista === 'detalle'
        ? [
            { key: 'fecha', label: 'Fecha', type: 'date' as const },
            { key: 'numeroCompra', label: 'Compra #', type: 'number' as const },
            { key: 'proveedor', label: 'Proveedor', type: 'text' as const },
            { key: 'producto', label: 'Producto', type: 'text' as const },
            { key: 'cantidad', label: 'Cantidad', type: 'number' as const },
            { key: 'costoUnitario', label: 'Costo unit.', type: 'currency' as const },
            { key: 'subtotal', label: 'Subtotal', type: 'currency' as const },
          ]
        : [
            { key: 'fecha', label: 'Fecha', type: 'date' as const },
            { key: 'numeroCompra', label: 'Compra #', type: 'number' as const },
            { key: 'numeroFactura', label: 'Factura', type: 'text' as const },
            { key: 'proveedor', label: 'Proveedor', type: 'text' as const },
            { key: 'esGasto', label: 'Es gasto', type: 'badge' as const },
            { key: 'total', label: 'Total', type: 'currency' as const },
          ];

    return {
      columns,
      rows,
      totals: { [params.vista === 'detalle' ? 'subtotal' : 'total']: totalGeneral },
      indicators: [
        { label: 'Total comprado', value: `Q ${totalGeneral.toFixed(2)}` },
        { label: '# Compras', value: compras.length },
      ],
      meta: { totalRegistros: rows.length, truncado: compras.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 2. Compras por proveedor (ranking) -----------------------------------------------------------
const comprasPorProveedorSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, top: optionalTopNParam }),
);
type ComprasPorProveedorParams = z.infer<typeof comprasPorProveedorSchema>;

const comprasPorProveedor: ReportDefinition<ComprasPorProveedorParams> = {
  id: 'compras-por-proveedor',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Compras por proveedor',
  descripcion: '¿A qué proveedores compramos más?',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    { key: 'top', label: 'Mostrar top N', type: 'number' },
  ],
  schema: comprasPorProveedorSchema,
  async run(params) {
    const compras = await fetchCompras(buildCompraWhere(params));

    const byProveedor = new Map<string, { total: number; compras: number }>();
    for (const compra of compras) {
      const nombre = compraProveedorNombre(compra);
      const entry = byProveedor.get(nombre) ?? { total: 0, compras: 0 };
      entry.total += compraTotalDetalle(compra) + compraTotalGasto(compra);
      entry.compras += 1;
      byProveedor.set(nombre, entry);
    }

    let rows = Array.from(byProveedor.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([proveedor, entry], index) => ({
        ranking: index + 1,
        proveedor,
        compras: entry.compras,
        total: round2(entry.total),
      }));

    if (params.top) rows = rows.slice(0, params.top);

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'compras', label: '# Compras', type: 'number' },
        { key: 'total', label: 'Total comprado', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 3. Compras por producto (ranking) -------------------------------------------------------------
const comprasPorProductoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, top: optionalTopNParam }),
);
type ComprasPorProductoParams = z.infer<typeof comprasPorProductoSchema>;

const comprasPorProducto: ReportDefinition<ComprasPorProductoParams> = {
  id: 'compras-por-producto',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Compras por producto',
  descripcion: '¿Qué productos/materias primas compramos más?',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    { key: 'top', label: 'Mostrar top N', type: 'number' },
  ],
  schema: comprasPorProductoSchema,
  async run(params) {
    const compras = await fetchCompras(buildCompraWhere(params));

    const byProducto = new Map<string, { categoria: string; cantidad: number; monto: number }>();
    for (const compra of compras) {
      for (const detalle of compra.DetalleCompra) {
        const nombre = detalle.InventarioItem?.Nombre ?? 'Producto';
        const entry = byProducto.get(nombre) ?? { categoria: detalle.InventarioItem?.Categoria ?? 'Sin categoría', cantidad: 0, monto: 0 };
        entry.cantidad += detalle.Cantidad;
        entry.monto += detalle.Cantidad * Number(detalle.CostoUnitario);
        byProducto.set(nombre, entry);
      }
    }

    let rows = Array.from(byProducto.entries())
      .sort(([, a], [, b]) => b.monto - a.monto)
      .map(([producto, entry], index) => ({
        ranking: index + 1,
        producto,
        categoria: entry.categoria,
        cantidad: round2(entry.cantidad),
        monto: round2(entry.monto),
      }));

    if (params.top) rows = rows.slice(0, params.top);

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'categoria', label: 'Categoría', type: 'text' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 4. Gastos de compra ------------------------------------------------------------------------------
const gastosCompraSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, idProveedor: optionalPositiveIntParam }),
);
type GastosCompraParams = z.infer<typeof gastosCompraSchema>;

const gastosCompra: ReportDefinition<GastosCompraParams> = {
  id: 'gastos-compra',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Gastos registrados en compras',
  descripcion: 'Gastos (no mercadería) registrados dentro de compras, por período.',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    proveedorParam(),
  ],
  schema: gastosCompraSchema,
  async run(params) {
    const compras = await fetchCompras(buildCompraWhere({ ...params, esGasto: true }));

    const rows = compras.flatMap((compra) =>
      compra.DetalleGasto.map((gasto) => ({
        fecha: compra.FechaFactura,
        numeroCompra: compra.NumeroCompra,
        proveedor: compraProveedorNombre(compra),
        descripcion: gasto.Descripcion,
        cantidad: round2(Number(gasto.Cantidad)),
        precioUnitario: round2(Number(gasto.PrecioUnitario)),
        subtotal: round2(Number(gasto.Cantidad) * Number(gasto.PrecioUnitario)),
      })),
    );

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'numeroCompra', label: 'Compra #', type: 'number' },
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'descripcion', label: 'Descripción', type: 'text' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'precioUnitario', label: 'Precio unit.', type: 'currency' },
        { key: 'subtotal', label: 'Subtotal', type: 'currency' },
      ],
      rows,
      totals: { subtotal: sumByKey(rows, (r) => Number(r.subtotal)) },
      meta: { totalRegistros: rows.length, truncado: compras.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 5. Compras vs. gastos --------------------------------------------------------------------------
const comprasVsGastosSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type ComprasVsGastosParams = z.infer<typeof comprasVsGastosSchema>;

const comprasVsGastos: ReportDefinition<ComprasVsGastosParams> = {
  id: 'compras-vs-gastos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Compras vs. gastos',
  descripcion: 'Comparativo entre compras de mercadería/materia prima y gastos registrados.',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: comprasVsGastosSchema,
  async run(params) {
    const compras = await fetchCompras(buildCompraWhere(params));

    const mercaderia = compras.filter((c) => !c.EsGasto);
    const gastos = compras.filter((c) => c.EsGasto);

    const totalMercaderia = sumByKey(mercaderia, (c) => compraTotalDetalle(c) + compraTotalGasto(c));
    const totalGastos = sumByKey(gastos, (c) => compraTotalDetalle(c) + compraTotalGasto(c));

    const rows = [
      { concepto: 'Compras de mercadería/materia prima', conteo: mercaderia.length, total: totalMercaderia },
      { concepto: 'Gastos', conteo: gastos.length, total: totalGastos },
    ];

    return {
      columns: [
        { key: 'concepto', label: 'Concepto', type: 'text' },
        { key: 'conteo', label: '# Registros', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { total: round2(totalMercaderia + totalGastos) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 6. Compras anuladas (auditoría) -------------------------------------------------------------------
const comprasAnuladasSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);
type ComprasAnuladasParams = z.infer<typeof comprasAnuladasSchema>;

const comprasAnuladas: ReportDefinition<ComprasAnuladasParams> = {
  id: 'compras-anuladas',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Compras anuladas',
  descripcion: 'Auditoría de compras anuladas en el período.',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: comprasAnuladasSchema,
  async run(params) {
    const fechaFilter = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const compras = await prisma.compra.findMany({
      where: { Anulado: true, ...(fechaFilter ? { FechaAnulacion: fechaFilter } : {}) },
      include: COMPRA_INCLUDE,
      orderBy: { FechaAnulacion: 'desc' },
      take: 5000,
    });

    const rows = compras.map((compra) => ({
      numeroCompra: compra.NumeroCompra,
      proveedor: compraProveedorNombre(compra),
      fechaAnulacion: compra.FechaAnulacion,
      montoAnulado: round2(compraTotalDetalle(compra) + compraTotalGasto(compra)),
    }));

    return {
      columns: [
        { key: 'numeroCompra', label: 'Compra #', type: 'number' },
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'fechaAnulacion', label: 'Fecha anulación', type: 'date' },
        { key: 'montoAnulado', label: 'Monto anulado', type: 'currency' },
      ],
      rows,
      totals: { montoAnulado: sumByKey(rows, (r) => Number(r.montoAnulado)) },
      indicators: [{ label: 'Compras anuladas', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 7. Comparativo de compras entre períodos --------------------------------------------------------
const comparativoComprasSchema = z
  .object({
    periodoAInicio: optionalDateParam,
    periodoAFin: optionalDateParam,
    periodoBInicio: optionalDateParam,
    periodoBFin: optionalDateParam,
  })
  .refine((data) => Boolean(data.periodoAInicio && data.periodoAFin && data.periodoBInicio && data.periodoBFin), {
    message: 'Debe indicar ambos períodos completos',
  });
type ComparativoComprasParams = z.infer<typeof comparativoComprasSchema>;

const comparativoCompras: ReportDefinition<ComparativoComprasParams> = {
  id: 'comparativo-compras-periodos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Comparativo de compras entre períodos',
  descripcion: '¿Cómo ha evolucionado nuestro gasto en compras?',
  moduloPermiso: 'compras',
  parametros: [
    { key: 'periodoAInicio', label: 'Período A - inicio', type: 'date', required: true },
    { key: 'periodoAFin', label: 'Período A - fin', type: 'date', required: true },
    { key: 'periodoBInicio', label: 'Período B - inicio', type: 'date', required: true },
    { key: 'periodoBFin', label: 'Período B - fin', type: 'date', required: true },
  ],
  schema: comparativoComprasSchema,
  async run(params) {
    const [comprasA, comprasB] = await Promise.all([
      fetchCompras(buildCompraWhere({ fechaInicio: params.periodoAInicio, fechaFin: params.periodoAFin })),
      fetchCompras(buildCompraWhere({ fechaInicio: params.periodoBInicio, fechaFin: params.periodoBFin })),
    ]);

    const totalA = sumByKey(comprasA, (c) => compraTotalDetalle(c) + compraTotalGasto(c));
    const totalB = sumByKey(comprasB, (c) => compraTotalDetalle(c) + compraTotalGasto(c));
    const variacion = totalA > 0 ? round2(((totalB - totalA) / totalA) * 100) : 0;

    const rows = [
      { periodo: `${params.periodoAInicio} a ${params.periodoAFin}`, compras: comprasA.length, total: totalA },
      { periodo: `${params.periodoBInicio} a ${params.periodoBFin}`, compras: comprasB.length, total: totalB },
    ];

    return {
      columns: [
        { key: 'periodo', label: 'Período', type: 'text' },
        { key: 'compras', label: '# Compras', type: 'number' },
        { key: 'total', label: 'Total comprado', type: 'currency' },
      ],
      rows,
      indicators: [
        { label: 'Período A', value: `Q ${totalA.toFixed(2)}` },
        { label: 'Período B', value: `Q ${totalB.toFixed(2)}` },
        { label: 'Variación', value: `${variacion > 0 ? '+' : ''}${variacion.toFixed(2)} %` },
      ],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const purchasesReports = [
  comprasPorPeriodo,
  comprasPorProveedor,
  comprasPorProducto,
  gastosCompra,
  comprasVsGastos,
  comprasAnuladas,
  comparativoCompras,
];
