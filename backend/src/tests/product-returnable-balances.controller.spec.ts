import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const {
  listEnvaseClienteSaldosMock,
  listEnvasePhysicalBalancesMock,
} = vi.hoisted(() => ({
  listEnvaseClienteSaldosMock: vi.fn(),
  listEnvasePhysicalBalancesMock: vi.fn(),
}));

vi.mock('../services/product.service', () => ({
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductById: vi.fn(),
  listAnulatedProducts: vi.fn(),
  listProducts: vi.fn(),
  restoreProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock('../services/envase.service', () => ({
  listEnvaseClienteSaldos: listEnvaseClienteSaldosMock,
  listEnvasePhysicalBalances: listEnvasePhysicalBalancesMock,
}));

import { listReturnableInventoryBalancesController } from '../controllers/product.controller';

describe('product returnable inventory balances controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns physical buckets and customer custody from their recorded balances', async () => {
    const physical = [
      { idInventarioItem: 5, ubicacion: 'PLANTA', estado: 'LLENO', cantidad: 200 },
      { idInventarioItem: 5, ubicacion: 'RUTA', estado: 'LLENO', cantidad: 20 },
      { idInventarioItem: 5, ubicacion: 'RUTA', estado: 'DANADO', cantidad: 2 },
      { idInventarioItem: 5, ubicacion: 'CUARENTENA', estado: 'DANADO', cantidad: 4 },
      { idInventarioItem: 5, ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO', cantidad: 7 },
      { idInventarioItem: 6, ubicacion: 'PLANTA', estado: 'VACIO', cantidad: 47 },
    ];
    const customers = [{ idInventarioItem: 5, cantidadPrestada: 3 }];
    listEnvasePhysicalBalancesMock.mockResolvedValueOnce(physical);
    listEnvaseClienteSaldosMock.mockResolvedValueOnce(customers);

    const response = {
      status: vi.fn(),
      json: vi.fn(),
    };
    response.status.mockReturnValue(response);

    await listReturnableInventoryBalancesController(
      {} as Request,
      response as unknown as Response,
    );

    expect(listEnvasePhysicalBalancesMock).toHaveBeenCalledOnce();
    expect(listEnvaseClienteSaldosMock).toHaveBeenCalledWith({ soloConSaldo: true });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        items: [{
          idInventarioItem: 5,
          plantFull: 200,
          plantEmpty: 0,
          routeFull: 20,
          routeEmpty: 0,
          routeDamaged: 2,
          customers: 3,
          damaged: 6,
          pending: 7,
        }, {
          idInventarioItem: 6,
          plantFull: 0,
          plantEmpty: 47,
          routeFull: 0,
          routeEmpty: 0,
          routeDamaged: 0,
          customers: 0,
          damaged: 0,
          pending: 0,
        }],
      },
    });
  });

  it('returns an error instead of an empty balance when a source query fails', async () => {
    listEnvasePhysicalBalancesMock.mockRejectedValueOnce(new Error('Ledger unavailable'));
    listEnvaseClienteSaldosMock.mockResolvedValueOnce([]);

    const response = {
      status: vi.fn(),
      json: vi.fn(),
    };
    response.status.mockReturnValue(response);

    await listReturnableInventoryBalancesController(
      {} as Request,
      response as unknown as Response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      message: 'Ledger unavailable',
    });
  });
});
