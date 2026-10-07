import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import {
  limitRows,
  nowIso,
  periodKey,
  round2,
  sumByKey,
  type PeriodGranularity,
} from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, optionalTopNParam, withDateRangeValidation } from '../params';
import {
  VENTA_REPORT_INCLUDE,
  buildVentaWhere,
  getClienteNombre,
  getRutaNombre,
  getTipoClienteNombre,
  getVendedorId,
  getVendedorNombre,
  prisma,
  ventaSubtotal,
  ventaTotalBonificado,
  type VentaReportRow,
} from './_shared';

const CATEGORIA = 'ventas';
const CATEGORIA_LABEL = 'Ventas';

const condicionPagoOptions = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
];

const estadoEntregaOptions = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_RUTA', label: 'En ruta' },
  { value: 'ENTREGADO', label: 'Entregado' },
  { value: 'PARCIAL', label: 'Parcial' },
];

const estadoPagoOptions = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'PAGADO', label: 'Pagado' },
];

const FECHA_PARAMS: ReportParamField[] = [
  { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
  { key: 'fechaFin', label: 'Fecha final', type: 'date' },
];

function clienteParam(): ReportParamField {
  return { key: 'idCliente', label: 'Cliente', type: 'select', optionsEndpoint: '/api/clients' };
}

function tipoClienteParam(): ReportParamField {
  return { key: 'idTipoCliente', label: 'Tipo de cliente', type: 'select', optionsEndpoint: '/api/client-catalog/tipos-cliente' };
}

function vendedorParam(): ReportParamField {
  return { key: 'idVendedor', label: 'Vendedor', type: 'select', optionsEndpoint: '/api/users' };
}

function rutaParam(): ReportParamField {
  return { key: 'idRuta', label: 'Ruta', type: 'select', optionsEndpoint: '/api/logistics/rutas' };
}

function productoParam(): ReportParamField {
  return { key: 'idProducto', label: 'Producto', type: 'select', optionsEndpoint: '/api/products' };
}

async function fetchVentas(where: ReturnType<typeof buildVentaWhere>): Promise<VentaReportRow[]> {
  return prisma.venta.findMany({
    where,
    orderBy: { FechaRegistro: 'desc' },
    include: VENTA_REPORT_INCLUDE,
    take: 5000,
  });
}

// 1. Ventas por período (detalle/resumen) -----------------------------------------------
const ventasPorPeriodoSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idCliente: optionalPositiveIntParam,
    idTipoCliente: optionalPositiveIntParam,
    idVendedor: optionalPositiveIntParam,
    idRuta: optionalPositiveIntParam,
    idProducto: optionalPositiveIntParam,
    condicionPago: z.enum(['CONTADO', 'CREDITO']).optional(),
    estadoEntrega: z.enum(['PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'PARCIAL']).optional(),
    vista: z.enum(['resumen', 'detalle']).default('resumen'),
    agrupacion: z.enum(['dia', 'semana', 'mes']).default('dia'),
  }),
);

type VentasPorPeriodoParams = z.infer<typeof ventasPorPeriodoSchema>;

