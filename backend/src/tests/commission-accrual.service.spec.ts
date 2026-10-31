import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  accrueMonthlyCommissionsForSale,
  cancelCommissionReversalRequest,
  reviewCommissionReversalRequest,
} from '../services/commission-accrual.service';

const date = new Date('2026-10-15T12:00:00.000Z');
let canceled = false;
let paidCommission = false;
let closedUnpaidCommission = false;
let ledger: Array<Record<string, unknown> & { Id: number; MontoMovimiento: number }> = [];
let reversalRequests: Array<Record<string, unknown> & { Id: number }> = [];
const tx = {
  venta: {
    findUnique: vi.fn(async () => ({
      Id: 41,
      IdEmpleadoVendedor: 7,
      IdUsuario: 2,
      TipoRegistro: 'VENTA',
      FechaVentaEfectiva: date,
      Anulado: canceled,
      EmpleadoVendedor: {
        Id: 7,
        IdConfiguracionComision: 3,
        TipoTrabajador: { Clave: 'VENDEDOR' },
      },
    })),
    findMany: vi.fn(async () => [{
      Id: 41,
      FechaVentaEfectiva: date,
      Anulado: canceled,
      DetalleVenta: [{
        Id: 91,
        IdInventarioItem: 22,
        Nombre: 'Producto',
        Cantidad: 2,
        PrecioUnitario: 50,
        InventarioItem: { IdCategoriaComision: null, CategoriaComision: null },
        Anulado: canceled,
        EsBonificacion: false,
        DevolucionesComerciales: [],
      }],
    }]),
  },
  configuracionComision: { findFirst: vi.fn(async () => ({ Id: 3 })) },
  reglaComisionCategoria: { findMany: vi.fn(async () => []) },
  reglaComision: {
    findMany: vi.fn(async () => [{
      Id: 8,
      IdInventarioItem: 22,
      CantidadMinima: 1,
      CantidadMaxima: null,
      TipoCalculo: 'PORCENTAJE_VENTA',
      Porcentaje: 10,
      MontoPorUnidad: null,
    }]),
  },
  comisionDevengada: {
    findMany: vi.fn(async () => ledger),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...data, Id: ledger.length + 1, MontoMovimiento: Number(data.MontoMovimiento) };
      ledger.push(row);
      return row;
    }),
  },
  planillaDetalleComisionFuente: {
    findMany: vi.fn(async () => {
      if (paidCommission) {
        return [{ PlanillaDetalleComision: { PlanillaMensual: { Estado: 'CERRADA', Pagos: [{ Id: 1 }] } } }];
      }
      if (closedUnpaidCommission) {
        return [{ PlanillaDetalleComision: { PlanillaMensual: { Estado: 'CERRADA', Pagos: [] } } }];
      }
      return [];
    }),
  },
  solicitudReversionComision: {
    findMany: vi.fn(async () => reversalRequests),
    findUnique: vi.fn(async ({ where }: { where: { ClaveOperacion: string } }) =>
      reversalRequests.find((request) => request.ClaveOperacion === where.ClaveOperacion) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const request = { ...data, Id: reversalRequests.length + 1 };
      reversalRequests.push(request);
      return request;
    }),
    update: vi.fn(async ({ where, data }: { where: { Id: number }; data: Record<string, unknown> }) => {
      const request = reversalRequests.find((item) => item.Id === where.Id);
      if (request) Object.assign(request, data);
      return request;
    }),
  },
} as unknown as Prisma.TransactionClient;

