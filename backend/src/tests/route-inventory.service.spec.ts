import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rutaSesion: { findFirst: vi.fn() },
    despachoRuta: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    devolucionRuta: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    reservaProforma: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    devolucionComercialDetalle: { findMany: vi.fn().mockResolvedValue([]) },
    inventarioItem: { findMany: vi.fn(), update: vi.fn() },
    bitacoraInventario: { create: vi.fn(), findFirst: vi.fn() },
    ajusteRuta: { create: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  assertRouteCanClose,
  cancelRouteDispatch,
  cancelRouteReturn,
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  getRouteInventory,
  getRouteAvailableQuantities,
  getRouteSettlement,
  transferVerifiedRouteReturnToPlant,
} from '../services/route-inventory.service';

function routeInventory(overrides: Record<string, unknown> = {}) {
  return {
    Id: 40,
    Estado: 'EN_CURSO',
    DespachoRuta: [{
      Id: 90,
      Detalles: [{
        IdInventarioItem: 7,
        NombreSnapshot: 'Agua 5 galones',
        UnidadMedidaSnapshot: 'garrafón',
        Cantidad: 8,
      }],
    }],
    DevolucionRuta: [],
    AjustesRuta: [],
    Venta: [],
    MovimientosEnvaseCliente: [],
    TransferenciasOrigen: [],
    TransferenciasDestino: [],
    ...overrides,
  };
}

function mockPhysicalBuckets(initial: Record<string, number>) {
  const buckets = new Map(Object.entries(initial));
  prismaMock.bitacoraInventario.findFirst.mockImplementation(async (input: {
    where: {
      IdInventarioItem: number;
      UbicacionEnvase: string;
      EstadoEnvase: string;
      IdRutaSesion: number | null;
    };
  }) => {
    const { IdInventarioItem, UbicacionEnvase, EstadoEnvase, IdRutaSesion } = input.where;
    const key = `${IdInventarioItem}|${UbicacionEnvase}|${EstadoEnvase}|${IdRutaSesion ?? ''}`;
    return { NuevaExistencia: buckets.get(key) ?? 0 };
  });
  prismaMock.bitacoraInventario.create.mockImplementation(async (input: {
    data: {
      IdInventarioItem: number;
      UbicacionEnvase?: string;
      EstadoEnvase?: string;
      IdRutaSesion?: number | null;
      NuevaExistencia: number;
    };
  }) => {
    const { IdInventarioItem, UbicacionEnvase, EstadoEnvase, IdRutaSesion, NuevaExistencia } = input.data;
    if (UbicacionEnvase && EstadoEnvase) {
      const key = `${IdInventarioItem}|${UbicacionEnvase}|${EstadoEnvase}|${IdRutaSesion ?? ''}`;
      buckets.set(key, NuevaExistencia);
    }
    return {};
  });
  return buckets;
}