const ventasPorPeriodo: ReportDefinition<VentasPorPeriodoParams> = {
  id: 'ventas-por-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas por período',
  descripcion: '¿Cuánto vendimos? Detalle o resumen de ventas agrupado por día, semana o mes.',
  moduloPermiso: 'ventas',
  parametros: [
    ...FECHA_PARAMS,
    clienteParam(),
    tipoClienteParam(),
    vendedorParam(),
    rutaParam(),
    productoParam(),
    { key: 'condicionPago', label: 'Condición de pago', type: 'select', options: condicionPagoOptions },
    { key: 'estadoEntrega', label: 'Estado de entrega', type: 'select', options: estadoEntregaOptions },
    {
      key: 'vista',
      label: 'Vista',
      type: 'select',
      options: [
        { value: 'resumen', label: 'Resumen (una fila por venta)' },
        { value: 'detalle', label: 'Detalle (una fila por producto)' },
      ],
    },
    {
      key: 'agrupacion',
      label: 'Agrupar por',
      type: 'select',
      options: [
        { value: 'dia', label: 'Día' },
        { value: 'semana', label: 'Semana' },
        { value: 'mes', label: 'Mes' },
      ],
    },
  ],
  schema: ventasPorPeriodoSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));
    const granularity: PeriodGranularity = params.agrupacion;

    type Row = Record<string, unknown> & { __fecha: Date };
    const rows: Row[] = [];

    if (params.vista === 'detalle') {
      for (const venta of ventas) {
        const fecha = venta.FechaRegistro ?? new Date();
        for (const detalle of venta.DetalleVenta) {
          rows.push({
            __fecha: fecha,
            fecha,
            numeroVenta: venta.NumeroVenta,
            cliente: getClienteNombre(venta),
            producto: detalle.InventarioItem?.Nombre ?? detalle.Nombre,
            cantidad: detalle.Cantidad,
            precioUnitario: Number(detalle.PrecioUnitario),
            bonificacion: detalle.EsBonificacion ? 'Sí' : 'No',
            subtotal: round2(detalle.Cantidad * Number(detalle.PrecioUnitario)),
          });
        }
      }
    } else {
      for (const venta of ventas) {
        const fecha = venta.FechaRegistro ?? new Date();
        rows.push({
          __fecha: fecha,
          fecha,
          numeroVenta: venta.NumeroVenta,
          cliente: getClienteNombre(venta),
          vendedor: getVendedorNombre(venta),
          ruta: getRutaNombre(venta),
          condicionPago: venta.CondicionPago,
          estadoEntrega: venta.EstadoEntrega,
          subtotal: round2(ventaSubtotal(venta)),
        });
      }
    }

    const groupsMap = new Map<string, { label: string; rows: Row[] }>();
    for (const row of rows) {
      const { key, label } = periodKey(row.__fecha, granularity);
      const group = groupsMap.get(key) ?? { label, rows: [] };
      group.rows.push(row);
      groupsMap.set(key, group);
    }

    const groups = Array.from(groupsMap.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([, group]) => ({
        key: group.label,
        label: group.label,
        rows: group.rows.map(({ __fecha: _omit, ...rest }) => rest),
        subtotals: { subtotal: sumByKey(group.rows, (r) => Number(r.subtotal)) },
      }));

    const totalVendido = sumByKey(rows, (r) => Number(r.subtotal));
    const transacciones = params.vista === 'resumen' ? rows.length : ventas.length;
    const { truncado } = limitRows(ventas);

    const columns =
      params.vista === 'detalle'
        ? [
            { key: 'fecha', label: 'Fecha', type: 'date' as const },
            { key: 'numeroVenta', label: 'Venta #', type: 'number' as const },
            { key: 'cliente', label: 'Cliente', type: 'text' as const },
            { key: 'producto', label: 'Producto', type: 'text' as const },
            { key: 'cantidad', label: 'Cantidad', type: 'number' as const },
            { key: 'precioUnitario', label: 'Precio unit.', type: 'currency' as const },
            { key: 'bonificacion', label: 'Bonificación', type: 'badge' as const },
            { key: 'subtotal', label: 'Subtotal', type: 'currency' as const },
          ]
        : [
            { key: 'fecha', label: 'Fecha', type: 'date' as const },
            { key: 'numeroVenta', label: 'Venta #', type: 'number' as const },
            { key: 'cliente', label: 'Cliente', type: 'text' as const },
            { key: 'vendedor', label: 'Vendedor', type: 'text' as const },
            { key: 'ruta', label: 'Ruta', type: 'text' as const },
            { key: 'condicionPago', label: 'Condición pago', type: 'badge' as const },
            { key: 'estadoEntrega', label: 'Estado entrega', type: 'badge' as const },
            { key: 'subtotal', label: 'Subtotal', type: 'currency' as const },
          ];

    return {
      columns,
      rows: [],
      groups,
      totals: { subtotal: totalVendido },
      indicators: [
        { label: 'Total vendido', value: `Q ${totalVendido.toFixed(2)}` },
        { label: 'Transacciones', value: transacciones },
        { label: 'Ticket promedio', value: `Q ${(transacciones > 0 ? round2(totalVendido / transacciones) : 0).toFixed(2)}` },
      ],
      meta: { totalRegistros: rows.length, truncado, generadoEn: nowIso() },
    };
  },
};

