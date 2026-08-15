import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
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
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: vi.fn(),
}));

import {
  anulatePurchase,
  restorePurchase,
  restorePurchaseExpense,
} from '../services/purchase.service';

describe('purchase.service business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restorePurchase fails when purchase is not anulated', async () => {
    prismaMock.compra.findFirst.mockResolvedValueOnce(null);

    await expect(restorePurchase(99)).rejects.toThrowError('Compra anulada no existe');
  });

  it('anulatePurchase fails when purchase does not exist', async () => {
    prismaMock.compra.findFirst.mockResolvedValueOnce(null);

    await expect(anulatePurchase(77, 1)).rejects.toThrowError('Compra no existe o ya está anulada');
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
});
