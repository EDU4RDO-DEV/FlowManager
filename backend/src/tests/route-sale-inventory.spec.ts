import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  sendMock,
  registerMovementMock,
  registerEnvaseBucketChangeMock,
  ensurePlantEnvaseBucketQuantityMock,
} = vi.hoisted(() => {
  return {
    prismaMock: {
      usuario: { findFirst: vi.fn() },
      cliente: { findFirst: vi.fn() },
      rutaSesion: { findFirst: vi.fn() },
      reservaProforma: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      devolucionComercialDetalle: { findMany: vi.fn().mockResolvedValue([]) },
      venta: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
      detalleVenta: { create: vi.fn() },
      detalleVentaEnvase: { create: vi.fn().mockResolvedValue({ Id: 12 }) },
      envaseClienteSaldo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      movimientoEnvase: { create: vi.fn().mockResolvedValue({ Id: 15 }) },
      inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
      reglaBonificacion: { findMany: vi.fn() },
      pagoVenta: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    sendMock: vi.fn(),
    registerMovementMock: vi.fn(),
    registerEnvaseBucketChangeMock: vi.fn(),
    ensurePlantEnvaseBucketQuantityMock: vi.fn(),
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
  ensurePlantEnvaseBucketQuantity: ensurePlantEnvaseBucketQuantityMock,
  registerEnvaseBucketChange: registerEnvaseBucketChangeMock,
  registerInventoryMovement: registerMovementMock,
}));

import { createSale } from '../services/sale.service';

function routeSession(available: number, hasReturn = false, returnedQuantity = 0) {
  return {
    Id: 12,
    Estado: 'EN_CURSO',
    DespachoRuta: [{
      Id: 80,
      Detalles: [{
        IdInventarioItem: 9,
        NombreSnapshot: 'Garrafón',
        UnidadMedidaSnapshot: 'unidad',
        Cantidad: available,
      }],
    }],
    DevolucionRuta: hasReturn
      ? [{
          Id: 91,
          Detalles: returnedQuantity > 0
            ? [{ IdInventarioItem: 9, CantidadRecibida: returnedQuantity, CantidadDanada: 0 }]
            : [],
        }]
      : [],
    AjustesRuta: [],
    MovimientosEnvaseCliente: [],
    Venta: [],
    TransferenciasOrigen: [],
    TransferenciasDestino: [],
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
  esEnvaseRetornable = false,
  esVendible = true,
  existencia = 0,
  returnedQuantity = 0,
) {
  prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
  prismaMock.cliente.findFirst.mockResolvedValueOnce({
    Id: 4,
    IdTipoCliente: null,
    HabilitadoCredito: false,
    Entidad: { NombreCompleto: 'Cliente', Nit: null },
  });
  prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 12, Estado: 'EN_CURSO' });
  prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeSession(available, hasReturn, returnedQuantity));
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
  );
  prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);
  prismaMock.venta.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValue(saleRow());
  prismaMock.venta.create.mockResolvedValueOnce({ Id: 7, NumeroVenta: 1 });
  prismaMock.detalleVenta.create.mockResolvedValueOnce({ Id: 3 });
  prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
    Id: 9,
    Nombre: 'Garrafón',
    Existencia: existencia,
    PrecioVenta: 10,
    EsVendible: esVendible,
    EsEnvaseRetornable: esEnvaseRetornable,
  });
}

