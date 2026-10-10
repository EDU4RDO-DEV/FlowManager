import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { buildDateOnlyRangeFilter, buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, withDateRangeValidation } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'proveedores';
const CATEGORIA_LABEL = 'Proveedores';

const estadoProveedorOptions = [
  { value: 'activos', label: 'Activos' },
  { value: 'anulados', label: 'Anulados' },
  { value: 'todos', label: 'Todos' },
];

// 51. Listado de proveedores --------------------------------------------------------------------
const listadoProveedoresSchema = z.object({ estado: z.enum(['activos', 'anulados', 'todos']).default('activos') });
type ListadoProveedoresParams = z.infer<typeof listadoProveedoresSchema>;

const listadoProveedores: ReportDefinition<ListadoProveedoresParams> = {
  id: 'listado-proveedores',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Listado de proveedores',
  descripcion: 'Proveedores activos, anulados o todos.',
  moduloPermiso: 'proveedores',
  parametros: [{ key: 'estado', label: 'Estado', type: 'select', options: estadoProveedorOptions }],
  schema: listadoProveedoresSchema,
  async run(params) {
    const proveedores = await prisma.proveedor.findMany({
      where: {
        ...(params.estado === 'activos' ? { Anulado: false } : {}),
        ...(params.estado === 'anulados' ? { Anulado: true } : {}),
      },
      orderBy: { Id: 'desc' },
      select: {
        Anulado: true,
        FechaRegistro: true,
        Entidad: { select: { NombreCompleto: true, Nit: true, Telefono1: true } },
      },
      take: 5000,
    });

    const rows = proveedores.map((proveedor) => ({
      proveedor: proveedor.Entidad.NombreCompleto,
      nit: proveedor.Entidad.Nit ?? '—',
      telefono: proveedor.Entidad.Telefono1 ?? '—',
      estado: proveedor.Anulado ? 'Anulado' : 'Activo',
      fechaRegistro: proveedor.FechaRegistro,
    }));

    return {
      columns: [
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'nit', label: 'NIT', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'fechaRegistro', label: 'Fecha de registro', type: 'date' },
      ],
      rows,
      indicators: [{ label: 'Total de proveedores', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: proveedores.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 52. Historial comercial por proveedor (multimódulo) --------------------------------------------
const historialProveedorSchema = withDateRangeValidation(
  z.object({
    idProveedor: optionalPositiveIntParam.refine((v) => v !== undefined, 'idProveedor es obligatorio'),
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
  }),
);
type HistorialProveedorParams = z.infer<typeof historialProveedorSchema>;

const historialProveedor: ReportDefinition<HistorialProveedorParams> = {
  id: 'historial-comercial-proveedor',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Historial comercial por proveedor',
  descripcion: 'Compras, gastos de vehículo y mantenimientos asociados a un proveedor.',
  moduloPermiso: 'proveedores',
  parametros: [
    { key: 'idProveedor', label: 'Proveedor', type: 'select', required: true, optionsEndpoint: '/api/providers' },
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: historialProveedorSchema,
  async run(params) {
    const idProveedor = params.idProveedor as number;
    const fechaFactura = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const fechaDateTime = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);

    const [compras, gastosVehiculo, mantenimientos] = await Promise.all([
      prisma.compra.findMany({
        where: { IdProveedor: idProveedor, Anulado: false, ...(fechaFactura ? { FechaFactura: fechaFactura } : {}) },
        include: {
          DetalleCompra: { where: { Anulado: false }, select: { Cantidad: true, CostoUnitario: true } },
          DetalleGasto: { where: { Anulado: false }, select: { Cantidad: true, PrecioUnitario: true } },
        },
      }),
      prisma.gastoVehiculo.findMany({
        where: { IdProveedor: idProveedor, Anulado: false, ...(fechaDateTime ? { FechaRegistro: fechaDateTime } : {}) },
        select: { Monto: true },
      }),
      prisma.mantenimientoVehiculo.findMany({
        where: { IdProveedor: idProveedor, Anulado: false, ...(fechaFactura ? { FechaMantenimiento: fechaFactura } : {}) },
        select: { Costo: true },
      }),
    ]);

    const totalCompras = sumByKey(
      compras,
      (c) =>
        c.DetalleCompra.reduce((s, d) => s + d.Cantidad * Number(d.CostoUnitario), 0) +
        c.DetalleGasto.reduce((s, g) => s + Number(g.Cantidad) * Number(g.PrecioUnitario), 0),
    );
    const totalGastosVehiculo = sumByKey(gastosVehiculo, (g) => Number(g.Monto));
    const totalMantenimientos = sumByKey(mantenimientos, (m) => Number(m.Costo ?? 0));

    const rows = [
      { concepto: 'Compras', conteo: compras.length, monto: totalCompras },
      { concepto: 'Gastos de vehículo', conteo: gastosVehiculo.length, monto: totalGastosVehiculo },
      { concepto: 'Mantenimientos de vehículo', conteo: mantenimientos.length, monto: totalMantenimientos },
    ];

    return {
      columns: [
        { key: 'concepto', label: 'Concepto', type: 'text' },
        { key: 'conteo', label: '# Registros', type: 'number' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: round2(totalCompras + totalGastosVehiculo + totalMantenimientos) },
      indicators: [{ label: 'Monto total acumulado', value: `Q ${round2(totalCompras + totalGastosVehiculo + totalMantenimientos).toFixed(2)}` }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 53. Productos adquiridos por proveedor -----------------------------------------------------------
const productosProveedorSchema = withDateRangeValidation(
  z.object({
    idProveedor: optionalPositiveIntParam.refine((v) => v !== undefined, 'idProveedor es obligatorio'),
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
  }),
);
type ProductosProveedorParams = z.infer<typeof productosProveedorSchema>;

const productosProveedor: ReportDefinition<ProductosProveedorParams> = {
  id: 'productos-adquiridos-proveedor',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Productos adquiridos por proveedor',
  descripcion: '¿Qué productos le compramos a este proveedor?',
  moduloPermiso: 'proveedores',
  parametros: [
    { key: 'idProveedor', label: 'Proveedor', type: 'select', required: true, optionsEndpoint: '/api/providers' },
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: productosProveedorSchema,
  async run(params) {
    const fechaFactura = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);
    const compras = await prisma.compra.findMany({
      where: { IdProveedor: params.idProveedor as number, Anulado: false, ...(fechaFactura ? { FechaFactura: fechaFactura } : {}) },
      include: {
        DetalleCompra: {
          where: { Anulado: false },
          select: { Cantidad: true, CostoUnitario: true, InventarioItem: { select: { Nombre: true } } },
        },
      },
    });

    const byProducto = new Map<string, { cantidad: number; monto: number }>();
    for (const compra of compras) {
      for (const detalle of compra.DetalleCompra) {
        const nombre = detalle.InventarioItem?.Nombre ?? 'Producto';
        const entry = byProducto.get(nombre) ?? { cantidad: 0, monto: 0 };
        entry.cantidad += detalle.Cantidad;
        entry.monto += detalle.Cantidad * Number(detalle.CostoUnitario);
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
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 54. Proveedores sin compras en el período -----------------------------------------------------
const proveedoresSinComprasSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
).refine((data) => Boolean(data.fechaInicio && data.fechaFin), { message: 'fechaInicio y fechaFin son obligatorios' });
type ProveedoresSinComprasParams = z.infer<typeof proveedoresSinComprasSchema>;

const proveedoresSinCompras: ReportDefinition<ProveedoresSinComprasParams> = {
  id: 'proveedores-sin-compras',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Proveedores sin compras en el período',
  descripcion: '¿A qué proveedores dejamos de comprarle?',
  moduloPermiso: 'proveedores',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date', required: true },
    { key: 'fechaFin', label: 'Fecha final', type: 'date', required: true },
  ],
  schema: proveedoresSinComprasSchema,
  async run(params) {
    const fechaFactura = buildDateOnlyRangeFilter(params.fechaInicio, params.fechaFin);

    const proveedoresConCompras = await prisma.compra.findMany({
      where: { Anulado: false, ...(fechaFactura ? { FechaFactura: fechaFactura } : {}) },
      select: { IdProveedor: true },
      distinct: ['IdProveedor'],
    });
    const idsConCompras = new Set(proveedoresConCompras.map((c) => c.IdProveedor));

    const proveedores = await prisma.proveedor.findMany({
      where: { Anulado: false },
      select: { Id: true, Entidad: { select: { NombreCompleto: true, Telefono1: true } } },
      take: 5000,
    });

    const rows = proveedores
      .filter((p) => !idsConCompras.has(p.Id))
      .map((p) => ({ proveedor: p.Entidad.NombreCompleto, telefono: p.Entidad.Telefono1 ?? '—' }));

    return {
      columns: [
        { key: 'proveedor', label: 'Proveedor', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
      ],
      rows,
      indicators: [{ label: 'Proveedores sin compras', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const providersReports = [listadoProveedores, historialProveedor, productosProveedor, proveedoresSinCompras];
