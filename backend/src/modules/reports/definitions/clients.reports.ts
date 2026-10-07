import { z } from 'zod';

import type { ReportDefinition, ReportParamField } from '../types';
import { buildDateTimeRangeFilter, nowIso, round2, sumByKey } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam, optionalTopNParam, withDateRangeValidation } from '../params';
import { buildVentaWhere, prisma, ventaSubtotal, VENTA_REPORT_INCLUDE } from './_shared';

const CATEGORIA = 'clientes';
const CATEGORIA_LABEL = 'Clientes';

const estadoClienteOptions = [
  { value: 'activos', label: 'Activos' },
  { value: 'anulados', label: 'Anulados' },
  { value: 'todos', label: 'Todos' },
];

function tipoClienteParam(): ReportParamField {
  return { key: 'idTipoCliente', label: 'Tipo de cliente', type: 'select', optionsEndpoint: '/api/client-catalog/tipos-cliente' };
}

// 13. Listado de clientes (activos/inactivos) ------------------------------------------------
const clientesListadoSchema = z.object({
  estado: z.enum(['activos', 'anulados', 'todos']).default('activos'),
  idTipoCliente: optionalPositiveIntParam,
});

type ClientesListadoParams = z.infer<typeof clientesListadoSchema>;

const clientesListado: ReportDefinition<ClientesListadoParams> = {
  id: 'clientes-listado',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Listado de clientes',
  descripcion: 'Clientes activos, anulados o todos, con su tipo.',
  moduloPermiso: 'clientes',
  parametros: [
    { key: 'estado', label: 'Estado', type: 'select', options: estadoClienteOptions },
    tipoClienteParam(),
  ],
  schema: clientesListadoSchema,
  async run(params) {
    const clientes = await prisma.cliente.findMany({
      where: {
        ...(params.estado === 'activos' ? { Anulado: false } : {}),
        ...(params.estado === 'anulados' ? { Anulado: true } : {}),
        ...(params.idTipoCliente ? { IdTipoCliente: params.idTipoCliente } : {}),
      },
      orderBy: { Id: 'desc' },
      take: 5000,
      select: {
        Id: true,
        Anulado: true,
        FechaRegistro: true,
        Entidad: { select: { NombreCompleto: true, Nit: true, Telefono1: true } },
        TipoCliente: { select: { Nombre: true } },
      },
    });

    const rows = clientes.map((cliente) => ({
      cliente: cliente.Entidad.NombreCompleto,
      nit: cliente.Entidad.Nit ?? '—',
      telefono: cliente.Entidad.Telefono1 ?? '—',
      tipoCliente: cliente.TipoCliente?.Nombre ?? 'Sin tipo',
      estado: cliente.Anulado ? 'Anulado' : 'Activo',
      fechaRegistro: cliente.FechaRegistro,
    }));

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'nit', label: 'NIT', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'tipoCliente', label: 'Tipo de cliente', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'fechaRegistro', label: 'Fecha de registro', type: 'date' },
      ],
      rows,
      indicators: [{ label: 'Total de clientes', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: clientes.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 14. Clientes por tipo -----------------------------------------------------------------------
const clientesPorTipoSchema = z.object({});
type ClientesPorTipoParams = z.infer<typeof clientesPorTipoSchema>;

const clientesPorTipo: ReportDefinition<ClientesPorTipoParams> = {
  id: 'clientes-por-tipo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Clientes por tipo',
  descripcion: 'Distribución de clientes activos según su tipo.',
  moduloPermiso: 'clientes',
  parametros: [],
  schema: clientesPorTipoSchema,
  async run() {
    const clientes = await prisma.cliente.findMany({
      where: { Anulado: false },
      select: { TipoCliente: { select: { Nombre: true } } },
      take: 5000,
    });

    const byTipo = new Map<string, number>();
    for (const cliente of clientes) {
      const nombre = cliente.TipoCliente?.Nombre ?? 'Sin tipo';
      byTipo.set(nombre, (byTipo.get(nombre) ?? 0) + 1);
    }

    const total = clientes.length;
    const rows = Array.from(byTipo.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([tipoCliente, conteo]) => ({
        tipoCliente,
        conteo,
        porcentaje: total > 0 ? round2((conteo / total) * 100) : 0,
      }));

    return {
      columns: [
        { key: 'tipoCliente', label: 'Tipo de cliente', type: 'text' },
        { key: 'conteo', label: '# Clientes', type: 'number' },
        { key: 'porcentaje', label: '% del total', type: 'percent' },
      ],
      rows,
      totals: { conteo: total },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 15. Ficha 360° de cliente (multimódulo) ------------------------------------------------------
const cliente360Schema = withDateRangeValidation(
  z.object({
    idCliente: optionalPositiveIntParam.refine((v) => v !== undefined, 'idCliente es obligatorio'),
    fechaInicio: optionalDateParam,
    fechaFin: optionalDateParam,
  }),
);

type Cliente360Params = z.infer<typeof cliente360Schema>;

const cliente360: ReportDefinition<Cliente360Params> = {
  id: 'cliente-360',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ficha 360° de cliente',
  descripcion: 'Historial comercial completo: ventas, pagos, créditos y envases en préstamo.',
  moduloPermiso: 'clientes',
  parametros: [
    { key: 'idCliente', label: 'Cliente', type: 'select', required: true, optionsEndpoint: '/api/clients' },
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: cliente360Schema,
  async run(params) {
    const idCliente = params.idCliente as number;
    const ventas = await prisma.venta.findMany({
      where: buildVentaWhere({ idCliente, fechaInicio: params.fechaInicio, fechaFin: params.fechaFin }),
      include: VENTA_REPORT_INCLUDE,
      orderBy: { FechaRegistro: 'desc' },
      take: 5000,
    });

    const creditos = await prisma.cuentaPorCobrar.findMany({
      where: { Venta: { IdCliente: idCliente }, Anulado: false },
      select: { TotalOriginal: true, Estado: true, FechaCreacion: true, FechaVencimiento: true, Venta: { select: { PagoVenta: { where: { Anulado: false }, select: { Monto: true } } } } },
    });

    const envases = await prisma.envaseClienteSaldo.findMany({
      where: { IdCliente: idCliente, CantidadPrestada: { gt: 0 } },
      select: { CantidadPrestada: true, InventarioItem: { select: { Nombre: true } } },
    });

    const rows = ventas.map((venta) => ({
      fecha: venta.FechaRegistro,
      numeroVenta: venta.NumeroVenta,
      condicionPago: venta.CondicionPago,
      estadoEntrega: venta.EstadoEntrega,
      total: round2(ventaSubtotal(venta)),
    }));

    const totalComprado = sumByKey(rows, (r) => Number(r.total));
    const totalCreditoOtorgado = sumByKey(creditos, (c) => Number(c.TotalOriginal));
    const totalAbonado = sumByKey(
      creditos,
      (c) => c.Venta.PagoVenta.reduce((sum, p) => sum + Number(p.Monto), 0),
    );
    const saldoCredito = round2(Math.max(0, totalCreditoOtorgado - totalAbonado));
    const totalEnvasesPrestados = envases.reduce((sum, e) => sum + e.CantidadPrestada, 0);

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'numeroVenta', label: 'Venta #', type: 'number' },
        { key: 'condicionPago', label: 'Condición pago', type: 'badge' },
        { key: 'estadoEntrega', label: 'Estado entrega', type: 'badge' },
        { key: 'total', label: 'Total', type: 'currency' },
      ],
      rows,
      totals: { total: round2(totalComprado) },
      indicators: [
        { label: 'Total comprado', value: `Q ${totalComprado.toFixed(2)}` },
        { label: 'Saldo de crédito', value: `Q ${saldoCredito.toFixed(2)}` },
        { label: 'Envases en préstamo', value: round2(totalEnvasesPrestados) },
      ],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 16. Clientes sin compras en el período --------------------------------------------------------
const clientesSinComprasSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam }),
).refine((data) => Boolean(data.fechaInicio && data.fechaFin), { message: 'fechaInicio y fechaFin son obligatorios' });

type ClientesSinComprasParams = z.infer<typeof clientesSinComprasSchema>;

const clientesSinCompras: ReportDefinition<ClientesSinComprasParams> = {
  id: 'clientes-sin-compras',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Clientes sin compras en el período',
  descripcion: 'Clientes activos que no registraron ventas en el rango indicado.',
  moduloPermiso: 'clientes',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date', required: true },
    { key: 'fechaFin', label: 'Fecha final', type: 'date', required: true },
  ],
  schema: clientesSinComprasSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);

    const clientesConCompras = await prisma.venta.findMany({
      where: { Anulado: false, FechaRegistro: fechaFilter },
      select: { IdCliente: true },
      distinct: ['IdCliente'],
    });
    const idsConCompras = new Set(clientesConCompras.map((v) => v.IdCliente));

    const clientes = await prisma.cliente.findMany({
      where: { Anulado: false },
      select: {
        Id: true,
        Entidad: { select: { NombreCompleto: true, Telefono1: true } },
        TipoCliente: { select: { Nombre: true } },
      },
      take: 5000,
    });

    const rows = clientes
      .filter((c) => !idsConCompras.has(c.Id))
      .map((c) => ({
        cliente: c.Entidad.NombreCompleto,
        telefono: c.Entidad.Telefono1 ?? '—',
        tipoCliente: c.TipoCliente?.Nombre ?? 'Sin tipo',
      }));

    return {
      columns: [
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'tipoCliente', label: 'Tipo de cliente', type: 'text' },
      ],
      rows,
      indicators: [{ label: 'Clientes inactivos en el período', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 17. Top clientes por volumen --------------------------------------------------------------------
const topClientesSchema = withDateRangeValidation(
  z.object({ fechaInicio: optionalDateParam, fechaFin: optionalDateParam, top: optionalTopNParam }),
);

type TopClientesParams = z.infer<typeof topClientesSchema>;

const topClientesVolumen: ReportDefinition<TopClientesParams> = {
  id: 'top-clientes-volumen',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Top clientes por volumen',
  descripcion: '¿Quién compra más? Ranking con porcentaje acumulado.',
  moduloPermiso: 'clientes',
  parametros: [
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
    { key: 'top', label: 'Mostrar top N', type: 'number' },
  ],
  schema: topClientesSchema,
  async run(params) {
    const ventas = await prisma.venta.findMany({
      where: buildVentaWhere(params),
      include: VENTA_REPORT_INCLUDE,
      take: 5000,
    });

    const byCliente = new Map<string, number>();
    for (const venta of ventas) {
      const nombre = venta.Cliente?.Entidad?.NombreCompleto ?? 'Cliente sin nombre';
      byCliente.set(nombre, (byCliente.get(nombre) ?? 0) + ventaSubtotal(venta));
    }

    const totalGeneral = Array.from(byCliente.values()).reduce((sum, v) => sum + v, 0);
    const ordenado = Array.from(byCliente.entries()).sort(([, a], [, b]) => b - a);
    const top = params.top ? ordenado.slice(0, params.top) : ordenado;

    let acumulado = 0;
    const rows = top.map(([cliente, total], index) => {
      acumulado += total;
      return {
        ranking: index + 1,
        cliente,
        total: round2(total),
        porcentajeAcumulado: totalGeneral > 0 ? round2((acumulado / totalGeneral) * 100) : 0,
      };
    });

    return {
      columns: [
        { key: 'ranking', label: '#', type: 'number' },
        { key: 'cliente', label: 'Cliente', type: 'text' },
        { key: 'total', label: 'Total comprado', type: 'currency' },
        { key: 'porcentajeAcumulado', label: '% acumulado', type: 'percent' },
      ],
      rows,
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const clientsReports = [clientesListado, clientesPorTipo, cliente360, clientesSinCompras, topClientesVolumen];
