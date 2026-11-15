import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    venta: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    detalleVenta: { create: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    reglaBonificacion: { findMany: vi.fn() },
    pagoVenta: { create: vi.fn() },
    cajaSesion: { findFirst: vi.fn() },
    movimientoCaja: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
const { emitFelInvoiceMock } = vi.hoisted(() => ({ emitFelInvoiceMock: vi.fn() }));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/notification.service', () => ({
  NotificationEvents: { PEDIDO_CREADO: 'PEDIDO_CREADO', FACTURA_EMITIDA: 'FACTURA_EMITIDA' },
  send: sendMock,
}));
vi.mock('../services/fel.service', () => ({
  anulateFelInvoice: vi.fn(),
  emitFelInvoice: emitFelInvoiceMock,
}));
vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: vi.fn(),
}));

import { createSale } from '../services/sale.service';

function saleInput() {
  return {
    idUsuario: 1,
    idCliente: 4,
    tipoRegistro: 'VENTA' as const,
    estadoEntrega: 'PENDIENTE' as const,
    condicionPago: 'CONTADO' as const,
    requiereFactura: true,
    nitFacturado: 'CF',
    nombreClienteFacturado: 'Cliente de prueba',
    detalle: [{ idInventarioItem: 9, cantidad: 1, precioUnitario: 10 }],
    pagoInicial: { monto: 10, metodoPago: 'EFECTIVO' as const },
  };
}

function activeClient() {
  return {
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: false,
    LimiteCredito: 0,
    Entidad: { NombreCompleto: 'Cliente de prueba', Nit: 'CF' },
  };
}

function createdSaleRow(felOverrides: Record<string, unknown> = {}) {
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
    RequiereFactura: true,
    AutorizacionFel: null,
    NumeroFel: null,
    SerieFel: null,
    QrFel: null,
    RutaPdfFel: null,
    FechaEmisionFel: null,
    NitFacturado: 'CF',
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
    Cliente: { Id: 4, Entidad: { NombreCompleto: 'Cliente de prueba', Nit: 'CF' } },
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
    ...felOverrides,
  };
}

describe('FEL emission integrity on createSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    prismaMock.cliente.findFirst.mockResolvedValue(activeClient());
    prismaMock.cajaSesion.findFirst.mockResolvedValue({ Id: 99 });
    prismaMock.venta.findUnique.mockResolvedValue(null); // sin solicitud previa (idempotencia)
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
    prismaMock.pagoVenta.create.mockResolvedValue({ Id: 2 });
    sendMock.mockResolvedValue({ ok: true });
  });

  it('rejects the sale when the provider returns a UUID already used by another sale', async () => {
    prismaMock.venta.findFirst
      .mockResolvedValueOnce(null) // getNextNumeroVenta
      .mockResolvedValueOnce({ Id: 99, NumeroVenta: 5 }); // assertFreshFelEmission: UUID ya en uso
    emitFelInvoiceMock.mockResolvedValueOnce({
      autorizacionFel: 'DUPLICADO-UUID-0000',
      numeroFel: '1',
      serieFel: 'SERIE',
      qrFel: 'https://example.test/qr',
      fechaEmisionFel: new Date(),
      rutaPdfFel: null,
    });

    await expect(createSale(saleInput())).rejects.toThrow(
      /ya asociado a la venta #5/,
    );

    expect(prismaMock.venta.update).not.toHaveBeenCalled();
  });

  it('rejects the sale when the certification date is far from the real operation time (stale/reused document)', async () => {
    prismaMock.venta.findFirst
      .mockResolvedValueOnce(null) // getNextNumeroVenta
      .mockResolvedValueOnce(null); // assertFreshFelEmission: ningún otro dueño del UUID
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30); // 30 días en el pasado
    emitFelInvoiceMock.mockResolvedValueOnce({
      autorizacionFel: 'UUID-UNICO-0001',
      numeroFel: '1',
      serieFel: 'SERIE',
      qrFel: 'https://example.test/qr',
      fechaEmisionFel: staleDate,
      rutaPdfFel: null,
    });

    await expect(createSale(saleInput())).rejects.toThrow(
      /parece un documento desactualizado o reutilizado/,
    );

    expect(prismaMock.venta.update).not.toHaveBeenCalled();
  });

  it('accepts a fresh, unique FEL emission and persists it', async () => {
    prismaMock.venta.findFirst
      .mockResolvedValueOnce(null) // getNextNumeroVenta
      .mockResolvedValueOnce(null) // assertFreshFelEmission: sin dueño previo del UUID
      .mockResolvedValueOnce(createdSaleRow({
        AutorizacionFel: 'UUID-UNICO-0002',
        NumeroFel: '1',
        SerieFel: 'SERIE',
      })); // getSaleByIdInternal al final
    emitFelInvoiceMock.mockResolvedValueOnce({
      autorizacionFel: 'UUID-UNICO-0002',
      numeroFel: '1',
      serieFel: 'SERIE',
      qrFel: 'https://example.test/qr',
      fechaEmisionFel: new Date(),
      rutaPdfFel: '/uploads/sales/fel/venta-7-SERIE-1-abc.pdf',
    });

    await createSale(saleInput());

    expect(prismaMock.venta.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: expect.objectContaining({
        AutorizacionFel: 'UUID-UNICO-0002',
        NumeroFel: '1',
        SerieFel: 'SERIE',
        RutaPdfFel: '/uploads/sales/fel/venta-7-SERIE-1-abc.pdf',
      }),
    });
  });
});
