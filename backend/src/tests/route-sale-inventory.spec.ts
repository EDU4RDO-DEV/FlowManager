import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  sendMock,
  registerMovementMock,
  getEnvaseBucketQuantityMock,
  registerEnvaseBucketChangeMock,
  transferEnvaseBucketMock,
  envaseBucketCounts,
} = vi.hoisted(() => {
  const envaseBucketCounts = new Map<string, number>();
  const bucketKey = (id: number, bucket: { ubicacion: string; estado: string; idRutaSesion?: number }) =>
    `${id}|${bucket.ubicacion}|${bucket.estado}|${bucket.idRutaSesion ?? ''}`;
  const transferEnvaseBucketMock = vi.fn(async (_tx, input: {
    idInventarioItem: number;
    origen: { ubicacion: string; estado: string; idRutaSesion?: number };
    destino: { ubicacion: string; estado: string; idRutaSesion?: number };
    cantidad: number;
  }) => {
    const from = bucketKey(input.idInventarioItem, input.origen);
    const to = bucketKey(input.idInventarioItem, input.destino);
    envaseBucketCounts.set(from, (envaseBucketCounts.get(from) ?? 0) - input.cantidad);
    envaseBucketCounts.set(to, (envaseBucketCounts.get(to) ?? 0) + input.cantidad);
  });
  return {
    prismaMock: {
      usuario: { findFirst: vi.fn() },
      cliente: { findFirst: vi.fn() },
      rutaSesion: { findFirst: vi.fn() },
      reservaProforma: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
      devolucionComercialDetalle: { findMany: vi.fn().mockResolvedValue([]) },
      venta: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
      detalleVenta: { create: vi.fn() },
      detalleVentaEnvase: { create: vi.fn() },
      movimientoEnvase: { create: vi.fn() },
      envaseClienteSaldo: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
      reglaBonificacion: { findMany: vi.fn() },
      pagoVenta: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    sendMock: vi.fn(),
    registerMovementMock: vi.fn(),
    getEnvaseBucketQuantityMock: vi.fn(async (_tx, id: number, bucket: { ubicacion: string; estado: string; idRutaSesion?: number }) =>
      envaseBucketCounts.get(bucketKey(id, bucket)) ?? 0),
    registerEnvaseBucketChangeMock: vi.fn(),
    transferEnvaseBucketMock,
    envaseBucketCounts,
  };
});

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
  getEnvaseBucketQuantity: getEnvaseBucketQuantityMock,
  registerEnvaseBucketChange: registerEnvaseBucketChangeMock,
  registerInventoryMovement: registerMovementMock,
  transferEnvaseBucket: transferEnvaseBucketMock,
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
    MovimientosEnvaseCliente: [],
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
      Envases: [],
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

function configureRouteSale(
  available: number,
  hasReturn = false,
  hasJarPresentation = false,
  proformaBeforeLoan = false,
) {
  prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
  prismaMock.cliente.findFirst.mockResolvedValueOnce({
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: false,
    Entidad: { NombreCompleto: 'Cliente', Nit: null },
  });
  prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 12, Estado: 'EN_CURSO' });
  if (!proformaBeforeLoan) {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeSession(available, hasReturn));
  }
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
  );
  prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
  prismaMock.venta.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValue(saleRow());
  prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });
  prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
    Id: 9,
    Nombre: 'Garrafón',
    Existencia: 0,
    PrecioVenta: 10,
    EsVendible: true,
    EsEnvaseRetornable: false,
    IdEnvasePresentacion: hasJarPresentation ? 20 : null,
    UnidadesEnvasePorUnidad: hasJarPresentation ? 1 : null,
  });
}

describe('route sales inventory source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envaseBucketCounts.clear();
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

  it('does not create a client loan while a route proforma is still unconfirmed', async () => {
    configureRouteSale(5, false, true, true);
    const proforma = {
      ...input,
      tipoRegistro: 'PROFORMA' as const,
      fechaExpiracionProforma: '2099-12-31T23:59:59.000Z',
      detalle: [{
        ...input.detalle[0],
        envases: [{
          idInventarioItemEnvase: 20,
          modo: 'PRESTAMO_EMPRESA' as const,
          cantidad: 2,
        }],
      }],
    };

    await expect(createSale(proforma)).rejects.toThrow(
      'No se pueden prestar envases hasta confirmar la proforma como venta',
    );

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.detalleVenta.create).not.toHaveBeenCalled();
  });

  it('fills a route jar at sale from empty truck stock before recording customer custody', async () => {
    configureRouteSale(5, false, true);
    envaseBucketCounts.set('20|RUTA|VACIO|12', 2);
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 20,
      Nombre: 'Garrafón retornable',
      Existencia: 0,
    });
    prismaMock.detalleVenta.create.mockResolvedValueOnce({ Id: 3 });
    prismaMock.detalleVentaEnvase.create.mockResolvedValueOnce({ Id: 40 });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce(null);
    prismaMock.envaseClienteSaldo.create.mockResolvedValueOnce({ Id: 50 });
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({ Id: 60 });
    const saleWithLoan = {
      ...input,
      detalle: [{
        ...input.detalle[0],
        envases: [{
          idInventarioItemEnvase: 20,
          modo: 'PRESTAMO_EMPRESA' as const,
          cantidad: 2,
        }],
      }],
    };

    await createSale(saleWithLoan);

    expect(transferEnvaseBucketMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        origen: { ubicacion: 'RUTA', estado: 'VACIO', idRutaSesion: 12 },
        destino: { ubicacion: 'RUTA', estado: 'LLENO', idRutaSesion: 12 },
        cantidad: 2,
      }),
    );
    expect(prismaMock.envaseClienteSaldo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 2 }) }),
    );
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ bucket: expect.objectContaining({ estado: 'LLENO' }), entrada: false }),
    );
  });

  it('does not move company containers when the customer supplies their own', async () => {
    configureRouteSale(5, false, true);
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 20,
      Nombre: 'Garrafón retornable',
      Existencia: 0,
    });
    prismaMock.detalleVenta.create.mockResolvedValueOnce({ Id: 3 });
    prismaMock.detalleVentaEnvase.create.mockResolvedValueOnce({ Id: 41 });
    const saleWithOwnContainer = {
      ...input,
      detalle: [{
        ...input.detalle[0],
        envases: [{
          idInventarioItemEnvase: 20,
          modo: 'CLIENTE_PROPIO' as const,
          cantidad: 2,
        }],
      }],
    };

    await createSale(saleWithOwnContainer);

    expect(prismaMock.detalleVentaEnvase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Modo: 'CLIENTE_PROPIO', Cantidad: 2 }) }),
    );
    expect(transferEnvaseBucketMock).not.toHaveBeenCalled();
    expect(registerEnvaseBucketChangeMock).not.toHaveBeenCalled();
    expect(prismaMock.envaseClienteSaldo.create).not.toHaveBeenCalled();
  });
});
