import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  anulateInventoryMovementByReferenceMock,
  restoreInventoryMovementByReferenceMock,
} = vi.hoisted(() => ({
  prismaMock: {
    ajusteInventario: {
      findFirst: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
    inventarioItem: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  anulateInventoryMovementByReferenceMock: vi.fn(),
  restoreInventoryMovementByReferenceMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  anulateInventoryMovementByReference: anulateInventoryMovementByReferenceMock,
  registerInventoryMovement: vi.fn(),
  restoreInventoryMovementByReference: restoreInventoryMovementByReferenceMock,
}));

import { deleteAdjustment, restoreAdjustment } from '../services/adjustment.service';

describe('adjustment.service business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteAdjustment fails when adjustment does not exist', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce(null);

    await expect(deleteAdjustment(88, 1)).rejects.toThrowError('Ajuste de inventario no existe');
  });

  it('restoreAdjustment fails when anulated adjustment does not exist', async () => {
    prismaMock.ajusteInventario.findFirst.mockResolvedValueOnce(null);

    await expect(restoreAdjustment(101, 1)).rejects.toThrowError('Ajuste anulado no existe');
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
      TipoAjuste: 'ENTRADA',
      CantidadAjustada: 5,
    });
    prismaMock.inventarioItem.findUnique.mockResolvedValueOnce({ Existencia: 15 });

    const tx = {
      ajusteInventario: {
        update: vi.fn().mockResolvedValue({ Id: 88 }),
      },
      inventarioItem: {
        update: vi.fn().mockResolvedValue({ Id: 20 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    await deleteAdjustment(88);

    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 20 },
      data: { Existencia: 10 },
    });
    expect(anulateInventoryMovementByReferenceMock).toHaveBeenCalledWith(
      tx,
      {
        tipoDocumento: 'AJ',
        documento: '88',
      },
      undefined,
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
    prismaMock.inventarioItem.findUnique.mockResolvedValueOnce({ Existencia: 10 });

    const tx = {
      ajusteInventario: {
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
        update: vi.fn().mockResolvedValue({ Id: 20 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    const restored = await restoreAdjustment(101);

    expect(tx.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 20 },
      data: { Existencia: 15 },
    });
    expect(restoreInventoryMovementByReferenceMock).toHaveBeenCalledWith(tx, {
      tipoDocumento: 'AJ',
      documento: '101',
    });
    expect(restored.anulado).toBe(false);
    expect(restored.id).toBe(101);
  });
});
