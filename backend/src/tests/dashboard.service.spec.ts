import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { getDashboardData } from '../services/dashboard.service';

describe('dashboard.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns period summaries, comparisons, zero-filled trend, products, and all delivery statuses', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { salesAmount: 200, orderCount: 4, pendingOrderCount: 3, unitsSold: 6 },
      ])
      .mockResolvedValueOnce([
        { salesAmount: 100, orderCount: 4, pendingOrderCount: 4, unitsSold: 3 },
      ])
      .mockResolvedValueOnce([
        { dateKey: '2026-01-01', salesAmount: 50 },
        { dateKey: '2026-01-03', salesAmount: 150 },
      ])
      .mockResolvedValueOnce([
        { productName: 'Garrafón', quantitySold: 6, salesAmount: 200 },
      ])
      .mockResolvedValueOnce([
        { customerId: 7, customerName: 'Cliente A', orderCount: 2, salesAmount: 150 },
      ])
      .mockResolvedValueOnce([
        { status: 'PENDIENTE', orderCount: 2 },
        { status: 'ENTREGADO', orderCount: 2 },
      ]);

    const result = await getDashboardData({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-03',
    });

    expect(result.summary).toEqual({
      salesAmount: 200,
      salesAmountChangePercent: 100,
      orderCount: 4,
      orderCountChangePercent: 0,
      pendingOrderCount: 3,
      pendingOrderCountChangePercent: -25,
      unitsSold: 6,
      unitsSoldChangePercent: 100,
      averageTicket: 50,
      averageTicketChangePercent: 100,
    });
    expect(result.period.granularidad).toBe('day');
    expect(result.trend).toEqual([
      { date: '2026-01-01', salesAmount: 50 },
      { date: '2026-01-02', salesAmount: 0 },
      { date: '2026-01-03', salesAmount: 150 },
    ]);
    expect(result.topProducts).toEqual([
      { name: 'Garrafón', quantity: 6, salesAmount: 200 },
    ]);
    expect(result.topCustomers).toEqual([
      { id: 7, name: 'Cliente A', orderCount: 2, salesAmount: 150 },
    ]);
    expect(result.orderStatuses).toEqual([
      { key: 'PENDIENTE', label: 'Pendiente', count: 2 },
      { key: 'EN_RUTA', label: 'En ruta', count: 0 },
      { key: 'PARCIAL', label: 'Parcial', count: 0 },
      { key: 'ENTREGADO', label: 'Entregado', count: 2 },
    ]);
  });

  it('omits percentage changes when the comparison period has no records', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { salesAmount: 0, orderCount: 0, pendingOrderCount: 0, unitsSold: 0 },
      ])
      .mockResolvedValueOnce([
        { salesAmount: 0, orderCount: 0, pendingOrderCount: 0, unitsSold: 0 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getDashboardData({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-01',
    });

    expect(result.summary.salesAmountChangePercent).toBeNull();
    expect(result.summary.orderCountChangePercent).toBeNull();
    expect(result.summary.averageTicketChangePercent).toBeNull();
    expect(result.trend).toEqual([{ date: '2026-01-01', salesAmount: 0 }]);
  });
});
