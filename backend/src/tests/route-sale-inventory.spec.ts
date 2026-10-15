import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendMock, registerMovementMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    rutaSesion: { findFirst: vi.fn() },
    reservaProforma: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    devolucionComercialDetalle: { findMany: vi.fn().mockResolvedValue([]) },
    venta: { findFirst: vi.fn(), create: vi.fn() },
    detalleVenta: { create: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    reglaBonificacion: { findMany: vi.fn() },
    pagoVenta: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  sendMock: vi.fn(),
  registerMovementMock: vi.fn(),
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
  registerInventoryMovement: registerMovementMock,
}));

import { createSale } from '../services/sale.service';

function routeSession(available: number, hasReturn = false) {
  return {
    Id: 12,
    Estado: 'EN_CURSO',
    DespachoRuta: {
      Id: 80,
      Detalles: [{
        IdInventarioItem: 9,
        NombreSnapshot: 'Garrafón',
        UnidadMedidaSnapshot: 'unidad',
        Cantidad: available,
      }],
    },
    DevolucionRuta: hasReturn ? { Id: 91, Detalles: [] } : null,
    AjustesRuta: [],
    Venta: [],
  };
}

function saleRow() {
  return {
    Id: 7,
    IdCliente: 4,
    IdUsuario: 1,
    IdRutaSesion: 12,
    IdTalonario: null,
    NumeroVenta: 1,
    NumeroProForma: null,
    TipoRegistro: 'VENTA',
    EstadoEntrega: 'EN_RUTA',
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
    NombreClienteFacturado: 'Cliente',
    DireccionClienteFacturado: null,
    LugarEntrega: null,
    FechaEntregaEsperada: null,
    FechaRegistro: new Date(),
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Cliente: { Id: 4, Entidad: { NombreCompleto: 'Cliente', Nit: null } },
    Usuario: { Id: 1, Nombre: 'Operador', Correo: 'operador@example.test' },
    RutaSesion: {
      Id: 12,
      Estado: 'EN_CURSO',
      FechaSesion: new Date('2026-10-15T00:00:00.000Z'),
      Ruta: { Id: 2, Nombre: 'Centro' },
    },
    Talonario: null,
    DetalleVenta: [{
      Id: 3,
      IdVenta: 7,
      IdInventarioItem: 9,
      Nombre: 'Garrafón',
      Cantidad: 2,
      PrecioUnitario: 10,
      EsBonificacion: false,
      Anulado: false,
      InventarioItem: { Id: 9, Nombre: 'Garrafón', Categoria: 'PRODUCTO_TERMINADO', Existencia: 0 },
    }],
    PagoVenta: [{
      Id: 5,
      IdVenta: 7,
      IdUsuario: 1,
      Monto: 20,
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

function configureRouteSale(available: number, hasReturn = false) {
  prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
  prismaMock.cliente.findFirst.mockResolvedValueOnce({
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: false,
    Entidad: { NombreCompleto: 'Cliente', Nit: null },
  });
  prismaMock.rutaSesion.findFirst
    .mockResolvedValueOnce({ Id: 12, Estado: 'EN_CURSO' })
    .mockResolvedValueOnce(routeSession(available, hasReturn));
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
  );
  prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
  prismaMock.venta.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(saleRow());
  prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });
  prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
    Id: 9,
    Nombre: 'Garrafón',
    Existencia: 0,
    PrecioVenta: 10,
  });
}

describe('route sales inventory source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ ok: true });
  });

  const input = {
    idUsuario: 1,
    idCliente: 4,
    idRutaSesion: 12,
    tipoRegistro: 'VENTA' as const,
    estadoEntrega: 'EN_RUTA' as const,
    condicionPago: 'CONTADO' as const,
    requiereFactura: false,
    detalle: [{ idInventarioItem: 9, cantidad: 2, precioUnitario: 10 }],
    pagoInicial: { monto: 20, metodoPago: 'EFECTIVO' as const },
  };

  it('sells against truck stock without deducting plant stock a second time', async () => {
    configureRouteSale(5);

    const result = await createSale(input);

    expect(result.idRutaSesion).toBe(12);
    expect(prismaMock.venta.create).toHaveBeenCalledOnce();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(registerMovementMock).not.toHaveBeenCalled();
  });

  it('rejects a route sale that exceeds the remaining truck quantity', async () => {
    configureRouteSale(1);

    await expect(createSale(input)).rejects.toThrow('Existencia insuficiente en el vehículo');

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('rejects new route sales after the physical return was confirmed', async () => {
    configureRouteSale(5, true);

    await expect(createSale(input)).rejects.toThrow(
      'No se pueden registrar ventas después de confirmar la devolución',
    );

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
  });
});
