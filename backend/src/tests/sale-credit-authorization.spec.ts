import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendMock, routeAvailableQuantitiesMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    clienteCondicionCredito: { findFirst: vi.fn() },
    cuentaPorCobrar: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    venta: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    reservaProforma: { updateMany: vi.fn() },
    detalleVenta: { create: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    reglaBonificacion: { findMany: vi.fn() },
    pagoVenta: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  sendMock: vi.fn(),
  routeAvailableQuantitiesMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/notification.service', () => ({
  NotificationEvents: { PEDIDO_CREADO: 'PEDIDO_CREADO', FACTURA_EMITIDA: 'FACTURA_EMITIDA' },
  send: sendMock,
}));
vi.mock('../services/fel.service', () => ({
  anulateFelInvoice: vi.fn(),
  emitFelInvoice: vi.fn(),
}));
vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: vi.fn(),
}));
vi.mock('../services/route-inventory.service', () => ({
  getRouteAvailableQuantities: routeAvailableQuantitiesMock,
}));
vi.mock('../services/proforma-reservation.service', () => ({
  processExpiredProformaReservations: vi.fn(),
}));

import {
  confirmRouteProforma,
  createSale,
  getCustomerCreditAuthorization,
} from '../services/sale.service';

function saleInput(condicionPago: 'CONTADO' | 'CREDITO', pagoInicial?: number) {
  return {
    idUsuario: 1,
    idCliente: 4,
    tipoRegistro: 'VENTA' as const,
    estadoEntrega: 'PENDIENTE' as const,
    condicionPago,
    requiereFactura: false,
    detalle: [{ idInventarioItem: 9, cantidad: 1, precioUnitario: 10 }],
    ...(condicionPago === 'CONTADO' || pagoInicial !== undefined
      ? { pagoInicial: { monto: pagoInicial ?? 10, metodoPago: 'EFECTIVO' as const } }
      : {}),
  };
}

function activeClient(habilitadoCredito: boolean) {
  return {
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: habilitadoCredito,
    LimiteCredito: 100,
    Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
  };
}

function activeCreditCondition() {
  return {
    Id: 11,
    IdTipoCredito: 3,
    TipoCredito: { Id: 3, Nombre: 'Crédito a 30 días', PlazoDias: 30 },
  };
}

function createdSaleRow() {
  return {
    Id: 7,
    IdCliente: 4,
    IdUsuario: 1,
    IdRutaSesion: null,
    IdTalonario: null,
    NumeroVenta: 1,
    NumeroProForma: null,
    TipoRegistro: 'VENTA',
    EstadoEntrega: 'PENDIENTE',
    CondicionPago: 'CONTADO',
    EstadoPago: 'PAGADO',
    RequiereFactura: false,
    AutorizacionFel: null,
    NumeroFel: null,
    SerieFel: null,
    QrFel: null,
    RutaPdfFel: null,
    FechaEmisionFel: null,
    NitFacturado: null,
    NombreClienteFacturado: 'Cliente de prueba',
    DireccionClienteFacturado: null,
    LugarEntrega: null,
    FechaEntregaEsperada: null,
    FechaRegistro: new Date(),
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Cliente: { Id: 4, Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null } },
    Usuario: { Id: 1, Nombre: 'Operador', Correo: 'operador@example.test' },
    RutaSesion: null,
    Talonario: null,
    DetalleVenta: [{
      Id: 1,
      IdVenta: 7,
      IdInventarioItem: 9,
      Nombre: 'Producto',
      Cantidad: 1,
      PrecioUnitario: 10,
      EsBonificacion: false,
      Anulado: false,
      Envases: [],
      InventarioItem: { Id: 9, Nombre: 'Producto', Categoria: 'PRODUCTO_TERMINADO', Existencia: 9 },
    }],
    PagoVenta: [{
      Id: 2,
      IdVenta: 7,
      IdUsuario: 1,
      Monto: 10,
      MetodoPago: 'EFECTIVO',
      NumeroReferencia: null,
      Banco: null,
      FechaPago: new Date(),
      RutaFirma: null,
      Observaciones: null,
      Usuario: { Id: 1, Nombre: 'Operador', Correo: 'operador@example.test' },
    }],
  };
}

