import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn(), update: vi.fn() },
    detalleVenta: { updateMany: vi.fn() },
    pagoVenta: { updateMany: vi.fn() },
    cuentaPorCobrar: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/notification.service', () => ({
  NotificationEvents: { VENTA_ANULADA: 'VENTA_ANULADA', PEDIDO_ENTREGADO: 'PEDIDO_ENTREGADO' },
  send: sendMock,
}));

vi.mock('../services/fel.service', () => ({
  emitFelInvoice: vi.fn(),
  anulateFelInvoice: vi.fn(),
}));

vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: vi.fn(),
}));

import { anulateSale, updateSale } from '../services/sale.service';

function buildAnulateSaleRow() {
  return {
    Id: 7,
    NumeroVenta: 1007,
    IdUsuario: 1,
    RequiereFactura: false,
    AutorizacionFel: null,
    SerieFel: null,
    NumeroFel: null,
    DetalleVenta: [],
    PagoVenta: [],
    Cliente: { Entidad: { NombreCompleto: 'Cliente de Prueba' } },
  };
}

describe('Fase 23 - VENTA_ANULADA (anulateSale)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sendMock.mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('notifica VENTA_ANULADA una sola vez, después de completar la transacción de anulación', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildAnulateSaleRow());
    prismaMock.detalleVenta.updateMany.mockResolvedValueOnce({});
    prismaMock.pagoVenta.updateMany.mockResolvedValueOnce({});
    prismaMock.venta.update.mockResolvedValueOnce({});
    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValueOnce({});

    await anulateSale(7, 9);
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('VENTA_ANULADA', {
      numeroVenta: 1007,
      cliente: 'Cliente de Prueba',
    });
  });

  it('no afecta la anulación ya confirmada si la notificación falla', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildAnulateSaleRow());
    prismaMock.detalleVenta.updateMany.mockResolvedValueOnce({});
    prismaMock.pagoVenta.updateMany.mockResolvedValueOnce({});
    prismaMock.venta.update.mockResolvedValueOnce({});
    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValueOnce({});
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado de red'));

    await expect(anulateSale(7, 9)).resolves.toBeUndefined();
  });
});

function buildExistingSaleForUpdate(estadoEntrega: string) {
  return {
    Id: 7,
    NumeroFel: null,
    AutorizacionFel: null,
    FechaEmisionFel: null,
    EstadoEntrega: estadoEntrega,
    PagoVenta: [],
    RutaSesion: null,
  };
}

function buildFullSaleRowForDto(estadoEntrega: string) {
  return {
    Id: 7,
    IdCliente: 3,
    IdUsuario: 1,
    IdRutaSesion: null,
    IdTalonario: null,
    NumeroVenta: 1007,
    NumeroProForma: null,
    TipoRegistro: 'VENTA',
    EstadoEntrega: estadoEntrega,
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
    NombreClienteFacturado: null,
    DireccionClienteFacturado: null,
    LugarEntrega: null,
    FechaEntregaEsperada: null,
    FechaRegistro: new Date('2026-10-03'),
    IdUsuarioModificador: null,
    FechaModificacion: new Date('2026-10-03'),
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Cliente: {
      Id: 3,
      Entidad: { NombreCompleto: 'Cliente de Prueba', Nit: null },
      TipoCliente: null,
    },
    Usuario: { Id: 1, Nombre: 'Vendedor', Correo: 'vendedor@basan.com' },
    RutaSesion: null,
    Talonario: null,
    DetalleVenta: [],
    PagoVenta: [],
  };
}

describe('Fase 23 - PEDIDO_ENTREGADO (updateSale)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sendMock.mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('notifica PEDIDO_ENTREGADO cuando estadoEntrega cambia a ENTREGADO', async () => {
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildExistingSaleForUpdate('EN_RUTA'));
    prismaMock.venta.update.mockResolvedValueOnce({});
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildFullSaleRowForDto('ENTREGADO'));

    await updateSale(7, { estadoEntrega: 'ENTREGADO' });
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('PEDIDO_ENTREGADO', {
      numeroVenta: 1007,
      cliente: 'Cliente de Prueba',
    });
  });

  it('no notifica cuando se actualizan otros campos sin tocar estadoEntrega', async () => {
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildExistingSaleForUpdate('EN_RUTA'));
    prismaMock.venta.update.mockResolvedValueOnce({});
    prismaMock.venta.findFirst.mockResolvedValueOnce(buildFullSaleRowForDto('EN_RUTA'));

    await updateSale(7, { lugarEntrega: 'Zona 1' });
    await Promise.resolve();

    expect(sendMock).not.toHaveBeenCalled();
  });
});