describe('monthly commission accrual', () => {
  beforeEach(() => {
    canceled = false;
    paidCommission = false;
    closedUnpaidCommission = false;
    ledger = [];
    reversalRequests = [];
    vi.clearAllMocks();
  });

  it('records a seller commission once when the confirmed sale is processed repeatedly', async () => {
    await accrueMonthlyCommissionsForSale(tx, 41);
    await accrueMonthlyCommissionsForSale(tx, 41);

    expect(ledger).toHaveLength(1);
    expect(ledger[0].TipoMovimiento).toBe('DEVENGO');
    expect(ledger[0].MontoMovimiento).toBe(10);
    expect(ledger[0].IdEmpleado).toBe(7);
    expect(tx.comisionDevengada.create).toHaveBeenCalledTimes(1);
  });

  it('does not backfill a prior sale while processing a different sale', async () => {
    await accrueMonthlyCommissionsForSale(tx, 42, 12);

    expect(ledger).toHaveLength(0);
    expect(tx.comisionDevengada.create).not.toHaveBeenCalled();
  });

  it('fails the sale transaction when the seller has no active commission configuration', async () => {
    vi.mocked(tx.configuracionComision.findFirst).mockResolvedValueOnce(null);

    await expect(accrueMonthlyCommissionsForSale(tx, 41, 12))
      .rejects.toThrow('El empleado vendedor no tiene una configuración de comisiones activa');
    expect(tx.comisionDevengada.create).not.toHaveBeenCalled();
  });

  it('recomputes prior monthly category accruals when a new sale crosses a tier', async () => {
    const secondDate = new Date('2026-10-20T12:00:00.000Z');
    const makeSale = (id: number, detailId: number, saleDate: Date) => ({
      Id: id,
      FechaVentaEfectiva: saleDate,
      Anulado: false,
      DetalleVenta: [{
        Id: detailId,
        IdInventarioItem: 22,
        Nombre: 'Categoría',
        Cantidad: 1,
        PrecioUnitario: 1000,
        InventarioItem: {
          IdCategoriaComision: 4,
          CategoriaComision: { Nombre: 'Productos' },
        },
        Anulado: false,
        EsBonificacion: false,
        DevolucionesComerciales: [],
      }],
    });
    const firstSale = makeSale(41, 91, date);
    const secondSale = makeSale(42, 92, secondDate);
    vi.mocked(tx.venta.findUnique).mockImplementation(async ({ where }: { where: { Id: number } }) => ({
      Id: where.Id,
      IdEmpleadoVendedor: 7,
      IdUsuario: 2,
      TipoRegistro: 'VENTA',
      FechaVentaEfectiva: where.Id === 41 ? date : secondDate,
      Anulado: false,
      EmpleadoVendedor: {
        Id: 7,
        IdConfiguracionComision: 3,
        TipoTrabajador: { Clave: 'VENDEDOR' },
      },
    }));
    vi.mocked(tx.venta.findMany)
      .mockResolvedValueOnce([firstSale] as never)
      .mockResolvedValueOnce([firstSale, secondSale] as never);
    vi.mocked(tx.reglaComisionCategoria.findMany).mockResolvedValue([
      {
        Id: 1,
        IdCategoriaComision: 4,
        MontoMinimoVenta: 0,
        Porcentaje: 3,
        FechaInicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
        FechaFinVigencia: null,
      },
      {
        Id: 2,
        IdCategoriaComision: 4,
        MontoMinimoVenta: 1500,
        Porcentaje: 5,
        FechaInicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
        FechaFinVigencia: null,
      },
    ] as never);

    await accrueMonthlyCommissionsForSale(tx, 41, 12);
    await accrueMonthlyCommissionsForSale(tx, 42, 12);

    expect(ledger.map((entry) => entry.MontoMovimiento)).toEqual([30, 20, 50]);
    expect(ledger.map((entry) => entry.IdDetalleVenta)).toEqual([91, 91, 92]);
    expect(Number(ledger[1].BaseCategoriaSnapshot)).toBe(2000);
  });

  it('records an append-only negative adjustment when a sale is annulled', async () => {
    await accrueMonthlyCommissionsForSale(tx, 41);
    canceled = true;
    await accrueMonthlyCommissionsForSale(tx, 41);
    await accrueMonthlyCommissionsForSale(tx, 41);

    expect(ledger.map((entry) => entry.MontoMovimiento)).toEqual([10, -10]);
    expect(ledger[1].TipoMovimiento).toBe('AJUSTE');
    expect(tx.comisionDevengada.create).toHaveBeenCalledTimes(2);
  });

  it('creates one pending administrative reversal instead of changing paid commission', async () => {
    await accrueMonthlyCommissionsForSale(tx, 41, 12);
    paidCommission = true;
    canceled = true;

    await accrueMonthlyCommissionsForSale(tx, 41, 12);
    await accrueMonthlyCommissionsForSale(tx, 41, 12);

    expect(ledger).toHaveLength(1);
    expect(reversalRequests).toHaveLength(1);
    expect(reversalRequests[0].Estado).toBe('PENDIENTE_REVISION');
    expect(Number(reversalRequests[0].MontoSolicitado)).toBe(10);
    expect(reversalRequests[0].IdUsuarioSolicitante).toBe(12);
  });

  it('links a paid commission reversal request to the commercial return', async () => {
    await accrueMonthlyCommissionsForSale(tx, 41, 12);
    paidCommission = true;
    canceled = true;

    await accrueMonthlyCommissionsForSale(tx, 41, 12, false, 78);

    expect(reversalRequests).toHaveLength(1);
    expect(reversalRequests[0].IdDevolucionComercial).toBe(78);
  });

  it('defers adjustments for an unpaid closed payroll to future commissions', async () => {
    await accrueMonthlyCommissionsForSale(tx, 41, 12);
    closedUnpaidCommission = true;
    canceled = true;

    await accrueMonthlyCommissionsForSale(tx, 41, 12);

    expect(ledger).toHaveLength(1);
    expect(reversalRequests).toHaveLength(1);
    expect(reversalRequests[0].Estado).toBe('APROBADA');
  });

  it('prevents a requester from approving their own reversal request', async () => {
    const txMock = {
      solicitudReversionComision: {
        findUnique: vi.fn(async () => ({
          Id: 2,
          IdUsuarioSolicitante: 12,
          Estado: 'PENDIENTE_REVISION',
        })),
        update: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock));

    await expect(reviewCommissionReversalRequest(2, 12, 'APROBAR', 'Revisado'))
      .rejects.toThrow('No puede aprobar su propia solicitud de reversión');
    expect(txMock.solicitudReversionComision.update).not.toHaveBeenCalled();
  });

  it('allows only the requester to cancel a pending reversal without financial effects', async () => {
    const txMock = {
      solicitudReversionComision: {
        findUnique: vi.fn(async () => ({
          Id: 2,
          IdUsuarioSolicitante: 12,
          Estado: 'PENDIENTE_REVISION',
        })),
        update: vi.fn(async () => ({ Id: 2, Estado: 'ANULADA' })),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock));

    await cancelCommissionReversalRequest(2, 12, 'Venta corregida');

    expect(txMock.solicitudReversionComision.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        Estado: 'ANULADA',
        IdUsuarioCancelador: 12,
        ObservacionesAnulacion: 'Venta corregida',
      }),
    }));
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock));
    await expect(cancelCommissionReversalRequest(2, 15, 'No corresponde'))
      .rejects.toThrow('Solo quien solicitó la reversión puede anularla');
    expect(txMock.solicitudReversionComision.update).toHaveBeenCalledTimes(1);
  });

  it('applies an approved reversal only against later seller commissions', async () => {
    reversalRequests = [{
      Id: 9,
      IdEmpleado: 7,
      Estado: 'APROBADA',
      MontoSolicitado: 5,
      MontoAplicado: 0,
      FechaSolicitud: new Date('2026-09-01T00:00:00.000Z'),
    }];

    await accrueMonthlyCommissionsForSale(tx, 41, 12);

    expect(ledger.map((entry) => entry.MontoMovimiento)).toEqual([10, -5]);
    expect(Number(reversalRequests[0].MontoAplicado)).toBe(5);
    expect(reversalRequests[0].Estado).toBe('APLICADA');
  });
});