describe('Sale credit authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    sendMock.mockResolvedValue({ ok: true });
    routeAvailableQuantitiesMock.mockResolvedValue([]);
  });

  it('rejects direct credit-sale requests when client credit is disabled', async () => {
    prismaMock.cliente.findFirst
      .mockResolvedValueOnce(activeClient(false))
      .mockResolvedValueOnce({ HabilitadoCredito: false });

    await expect(createSale(saleInput('CREDITO'))).rejects.toThrow(
      'Cliente no tiene habilitado el crédito',
    );

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.clienteCondicionCredito.findFirst).not.toHaveBeenCalled();
  });

  it('still requires an active credit condition for an authorized client', async () => {
    prismaMock.cliente.findFirst
      .mockResolvedValueOnce(activeClient(true))
      .mockResolvedValueOnce({ HabilitadoCredito: true });
    prismaMock.venta.findFirst.mockResolvedValueOnce(null);
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValueOnce(null);

    await expect(createSale(saleInput('CREDITO'))).rejects.toThrow(
      'Cliente no habilitado para crédito',
    );

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.clienteCondicionCredito.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          TipoCredito: { is: { Activo: true, Anulado: false } },
        }),
      }),
    );
  });

  it('creates a credit sale with the authorized condition, due date, and initial payment reducing credit use', async () => {
    prismaMock.cliente.findFirst
      .mockResolvedValueOnce(activeClient(true))
      .mockResolvedValueOnce({ HabilitadoCredito: true })
      .mockResolvedValueOnce({
        Id: 4,
        HabilitadoCredito: true,
        LimiteCredito: 8,
        Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
      });
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(activeCreditCondition());
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);
    prismaMock.venta.findFirst.mockResolvedValue(createdSaleRow());
    prismaMock.reglaBonificacion.findMany.mockResolvedValue([]);
    prismaMock.inventarioItem.findFirst.mockResolvedValue({
      Id: 9,
      Nombre: 'Producto',
      Existencia: 10,
      PrecioVenta: 10,
      EsVendible: true,
      EsEnvaseRetornable: false,
    });
    prismaMock.venta.create.mockResolvedValue({ Id: 7, NumeroVenta: 1 });

    await createSale(saleInput('CREDITO', 2));

    expect(prismaMock.pagoVenta.create).toHaveBeenCalledOnce();
    expect(prismaMock.cuentaPorCobrar.create).toHaveBeenCalledOnce();
    const accountData = prismaMock.cuentaPorCobrar.create.mock.calls[0][0].data;
    expect(accountData).toMatchObject({
      IdVenta: 7,
      IdTipoCreditoAplicado: 3,
      IdClienteCondicionCreditoAplicada: 11,
      TotalOriginal: 10,
      Estado: 'ACTIVO',
    });
    expect(accountData.FechaVencimiento).toBeInstanceOf(Date);
    const expectedDueDate = new Date();
    expectedDueDate.setDate(expectedDueDate.getDate() + 30);
    expect(accountData.FechaVencimiento.toISOString().slice(0, 10)).toBe(
      expectedDueDate.toISOString().slice(0, 10),
    );
    expect(prismaMock.$transaction.mock.calls[0][1].isolationLevel).toBe('Serializable');
  });

  it('rejects a credit sale when prior active balances leave insufficient credit', async () => {
    prismaMock.cliente.findFirst
      .mockResolvedValueOnce(activeClient(true))
      .mockResolvedValueOnce({ HabilitadoCredito: true })
      .mockResolvedValueOnce({
        Id: 4,
        HabilitadoCredito: true,
        LimiteCredito: 8,
        Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
      });
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(activeCreditCondition());
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
      { TotalOriginal: 5, Venta: { PagoVenta: [{ Monto: 2 }] } },
    ]);
    prismaMock.venta.findFirst.mockResolvedValue(createdSaleRow());
    prismaMock.reglaBonificacion.findMany.mockResolvedValue([]);
    prismaMock.inventarioItem.findFirst.mockResolvedValue({
      Id: 9,
      Nombre: 'Producto',
      Existencia: 10,
      PrecioVenta: 10,
      EsVendible: true,
      EsEnvaseRetornable: false,
    });

    await expect(createSale(saleInput('CREDITO'))).rejects.toThrow(
      'Crédito insuficiente: 10.00 de consumo supera los 5.00 disponibles',
    );

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('calculates credit available from active receivables and non-annulled payments', async () => {
    prismaMock.cliente.findFirst.mockResolvedValue({
      Id: 4,
      HabilitadoCredito: true,
      LimiteCredito: 200,
      Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
    });

    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(activeCreditCondition());
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
      { TotalOriginal: 100, Venta: { PagoVenta: [{ Monto: 20 }, { Monto: 30 }] } },
      { TotalOriginal: 50, Venta: { PagoVenta: [{ Monto: 50 }] } },
      { TotalOriginal: 80, Venta: { PagoVenta: [{ Monto: 20 }] } },
    ]);

    const result = await getCustomerCreditAuthorization(4);

    expect(result.saldoPendiente).toBe(110);
    expect(result.creditoDisponible).toBe(90);
    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          Anulado: false,
          Estado: { not: 'ANULADO' },
          Venta: { is: { IdCliente: 4, Anulado: false } },
        }),
        select: expect.objectContaining({
          Venta: {
            select: {
              PagoVenta: { where: { Anulado: false }, select: { Monto: true } },
            },
          },
        }),
      }),
    );
  });

  it('uses inclusive calendar-day boundaries for credit conditions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-30T23:59:59.999Z'));
    prismaMock.cliente.findFirst.mockResolvedValue({
      Id: 4,
      HabilitadoCredito: true,
      LimiteCredito: 200,
      Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
    });
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(activeCreditCondition());
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);

    try {
      await getCustomerCreditAuthorization(4);
    } finally {
      vi.useRealTimers();
    }

    expect(prismaMock.clienteCondicionCredito.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          FechaInicioVigencia: { lte: new Date('2026-11-30T00:00:00.000Z') },
          OR: [
            { FechaFinVigencia: null },
            { FechaFinVigencia: { gte: new Date('2026-11-30T00:00:00.000Z') } },
          ],
        }),
      }),
    );
  });

  it('validates credit and creates the receivable only when converting a route proforma', async () => {
    const finalSale = {
      ...createdSaleRow(),
      CondicionPago: 'CREDITO',
      EstadoPago: 'PARCIAL',
      PagoVenta: [{
        Id: 2,
        IdVenta: 7,
        IdUsuario: 1,
        Monto: 2,
        MetodoPago: 'EFECTIVO',
        NumeroReferencia: null,
        Banco: null,
        FechaPago: new Date(),
        RutaFirma: null,
        Observaciones: null,
        Usuario: { Id: 1, Nombre: 'Operador', Correo: 'operador@example.test' },
      }],
    };
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.venta.findFirst
      .mockResolvedValueOnce({
        Id: 7,
        IdCliente: 4,
        IdRutaSesion: 12,
        TipoRegistro: 'PROFORMA',
        CondicionPago: 'CREDITO',
        ReservaProforma: {
          Id: 5,
          Estado: 'ACTIVA',
          FechaExpiracion: new Date(Date.now() + 60_000),
        },
      })
      .mockResolvedValueOnce({
        Anulado: false,
        DetalleVenta: [{ Cantidad: 1, PrecioUnitario: 10, EsBonificacion: false }],
        PagoVenta: [{ Monto: 2 }],
      })
      .mockResolvedValueOnce(finalSale);
    prismaMock.venta.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.reservaProforma.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.findFirst.mockResolvedValue({
      Id: 4,
      HabilitadoCredito: true,
      LimiteCredito: 8,
      Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
    });
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(activeCreditCondition());
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);
    prismaMock.cuentaPorCobrar.findUnique.mockResolvedValue(null);

    await confirmRouteProforma(7, 1);

    expect(prismaMock.cuentaPorCobrar.create).toHaveBeenCalledOnce();
    expect(prismaMock.cuentaPorCobrar.create.mock.calls[0][0].data).toMatchObject({
      IdVenta: 7,
      TotalOriginal: 10,
      IdClienteCondicionCreditoAplicada: 11,
      Estado: 'ACTIVO',
    });
    expect(prismaMock.$transaction.mock.calls.at(-1)?.[1].isolationLevel).toBe('Serializable');
  });

  it('allows a cash sale when credit is disabled', async () => {
    prismaMock.cliente.findFirst.mockResolvedValueOnce(activeClient(false));
    prismaMock.venta.findFirst.mockResolvedValue(createdSaleRow());
    prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 9,
      Nombre: 'Producto',
      Existencia: 10,
      PrecioVenta: 10,
      EsVendible: true,
      EsEnvaseRetornable: false,
    });
    prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });

    const result = await createSale(saleInput('CONTADO'));

    expect(result.condicionPago).toBe('CONTADO');
    expect(prismaMock.cliente.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.venta.create).toHaveBeenCalledOnce();
  });

  it('does not require credit authorization or create a receivable when creating a proforma', async () => {
    prismaMock.cliente.findFirst.mockResolvedValueOnce(activeClient(false));
    prismaMock.venta.findFirst.mockResolvedValue(createdSaleRow());
    prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 9,
      Nombre: 'Producto',
      Existencia: 10,
      PrecioVenta: 10,
      EsVendible: true,
      EsEnvaseRetornable: false,
    });
    prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });

    await createSale({
      ...saleInput('CREDITO'),
      tipoRegistro: 'PROFORMA',
    });

    expect(prismaMock.clienteCondicionCredito.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with a different sale payload', async () => {
    prismaMock.venta.findUnique.mockResolvedValueOnce({
      Id: 8,
      IdUsuario: 1,
      HuellaSolicitud: 'different-request-fingerprint',
    });

    await expect(
      createSale(saleInput('CONTADO'), 'c49a2af0-218c-4f23-9b4b-2cc38979ab83'),
    ).rejects.toThrow('La clave de idempotencia ya fue utilizada con datos diferentes');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