describe('route inventory lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.bitacoraInventario.findFirst.mockReset();
    prismaMock.bitacoraInventario.create.mockReset();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('confirms a dispatch, decreases plant stock, and writes an auditable movement atomically', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.despachoRuta.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 20, EsVendible: true },
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
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.despachoRuta.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 2, EsVendible: true },
    ]);

    await expect(
      createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 3 }] }),
    ).rejects.toThrow('Stock insuficiente');

    expect(prismaMock.despachoRuta.create).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('uses an explicitly selected state to classify legacy pending stock during dispatch', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.despachoRuta.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      {
        Id: 7,
        Nombre: 'Garrafón 20 galones',
        UnidadMedida: 'garrafón',
        Existencia: 20,
        EsVendible: true,
        EsEnvaseRetornable: true,
      },
    ]);
    const buckets = mockPhysicalBuckets({
      '7|PLANTA|VACIO|': 1,
      '7|PLANTA|PENDIENTE_CONTEO|': 5,
    });
    prismaMock.despachoRuta.create.mockResolvedValueOnce({
      Id: 90,
      Detalles: [{ IdInventarioItem: 7, Cantidad: 3 }],
    });

    await createRouteDispatch(40, 12, {
      detalle: [{ idInventarioItem: 7, cantidad: 3, estadoEnvase: 'VACIO' }],
    });

    expect(buckets.get('7|PLANTA|VACIO|')).toBe(0);
    expect(buckets.get('7|PLANTA|PENDIENTE_CONTEO|')).toBe(3);
    expect(buckets.get('7|RUTA|VACIO|40')).toBe(3);
    expect(prismaMock.despachoRuta.create).toHaveBeenCalledOnce();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('dispatching 20 full returnable products from 200 leaves 180 full at plant and 20 in route', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.despachoRuta.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([{
      Id: 7,
      Nombre: 'Garrafón',
      UnidadMedida: 'unidad',
      Existencia: 200,
      EsVendible: true,
      EsEnvaseRetornable: true,
    }]);
    const buckets = mockPhysicalBuckets({ '7|PLANTA|LLENO|': 200 });
    prismaMock.despachoRuta.create.mockResolvedValueOnce({
      Id: 90,
      Detalles: [{ IdInventarioItem: 7, Cantidad: 20, EstadoEnvase: 'LLENO' }],
    });

    await createRouteDispatch(40, 12, {
      detalle: [{ idInventarioItem: 7, cantidad: 20, estadoEnvase: 'LLENO' }],
    });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 180 },
    });
    expect(buckets.get('7|PLANTA|LLENO|')).toBe(180);
    expect(buckets.get('7|RUTA|LLENO|40')).toBe(20);
  });

  it('rejects non-sellable products before creating a dispatch or changing plant stock', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.despachoRuta.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Materia prima', Existencia: 20, EsVendible: false },
    ]);

    await expect(
      createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 6 }] }),
    ).rejects.toThrow('no está habilitado para la venta');

    expect(prismaMock.despachoRuta.create).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('allows a second dispatch on the same session (reabastecimiento) when there is no active devolución', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO', DevolucionRuta: [] });
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 20, EsVendible: true },
    ]);
    prismaMock.despachoRuta.create.mockResolvedValueOnce({
      Id: 91,
      Detalles: [{ IdInventarioItem: 7, Cantidad: 6 }],
    });

    await createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 6 }] });

    expect(prismaMock.despachoRuta.create).toHaveBeenCalledOnce();
    // El bloqueo histórico por "despacho ya confirmado" ya no existe (T-F2-DIST-02):
    // ahora se permiten varios despachos activos por sesión para soportar reabastecimiento.
    expect(prismaMock.despachoRuta.findFirst).not.toHaveBeenCalled();
  });

  it('allows a new dispatch after a devolución was already registered (D-DIST-06 reabastecimiento)', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 40, Estado: 'EN_CURSO' });
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', UnidadMedida: 'garrafón', Existencia: 20, EsVendible: true },
    ]);
    prismaMock.despachoRuta.create.mockResolvedValueOnce({
      Id: 92,
      Detalles: [{ IdInventarioItem: 7, Cantidad: 6 }],
    });

    await createRouteDispatch(40, 12, { detalle: [{ idInventarioItem: 7, cantidad: 6 }] });

    expect(prismaMock.despachoRuta.create).toHaveBeenCalledOnce();
  });

  it('reverses and audits a dispatch cancellation before any downstream route operation', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      Venta: [],
      DevolucionRuta: [],
      AjustesRuta: [],
      MovimientosEnvaseCliente: [],
      TransferenciasOrigen: [],
      TransferenciasDestino: [],
    });
    prismaMock.despachoRuta.findMany.mockResolvedValueOnce([{
      Id: 90,
      Detalles: [{
        IdInventarioItem: 7,
        Cantidad: 20,
        EstadoEnvase: 'LLENO',
      }],
    }]);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([{
      Id: 7,
      Nombre: 'Garrafón',
      Existencia: 180,
      EsEnvaseRetornable: true,
    }]);
    prismaMock.inventarioItem.update.mockResolvedValueOnce({});
    prismaMock.despachoRuta.update.mockResolvedValueOnce({});
    const buckets = mockPhysicalBuckets({
      '7|RUTA|LLENO|40': 20,
      '7|PLANTA|LLENO|': 180,
    });

    await expect(cancelRouteDispatch(40, 12, 'Estado capturado incorrectamente')).resolves.toEqual({
      idDespacho: 90,
      anulada: true,
    });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 200 },
    });
    expect(prismaMock.bitacoraInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        TipoDocumento: 'ANU',
        Documento: '90',
        TipoMovimiento: true,
        ExistenciaAnterior: 180,
        Cantidad: 20,
        NuevaExistencia: 200,
      }),
    });
    expect(buckets.get('7|RUTA|LLENO|40')).toBe(0);
    expect(buckets.get('7|PLANTA|LLENO|')).toBe(200);
    expect(prismaMock.despachoRuta.update).toHaveBeenCalledWith({
      where: { Id: 90 },
      data: expect.objectContaining({
        Anulado: true,
        IdUsuarioAnulador: 12,
        MotivoAnulacion: 'Estado capturado incorrectamente',
      }),
    });
  });

  it('blocks dispatch cancellation after a sale without reversing stock', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      Venta: [{ Id: 23 }],
      DevolucionRuta: [],
      AjustesRuta: [],
      MovimientosEnvaseCliente: [],
      TransferenciasOrigen: [],
      TransferenciasDestino: [],
    });

    await expect(cancelRouteDispatch(40, 12, 'Corrección solicitada')).rejects.toThrow(
      'No se puede anular el despacho después de registrar ventas',
    );

    expect(prismaMock.despachoRuta.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(prismaMock.despachoRuta.update).not.toHaveBeenCalled();
  });

  it('annuls a route return with a reason while open and without dependent adjustments', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      AjustesRuta: [],
    });
    prismaMock.devolucionRuta.findMany.mockResolvedValueOnce([{ Id: 92 }]);
    prismaMock.devolucionRuta.update.mockResolvedValueOnce({});

    await expect(cancelRouteReturn(40, 12, 'Se clasificaron mal los envases')).resolves.toEqual({
      idDevolucion: 92,
      anulada: true,
    });

    expect(prismaMock.devolucionRuta.update).toHaveBeenCalledWith({
      where: { Id: 92 },
      data: expect.objectContaining({
        Anulado: true,
        IdUsuarioAnulador: 12,
        MotivoAnulacion: 'Se clasificaron mal los envases',
        FechaAnulacion: expect.any(Date),
      }),
    });
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
  });

  it('blocks route-return cancellation after closure or an authorized adjustment', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'CERRADA',
      AjustesRuta: [],
    });
    await expect(cancelRouteReturn(40, 12, 'Corrección')).rejects.toThrow('debe estar EN_CURSO');

    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      AjustesRuta: [{ Id: 93 }],
    });
    await expect(cancelRouteReturn(40, 12, 'Corrección')).rejects.toThrow(
      'No se puede anular la devolución después de autorizar diferencias',
    );
    expect(prismaMock.devolucionRuta.update).not.toHaveBeenCalled();
  });

  it('requires idDevolucion to disambiguate cancellation when several returns are active (D-DIST-06)', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      AjustesRuta: [],
    });
    prismaMock.devolucionRuta.findMany.mockResolvedValueOnce([{ Id: 92 }, { Id: 95 }]);

    await expect(cancelRouteReturn(40, 12, 'Corrección')).rejects.toThrow(
      'especifique idDevolucion a anular',
    );
    expect(prismaMock.devolucionRuta.update).not.toHaveBeenCalled();
  });

  it('cancels the explicitly selected devolución when several are active', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 40,
      Estado: 'EN_CURSO',
      AjustesRuta: [],
    });
    prismaMock.devolucionRuta.findMany.mockResolvedValueOnce([{ Id: 92 }, { Id: 95 }]);
    prismaMock.devolucionRuta.update.mockResolvedValueOnce({});

    await expect(cancelRouteReturn(40, 12, 'Corrección', 95)).resolves.toEqual({
      idDevolucion: 95,
      anulada: true,
    });
    expect(prismaMock.devolucionRuta.update).toHaveBeenCalledWith({
      where: { Id: 95 },
      data: expect.objectContaining({ Anulado: true }),
    });
  });

  it('allows registering a new devolución after a prior one, as long as the request fits the remaining pending balance (D-DIST-06)', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [
        { Id: 90, Detalles: [{ IdInventarioItem: 7, NombreSnapshot: 'Agua', UnidadMedidaSnapshot: 'u', Cantidad: 10 }] },
        { Id: 96, Detalles: [{ IdInventarioItem: 7, NombreSnapshot: 'Agua', UnidadMedidaSnapshot: 'u', Cantidad: 5 }] },
      ],
      DevolucionRuta: [{ Id: 92, Anulado: false, Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 4, CantidadDanada: 0 }] }],
    }));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([{ Id: 7, EsEnvaseRetornable: false }]);
    prismaMock.devolucionRuta.create.mockResolvedValueOnce({ Id: 97, Detalles: [] });

    // Pendiente real = 10 (desp1) + 5 (desp2 - reabastecimiento) - 4 (devolución previa) = 11.
    await createRouteReturn(40, 12, {
      detalle: [{ idInventarioItem: 7, cantidadRecibida: 11, cantidadDanada: 0, cantidadEnvaseVacio: 0, cantidadEnvaseLleno: 0 }],
    });

    expect(prismaMock.devolucionRuta.create).toHaveBeenCalledOnce();
  });

  it('excludes annulled receipts from truck balances and returns their audit history', async () => {
    const annulledAt = new Date('2026-10-23T10:00:00.000Z');
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DevolucionRuta: [{
        Id: 92,
        Anulado: true,
        FechaRegistro: new Date('2026-10-23T09:00:00.000Z'),
        FechaAnulacion: annulledAt,
        MotivoAnulacion: 'Clasificación incorrecta',
        UsuarioAnulador: { Id: 12, Nombre: 'Operador' },
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 5, CantidadDanada: 1 }],
      }],
    }));

    const inventory = await getRouteInventory(40);

    expect(inventory.devolucion).toBeNull();
    expect(inventory.productos[0]?.pendienteConciliacion).toBe(8);
    expect(inventory.devolucionesAnuladas).toEqual([{
      id: 92,
      fechaRegistro: new Date('2026-10-23T09:00:00.000Z'),
      fechaAnulacion: annulledAt,
      motivoAnulacion: 'Clasificación incorrecta',
      usuarioAnulador: { id: 12, nombre: 'Operador' },
    }]);
  });

  it('exposes every active despacho and devolución with their own Id for individual cancellation', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [
        { Id: 90, Observaciones: 'Carga inicial', FechaRegistro: new Date('2026-10-23T08:00:00.000Z'), Detalles: [{ IdInventarioItem: 7, NombreSnapshot: 'Agua', UnidadMedidaSnapshot: 'u', Cantidad: 8 }] },
        { Id: 96, Observaciones: 'Reabastecimiento', FechaRegistro: new Date('2026-10-23T12:00:00.000Z'), Detalles: [{ IdInventarioItem: 7, NombreSnapshot: 'Agua', UnidadMedidaSnapshot: 'u', Cantidad: 4 }] },
      ],
      DevolucionRuta: [
        { Id: 97, Anulado: false, Observaciones: 'Cierre del día', FechaRegistro: new Date('2026-10-23T18:00:00.000Z'), Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 1, CantidadDanada: 0 }] },
        { Id: 92, Anulado: false, Observaciones: 'Conteo intermedio', FechaRegistro: new Date('2026-10-23T09:00:00.000Z'), Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 2, CantidadDanada: 0 }] },
      ],
    }));

    const inventory = await getRouteInventory(40);

    expect(inventory.despachos).toEqual([
      { id: 90, observaciones: 'Carga inicial', fechaRegistro: new Date('2026-10-23T08:00:00.000Z') },
      { id: 96, observaciones: 'Reabastecimiento', fechaRegistro: new Date('2026-10-23T12:00:00.000Z') },
    ]);
    expect(inventory.devoluciones).toEqual([
      { id: 97, observaciones: 'Cierre del día', fechaRegistro: new Date('2026-10-23T18:00:00.000Z') },
      { id: 92, observaciones: 'Conteo intermedio', fechaRegistro: new Date('2026-10-23T09:00:00.000Z') },
    ]);
    // El campo singular "despacho"/"devolucion" sigue siendo el más reciente (metadata),
    // sin romper a los consumidores existentes que no usan las listas nuevas.
    expect(inventory.despacho?.id).toBe(96);
    expect(inventory.devolucion?.id).toBe(97);
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
    prismaMock.devolucionRuta.findMany.mockResolvedValue([{
      Id: 92,
      Detalles: [{
        IdInventarioItem: 7,
        CantidadRecibida: 5,
        CantidadDanada: 1,
      }],
    }]);
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

  it('accumulates sellable quantities from several active devoluciones for the same item at closure (D-DIST-06)', async () => {
    prismaMock.devolucionRuta.findMany.mockResolvedValue([
      { Id: 92, Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 4, CantidadDanada: 0 }] },
      { Id: 97, Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 3, CantidadDanada: 1 }] },
    ]);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 5 galones', Existencia: 70 },
    ]);
    prismaMock.inventarioItem.update
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    prismaMock.bitacoraInventario.create.mockResolvedValue({});

    await transferVerifiedRouteReturnToPlant(prismaMock as never, 40, 15);

    // Primera devolución: +4 (70 -> 74). Segunda: +2 vendible de 3 recibidos con 1 dañado (74 -> 76).
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(1, {
      where: { Id: 7 },
      data: { Existencia: 74 },
    });
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(2, {
      where: { Id: 7 },
      data: { Existencia: 76 },
    });
    expect(prismaMock.bitacoraInventario.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ Documento: '92', Cantidad: 4, ExistenciaAnterior: 70, NuevaExistencia: 74 }),
    });
    expect(prismaMock.bitacoraInventario.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ Documento: '97', Cantidad: 2, ExistenciaAnterior: 74, NuevaExistencia: 76 }),
    });
  });

  it('adds inspected sellable returns to truck availability while excluding damaged returns', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [{
        Id: 90,
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Agua 5 galones',
          UnidadMedidaSnapshot: 'garrafón',
          Cantidad: 10,
        }],
      }],
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

  it('aggregates a product dispatched in multiple container states without duplicating sales or damage', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [
        {
          Id: 90,
          Detalles: [{
            IdInventarioItem: 7,
            NombreSnapshot: 'Garrafón',
            UnidadMedidaSnapshot: 'unidad',
            Cantidad: 4,
            EstadoEnvase: 'VACIO',
          }],
        },
        {
          Id: 91,
          Detalles: [{
            IdInventarioItem: 7,
            NombreSnapshot: 'Garrafón',
            UnidadMedidaSnapshot: 'unidad',
            Cantidad: 6,
            EstadoEnvase: 'LLENO',
          }],
        },
      ],
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: [{
        Id: 92,
        Anulado: false,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 1, CantidadDanada: 1 }],
      }],
    }));

    const result = await getRouteInventory(40);

    expect(result.productos).toHaveLength(1);
    expect(result.productos[0]).toMatchObject({
      despachado: 10,
      vendido: 3,
      devuelto: 1,
      danado: 1,
      disponible: 6,
      esEnvaseRetornable: true,
    });
  });

  it('makes confirmed transfer-only inventory available for route sales', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [],
      TransferenciasDestino: [{
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Garrafón',
          UnidadMedidaSnapshot: 'unidad',
          Cantidad: 5,
          EstadoEnvase: 'LLENO',
        }],
      }],
    }));

    const available = await getRouteAvailableQuantities(prismaMock as never, 40);

    expect(available.get(7)).toBe(5);
  });

  it('accepts a route return against inventory received only through a confirmed transfer', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [],
      TransferenciasDestino: [{
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Agua 5 galones',
          UnidadMedidaSnapshot: 'garrafón',
          Cantidad: 5,
          EstadoEnvase: null,
        }],
      }],
    }));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, EsEnvaseRetornable: false },
    ]);
    prismaMock.devolucionRuta.create.mockResolvedValueOnce({ Id: 92, Detalles: [] });

    await createRouteReturn(40, 12, {
      detalle: [{
        idInventarioItem: 7,
        cantidadRecibida: 5,
        cantidadDanada: 0,
      }],
    });

    expect(prismaMock.devolucionRuta.create).toHaveBeenCalledOnce();
  });

  it('subtracts route container retirements from the remaining truck balance', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [{
        Id: 90,
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Garrafón',
          UnidadMedidaSnapshot: 'unidad',
          Cantidad: 10,
          EstadoEnvase: 'VACIO',
        }],
      }],
      MovimientosEnvaseCliente: [{
        IdInventarioItem: 7,
        TipoMovimiento: 'BAJA',
        Cantidad: 2,
      }],
    }));

    const result = await getRouteInventory(40);

    expect(result.productos[0]).toMatchObject({ envaseBaja: 2, disponible: 8 });
  });

  it('does not subtract a sale-linked company loan twice from route stock', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      DespachoRuta: [{
        Id: 90,
        Detalles: [{
          IdInventarioItem: 7,
          NombreSnapshot: 'Garrafón',
          UnidadMedidaSnapshot: 'unidad',
          Cantidad: 10,
          EstadoEnvase: 'LLENO',
        }],
      }],
      Venta: [{
        DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 5 }],
      }],
      MovimientosEnvaseCliente: [{
        IdInventarioItem: 7,
        TipoMovimiento: 'PRESTAMO',
        Cantidad: 5,
        IdDetalleVentaEnvase: 14,
      }],
    }));

    const result = await getRouteInventory(40);

    expect(result.productos[0]).toMatchObject({
      despachado: 10,
      vendido: 5,
      envasePrestado: 0,
      pendienteConciliacion: 5,
    });
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
      DevolucionRuta: [{
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 3, CantidadDanada: 0 }],
      }],
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
      DevolucionRuta: [{
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 3, CantidadDanada: 1 }],
      }],
      AjustesRuta: [{ IdInventarioItem: 7, Cantidad: 1 }],
    }));

    const settlement = await getRouteSettlement(40);

    expect(settlement.productos[0]?.disponible).toBe(2);
  });

  it('prevents closing while a dispatched quantity remains unaccounted for', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: [{
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 4, CantidadDanada: 0 }],
      }],
    }));

    await expect(assertRouteCanClose(prismaMock as never, 40)).rejects.toThrow(
      'productos pendientes',
    );
  });

  it('allows closing only after sales and returned quantities reconcile to the dispatch', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(routeInventory({
      Venta: [{ DetalleVenta: [{ IdInventarioItem: 7, Cantidad: 3 }] }],
      DevolucionRuta: [{
        Id: 92,
        Detalles: [{ IdInventarioItem: 7, CantidadRecibida: 5, CantidadDanada: 1 }],
      }],
    }));

    await expect(assertRouteCanClose(prismaMock as never, 40)).resolves.toBeUndefined();
  });
});
