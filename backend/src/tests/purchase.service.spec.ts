import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, registerInventoryMovementMock } = vi.hoisted(() => ({
  prismaMock: {
    compra: {
      findFirst: vi.fn(),
    },
    detalleGasto: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
    proveedor: {
      findFirst: vi.fn(),
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
  anulatePurchase,
  createPurchase,
  restorePurchase,
  restorePurchaseExpense,
  updatePurchaseExpense,
} from '../services/purchase.service';

describe('purchase.service business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  function buildPurchaseAggregate(anulado: boolean) {
    return {
      Id: 10,
      IdProveedor: 2,
      IdUsuario: 4,
      NumeroCompra: 123,
      NumeroFactura: 'F-123',
      EsGasto: false,
      Observaciones: null,
      FechaFactura: new Date('2026-08-15T00:00:00.000Z'),
      FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: anulado,
      IdUsuarioAnulador: anulado ? 9 : null,
      FechaAnulacion: anulado ? new Date('2026-08-15T02:00:00.000Z') : null,
      Proveedor: {
        Id: 2,
        Nombre: 'Proveedor A',
        Anulado: false,
      },
      Usuario: {
        Id: 4,
        Nombre: 'Tester',
        Correo: 'tester@flow.com',
      },
      DetalleCompra: [
        {
          Id: 22,
          IdCompra: 10,
          IdInventarioItem: 7,
          Cantidad: 3,
          CostoUnitario: 12.5,
          FechaRegistro: new Date('2026-08-15T01:00:00.000Z'),
          Anulado: anulado,
          IdUsuarioAnulador: anulado ? 9 : null,
          FechaAnulacion: anulado ? new Date('2026-08-15T02:00:00.000Z') : null,
          InventarioItem: {
            Id: 7,
            Nombre: 'Resina',
            Categoria: 'MATERIA_PRIMA',
            Existencia: anulado ? 10 : 13,
            Anulado: false,
          },
        },
      ],
      DetalleGasto: [],
    };
  }

  it('restorePurchase fails when purchase is not anulated', async () => {
    prismaMock.compra.findFirst.mockResolvedValueOnce(null);

    await expect(restorePurchase(99)).rejects.toThrowError('Compra anulada no existe');
  });

  it('anulatePurchase fails when purchase does not exist', async () => {
    prismaMock.compra.findFirst.mockResolvedValueOnce(null);

    await expect(anulatePurchase(77)).rejects.toThrowError('Compra no existe o ya está anulada');
  });

  it('restorePurchaseExpense fails when expense does not exist', async () => {
    prismaMock.detalleGasto.findFirst.mockResolvedValueOnce(null);

    await expect(restorePurchaseExpense(1, 55)).rejects.toThrowError('Detalle de gasto anulado no existe');
  });

  it('restorePurchaseExpense validates auditing user', async () => {
    prismaMock.detalleGasto.findFirst.mockResolvedValueOnce({ Id: 55 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null);

    await expect(restorePurchaseExpense(1, 55, 999)).rejects.toThrowError('Usuario no existe');
  });

  it('anulatePurchase applies stock reversal and marks records as anulated', async () => {
    const tx = {
      inventarioItem: {
        findFirst: vi.fn().mockResolvedValue({ Id: 7, Nombre: 'Resina', Existencia: 13 }),
        update: vi.fn().mockResolvedValue({ Id: 7 }),
      },
      detalleCompra: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      detalleGasto: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      compra: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 10,
          IdUsuario: 4,
          NumeroCompra: 123,
          EsGasto: false,
          DetalleCompra: [{ Id: 22, IdInventarioItem: 7, Cantidad: 3 }],
          DetalleGasto: [],
        }),
        update: vi.fn().mockResolvedValue({ Id: 10 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    await anulatePurchase(10);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 10 },
    });
    expect(tx.detalleCompra.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.compra.update).toHaveBeenCalledTimes(1);
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tipoDocumento: 'COMAN',
        tipoMovimiento: false,
        existenciaAnterior: 13,
        nuevaExistencia: 10,
      }),
    );
  });

  it('restorePurchase reapplies stock and clears anulation flags', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });

    const tx = {
      inventarioItem: {
        findFirst: vi.fn().mockResolvedValue({ Id: 7, Nombre: 'Resina', Existencia: 10 }),
        update: vi.fn().mockResolvedValue({ Id: 7 }),
      },
      detalleCompra: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      detalleGasto: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      compra: {
        update: vi.fn().mockResolvedValue({ Id: 10 }),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            Id: 10,
            IdUsuario: 4,
            NumeroCompra: 123,
            EsGasto: false,
            DetalleCompra: [{ Id: 22, IdInventarioItem: 7, Cantidad: 3 }],
            DetalleGasto: [],
          })
          .mockResolvedValueOnce(buildPurchaseAggregate(false)),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    const restored = await restorePurchase(10, 9);

    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 7 },
      data: { Existencia: 13 },
    });
    expect(tx.detalleCompra.updateMany).toHaveBeenCalledWith({
      where: { IdCompra: 10, Anulado: true },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
      },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tipoDocumento: 'COMRES',
        tipoMovimiento: true,
      }),
    );
    expect(restored.anulado).toBe(false);
    expect(restored.id).toBe(10);
  });

  it('createPurchase rechaza numeroFactura duplicada activa para el mismo proveedor', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.proveedor.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.compra.findFirst.mockResolvedValueOnce({ Id: 99 });

    await expect(
      createPurchase({
        idUsuario: 1,
        idProveedor: 2,
        numeroFactura: 'F-001',
        esGasto: false,
        fechaFactura: '2026-09-28',
        detalleCompra: [{ idInventarioItem: 7, cantidad: 1, costoUnitario: 10 }],
      }),
    ).rejects.toThrowError('Ya existe una compra activa con ese numeroFactura para este proveedor');

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('updatePurchaseExpense registra IdUsuarioModificador y FechaModificacion', async () => {
    prismaMock.detalleGasto.findFirst.mockResolvedValueOnce({ Id: 55 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.detalleGasto.update.mockResolvedValueOnce({
      Id: 55,
      IdCompra: 10,
      Descripcion: 'Combustible',
      Cantidad: 1,
      PrecioUnitario: 100,
      FechaRegistro: new Date('2026-09-01'),
      IdUsuarioModificador: 9,
      FechaModificacion: new Date('2026-09-28'),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await updatePurchaseExpense(10, 55, { precioUnitario: 100, idUsuarioModificador: 9 });

    expect(prismaMock.detalleGasto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdUsuarioModificador: 9 }),
      }),
    );
    expect(result.idUsuarioModificador).toBe(9);
  });
});
