import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    venta: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    pagoVenta: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cuentaPorCobrar: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
    solicitudPagoIdempotente: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('../services/notification.service', () => ({
  NotificationEvents: { PAGO_RECIBIDO: 'PAGO_RECIBIDO' },
  send: sendMock,
}));

import { anulateSalePayment, createSalePayment } from '../services/sale.service';

function buildSaleWithPayments(pagos: number[]) {
  return {
    DetalleVenta: [
      { Cantidad: 10, PrecioUnitario: 10, EsBonificacion: false },
    ],
    PagoVenta: pagos.map((monto) => ({ Monto: monto })),
  };
}

function buildSaleExistenceCheck() {
  return {
    Id: 7,
    NumeroVenta: 1007,
    Cliente: { Entidad: { NombreCompleto: 'Cliente de Prueba' } },
  };
}

function paymentFingerprint() {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      idVenta: 7,
      idUsuario: 1,
      monto: 20,
      metodoPago: 'EFECTIVO',
      numeroReferencia: null,
      banco: null,
      fechaPago: null,
      rutaFirma: null,
      observaciones: null,
    }))
    .digest('hex');
}

describe('Fase 4 - Ventas y Cuentas por Cobrar (pagos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prismaMock.solicitudPagoIdempotente.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('rechaza un pago mayor al saldo pendiente (total=100, pagado=80, intenta 50)', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    // Verificación inicial de venta activa.
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleExistenceCheck());
    // recalculateSalePaymentStatus ("current"): total 100, pagado 80 => saldo 20.
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([80]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    await expect(
      createSalePayment(7, { idUsuario: 1, monto: 50, metodoPago: 'EFECTIVO' }, 'key-overpayment'),
    ).rejects.toThrowError('Pago no puede ser mayor al saldo pendiente');

    expect(prismaMock.pagoVenta.create).not.toHaveBeenCalled();
  });

  it('reproduce el resultado guardado para una clave y payload ya procesados', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.solicitudPagoIdempotente.findUnique.mockResolvedValueOnce({
      HuellaSolicitud: paymentFingerprint(),
      EstadoPago: 'PAGADO',
      Saldo: 0,
      PagoVenta: {
        Id: 55,
        IdVenta: 7,
        IdUsuario: 1,
        Monto: 20,
        MetodoPago: 'EFECTIVO',
        NumeroReferencia: null,
        Banco: null,
        FechaPago: new Date('2026-09-28'),
        RutaFirma: null,
        Observaciones: null,
      },
    });

    await expect(
      createSalePayment(7, { idUsuario: 1, monto: 20, metodoPago: 'EFECTIVO' }, 'same-key'),
    ).resolves.toMatchObject({
      id: 55,
      idVenta: 7,
      estadoPago: 'PAGADO',
      saldo: 0,
    });

    expect(prismaMock.pagoVenta.create).not.toHaveBeenCalled();
    expect(prismaMock.solicitudPagoIdempotente.create).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar una clave con un payload diferente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.solicitudPagoIdempotente.findUnique.mockResolvedValueOnce({
      HuellaSolicitud: '0'.repeat(64),
      EstadoPago: 'PAGADO',
      Saldo: 0,
      PagoVenta: {
        Id: 55,
        IdVenta: 7,
        IdUsuario: 1,
        Monto: 20,
        MetodoPago: 'EFECTIVO',
        NumeroReferencia: null,
        Banco: null,
        FechaPago: new Date('2026-09-28'),
        RutaFirma: null,
        Observaciones: null,
      },
    });

    await expect(
      createSalePayment(7, { idUsuario: 1, monto: 20, metodoPago: 'EFECTIVO' }, 'same-key'),
    ).rejects.toThrowError('La clave de idempotencia ya fue utilizada con datos diferentes');

    expect(prismaMock.pagoVenta.create).not.toHaveBeenCalled();
  });

  it('recupera el resultado persistido cuando otra solicitud concurrente gana la clave única', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prismaMock.solicitudPagoIdempotente.findUnique.mockResolvedValueOnce({
      HuellaSolicitud: paymentFingerprint(),
      EstadoPago: 'PAGADO',
      Saldo: 0,
      PagoVenta: {
        Id: 55,
        IdVenta: 7,
        IdUsuario: 1,
        Monto: 20,
        MetodoPago: 'EFECTIVO',
        NumeroReferencia: null,
        Banco: null,
        FechaPago: new Date('2026-09-28'),
        RutaFirma: null,
        Observaciones: null,
      },
    });

    await expect(
      createSalePayment(7, { idUsuario: 1, monto: 20, metodoPago: 'EFECTIVO' }, 'same-key'),
    ).resolves.toMatchObject({ id: 55, estadoPago: 'PAGADO', saldo: 0 });
    expect(prismaMock.pagoVenta.create).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('acepta un pago que completa exactamente el saldo pendiente y marca la CxC como PAGADO', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleExistenceCheck());
    // "current": total 100, pagado 80 => saldo 20.
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([80]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.pagoVenta.create.mockResolvedValueOnce({
      Id: 55,
      IdVenta: 7,
      IdUsuario: 1,
      Monto: 20,
      MetodoPago: 'EFECTIVO',
      NumeroReferencia: null,
      Banco: null,
      FechaPago: new Date('2026-09-28'),
      RutaFirma: null,
      Observaciones: null,
    });

    // "recalculated" post-pago: total 100, pagado 100 => saldo 0, PAGADO.
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([80, 20]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValueOnce({ Id: 3, Estado: 'ACTIVO' });
    prismaMock.cuentaPorCobrar.update.mockResolvedValueOnce({});

    const result = await createSalePayment(7, { idUsuario: 1, monto: 20, metodoPago: 'EFECTIVO' }, 'key-exact-payment');

    expect(result.saldo).toBe(0);
    expect(result.estadoPago).toBe('PAGADO');
    expect(prismaMock.cuentaPorCobrar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 3 },
        data: expect.objectContaining({ Estado: 'PAGADO' }),
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );

    // PAGO_RECIBIDO se dispara una sola vez, después del commit, con el payload real.
    await Promise.resolve();
    await Promise.resolve();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('PAGO_RECIBIDO', {
      numeroVenta: 1007,
      cliente: 'Cliente de Prueba',
      monto: 20,
      metodoPago: 'EFECTIVO',
      estadoPago: 'PAGADO',
      saldo: 0,
    });
  });

  it('no afecta el pago registrado si la notificación PAGO_RECIBIDO falla', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleExistenceCheck());
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([80]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.pagoVenta.create.mockResolvedValueOnce({
      Id: 55,
      IdVenta: 7,
      IdUsuario: 1,
      Monto: 20,
      MetodoPago: 'EFECTIVO',
      NumeroReferencia: null,
      Banco: null,
      FechaPago: new Date('2026-09-28'),
      RutaFirma: null,
      Observaciones: null,
    });

    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([80, 20]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValueOnce({ Id: 3, Estado: 'ACTIVO' });
    prismaMock.cuentaPorCobrar.update.mockResolvedValueOnce({});

    sendMock.mockRejectedValueOnce(new Error('fallo inesperado de red'));

    const result = await createSalePayment(7, { idUsuario: 1, monto: 20, metodoPago: 'EFECTIVO' }, 'key-notification-failure');

    expect(result.id).toBe(55);
    expect(result.saldo).toBe(0);
  });

  it('al anular un pago, reactiva la CxC (vuelve a ACTIVO) si vuelve a quedar saldo pendiente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.pagoVenta.findFirst.mockResolvedValueOnce({ Id: 55 });
    prismaMock.pagoVenta.update.mockResolvedValueOnce({});

    // recalculateSalePaymentStatus tras anular el pago: total 100, pagado 0 => saldo 100.
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValueOnce({ Id: 3, Estado: 'PAGADO' });
    prismaMock.cuentaPorCobrar.update.mockResolvedValueOnce({});

    await anulateSalePayment(7, 55, 9);

    expect(prismaMock.cuentaPorCobrar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 3 },
        data: expect.objectContaining({ Estado: 'ACTIVO' }),
      }),
    );
  });

  it('no reactiva una CxC que ya está ANULADO aunque cambie el saldo', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.pagoVenta.findFirst.mockResolvedValueOnce({ Id: 55 });
    prismaMock.pagoVenta.update.mockResolvedValueOnce({});

    prismaMock.venta.findFirst.mockResolvedValueOnce(buildSaleWithPayments([]));
    prismaMock.venta.update.mockResolvedValueOnce({});

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValueOnce({ Id: 3, Estado: 'ANULADO' });

    await anulateSalePayment(7, 55, 9);

    expect(prismaMock.cuentaPorCobrar.update).not.toHaveBeenCalled();
  });
});