// 2. Ventas por cliente -------------------------------------------------------------------
const ventasPorClienteSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idTipoCliente: optionalPositiveIntParam,
    top: optionalTopNParam,
  }),
);

type VentasPorClienteParams = z.infer<typeof ventasPorClienteSchema>;

const ventasPorCliente: ReportDefinition<VentasPorClienteParams> = {
  id: 'ventas-por-cliente',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas por cliente',
  descripcion: '¿Qué clientes compran más?',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, tipoClienteParam(), { key: 'top', label: 'Mostrar top N', type: 'number' }],
  schema: ventasPorClienteSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byCliente = new Map<string, { nombre: string; total: number; transacciones: number }>();
    for (const venta of ventas) {
      const nombre = getClienteNombre(venta);
      const key = String(venta.IdCliente);
      const entry = byCliente.get(key) ?? { nombre, total: 0, transacciones: 0 };
      entry.total += ventaSubtotal(venta);
      entry.transacciones += 1;
      byCliente.set(key, entry);
    }

    const totalGeneral = Array.from(byCliente.values()).reduce((sum, c) => sum + c.total, 0);

    let rows = Array.from(byCliente.values())
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({
        cliente: entry.nombre,
        transacciones: entry.transacciones,
        total: round2(entry.total),
        porcentaje: totalGeneral > 0 ? round2((entry.total / totalGeneral) * 100) : 0,
      }));

    if (params.top) {
      rows = rows.slice(0, params.top);
    }

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'transacciones', label: 'Transacciones', type: 'number' },
        { key: 'total', label: 'Total comprado', type: 'currency' },
        { key: 'porcentaje', label: '% del total', type: 'percent' },
      ],
      rows,
      totals: { total: round2(totalGeneral) },
      indicators: [
        { label: 'Clientes con compras', value: byCliente.size },
        { label: 'Total vendido', value: `Q ${round2(totalGeneral).toFixed(2)}` },
      ],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 3. Productos más vendidos ----------------------------------------------------------------
const productosMasVendidosSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    top: optionalTopNParam,
  }),
);

type ProductosMasVendidosParams = z.infer<typeof productosMasVendidosSchema>;

const productosMasVendidos: ReportDefinition<ProductosMasVendidosParams> = {
  id: 'productos-mas-vendidos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Productos más vendidos',
  descripcion: '¿Qué productos se venden más?',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, { key: 'top', label: 'Mostrar top N', type: 'number' }],
  schema: productosMasVendidosSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byProducto = new Map<string, { nombre: string; cantidad: number; monto: number }>();
    for (const venta of ventas) {
      for (const detalle of venta.DetalleVenta) {
        if (detalle.EsBonificacion) continue;
        const key = String(detalle.IdInventarioItem);
        const nombre = detalle.InventarioItem?.Nombre ?? detalle.Nombre;
        const entry = byProducto.get(key) ?? { nombre, cantidad: 0, monto: 0 };
        entry.cantidad += detalle.Cantidad;
        entry.monto += detalle.Cantidad * Number(detalle.PrecioUnitario);
        byProducto.set(key, entry);
      }
    }

    let rows = Array.from(byProducto.values())
      .sort((a, b) => b.monto - a.monto)
      .map((entry, index) => ({
        ranking: index + 1,
        producto: entry.nombre,
        cantidadVendida: round2(entry.cantidad),
        montoVendido: round2(entry.monto),
      }));

    if (params.top) {
      rows = rows.slice(0, params.top);
    }

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'cantidadVendida', label: 'Cantidad vendida', type: 'number' },
        { key: 'montoVendido', label: 'Monto vendido', type: 'currency' },
      ],
      rows,
      totals: { montoVendido: sumByKey(rows, (r) => Number(r.montoVendido)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 4. Ventas por vendedor --------------------------------------------------------------------
const ventasPorVendedorSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idVendedor: optionalPositiveIntParam,
  }),
);

