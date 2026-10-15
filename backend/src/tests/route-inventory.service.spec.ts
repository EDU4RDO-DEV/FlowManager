import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rutaSesion: { findFirst: vi.fn() },
    despachoRuta: { findUnique: vi.fn(), create: vi.fn() },
    devolucionRuta: { create: vi.fn(), findUnique: vi.fn() },
    reservaProforma: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    devolucionComercialDetalle: { findMany: vi.fn().mockResolvedValue([]) },
    inventarioItem: { findMany: vi.fn(), update: vi.fn() },
    bitacoraInventario: { create: vi.fn() },
    ajusteRuta: { create: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  assertRouteCanClose,
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  getRouteInventory,
  getRouteSettlement,
  transferVerifiedRouteReturnToPlant,
} from '../services/route-inventory.service';

function routeInventory(overrides: Record<string, unknown> = {}) {
  return {
    Id: 40,
    Estado: 'EN_CURSO',
    DespachoRuta: {
      Id: 90,
      Detalles: [{
        IdInventarioItem: 7,
        NombreSnapshot: 'Agua 5 galones',
        UnidadMedidaSnapshot: 'garrafón',
        Cantidad: 8,
      }],
    },
    DevolucionRuta: null,
    AjustesRuta: [],
    Venta: [],
    MovimientosEnvaseCliente: [],
    ...overrides,
  };
}

