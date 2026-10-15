import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  registerInventoryMovementMock,
  registerEnvaseBucketChangeMock,
  getEnvaseBucketQuantityMock,
  recordEnvaseBucketCountMock,
} = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    rutaSesion: { findFirst: vi.fn() },
    envaseClienteSaldo: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    movimientoEnvase: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bitacoraInventario: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  registerInventoryMovementMock: vi.fn(),
  registerEnvaseBucketChangeMock: vi.fn(),
  getEnvaseBucketQuantityMock: vi.fn().mockResolvedValue(100),
  recordEnvaseBucketCountMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  getEnvaseBucketQuantity: getEnvaseBucketQuantityMock,
  recordEnvaseBucketCount: recordEnvaseBucketCountMock,
  registerEnvaseBucketChange: registerEnvaseBucketChangeMock,
  registerInventoryMovement: registerInventoryMovementMock,
  transferEnvaseBucket: vi.fn(),
}));

import {
  anulateMovimientoEnvase,
  registrarDevolucionEnvase,
  registrarBajaEnvase,
  registrarPerdidaEnvase,
  registrarPrestamoEnvase,
  registerEnvasePhysicalCount,
} from '../services/envase.service';

describe('Fase 5 - envases retornables (préstamo/devolución)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      Categoria: 'ENVASE',
      Existencia: 50,
      EsEnvaseRetornable: true,
    });
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
      Categoria: 'ENVASE',
      Existencia: 1,
      EsEnvaseRetornable: true,
    });

    await expect(
      registrarPrestamoEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 3 }),
    ).rejects.toThrowError('Stock insuficiente');
  });

  it('rechaza el préstamo si el InventarioItem no es de categoría ENVASE', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Resina',
      Categoria: 'MATERIA_PRIMA',
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
      Categoria: 'ENVASE',
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
      TipoMovimiento: 'PRESTAMO',
      EstadoEnvase: null,
      UbicacionEnvase: null,
      IdRutaSesion: null,
      Cantidad: 3,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValue({ Id: 9, CantidadPrestada: 3 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Existencia: 47 });

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

  it('da de baja un envase de planta y descuenta una sola existencia física', async () => {
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
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 9 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledOnce();
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
