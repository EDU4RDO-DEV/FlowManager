import { Prisma } from '@prisma/client';

import { prisma } from '../../../config/prisma';
import { buildDateTimeRangeFilter } from '../helpers';

export { prisma };

export type VentaFilterParams = {
  fechaInicio?: string;
  fechaFin?: string;
  idCliente?: number;
  idVendedor?: number;
  idRuta?: number;
  idProducto?: number;
  condicionPago?: 'CONTADO' | 'CREDITO';
  estadoPago?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  estadoEntrega?: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'PARCIAL';
  tipoRegistro?: 'VENTA' | 'PROFORMA';
  incluirAnuladas?: boolean;
};

// Where-clause reutilizable para los 12 reportes de Ventas. Replica/extiende los filtros
// ya soportados por sale.service.ts#listSales, agregando vendedor/ruta/producto (vía
// RutaSesion y DetalleVenta) que el listado operativo no necesitaba pero un reporte sí.
export function buildVentaWhere(params: VentaFilterParams): Prisma.VentaWhereInput {
  const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);

  return {
    ...(params.incluirAnuladas ? {} : { Anulado: false }),
    ...(params.idCliente ? { IdCliente: params.idCliente } : {}),
    ...(params.condicionPago ? { CondicionPago: params.condicionPago } : {}),
    ...(params.estadoPago ? { EstadoPago: params.estadoPago } : {}),
    ...(params.estadoEntrega ? { EstadoEntrega: params.estadoEntrega } : {}),
    TipoRegistro: params.tipoRegistro ?? 'VENTA',
    ...(params.idRuta || params.idVendedor
      ? {
          RutaSesion: {
            ...(params.idRuta ? { IdRuta: params.idRuta } : {}),
            ...(params.idVendedor ? { IdUsuarioVendedor: params.idVendedor } : {}),
          },
        }
      : {}),
    ...(params.idProducto
      ? { DetalleVenta: { some: { IdInventarioItem: params.idProducto, Anulado: false } } }
      : {}),
    ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}),
  };
}

export const VENTA_REPORT_INCLUDE = {
  Cliente: {
    select: {
      Id: true,
      Entidad: { select: { NombreCompleto: true, Nit: true } },
    },
  },
  RutaSesion: {
    select: {
      Id: true,
      KmInicial: true,
      KmFinal: true,
      Ruta: { select: { Id: true, Nombre: true } },
      Vehiculo: { select: { Id: true, Placa: true } },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: { select: { Id: true, Nombre: true } },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: { select: { Id: true, Nombre: true } },
    },
  },
  DetalleVenta: {
    where: { Anulado: false },
    select: {
      Id: true,
      IdInventarioItem: true,
      Nombre: true,
      Cantidad: true,
      PrecioUnitario: true,
      EsBonificacion: true,
      InventarioItem: { select: { Id: true, Nombre: true, Categoria: true } },
    },
  },
  PagoVenta: {
    where: { Anulado: false },
    select: { Id: true, Monto: true, MetodoPago: true, FechaPago: true },
  },
} as const;

export type VentaReportRow = Prisma.VentaGetPayload<{ include: typeof VENTA_REPORT_INCLUDE }>;

export function getVendedorNombre(venta: VentaReportRow): string {
  return venta.RutaSesion?.Usuario_RutaSesion_IdUsuarioVendedorToUsuario?.Nombre ?? 'Sin asignar';
}

export function getVendedorId(venta: VentaReportRow): number | null {
  return venta.RutaSesion?.Usuario_RutaSesion_IdUsuarioVendedorToUsuario?.Id ?? null;
}

export function getRutaNombre(venta: VentaReportRow): string {
  return venta.RutaSesion?.Ruta?.Nombre ?? 'Sin ruta';
}

export function getClienteNombre(venta: VentaReportRow): string {
  return venta.Cliente?.Entidad?.NombreCompleto ?? 'Cliente sin nombre';
}

export function ventaSubtotal(venta: VentaReportRow, soloNoBonificado = true): number {
  return venta.DetalleVenta.filter((d) => (soloNoBonificado ? !d.EsBonificacion : true)).reduce(
    (sum, d) => sum + d.Cantidad * Number(d.PrecioUnitario),
    0,
  );
}

export function ventaTotalBonificado(venta: VentaReportRow): number {
  return venta.DetalleVenta.filter((d) => d.EsBonificacion).reduce(
    (sum, d) => sum + d.Cantidad * Number(d.PrecioUnitario),
    0,
  );
}