type VentasPorVendedorParams = z.infer<typeof ventasPorVendedorSchema>;

const ventasPorVendedor: ReportDefinition<VentasPorVendedorParams> = {
  id: 'ventas-por-vendedor',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas por vendedor',
  descripcion: '¿Quién vende más? Ventas atribuidas al vendedor de la sesión de ruta.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, vendedorParam()],
  schema: ventasPorVendedorSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byVendedor = new Map<string, { nombre: string; total: number; transacciones: number }>();
    for (const venta of ventas) {
      const id = getVendedorId(venta);
      const key = id ? String(id) : 'sin-asignar';
      const nombre = getVendedorNombre(venta);
      const entry = byVendedor.get(key) ?? { nombre, total: 0, transacciones: 0 };
      entry.total += ventaSubtotal(venta);
      entry.transacciones += 1;
      byVendedor.set(key, entry);
    }

    const rows = Array.from(byVendedor.values())
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({
        vendedor: entry.nombre,
        transacciones: entry.transacciones,
        total: round2(entry.total),
      }));

    return {
      columns: [
        { key: 'vendedor', label: 'Vendedor', type: 'text' },
        { key: 'transacciones', label: '# Ventas', type: 'number' },
        { key: 'total', label: 'Total vendido', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 5. Ventas por ruta -------------------------------------------------------------------------
const ventasPorRutaSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    idRuta: optionalPositiveIntParam,
  }),
);

type VentasPorRutaParams = z.infer<typeof ventasPorRutaSchema>;

