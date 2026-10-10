import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import type { DashboardQuery } from '../validators/dashboard.validators';

type SummaryRow = {
  salesAmount: number | bigint | Prisma.Decimal | null;
  orderCount: number | bigint;
  pendingOrderCount: number | bigint;
  unitsSold: number | bigint | null;
};

type TrendRow = {
  dateKey: string;
  salesAmount: number | bigint | Prisma.Decimal | null;
};

type TopProductRow = {
  productName: string;
  quantitySold: number | bigint | null;
  salesAmount: number | bigint | Prisma.Decimal | null;
};

type TopCustomerRow = {
  customerId: number;
  customerName: string;
  orderCount: number | bigint;
  salesAmount: number | bigint | Prisma.Decimal | null;
};

type OrderStatusRow = {
  status: string;
  orderCount: number | bigint;
};

type DashboardSummary = {
  salesAmount: number;
  orderCount: number;
  pendingOrderCount: number;
  unitsSold: number;
};

const ORDER_STATUSES = [
  { key: 'PENDIENTE', label: 'Pendiente' },
  { key: 'EN_RUTA', label: 'En ruta' },
  { key: 'PARCIAL', label: 'Parcial' },
  { key: 'ENTREGADO', label: 'Entregado' },
] as const;

function asNumber(value: number | bigint | Prisma.Decimal | null | undefined): number {
  return Number(value ?? 0);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateKeyFromUtcParts(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveGranularity(start: Date, end: Date): 'day' | 'week' | 'month' {
  const days = (Date.parse(dayKey(end)) - Date.parse(dayKey(start))) / 86_400_000 + 1;
  if (days <= 45) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

function bucketStartKeys(
  start: Date,
  end: Date,
  granularity: 'day' | 'week' | 'month',
): string[] {
  const startUtc = new Date(`${dayKey(start)}T00:00:00.000Z`);
  const endUtc = new Date(`${dayKey(end)}T00:00:00.000Z`);

  if (granularity === 'week') {
    const daysSinceMonday = (startUtc.getUTCDay() + 6) % 7;
    startUtc.setUTCDate(startUtc.getUTCDate() - daysSinceMonday);
  } else if (granularity === 'month') {
    startUtc.setUTCDate(1);
  }

  const keys: string[] = [];
  while (startUtc <= endUtc) {
    keys.push(dateKeyFromUtcParts(startUtc));
    if (granularity === 'day') {
      startUtc.setUTCDate(startUtc.getUTCDate() + 1);
    } else if (granularity === 'week') {
      startUtc.setUTCDate(startUtc.getUTCDate() + 7);
    } else {
      startUtc.setUTCMonth(startUtc.getUTCMonth() + 1);
    }
  }

  return keys;
}

async function getSummary(start: Date, endExclusive: Date): Promise<DashboardSummary> {
  const [row] = await prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(CASE WHEN dv.EsBonificacion = 0
        THEN CAST(dv.Cantidad AS decimal(18, 4)) * dv.PrecioUnitario
        ELSE CAST(0 AS decimal(18, 4)) END), 0) AS salesAmount,
      COUNT(DISTINCT v.Id) AS orderCount,
      COUNT(DISTINCT CASE WHEN v.EstadoEntrega IN ('PENDIENTE', 'EN_RUTA', 'PARCIAL') THEN v.Id END) AS pendingOrderCount,
      COALESCE(SUM(CASE WHEN dv.EsBonificacion = 0
        THEN CAST(dv.Cantidad AS decimal(18, 4))
        ELSE CAST(0 AS decimal(18, 4)) END), 0) AS unitsSold
    FROM Venta v
    LEFT JOIN DetalleVenta dv
      ON dv.IdVenta = v.Id AND dv.Anulado = 0
    WHERE v.Anulado = 0
      AND v.TipoRegistro = 'VENTA'
      AND v.FechaRegistro >= ${start}
      AND v.FechaRegistro < ${endExclusive}
  `);

  return {
    salesAmount: asNumber(row?.salesAmount),
    orderCount: asNumber(row?.orderCount),
    pendingOrderCount: asNumber(row?.pendingOrderCount),
    unitsSold: asNumber(row?.unitsSold),
  };
}

async function getSalesTrend(
  start: Date,
  endExclusive: Date,
  granularity: 'day' | 'week' | 'month',
): Promise<TrendRow[]> {
  const bucketExpression =
    granularity === 'day'
      ? Prisma.sql`CONVERT(date, v.FechaRegistro)`
      : granularity === 'week'
        ? Prisma.sql`DATEADD(day, (DATEDIFF(day, CONVERT(date, '19000101'), CONVERT(date, v.FechaRegistro)) / 7) * 7, CONVERT(date, '19000101'))`
        : Prisma.sql`DATEFROMPARTS(YEAR(v.FechaRegistro), MONTH(v.FechaRegistro), 1)`;

  return prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      CONVERT(varchar(10), ${bucketExpression}, 23) AS dateKey,
      COALESCE(SUM(CASE WHEN dv.EsBonificacion = 0
        THEN CAST(dv.Cantidad AS decimal(18, 4)) * dv.PrecioUnitario
        ELSE CAST(0 AS decimal(18, 4)) END), 0) AS salesAmount
    FROM Venta v
    LEFT JOIN DetalleVenta dv
      ON dv.IdVenta = v.Id AND dv.Anulado = 0
    WHERE v.Anulado = 0
      AND v.TipoRegistro = 'VENTA'
      AND v.FechaRegistro >= ${start}
      AND v.FechaRegistro < ${endExclusive}
    GROUP BY ${bucketExpression}
    ORDER BY ${bucketExpression}
  `);
}

async function getTopProducts(start: Date, endExclusive: Date): Promise<TopProductRow[]> {
  return prisma.$queryRaw<TopProductRow[]>(Prisma.sql`
    SELECT TOP (10)
      dv.Nombre AS productName,
      SUM(CAST(dv.Cantidad AS decimal(18, 4))) AS quantitySold,
      SUM(CAST(dv.Cantidad AS decimal(18, 4)) * dv.PrecioUnitario) AS salesAmount
    FROM DetalleVenta dv
    INNER JOIN Venta v ON v.Id = dv.IdVenta
    WHERE v.Anulado = 0
      AND v.TipoRegistro = 'VENTA'
      AND dv.Anulado = 0
      AND dv.EsBonificacion = 0
      AND v.FechaRegistro >= ${start}
      AND v.FechaRegistro < ${endExclusive}
    GROUP BY dv.Nombre
    ORDER BY SUM(CAST(dv.Cantidad AS decimal(18, 4))) DESC, dv.Nombre ASC
  `);
}

async function getTopCustomers(start: Date, endExclusive: Date): Promise<TopCustomerRow[]> {
  return prisma.$queryRaw<TopCustomerRow[]>(Prisma.sql`
    SELECT TOP (10)
      c.Id AS customerId,
      e.NombreCompleto AS customerName,
      COUNT(DISTINCT v.Id) AS orderCount,
      COALESCE(SUM(CASE WHEN dv.EsBonificacion = 0
        THEN CAST(dv.Cantidad AS decimal(18, 4)) * dv.PrecioUnitario
        ELSE CAST(0 AS decimal(18, 4)) END), 0) AS salesAmount
    FROM Venta v
    INNER JOIN Cliente c ON c.Id = v.IdCliente
    INNER JOIN Entidad e ON e.Id = c.IdEntidad
    LEFT JOIN DetalleVenta dv
      ON dv.IdVenta = v.Id AND dv.Anulado = 0
    WHERE v.Anulado = 0
      AND v.TipoRegistro = 'VENTA'
      AND v.FechaRegistro >= ${start}
      AND v.FechaRegistro < ${endExclusive}
    GROUP BY c.Id, e.NombreCompleto
    ORDER BY COALESCE(SUM(CASE WHEN dv.EsBonificacion = 0
      THEN CAST(dv.Cantidad AS decimal(18, 4)) * dv.PrecioUnitario
      ELSE CAST(0 AS decimal(18, 4)) END), 0) DESC, e.NombreCompleto ASC
  `);
}

async function getOrderStatuses(start: Date, endExclusive: Date): Promise<OrderStatusRow[]> {
  return prisma.$queryRaw<OrderStatusRow[]>(Prisma.sql`
    SELECT v.EstadoEntrega AS status, COUNT_BIG(*) AS orderCount
    FROM Venta v
    WHERE v.Anulado = 0
      AND v.TipoRegistro = 'VENTA'
      AND v.FechaRegistro >= ${start}
      AND v.FechaRegistro < ${endExclusive}
    GROUP BY v.EstadoEntrega
  `);
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboardData(query: DashboardQuery) {
  const start = parseDate(query.fechaInicio);
  const end = parseDate(query.fechaFin);
  const endExclusive = addDays(end, 1);
  const periodDays = Math.round((Date.parse(query.fechaFin) - Date.parse(query.fechaInicio)) / 86_400_000) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(start, -periodDays);
  const previousEndExclusive = addDays(previousEnd, 1);
  const granularity = resolveGranularity(start, end);

  const [current, previous, trendRows, topProducts, topCustomers, statusRows] = await Promise.all([
    getSummary(start, endExclusive),
    getSummary(previousStart, previousEndExclusive),
    getSalesTrend(start, endExclusive, granularity),
    getTopProducts(start, endExclusive),
    getTopCustomers(start, endExclusive),
    getOrderStatuses(start, endExclusive),
  ]);

  const trendByDate = new Map(trendRows.map((row) => [row.dateKey, asNumber(row.salesAmount)]));
  const trend = bucketStartKeys(start, end, granularity).map((date) => ({
    date,
    salesAmount: trendByDate.get(date) ?? 0,
  }));
  const orderCountsByStatus = new Map(statusRows.map((row) => [row.status, asNumber(row.orderCount)]));
  const averageTicket = current.orderCount > 0 ? current.salesAmount / current.orderCount : 0;
  const previousAverageTicket =
    previous.orderCount > 0 ? previous.salesAmount / previous.orderCount : 0;

  return {
    period: {
      fechaInicio: query.fechaInicio,
      fechaFin: query.fechaFin,
      granularidad: granularity,
    },
    summary: {
      salesAmount: current.salesAmount,
      salesAmountChangePercent: percentageChange(current.salesAmount, previous.salesAmount),
      orderCount: current.orderCount,
      orderCountChangePercent: percentageChange(current.orderCount, previous.orderCount),
      pendingOrderCount: current.pendingOrderCount,
      pendingOrderCountChangePercent: percentageChange(
        current.pendingOrderCount,
        previous.pendingOrderCount,
      ),
      unitsSold: current.unitsSold,
      unitsSoldChangePercent: percentageChange(current.unitsSold, previous.unitsSold),
      averageTicket,
      averageTicketChangePercent: percentageChange(averageTicket, previousAverageTicket),
    },
    trend,
    topProducts: topProducts.map((product) => ({
      name: product.productName,
      quantity: asNumber(product.quantitySold),
      salesAmount: asNumber(product.salesAmount),
    })),
    topCustomers: topCustomers.map((customer) => ({
      id: customer.customerId,
      name: customer.customerName,
      orderCount: asNumber(customer.orderCount),
      salesAmount: asNumber(customer.salesAmount),
    })),
    orderStatuses: ORDER_STATUSES.map((status) => ({
      key: status.key,
      label: status.label,
      count: orderCountsByStatus.get(status.key) ?? 0,
    })),
  };
}
