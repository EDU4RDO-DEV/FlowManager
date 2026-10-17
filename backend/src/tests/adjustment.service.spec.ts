import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, registerInventoryMovementMock } = vi.hoisted(() => ({
  prismaMock: {
    ajusteInventario: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bitacoraInventario: {
      findMany: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
    inventarioItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  registerInventoryMovementMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: registerInventoryMovementMock,
}));

import {
  createAdjustment,
  deleteAdjustment,
  deleteAdjustmentOperation,
  getAdjustmentOperation,
  listAdjustmentOperations,
  restoreAdjustment,
  restoreAdjustmentOperation,
} from '../services/adjustment.service';

describe('adjustment.service business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('deleteAdjustment fails when adjustment does not exist', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce(null);

    await expect(deleteAdjustment(88)).rejects.toThrowError('Ajuste de inventario no existe');
  });

  it('restoreAdjustment fails when anulated adjustment does not exist', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce(null);

    await expect(restoreAdjustment(101)).rejects.toThrowError('Ajuste anulado no existe');
  });

  it('lists adjustment lines grouped into one operation and summarizes mixed types', async () => {
    prismaMock.ajusteInventario.groupBy
      .mockResolvedValueOnce([{ NumeroAjuste: 500 }])
      .mockResolvedValueOnce([{ NumeroAjuste: 500 }])
      .mockResolvedValueOnce([
        { NumeroAjuste: 500, TipoAjuste: 'ENTRADA', Anulado: false },
        { NumeroAjuste: 500, TipoAjuste: 'SALIDA', Anulado: false },
        { NumeroAjuste: 500, TipoAjuste: 'ENTRADA', Anulado: true },
      ]);
    prismaMock.ajusteInventario.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdInventarioItem: 20,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        NumeroAjuste: 500,
        CantidadAjustada: 5,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: {
          Id: 20,
          Nombre: 'Resina',
          Categoria: 'MATERIA_PRIMA',
          Existencia: 15,
          Anulado: false,
        },
        Usuario: { Id: 4, Nombre: 'Operador' },
      },
      {
        Id: 2,
        IdInventarioItem: 21,
        IdUsuario: 4,
        TipoAjuste: 'SALIDA',
        NumeroAjuste: 500,
        CantidadAjustada: 2,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: {
          Id: 21,
          Nombre: 'Pigmento',
          Categoria: 'INSUMO',
          Existencia: 10,
          Anulado: false,
        },
        Usuario: { Id: 4, Nombre: 'Operador' },
      },
      {
        Id: 3,
        IdInventarioItem: 22,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        NumeroAjuste: 500,
        CantidadAjustada: 1,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: true,
        IdUsuarioAnulador: 4,
        FechaAnulacion: new Date('2026-08-16T01:00:00.000Z'),
        InventarioItem: {
          Id: 22,
          Nombre: 'Empaque',
          Categoria: 'INSUMO',
          Existencia: 4,
          Anulado: false,
        },
        Usuario: { Id: 4, Nombre: 'Operador' },
      },
    ]);

    const result = await listAdjustmentOperations({ anulado: false });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      numeroAjuste: 500,
      tipoAjuste: 'MIXTO',
      tiposAjuste: ['ENTRADA', 'SALIDA'],
      estado: 'PARCIAL',
      totalProductos: 3,
      responsable: 'Operador',
    });
    expect(result.pagination.total).toBe(1);
    expect(result.summary).toMatchObject({
      total: 1,
      active: 1,
      entradas: 1,
      salidas: 1,
      mixtos: 1,
      anulados: 1,
    });
  });

  it('returns adjustment detail with original stock snapshots from the inventory log', async () => {
    prismaMock.ajusteInventario.findMany.mockResolvedValueOnce([
      {
        Id: 101,
        IdInventarioItem: 20,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        NumeroAjuste: 500,
        CantidadAjustada: 5,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: {
          Id: 20,
          Nombre: 'Resina',
          Categoria: 'MATERIA_PRIMA',
          Existencia: 15,
          Anulado: false,
        },
        Usuario: { Id: 4, Nombre: 'Operador' },
      },
    ]);
    prismaMock.bitacoraInventario.findMany.mockResolvedValueOnce([
      {
        Documento: '101',
        ExistenciaAnterior: 10,
        NuevaExistencia: 15,
      },
    ]);

    const operation = await getAdjustmentOperation(500);

    expect(operation.items[0]).toMatchObject({
      id: 101,
      existenciaAnterior: 10,
      existenciaResultante: 15,
    });
  });

  it('anulates every line of an operation within one serializable transaction', async () => {
    prismaMock.ajusteInventario.findMany.mockResolvedValueOnce([
      {
        Id: 201,
        IdInventarioItem: 20,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        CantidadAjustada: 5,
      },
      {
        Id: 202,
        IdInventarioItem: 21,
        IdUsuario: 4,
        TipoAjuste: 'SALIDA',
        CantidadAjustada: 2,
      },
    ]);
    prismaMock.inventarioItem.findUnique
      .mockResolvedValueOnce({ Id: 20, Nombre: 'Resina', Existencia: 15, EsEnvaseRetornable: false })
      .mockResolvedValueOnce({ Id: 21, Nombre: 'Pigmento', Existencia: 10, EsEnvaseRetornable: false });

    await deleteAdjustmentOperation(500);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.ajusteInventario.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(1, {
      where: { Id: 20 },
      data: { Existencia: 10 },
    });
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(2, {
      where: { Id: 21 },
      data: { Existencia: 12 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledTimes(2);
  });

  it('restores every anulled line of an operation in one transaction', async () => {
    prismaMock.ajusteInventario.findMany.mockResolvedValueOnce([
      {
        Id: 401,
        IdInventarioItem: 20,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        CantidadAjustada: 5,
      },
      {
        Id: 402,
        IdInventarioItem: 21,
        IdUsuario: 4,
        TipoAjuste: 'SALIDA',
        CantidadAjustada: 2,
      },
    ]);
    prismaMock.inventarioItem.findUnique
      .mockResolvedValueOnce({ Id: 20, Nombre: 'Resina', Existencia: 10, EsEnvaseRetornable: false })
      .mockResolvedValueOnce({ Id: 21, Nombre: 'Pigmento', Existencia: 12, EsEnvaseRetornable: false });

    await restoreAdjustmentOperation(500);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.ajusteInventario.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(1, {
      where: { Id: 20 },
      data: { Existencia: 15 },
    });
    expect(prismaMock.inventarioItem.update).toHaveBeenNthCalledWith(2, {
      where: { Id: 21 },
      data: { Existencia: 10 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledTimes(2);
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ tipoDocumento: 'AJRE' }),
    );
  });

  it('creates multiple adjustment lines with the same generated operation number', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 4 });
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce({ NumeroAjuste: 12 });
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 20, Existencia: 10, EsEnvaseRetornable: false },
      { Id: 21, Existencia: 8, EsEnvaseRetornable: false },
    ]);
    prismaMock.ajusteInventario.create
      .mockResolvedValueOnce({
        Id: 301,
        IdInventarioItem: 20,
        IdUsuario: 4,
        TipoAjuste: 'ENTRADA',
        NumeroAjuste: 13,
        CantidadAjustada: 2,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: {
          Id: 20,
          Nombre: 'Resina',
          Categoria: 'MATERIA_PRIMA',
          Existencia: 10,
          Anulado: false,
        },
      })
      .mockResolvedValueOnce({
        Id: 302,
        IdInventarioItem: 21,
        IdUsuario: 4,
        TipoAjuste: 'SALIDA',
        NumeroAjuste: 13,
        CantidadAjustada: 1,
        NombreAjuste: 'AJUSTE POR CONTEO',
        Observacion: 'Conteo físico de almacén',
        FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: {
          Id: 21,
          Nombre: 'Pigmento',
          Categoria: 'INSUMO',
          Existencia: 8,
          Anulado: false,
        },
      });

    const result = await createAdjustment({
      idUsuario: 4,
      nombreAjuste: 'AJUSTE POR CONTEO',
      observacion: 'Conteo físico de almacén',
      items: [
        { idInventarioItem: 20, tipoAjuste: 'ENTRADA', cantidadAjustada: 2 },
        { idInventarioItem: 21, tipoAjuste: 'SALIDA', cantidadAjustada: 1 },
      ],
    });

    expect(prismaMock.ajusteInventario.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.ajusteInventario.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ NumeroAjuste: 13 }) }),
    );
    expect(prismaMock.ajusteInventario.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ NumeroAjuste: 13 }) }),
    );
    expect(result).toMatchObject({ numeroAjuste: 13, totalItems: 2 });
    expect(result.items.map((item) => item.numeroAjuste)).toEqual([13, 13]);
    expect(registerInventoryMovementMock).toHaveBeenCalledTimes(2);
  });

  it('deleteAdjustment validates auditing user before stock operations', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce({
      Id: 88,
      IdInventarioItem: 20,
      TipoAjuste: 'ENTRADA',
      CantidadAjustada: 5,
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null);

    await expect(deleteAdjustment(88, 999)).rejects.toThrowError('Usuario no existe');
    expect(prismaMock.inventarioItem.findUnique).not.toHaveBeenCalled();
  });

  it('deleteAdjustment reverts stock and anulates bitacora reference', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce({
      Id: 88,
      IdInventarioItem: 20,
      IdUsuario: 4,
      TipoAjuste: 'ENTRADA',
      CantidadAjustada: 5,
    });
    prismaMock.inventarioItem.findUnique.mockResolvedValueOnce({ Id: 20, Nombre: 'Resina', Existencia: 15 });

    const tx = {
      ajusteInventario: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 88,
          IdInventarioItem: 20,
          IdUsuario: 4,
          TipoAjuste: 'ENTRADA',
          CantidadAjustada: 5,
        }),
        update: vi.fn().mockResolvedValue({ Id: 88 }),
      },
      inventarioItem: {
        findUnique: vi.fn().mockResolvedValue({ Id: 20, Nombre: 'Resina', Existencia: 15 }),
        update: vi.fn().mockResolvedValue({ Id: 20 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    await deleteAdjustment(88);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 20 },
      data: { Existencia: 10 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tipoDocumento: 'AJAN',
        documento: '88',
        existenciaAnterior: 15,
        cantidad: 5,
        nuevaExistencia: 10,
      }),
    );
  });

  it('restoreAdjustment reapplies stock and restores bitacora reference', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce({
      Id: 101,
      IdInventarioItem: 20,
      IdUsuario: 1,
      TipoAjuste: 'ENTRADA',
      CantidadAjustada: 5,
      NumeroAjuste: 500,
    });
    prismaMock.inventarioItem.findUnique.mockResolvedValueOnce({ Id: 20, Nombre: 'Resina', Existencia: 10 });

    const tx = {
      ajusteInventario: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 101,
          IdInventarioItem: 20,
          IdUsuario: 1,
          TipoAjuste: 'ENTRADA',
          CantidadAjustada: 5,
          NumeroAjuste: 500,
        }),
        update: vi.fn().mockResolvedValue({
          Id: 101,
          IdInventarioItem: 20,
          IdUsuario: 1,
          TipoAjuste: 'ENTRADA',
          NumeroAjuste: 500,
          CantidadAjustada: 5,
          Observacion: 'Ajuste',
          FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
          InventarioItem: {
            Id: 20,
            Nombre: 'Resina',
            Categoria: 'MATERIA_PRIMA',
            Existencia: 15,
            Anulado: false,
          },
        }),
      },
      inventarioItem: {
        findUnique: vi.fn().mockResolvedValue({ Id: 20, Nombre: 'Resina', Existencia: 10 }),
        update: vi.fn().mockResolvedValue({ Id: 20 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    const restored = await restoreAdjustment(101);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 20 },
      data: { Existencia: 15 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tipoDocumento: 'AJRE',
        documento: '101',
        existenciaAnterior: 10,
        cantidad: 5,
        nuevaExistencia: 15,
      }),
    );
    expect(restored.anulado).toBe(false);
    expect(restored.id).toBe(101);
  });
});
