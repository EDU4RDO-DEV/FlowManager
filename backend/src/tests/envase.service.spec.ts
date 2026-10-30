import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  registerInventoryMovementMock,
  registerEnvaseBucketChangeMock,
  getEnvaseBucketQuantityMock,
  ensurePlantEnvaseBucketQuantityMock,
  recordEnvaseBucketCountMock,
  transferEnvaseBucketMock,
} = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    rutaSesion: { findFirst: vi.fn() },
    envaseClienteSaldo: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    movimientoEnvase: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bitacoraInventario: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  registerInventoryMovementMock: vi.fn(),
  registerEnvaseBucketChangeMock: vi.fn(),
  getEnvaseBucketQuantityMock: vi.fn().mockResolvedValue(100),
  ensurePlantEnvaseBucketQuantityMock: vi.fn(),
  recordEnvaseBucketCountMock: vi.fn(),
  transferEnvaseBucketMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  ensurePlantEnvaseBucketQuantity: ensurePlantEnvaseBucketQuantityMock,
  getEnvaseBucketQuantity: getEnvaseBucketQuantityMock,
  recordEnvaseBucketCount: recordEnvaseBucketCountMock,
  registerEnvaseBucketChange: registerEnvaseBucketChangeMock,
  registerInventoryMovement: registerInventoryMovementMock,
  transferEnvaseBucket: transferEnvaseBucketMock,
}));

import {
  anulateMovimientoEnvase,
  listEnvasePhysicalBalances,
  listEnvasePlantBucketBalances,
  reconcileEnvasePhysicalStock,
  registrarDevolucionEnvase,
  registrarBajaEnvase,
  registrarPerdidaEnvase,
  registrarPrestamoEnvase,
  registerEnvasePhysicalCount,
} from '../services/envase.service';