describe('route sales inventory source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.rutaSesion.findFirst.mockReset();
    prismaMock.detalleVenta.create.mockReset();
    prismaMock.inventarioItem.findFirst.mockReset();
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

  it('classifies plant full-container stock before a sale consumes the scalar balance', async () => {
    configureRouteSale(5, false, true, true, 2);
    const directSale = {
      ...input,
      idRutaSesion: undefined,
      estadoEntrega: 'ENTREGADO' as const,
      detalle: [{
        idInventarioItem: 9,
        cantidad: 2,
        precioUnitario: 10,
        estadoEnvase: 'LLENO' as const,
        modoEnvase: 'CLIENTE_PROPIO' as const,
      }],
    };

    await createSale(directSale);

    expect(ensurePlantEnvaseBucketQuantityMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ estado: 'LLENO', cantidad: 2 }),
    );
    expect(ensurePlantEnvaseBucketQuantityMock.mock.invocationCallOrder[0])
      .toBeLessThan(prismaMock.inventarioItem.update.mock.invocationCallOrder[0]);
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 9 },
      data: { Existencia: 0 },
    });
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        bucket: { ubicacion: 'PLANTA', estado: 'LLENO' },
        cantidad: 2,
        entrada: false,
      }),
    );
  });

  it('rejects a route sale that exceeds the remaining truck quantity', async () => {
    configureRouteSale(1);

    await expect(createSale(input)).rejects.toThrow('Existencia insuficiente en el vehículo');

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('rejects a non-vendible item even when the sale request is sent directly to the API', async () => {
    configureRouteSale(5, false, false, false);

    await expect(createSale(input)).rejects.toThrow('no está habilitado para la venta');

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
  });

  it('allows a route sale even after a devolución was registered, as long as disponible remains (D-DIST-06)', async () => {
    // Reabastecimiento tras devolución: una devolución existe pero no afectó este producto,
    // así que el bloqueo histórico (bloquear toda venta por la mera existencia de una
    // devolución) ya no aplica.
    configureRouteSale(5, true);

    const result = await createSale(input);

    expect(result.idRutaSesion).toBe(12);
    expect(prismaMock.venta.create).toHaveBeenCalledOnce();
  });

  it('reduces disponible by what was actually returned, without blocking the remaining balance', async () => {
    // Despachado 5, devueltos 2 -> disponible real 3. La venta de 2 debe seguir funcionando.
    configureRouteSale(5, true, false, true, 0, 2);

    const result = await createSale(input);

    expect(result.idRutaSesion).toBe(12);
    expect(prismaMock.venta.create).toHaveBeenCalledOnce();
  });

  it('rejects a route sale that would exceed the balance remaining after a devolución', async () => {
    // Despachado 5, devueltos 4 -> disponible real 1. Vender 2 debe fallar.
    configureRouteSale(5, true, false, true, 0, 4);

    await expect(createSale(input)).rejects.toThrow('Existencia insuficiente en el vehículo');

    expect(prismaMock.venta.create).not.toHaveBeenCalled();
  });

  it('tracks a sold returnable product without depending on its category or a presentation field', async () => {
    configureRouteSale(5, false, true);
    const returnableSale = {
      ...input,
      detalle: [{
        ...input.detalle[0],
        estadoEnvase: 'LLENO' as const,
        modoEnvase: 'CLIENTE_PROPIO' as const,
      }],
    };

    await createSale(returnableSale);

    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        idInventarioItem: 9,
        bucket: expect.objectContaining({ estado: 'LLENO', ubicacion: 'RUTA' }),
        entrada: false,
      }),
    );
    expect(prismaMock.detalleVentaEnvase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Modo: 'CLIENTE_PROPIO' }) }),
    );
    expect(prismaMock.movimientoEnvase.create).not.toHaveBeenCalled();
  });

  it('registers company-owned container custody as part of the sale without a second stock movement', async () => {
    configureRouteSale(5, false, true);
    const returnableSale = {
      ...input,
      detalle: [{
        ...input.detalle[0],
        estadoEnvase: 'LLENO' as const,
        modoEnvase: 'PRESTAMO_EMPRESA' as const,
      }],
    };

    await createSale(returnableSale);

    expect(prismaMock.envaseClienteSaldo.create).toHaveBeenCalledWith({
      data: { IdCliente: 4, IdInventarioItem: 9, CantidadPrestada: 2 },
    });
    expect(prismaMock.movimientoEnvase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          IdVenta: 7,
          IdDetalleVentaEnvase: 12,
          IdRutaSesion: 12,
          TipoMovimiento: 'PRESTAMO',
          UbicacionEnvase: 'RUTA',
          Cantidad: 2,
        }),
      }),
    );
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledTimes(1);
  });

  it('does not move route stock for a reserved returnable item in a route proforma', async () => {
    configureRouteSale(5, false, true);
    const proformaInput = {
      ...input,
      tipoRegistro: 'PROFORMA' as const,
      fechaExpiracionProforma: new Date(Date.now() + 60_000).toISOString(),
      detalle: [{
        idInventarioItem: 9,
        cantidad: 2,
        precioUnitario: 10,
        estadoEnvase: 'LLENO' as const,
      }],
    };

    await createSale(proformaInput);

    expect(prismaMock.reservaProforma.create).toHaveBeenCalledOnce();
    expect(ensurePlantEnvaseBucketQuantityMock).not.toHaveBeenCalled();
    expect(registerEnvaseBucketChangeMock).not.toHaveBeenCalled();
    expect(prismaMock.detalleVentaEnvase.create).not.toHaveBeenCalled();
  });
});
