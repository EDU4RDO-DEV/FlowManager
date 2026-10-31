import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cajaSesion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    movimientoCaja: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  closeCashSession,
  openCashSession,
  recordCashPaymentMovement,
  reverseSalePaymentCashMovement,
} from '../services/cash.service';

describe('cash service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate active cash sessions and records the opener', async () => {
    const tx = {
      cajaSesion: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ Id: 14 }),
        findUnique: vi.fn().mockResolvedValue({
          Id: 14,
          Estado: 'ABIERTA',
          SaldoInicial: { toString: () => '200.00' },
          EfectivoEsperado: null,
          EfectivoContado: null,
          DiferenciaEfectivo: null,
          UsuarioApertura: { Id: 5, Nombre: 'Cajero' },
          UsuarioCierre: null,
          Movimientos: [],
        }),
      },
      movimientoCaja: { findMany: vi.fn().mockResolvedValue([]) },
    };
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    const result = await openCashSession(5, 200);

    expect(tx.cajaSesion.create).toHaveBeenCalledWith({
      data: {
        Estado: 'ABIERTA',
        IdUsuarioApertura: 5,
        SaldoInicial: expect.anything(),
      },
      select: { Id: true },
    });
    expect(result?.EfectivoEsperado).toBe(200);
  });

  it('requires an open cash session for cash payments but not transfers', async () => {
    const tx = {
      cajaSesion: { findFirst: vi.fn().mockResolvedValue(null) },
      movimientoCaja: { create: vi.fn() },
    };

    await expect(recordCashPaymentMovement(tx as never, {
      idUsuario: 2,
      metodoPago: 'EFECTIVO',
      monto: 25,
      fecha: new Date('2026-10-31T12:00:00Z'),
      source: 'PAGO_VENTA',
      sourceId: 31,
      concepto: 'Cobro venta',
    })).rejects.toThrow('Debe abrir la caja antes de registrar un pago en efectivo');

    await expect(recordCashPaymentMovement(tx as never, {
      idUsuario: 2,
      metodoPago: 'TRANSFERENCIA',
      monto: 25,
      fecha: new Date('2026-10-31T12:00:00Z'),
      source: 'PAGO_VENTA',
      sourceId: 31,
      concepto: 'Cobro venta',
    })).resolves.toBeUndefined();
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it('closes the session using cash movements only for the expected cash balance', async () => {
    const tx = {
      cajaSesion: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 14,
          SaldoInicial: { toString: () => '200.00' },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          Id: 14,
          Estado: 'CERRADA',
          SaldoInicial: { toString: () => '200.00' },
          EfectivoEsperado: { toString: () => '250.00' },
          EfectivoContado: { toString: () => '248.00' },
          DiferenciaEfectivo: { toString: () => '-2.00' },
          UsuarioApertura: { Id: 5, Nombre: 'Cajero' },
          UsuarioCierre: { Id: 6, Nombre: 'Supervisor' },
          Movimientos: [],
        }),
      },
      movimientoCaja: {
        findMany: vi.fn().mockResolvedValue([
          { Tipo: 'INGRESO', MetodoPago: 'EFECTIVO', Monto: { toString: () => '70.00' } },
          { Tipo: 'EGRESO', MetodoPago: 'EFECTIVO', Monto: { toString: () => '20.00' } },
          { Tipo: 'INGRESO', MetodoPago: 'TRANSFERENCIA', Monto: { toString: () => '300.00' } },
        ]),
      },
    };
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    await closeCashSession(14, 6, 248, 'Conteo');

    expect(tx.cajaSesion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { Id: 14, Estado: 'ABIERTA' },
      data: expect.objectContaining({
        EfectivoEsperado: expect.anything(),
        EfectivoContado: expect.anything(),
        DiferenciaEfectivo: expect.anything(),
      }),
    }));
  });

  it('records an idempotent refund in the current cash session without changing the closed one', async () => {
    const tx = {
      cajaSesion: { findFirst: vi.fn().mockResolvedValue({ Id: 15 }) },
      movimientoCaja: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            Id: 70,
            IdCajaSesion: 12,
            Tipo: 'INGRESO',
            MetodoPago: 'EFECTIVO',
            Monto: { toString: () => '40.00' },
          })
          .mockResolvedValueOnce(null),
        create: vi.fn(),
      },
    };

    await reverseSalePaymentCashMovement(tx as never, {
      idPagoVenta: 70,
      idUsuario: 6,
      concepto: 'Reembolso',
    });

    expect(tx.movimientoCaja.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        IdCajaSesion: 15,
        IdMovimientoReversado: 70,
        Tipo: 'EGRESO',
        MetodoPago: 'EFECTIVO',
        Concepto: 'Reembolso',
      }),
    });
  });
});