describe('route inventory lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('confirms a dispatch, decreases plant stock, and writes an auditable movement atomically', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', Venta: [] });
    prismaMock.despachoRuta.findUnique.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 20 },
    ]);
    prismaMock.despachoRuta.create.mockResolvedValueOnce({
      Id: 90,
      Detalles: [{ IdInventarioItem: 7, Cantidad: 6 }],
    });
    prismaMock.inventarioItem.update.mockResolvedValueOnce({});
    prismaMock.bitacoraInventario.create.mockResolvedValueOnce({});

    await createRouteDispatch(40, 12, {
      observaciones: 'Carga inicial',
      detalle: [{ idInventarioItem: 7, cantidad: 6 }],
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 14 },
    });
    expect(prismaMock.bitacoraInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        TipoDocumento: 'DES',
        Documento: '90',
        TipoMovimiento: false,
        ExistenciaAnterior: 20,
        Cantidad: 6,
        NuevaExistencia: 14,
      }),
    });
  });

  it('rejects dispatch beyond plant stock without creating movement records', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', Venta: [] });
    prismaMock.despachoRuta.findUnique.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 2 },
    ]);

    await expect(
      createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 3 }] }),
    ).rejects.toThrow('Stock insuficiente');

    expect(prismaMock.despachoRuta.create).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate dispatch or repeat its inventory movement on retry', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', Venta: [] });
    prismaMock.despachoRuta.findUnique.mockResolvedValueOnce({ Id: 90 });

    await expect(
      createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 6 }] }),
    ).rejects.toThrow('ya tiene un despacho');

    expect(prismaMock.despachoRuta.create).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('records verified route returns without moving stock to plant before closure', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{
        DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 1 }],
      }],
    }));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([{ Id: 7 }]);
    prismaMock.devolucionRuta.create.mockResolvedValueOnce({ Id: 92, Detalles: [] });

    await createRouteReturn(40, 12, {
      detalle: [{
        idInventarioItem: 7,
        cantidadRecibida: 5,
        cantidadDanada: 1,
        ubicacionDanada: 'Área no vendible de planta',
      }],
    });

    expect(prismaMock.devolucionRuta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Detalles: {
            create: [expect.objectContaining({ UbicacionDanada: 'Área no vendible de planta' })],
          },
        }),
      }),
    );
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('transfers only verified sellable return quantities to plant at route closure', async () => {
    prismaMock.devolucionRuta.findUnique.mockResolvedValueOnce({
      Id: 92,
      Detalles: [{
        IdInventarioItem: 7,
        CantidadRecibida: 5,
        CantidadDanada: 1,
      }],
    });
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', Existencia: 72 },
    ]);
    prismaMock.inventarioItem.update.mockResolvedValueOnce({});
    prismaMock.bitacoraInventario.create.mockResolvedValueOnce({});

    await transferVerifiedRouteReturnToPlant(prismaMock as never, 40, 15);

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 76 },
    });
    expect(prismaMock.bitacoraInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        TipoDocumento: 'DEV',
        Documento: '92',
        IdUsuario: 15,
        TipoMovimiento: true,
        Cantidad: 4,
        ExistenciaAnterior: 72,
        NuevaExistencia: 76,
      }),
    });
  });

  it('adds inspected sellable returns to truck availability while excluding damaged returns', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: {
        Id: 90,
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Agua 5 galones',
          UnidadMedidaSnapshot: 'garrafón',
          Cantidad: 10,
        }],
      },
      Venta: [{
        DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 4 }],
      }],
    }));
    prismaMock.devolucionComercialDetalle.findMany.mockResolvedValueOnce([
      {
        Cantidad: 1,
        CondicionFisica: 'VENDIBLE',
        DetalleVenta: { IdInventarioItem: 7 },
      },
      {
        Cantidad: 1,
        CondicionFisica: 'DANADO',
        DetalleVenta: { IdInventarioItem: 7 },
      },
    ]);

    const result = await getRouteInventory(40);

    expect(result.productos[0]).toMatchObject({
      despachado: 10,
      vendido: 4,
      devolucionComercial: 2,
      noVendibleComercial: 1,
      pendienteConciliacion: 8,
      disponible: 7,
    });
  });

  it('subtracts route container retirements from the remaining truck balance', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: {
        Id: 90,
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Garrafón',
          UnidadMedidaSnapshot: 'unidad',
          Cantidad: 10,
          EstadoEnvase: 'VACIO',
        }],
      },
      MovimientosEnvaseCliente: [{
        IdInventarioItem: 7,
        TipoMovimiento: 'BAJA',
        Cantidad: 2,
      }],
    }));

    const result = await getRouteInventory(40);

    expect(result.productos[0]).toMatchObject({ envaseBaja: 2, disponible: 8 });
  });

  it('rejects a return larger than the truck balance', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory());
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([{ Id: 7, Existencia: 72 }]);

    await expect(
      createRouteReturn(40, 12, {
        detalle: [{
          idInventarioItem: 7,
          cantidadRecibida: 9,
          cantidadDanada: 0,
        }],
      }),
    ).rejects.toThrow('Devolución superior');

    expect(prismaMock.devolucionRuta.create).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('records an empty physical receipt so a fully missing load can be reviewed and authorized', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory());
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([]);
    prismaMock.devolucionRuta.create.mockResolvedValueOnce({ Id: 93, Detalles: [] });

    await createRouteReturn(40, 12, { observaciones: 'No se recibió producto', detalle: [] });

    expect(prismaMock.devolucionRuta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ IdRutaSesion: 40, IdUsuario: 12, Detalles: { create: [] } }),
      include: { Detalles: true },
    });
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('records an authorized adjustment with the authenticated user and full pending amount', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: {
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 3, CantidadDanada: 0 }],
      },
    }));
    prismaMock.ajusteRuta.create.mockResolvedValueOnce({ Id: 33 });

    await createRouteAdjustment(40, 19, {
      idInventarioItem: 7,
      clasificacion: 'FALTANTE',
      cantidad: 2,
      motivo: 'Diferencia revisada con bodega',
    });

    expect(prismaMock.ajusteRuta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        IdRutaSesion: 40,
        IdInventarioItem: 7,
        IdUsuario: 19,
        Clasificacion: 'FALTANTE',
        Cantidad: 2,
      }),
    });
  });

  it('calculates current truck balance from route sales, returns, and approved adjustments', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 2 }] }],
      DevolucionRuta: {
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 3, CantidadDanada: 1 }],
      },
      AjustesRuta: [{ IdInventarioItem: 7, Cantidad: 1 }],
    }));

    const settlement = await getRouteSettlement(40);

    expect(settlement.productos[0]?.disponible).toBe(2);
  });

  it('prevents closing while a dispatched quantity remains unaccounted for', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: {
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 4, CantidadDanada: 0 }],
      },
    }));

    await expect(assertRouteCanClose(prismaMock as never, 40)).rejects.toThrow(
      'productos pendientes',
    );
  });

  it('allows closing only after sales and returned quantities reconcile to the dispatch', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: {
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 5, CantidadDanada: 1 }],
      },
    }));

    await expect(assertRouteCanClose(prismaMock as never, 40)).resolves.toBeUndefined();
  });
});