describe('Fase 5 - envases retornables (préstamo/devolución)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getEnvaseBucketQuantityMock.mockResolvedValue(100);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('registra un préstamo: descuenta existencia y aumenta el saldo del cliente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'PRODUCTO_TERMINADO',
      Existencia: 50,
      EsEnvaseRetornable: true,
    });
    ensurePlantEnvaseBucketQuantityMock.mockResolvedValueOnce(undefined);
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce(null);
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({
      Id: 10,
      IdInventarioItem: 5,
      IdCliente: 2,
      IdVenta: null,
      IdUsuario: 1,
      TipoMovimiento: 'PRESTAMO',
      Cantidad: 3,
      SaldoAnterior: 0,
      SaldoNuevo: 3,
      RutaFirma: null,
      Observaciones: null,
      FechaMovimiento: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await registrarPrestamoEnvase({
      idInventarioItem: 5,
      idCliente: 2,
      idUsuario: 1,
      cantidad: 3,
      estadoEnvase: 'LLENO',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(result.saldoNuevo).toBe(3);
    expect(prismaMock.envaseClienteSaldo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 3 }) }),
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 47 },
    });
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        bucket: { ubicacion: 'PLANTA', estado: 'LLENO' },
        cantidad: 3,
        entrada: false,
      }),
    );
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ tipoMovimiento: false, cantidad: 3 }),
    );
  });

  it('rechaza el préstamo si no hay stock suficiente en bodega', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'PRODUCTO_TERMINADO',
      Existencia: 1,
      EsEnvaseRetornable: true,
    });
    ensurePlantEnvaseBucketQuantityMock.mockRejectedValueOnce(
      new Error('Stock insuficiente de Garrafón 20L en el estado VACIO'),
    );

    await expect(
      registrarPrestamoEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 3 }),
    ).rejects.toThrowError('Stock insuficiente');
  });

  it('muestra el saldo físico por estado y ubicación usando el movimiento más reciente', async () => {
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([
      { IdInventarioItem: 5, EstadoEnvase: 'VACIO', NuevaExistencia: 4 },
      { IdInventarioItem: 5, EstadoEnvase: 'VACIO', NuevaExistencia: 2 },
      { IdInventarioItem: 5, EstadoEnvase: 'PENDIENTE_CONTEO', NuevaExistencia: 3 },
    ]);

    await expect(listEnvasePlantBucketBalances([5])).resolves.toEqual([
      { idInventarioItem: 5, estado: 'VACIO', cantidad: 4 },
      { idInventarioItem: 5, estado: 'PENDIENTE_CONTEO', cantidad: 3 },
    ]);
    expect(prismaMock.bitacoraInventario.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        IdInventarioItem: { in: [5] },
        UbicacionEnvase: 'PLANTA',
      }),
      orderBy: { Id: 'desc' },
    }));
  });

  it('expone stock legado del catálogo como pendiente de clasificación sin alterar la existencia', async () => {
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([]);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 5, Nombre: 'Garrafón 20L', Existencia: 8 },
    ]);

    await expect(listEnvasePhysicalBalances()).resolves.toEqual([
      {
        idInventarioItem: 5,
        nombre: 'Garrafón 20L',
        existenciaCatalogo: 8,
        ubicacion: 'PLANTA',
        estado: 'PENDIENTE_CONTEO',
        idRutaSesion: null,
        cantidad: 8,
        esSaldoLegadoPendiente: true,
      },
    ]);
  });

  it('does not count explicitly classified full and empty buckets as pending', async () => {
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([
      {
        Id: 3,
        IdInventarioItem: 5,
        UbicacionEnvase: 'PLANTA',
        EstadoEnvase: 'VACIO',
        IdRutaSesion: null,
        NuevaExistencia: 50,
        InventarioItem: { Nombre: 'Garrafón 18L', Existencia: 200 },
      },
      {
        Id: 2,
        IdInventarioItem: 5,
        UbicacionEnvase: 'PLANTA',
        EstadoEnvase: 'LLENO',
        IdRutaSesion: null,
        NuevaExistencia: 150,
        InventarioItem: { Nombre: 'Garrafón 18L', Existencia: 200 },
      },
    ]);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 5, Nombre: 'Garrafón 18L', Existencia: 200 },
    ]);

    await expect(listEnvasePhysicalBalances()).resolves.toEqual([
      expect.objectContaining({
        idInventarioItem: 5,
        ubicacion: 'PLANTA',
        estado: 'VACIO',
        cantidad: 50,
      }),
      expect.objectContaining({
        idInventarioItem: 5,
        ubicacion: 'PLANTA',
        estado: 'LLENO',
        cantidad: 150,
      }),
    ]);
  });

  it('clasifica stock legado en los buckets sin volver a sumarlo a la existencia de catálogo', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      EsEnvaseRetornable: true,
      Existencia: 200,
    });
    getEnvaseBucketQuantityMock
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await reconcileEnvasePhysicalStock({
      idInventarioItem: 5,
      idUsuario: 1,
      cantidadVacia: 50,
      cantidadLlena: 150,
      cantidadDanada: 0,
      observaciones: 'Conteo inicial confirmado',
    });

    expect(recordEnvaseBucketCountMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        cantidadContada: 200,
        tipoDocumento: 'ENVLG',
        bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
      }),
    );
    expect(transferEnvaseBucketMock).toHaveBeenCalledTimes(2);
    expect(transferEnvaseBucketMock).toHaveBeenNthCalledWith(
      1,
      prismaMock,
      expect.objectContaining({
        origen: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
        destino: { ubicacion: 'PLANTA', estado: 'VACIO' },
        cantidad: 50,
      }),
    );
    expect(transferEnvaseBucketMock).toHaveBeenNthCalledWith(
      2,
      prismaMock,
      expect.objectContaining({
        origen: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
        destino: { ubicacion: 'PLANTA', estado: 'LLENO' },
        cantidad: 150,
      }),
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 150 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        tipoDocumento: 'ENVCL',
        tipoMovimiento: false,
        existenciaAnterior: 200,
        cantidad: 50,
        nuevaExistencia: 150,
      }),
    );
  });

  it('requires explicit authorization when a physical count differs from recorded balances', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      EsEnvaseRetornable: true,
      Existencia: 8,
    });
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([]);
    getEnvaseBucketQuantityMock
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(registerEnvasePhysicalCount({
      idInventarioItem: 5,
      idUsuario: 1,
      ubicacionEnvase: 'PLANTA',
      cantidadVacia: 8,
      cantidadLlena: 0,
      cantidadDanada: 0,
      observaciones: 'Conteo inicial confirmado',
      autorizarRegularizacion: true,
    })).rejects.toThrow('El conteo difiere del saldo registrado; requiere regularización autorizada');

    expect(recordEnvaseBucketCountMock).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('allows a plant loan when legacy pending stock can be classified into its selected state', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'PRODUCTO_TERMINADO',
      Existencia: 20,
      EsEnvaseRetornable: true,
    });
    ensurePlantEnvaseBucketQuantityMock.mockResolvedValueOnce(undefined);
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce(null);
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({
      Id: 18,
      IdInventarioItem: 5,
      IdCliente: 2,
      IdVenta: null,
      IdUsuario: 1,
      TipoMovimiento: 'PRESTAMO',
      EstadoEnvase: 'VACIO',
      UbicacionEnvase: 'PLANTA',
      IdRutaSesion: null,
      Cantidad: 2,
      SaldoAnterior: 0,
      SaldoNuevo: 2,
      RutaFirma: null,
      Observaciones: null,
      FechaMovimiento: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    await registrarPrestamoEnvase({
      idInventarioItem: 5,
      idCliente: 2,
      idUsuario: 1,
      cantidad: 2,
      estadoEnvase: 'VACIO',
    });

    expect(ensurePlantEnvaseBucketQuantityMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ estado: 'VACIO', cantidad: 2 }),
    );
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        bucket: { ubicacion: 'PLANTA', estado: 'VACIO' },
        cantidad: 2,
        entrada: false,
      }),
    );
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('rechaza el préstamo si el producto no está marcado como retornable', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Resina',
      Categoria: 'PRODUCTO_TERMINADO',
      Existencia: 100,
      EsEnvaseRetornable: false,
    });

    await expect(
      registrarPrestamoEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 3 }),
    ).rejects.toThrowError('El InventarioItem indicado no es un envase retornable');
  });

  it('rechaza la devolución si la cantidad excede el saldo prestado', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'PRODUCTO_TERMINADO',
      Existencia: 10,
      EsEnvaseRetornable: true,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce({ Id: 9, CantidadPrestada: 2 });

    await expect(
      registrarDevolucionEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 5 }),
    ).rejects.toThrowError('La cantidad devuelta no puede ser mayor al saldo prestado');
  });

  it('al anular un préstamo, revierte el saldo del cliente y regresa el stock a bodega', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.movimientoEnvase.findFirst.mockResolvedValueOnce({
      Id: 10,
      IdCliente: 2,
      IdInventarioItem: 5,
      IdDetalleVentaEnvase: null,
      TipoMovimiento: 'PRESTAMO',
      EstadoEnvase: null,
      UbicacionEnvase: null,
      IdRutaSesion: null,
      Cantidad: 3,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValue({ Id: 9, CantidadPrestada: 3 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Existencia: 47 });
    prismaMock.bitacoraInventario.findFirst.mockResolvedValueOnce({ Id: 99 });

    await anulateMovimientoEnvase(10, 9);

    expect(prismaMock.envaseClienteSaldo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 0 }) }),
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 50 },
    });
    expect(prismaMock.movimientoEnvase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { Id: 10 }, data: expect.objectContaining({ Anulado: true }) }),
    );
  });

  it('registra una pérdida de cliente como salida de custodia sin sumar stock físico', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Existencia: 10,
      EsEnvaseRetornable: true,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce({ Id: 9, CantidadPrestada: 3 });
    prismaMock.envaseClienteSaldo.update.mockResolvedValueOnce({});
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({
      Id: 11,
      IdInventarioItem: 5,
      IdCliente: 2,
      IdVenta: null,
      IdUsuario: 1,
      TipoMovimiento: 'PERDIDA',
      EstadoEnvase: null,
      UbicacionEnvase: null,
      IdRutaSesion: null,
      Cantidad: 1,
      SaldoAnterior: 3,
      SaldoNuevo: 2,
      RutaFirma: null,
      Observaciones: 'No devuelto',
      FechaMovimiento: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await registrarPerdidaEnvase({
      idInventarioItem: 5,
      idCliente: 2,
      idUsuario: 1,
      cantidad: 1,
      observaciones: 'No devuelto',
    });

    expect(result.tipoMovimiento).toBe('PERDIDA');
    expect(prismaMock.envaseClienteSaldo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 2 }) }),
    );
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(registerEnvaseBucketChangeMock).not.toHaveBeenCalled();
  });

  it('da de baja un envase vacío de planta sin modificar las existencias vendibles', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Existencia: 10,
      EsEnvaseRetornable: true,
    });
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({
      Id: 12,
      IdInventarioItem: 5,
      IdCliente: null,
      IdVenta: null,
      IdUsuario: 1,
      TipoMovimiento: 'BAJA',
      EstadoEnvase: 'VACIO',
      UbicacionEnvase: 'PLANTA',
      IdRutaSesion: null,
      Cantidad: 1,
      SaldoAnterior: 0,
      SaldoNuevo: 0,
      RutaFirma: null,
      Observaciones: 'Roto',
      FechaMovimiento: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    await registrarBajaEnvase({
      idInventarioItem: 5,
      idUsuario: 1,
      cantidad: 1,
      estadoEnvase: 'VACIO',
      ubicacionEnvase: 'PLANTA',
      observaciones: 'Envase roto',
    });

    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ entrada: false, cantidad: 1 }),
    );
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
    expect(registerInventoryMovementMock).not.toHaveBeenCalled();
  });

  it('reintenta un conteo físico con la misma clave sin crear registros duplicados', async () => {
    const observaciones = 'Conteo de apertura 2026';
    const claveMovimiento = 'c49a2af0-218c-4f23-9b4b-2cc38979ab83';
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Existencia: 10,
      EsEnvaseRetornable: true,
    });
    getEnvaseBucketQuantityMock.mockResolvedValueOnce(0);
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([
      {
        IdInventarioItem: 5,
        IdUsuario: 1,
        UbicacionEnvase: 'PLANTA',
        EstadoEnvase: 'VACIO',
        IdRutaSesion: null,
        NuevaExistencia: 10,
        Nombre: `Conteo físico PLANTA/VACIO: ${observaciones}`,
      },
      {
        IdInventarioItem: 5,
        IdUsuario: 1,
        UbicacionEnvase: 'PLANTA',
        EstadoEnvase: 'LLENO',
        IdRutaSesion: null,
        NuevaExistencia: 0,
        Nombre: `Conteo físico PLANTA/LLENO: ${observaciones}`,
      },
      {
        IdInventarioItem: 5,
        IdUsuario: 1,
        UbicacionEnvase: 'PLANTA',
        EstadoEnvase: 'PENDIENTE_CONTEO',
        IdRutaSesion: null,
        NuevaExistencia: 0,
        Nombre: `Conteo físico PLANTA/PENDIENTE_CONTEO: ${observaciones}`,
      },
    ]);

    await registerEnvasePhysicalCount({
      idInventarioItem: 5,
      idUsuario: 1,
      ubicacionEnvase: 'PLANTA',
      cantidadVacia: 10,
      cantidadLlena: 0,
      cantidadDanada: 0,
      observaciones,
      claveMovimiento,
    });

    expect(prismaMock.bitacoraInventario.create).not.toHaveBeenCalled();
    expect(recordEnvaseBucketCountMock).not.toHaveBeenCalled();
    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });
});
