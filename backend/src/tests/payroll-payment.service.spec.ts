import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock, cashMovementMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    pagoPlanillaEmpleado: { findUnique: vi.fn() },
  },
  cashMovementMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/cash.service', () => ({
  recordCashPaymentMovement: cashMovementMock,
}));

import { registerPayrollPayment } from '../services/payroll-payment.service';

describe('payroll payment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a partial payment and its cash movement atomically', async () => {
    const now = new Date('2026-10-30T12:00:00.000Z');
    const payment = {
      Id: 25,
      IdUsuario: 4,
      Monto: new Prisma.Decimal(40),
      MetodoPago: 'EFECTIVO',
      NumeroReferencia: null,
      Banco: null,
      RutaComprobante: null,
      FechaPago: now,
      Observaciones: null,
      Usuario: { Nombre: 'Administración' },
    };
    const tx = {
      pagoPlanillaEmpleado: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ Id: payment.Id, Monto: payment.Monto, FechaPago: now }),
      },
      planillaMensual: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            Id: 8,
            Estado: 'CERRADA',
            SueldoLiquido: new Prisma.Decimal(100),
          })
          .mockResolvedValueOnce({
            Id: 8,
            Estado: 'CERRADA',
            EstadoPago: 'PARCIAL',
            SueldoLiquido: new Prisma.Decimal(100),
            Pagos: [payment],
          }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await registerPayrollPayment(8, 4, {
      monto: 40,
      metodoPago: 'EFECTIVO',
    }, 'payroll-payment-retry-001');

    expect(result).toMatchObject({
      estadoPago: 'PARCIAL',
      totalPagado: 40,
      saldoPendiente: 60,
    });
    expect(tx.planillaMensual.update).toHaveBeenCalledWith({
      where: { Id: 8 },
      data: { EstadoPago: 'PARCIAL' },
    });
    expect(cashMovementMock).toHaveBeenCalledWith(tx, expect.objectContaining({
      source: 'PAGO_PLANILLA',
      sourceId: 25,
      metodoPago: 'EFECTIVO',
      idUsuario: 4,
    }));
  });

  it('replays an idempotent payment without creating a second payment', async () => {
    const tx = {
      pagoPlanillaEmpleado: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      planillaMensual: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 8,
          Estado: 'CERRADA',
          EstadoPago: 'PARCIAL',
          SueldoLiquido: new Prisma.Decimal(100),
          Pagos: [{
            Id: 25,
            IdUsuario: 4,
            Monto: new Prisma.Decimal(40),
            MetodoPago: 'TRANSFERENCIA',
            NumeroReferencia: 'TRX-25',
            Banco: 'Banco',
            RutaComprobante: null,
            FechaPago: new Date('2026-10-30T12:00:00.000Z'),
            Observaciones: null,
            Usuario: { Nombre: 'Administración' },
          }],
        }),
      },
    };
    const input = {
      monto: 40,
      metodoPago: 'TRANSFERENCIA' as const,
      numeroReferencia: 'TRX-25',
      banco: 'Banco',
    };
    const { createHash } = await import('node:crypto');
    const requestFingerprint = createHash('sha256').update(JSON.stringify({
      idPlanilla: 8,
      idUsuario: 4,
      monto: input.monto,
      metodoPago: input.metodoPago,
      numeroReferencia: input.numeroReferencia,
      banco: input.banco,
      fechaPago: null,
      rutaComprobante: null,
      observaciones: null,
    })).digest('hex');
    tx.pagoPlanillaEmpleado.findUnique.mockResolvedValue({
      IdPlanillaMensual: 8,
      HuellaSolicitud: requestFingerprint,
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await registerPayrollPayment(8, 4, input, 'payroll-payment-retry-002');

    expect(result.totalPagado).toBe(40);
    expect(tx.pagoPlanillaEmpleado.create).not.toHaveBeenCalled();
    expect(cashMovementMock).not.toHaveBeenCalled();
  });
});
