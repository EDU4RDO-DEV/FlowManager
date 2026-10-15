import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    clienteCondicionCredito: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn(), create: vi.fn() },
    detalleVenta: { create: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    reglaBonificacion: { findMany: vi.fn() },
    pagoVenta: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  sendMock: vi.fn(),
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

import { createSale } from '../services/sale.service';

function saleInput(condicionPago: 'CONTADO' | 'CREDITO') {
  return {
    idUsuario: 1,
    idCliente: 4,
    tipoRegistro: 'VENTA' as const,
    estadoEntrega: 'PENDIENTE' as const,
    condicionPago,
    requiereFactura: false,
    detalle: [{ idInventarioItem: 9, cantidad: 1, precioUnitario: 10 }],
    ...(condicionPago === 'CONTADO'
      ? { pagoInicial: { monto: 10, metodoPago: 'EFECTIVO' as const } }
      : {}),
  };
}

function activeClient(habilitadoCredito: boolean) {
  return {
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: habilitadoCredito,
    Entidad: { NombreCompleto: 'Cliente de prueba', Nit: null },
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
  });

  it('allows a cash sale when credit is disabled', async () => {
    prismaMock.cliente.findFirst.mockResolvedValueOnce(activeClient(false));
    prismaMock.venta.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdSaleRow());
    prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 9,
      Nombre: 'Producto',
      Existencia: 10,
      PrecioVenta: 10,
    });
    prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });

    const result = await createSale(saleInput('CONTADO'));

    expect(result.condicionPago).toBe('CONTADO');
    expect(prismaMock.cliente.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.venta.create).toHaveBeenCalledOnce();
  });
});