const ventasPorRuta: ReportDefinition<VentasPorRutaParams> = {
  id: 'ventas-por-ruta',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas por ruta',
  descripcion: '¿Qué ruta vende más?',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, rutaParam()],
  schema: ventasPorRutaSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byRuta = new Map<string, { nombre: string; total: number; transacciones: number }>();
    for (const venta of ventas) {
      const nombre = getRutaNombre(venta);
      const entry = byRuta.get(nombre) ?? { nombre, total: 0, transacciones: 0 };
      entry.total += ventaSubtotal(venta);
      entry.transacciones += 1;
      byRuta.set(nombre, entry);
    }

    const rows = Array.from(byRuta.values())
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({ ruta: entry.nombre, transacciones: entry.transacciones, total: round2(entry.total) }));

    return {
      columns: [
        { key: 'ruta', label: 'Ruta', type: 'text' },
        { key: 'transacciones', label: '# Ventas', type: 'number' },
        { key: 'total', label: 'Total vendido', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 6. Ventas por tipo de cliente -----------------------------------------------------------
const ventasPorTipoClienteSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);

type VentasPorTipoClienteParams = z.infer<typeof ventasPorTipoClienteSchema>;

const ventasPorTipoCliente: ReportDefinition<VentasPorTipoClienteParams> = {
  id: 'ventas-por-tipo-cliente',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas por tipo de cliente',
  descripcion: 'Distribución de ventas según el tipo de cliente.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS],
  schema: ventasPorTipoClienteSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byTipo = new Map<string, { nombre: string; total: number; transacciones: number }>();
    for (const venta of ventas) {
      const nombre = getTipoClienteNombre(venta);
      const entry = byTipo.get(nombre) ?? { nombre, total: 0, transacciones: 0 };
      entry.total += ventaSubtotal(venta);
      entry.transacciones += 1;
      byTipo.set(nombre, entry);
    }

    const totalGeneral = Array.from(byTipo.values()).reduce((sum, t) => sum + t.total, 0);
    const rows = Array.from(byTipo.values())
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({
        tipoCliente: entry.nombre,
        transacciones: entry.transacciones,
        total: round2(entry.total),
        porcentaje: totalGeneral > 0 ? round2((entry.total / totalGeneral) * 100) : 0,
      }));

    return {
      columns: [
        { key: 'tipoCliente', label: 'Tipo de cliente', type: 'text' },
        { key: 'transacciones', label: '# Ventas', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'porcentaje', label: '% del total', type: 'percent' },
      ],
      rows,
      totals: { total: round2(totalGeneral) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 7. Ventas contado vs. crédito -------------------------------------------------------------
const ventasContadoCreditoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);

type VentasContadoCreditoParams = z.infer<typeof ventasContadoCreditoSchema>;

const ventasContadoCredito: ReportDefinition<VentasContadoCreditoParams> = {
  id: 'ventas-contado-credito',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas contado vs. crédito',
  descripcion: 'Comparativo de ventas según condición de pago.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS],
  schema: ventasContadoCreditoSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byCondicion = new Map<string, { total: number; transacciones: number }>();
    for (const venta of ventas) {
      const entry = byCondicion.get(venta.CondicionPago) ?? { total: 0, transacciones: 0 };
      entry.total += ventaSubtotal(venta);
      entry.transacciones += 1;
      byCondicion.set(venta.CondicionPago, entry);
    }

    const totalGeneral = Array.from(byCondicion.values()).reduce((sum, c) => sum + c.total, 0);
    const rows = Array.from(byCondicion.entries()).map(([condicion, entry]) => ({
      condicionPago: condicion === 'CONTADO' ? 'Contado' : 'Crédito',
      transacciones: entry.transacciones,
      total: round2(entry.total),
      porcentaje: totalGeneral > 0 ? round2((entry.total / totalGeneral) * 100) : 0,
    }));

    return {
      columns: [
        { key: 'condicionPago', label: 'Condición de pago', type: 'badge' },
        { key: 'transacciones', label: '# Ventas', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'porcentaje', label: '% del total', type: 'percent' },
      ],
      rows,
      totals: { total: round2(totalGeneral) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 8. Pedidos por estado de entrega -----------------------------------------------------------
const pedidosPorEstadoSchema = withDateRangeValidation(
  z.object({
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
    estadoEntrega: z.enum(['PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'PARCIAL']).optional(),
  }),
);

type PedidosPorEstadoParams = z.infer<typeof pedidosPorEstadoSchema>;

const pedidosPorEstado: ReportDefinition<PedidosPorEstadoParams> = {
  id: 'pedidos-por-estado-entrega',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Pedidos por estado de entrega',
  descripcion: 'Pendientes, en ruta, entregados o parciales.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, { key: 'estadoEntrega', label: 'Estado de entrega', type: 'select', options: estadoEntregaOptions }],
  schema: pedidosPorEstadoSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byEstado = new Map<string, { conteo: number; total: number }>();
    for (const venta of ventas) {
      const entry = byEstado.get(venta.EstadoEntrega) ?? { conteo: 0, total: 0 };
      entry.conteo += 1;
      entry.total += ventaSubtotal(venta);
      byEstado.set(venta.EstadoEntrega, entry);
    }

    const rows = Array.from(byEstado.entries()).map(([estado, entry]) => ({
      estadoEntrega: estado,
      conteo: entry.conteo,
      total: round2(entry.total),
    }));

    return {
      columns: [
        { key: 'estadoEntrega', label: 'Estado de entrega', type: 'badge' },
        { key: 'conteo', label: '# Pedidos', type: 'number' },
        { key: 'total', label: 'Monto total', type: 'currency' },
      ],
      rows,
      totals: { conteo: rows.reduce((s, r) => s + r.conteo, 0), total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 9. Bonificaciones otorgadas -----------------------------------------------------------------
const bonificacionesSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, idProducto: optionalPositiveIntParam }),
);

type BonificacionesParams = z.infer<typeof bonificacionesSchema>;

const bonificacionesOtorgadas: ReportDefinition<BonificacionesParams> = {
  id: 'bonificaciones-otorgadas',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Bonificaciones otorgadas',
  descripcion: '¿Cuánto bonificamos a nuestros clientes?',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS, productoParam()],
  schema: bonificacionesSchema,
  async run(params) {
    const ventas = await fetchVentas(buildVentaWhere(params));

    const byProducto = new Map<string, { nombre: string; cantidad: number; valor: number }>();
    for (const venta of ventas) {
      for (const detalle of venta.DetalleVenta) {
        if (!detalle.EsBonificacion) continue;
        const key = String(detalle.IdInventarioItem);
        const nombre = detalle.InventarioItem?.Nombre ?? detalle.Nombre;
        const entry = byProducto.get(key) ?? { nombre, cantidad: 0, valor: 0 };
        entry.cantidad += detalle.Cantidad;
        entry.valor += detalle.Cantidad * Number(detalle.PrecioUnitario);
        byProducto.set(key, entry);
      }
    }

    const rows = Array.from(byProducto.values())
      .sort((a, b) => b.valor - a.valor)
      .map((entry) => ({ producto: entry.nombre, cantidadBonificada: round2(entry.cantidad), valorBonificado: round2(entry.valor) }));

    return {
      columns: [
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'cantidadBonificada', label: 'Cantidad bonificada', type: 'number' },
        { key: 'valorBonificado', label: 'Valor bonificado', type: 'currency' },
      ],
      rows,
      totals: { valorBonificado: sumByKey(rows, (r) => Number(r.valorBonificado)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 10. Formas de pago de ventas -----------------------------------------------------------------
const formasPagoSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);

type FormasPagoParams = z.infer<typeof formasPagoSchema>;

const formasPagoVentas: ReportDefinition<FormasPagoParams> = {
  id: 'formas-pago-ventas',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Formas de pago de ventas',
  descripcion: 'Distribución de pagos recibidos por método.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS],
  schema: formasPagoSchema,
  async run(params) {
    const fechaFilter = params.fechaInicio || params.fechaFin
      ? { FechaPago: { ...(params.fechaInicio ? { gte: new Date(`${params.fechaInicio}T00:00:00`) } : {}), ...(params.fechaFin ? { lt: new Date(new Date(`${params.fechaFin}T00:00:00`).getTime() + 86400000) } : {}) } }
      : {};

    const pagos = await prisma.pagoVenta.findMany({
      where: { Anulado: false, ...fechaFilter },
      select: { Monto: true, MetodoPago: true },
      take: 5000,
    });

    const byMetodo = new Map<string, { conteo: number; total: number }>();
    for (const pago of pagos) {
      const entry = byMetodo.get(pago.MetodoPago) ?? { conteo: 0, total: 0 };
      entry.conteo += 1;
      entry.total += Number(pago.Monto);
      byMetodo.set(pago.MetodoPago, entry);
    }

    const rows = Array.from(byMetodo.entries()).map(([metodo, entry]) => ({
      metodoPago: metodo,
      conteo: entry.conteo,
      total: round2(entry.total),
    }));

    return {
      columns: [
        { key: 'metodoPago', label: 'Método de pago', type: 'badge' },
        { key: 'conteo', label: '# Pagos', type: 'number' },
        { key: 'total', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 11. Comparativo de ventas (período A vs. período B) -------------------------------------------
const comparativoVentasSchema = z
  .object({
    periodoAInicio: optionalDateParam,
    periodoAFin: optionalDateParam,
    periodoBInicio: optionalDateParam,
    periodoBFin: optionalDateParam,
  })
  .refine((data) => Boolean(data.periodoAInicio && data.periodoAFin && data.periodoBInicio && data.periodoBFin), {
    message: 'Debe indicar ambos períodos completos',
  });

type ComparativoVentasParams = z.infer<typeof comparativoVentasSchema>;

const comparativoVentas: ReportDefinition<ComparativoVentasParams> = {
  id: 'comparativo-ventas-periodos',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Comparativo de ventas entre períodos',
  descripcion: '¿Cómo evoluciona el negocio? Compara el total vendido entre dos períodos.',
  moduloPermiso: 'ventas',
  parametros: [
    { key: 'periodoAInicio', label: 'Período A - inicio', type: 'date', required: true },
    { key: 'periodoAFin', label: 'Período A - fin', type: 'date', required: true },
    { key: 'periodoBInicio', label: 'Período B - inicio', type: 'date', required: true },
    { key: 'periodoBFin', label: 'Período B - fin', type: 'date', required: true },
  ],
  schema: comparativoVentasSchema,
  async run(params) {
    const [ventasA, ventasB] = await Promise.all([
      fetchVentas(buildVentaWhere({ fechaInicio: params.periodoAInicio, fechaFin: params.periodoAFin })),
      fetchVentas(buildVentaWhere({ fechaInicio: params.periodoBInicio, fechaFin: params.periodoBFin })),
    ]);

    const totalA = sumByKey(ventasA, (v) => ventaSubtotal(v));
    const totalB = sumByKey(ventasB, (v) => ventaSubtotal(v));
    const variacion = totalA > 0 ? round2(((totalB - totalA) / totalA) * 100) : 0;

    const rows = [
      { periodo: `${params.periodoAInicio} a ${params.periodoAFin}`, transacciones: ventasA.length, total: totalA },
      { periodo: `${params.periodoBInicio} a ${params.periodoBFin}`, transacciones: ventasB.length, total: totalB },
    ];

    return {
      columns: [
        { key: 'periodo', label: 'Período', type: 'text' },
        { key: 'transacciones', label: '# Ventas', type: 'number' },
        { key: 'total', label: 'Total vendido', type: 'currency' },
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

// 12. Ventas anuladas (auditoría) ---------------------------------------------------------------
const ventasAnuladasSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
);

type VentasAnuladasParams = z.infer<typeof ventasAnuladasSchema>;

const ventasAnuladas: ReportDefinition<VentasAnuladasParams> = {
  id: 'ventas-anuladas',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ventas anuladas',
  descripcion: 'Auditoría de ventas anuladas en el período.',
  moduloPermiso: 'ventas',
  parametros: [...FECHA_PARAMS],
  schema: ventasAnuladasSchema,
  async run(params) {
    const ventas = await prisma.venta.findMany({
      where: {
        Anulado: true,
        ...(params.fechaInicio || params.fechaFin
          ? {
              FechaAnulacion: {
                ...(params.fechaInicio ? { gte: new Date(`${params.fechaInicio}T00:00:00`) } : {}),
                ...(params.fechaFin ? { lt: new Date(new Date(`${params.fechaFin}T00:00:00`).getTime() + 86400000) } : {}),
              },
            }
          : {}),
      },
      orderBy: { FechaAnulacion: 'desc' },
      include: VENTA_REPORT_INCLUDE,
      take: 5000,
    });

    const rows = ventas.map((venta) => ({
      numeroVenta: venta.NumeroVenta,
      cliente: getClienteNombre(venta),
      fechaAnulacion: venta.FechaAnulacion,
      montoAnulado: round2(ventaSubtotal(venta) + ventaTotalBonificado(venta)),
    }));

    return {
      columns: [
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'fechaAnulacion', label: 'Fecha de anulación', type: 'date' },
        { key: 'montoAnulado', label: 'Monto anulado', type: 'currency' },
      ],
      rows,
      totals: { montoAnulado: sumByKey(rows, (r) => Number(r.montoAnulado)) },
      indicators: [{ label: 'Ventas anuladas', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const salesReports = [
  ventasPorPeriodo,
  ventasPorCliente,
  productosMasVendidos,
  ventasPorVendedor,
  ventasPorRuta,
  ventasPorTipoCliente,
  ventasContadoCredito,
  pedidosPorEstado,
  bonificacionesOtorgadas,
  formasPagoVentas,
  comparativoVentas,
  ventasAnuladas,
];
