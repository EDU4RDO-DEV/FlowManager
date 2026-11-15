import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    venta: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { getReportDefinition } from '../modules/reports/registry';

describe('sales reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by the requested product and excludes bonifications from sales totals', async () => {
    prismaMock.venta.findMany.mockResolvedValue([
      {
        IdCliente: 5,
        NumeroVenta: 21,
        FechaRegistro: new Date('2026-01-03T12:00:00.000Z'),
        CondicionPago: 'CONTADO',
        EstadoEntrega: 'ENTREGADO',
        Cliente: { Entidad: { NombreCompleto: 'Cliente A' } },
        RutaSesion: null,
        DetalleVenta: [
          {
            IdInventarioItem: 7,
            Nombre: 'Producto seleccionado',
            Cantidad: 3,
            PrecioUnitario: 5,
            EsBonificacion: false,
            InventarioItem: { Nombre: 'Producto seleccionado' },
          },
          {
            IdInventarioItem: 7,
            Nombre: 'Producto seleccionado',
            Cantidad: 1,
            PrecioUnitario: 5,
            EsBonificacion: true,
            InventarioItem: { Nombre: 'Producto seleccionado' },
          },
          {
            IdInventarioItem: 8,
            Nombre: 'Otro producto',
            Cantidad: 2,
            PrecioUnitario: 9,
            EsBonificacion: false,
            InventarioItem: { Nombre: 'Otro producto' },
          },
        ],
      },
    ]);

    const report = getReportDefinition('ventas-por-periodo');
    if (!report) throw new Error('Sales period report is not registered');

    const result = await report.run({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      idProducto: 7,
      vista: 'detalle',
      agrupacion: 'dia',
    });

    expect(prismaMock.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          TipoRegistro: 'VENTA',
          DetalleVenta: { some: { IdInventarioItem: 7, Anulado: false } },
        }),
      }),
    );
    expect(result.groups?.[0].rows.map((row) => row.subtotal)).toEqual([15, 0]);
    expect(result.totals).toEqual({ subtotal: 15 });
  });

  it('parses false correctly and rejects impossible report dates', () => {
    const inventoryReport = getReportDefinition('existencias-valorizadas');
    const salesReport = getReportDefinition('ventas-por-periodo');
    const comparisonReport = getReportDefinition('comparativo-ventas-periodos');
    if (!inventoryReport || !salesReport || !comparisonReport) {
      throw new Error('Expected reports are not registered');
    }

    expect(inventoryReport.schema.parse({ incluirAnulados: 'false' })).toEqual({
      incluirAnulados: false,
    });
    expect(() => salesReport.schema.parse({ fechaInicio: '2026-02-31' })).toThrow();
    expect(salesReport.schema.parse({ estadoPago: 'PAGADO' })).toMatchObject({
      estadoPago: 'PAGADO',
    });
    expect(() =>
      comparisonReport.schema.parse({
        periodoAInicio: '2026-02-02',
        periodoAFin: '2026-02-01',
        periodoBInicio: '2026-03-01',
        periodoBFin: '2026-03-31',
      }),
    ).toThrow();
  });

  it('applies operational visibility to vendor sales reports', async () => {
    prismaMock.venta.findMany.mockResolvedValue([]);

    const report = getReportDefinition('ventas-por-periodo');
    if (!report) throw new Error('Sales period report is not registered');

    await report.run(
      { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' },
      { actor: { userId: 42, roleName: 'Vendedor' } },
    );

    expect(prismaMock.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { IdUsuario: 42 },
                expect.any(Object),
                expect.any(Object),
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
