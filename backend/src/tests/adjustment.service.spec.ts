import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
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
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  anulateInventoryMovementByReference: vi.fn(),
  registerInventoryMovement: vi.fn(),
  restoreInventoryMovementByReference: vi.fn(),
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
});
