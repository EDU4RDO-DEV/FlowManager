import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const {
  cancelRouteDispatchMock,
  cancelRouteReturnMock,
  listProductsMock,
  listEnvasePlantBucketBalancesMock,
} = vi.hoisted(() => ({
  cancelRouteDispatchMock: vi.fn(),
  cancelRouteReturnMock: vi.fn(),
  listProductsMock: vi.fn(),
  listEnvasePlantBucketBalancesMock: vi.fn(),
}));

vi.mock('../services/route-inventory.service', () => ({
  cancelRouteDispatch: cancelRouteDispatchMock,
  cancelRouteReturn: cancelRouteReturnMock,
  createRouteAdjustment: vi.fn(),
  createRouteDispatch: vi.fn(),
  createRouteReturn: vi.fn(),
  getRouteInventory: vi.fn(),
  getRouteSettlement: vi.fn(),
}));

vi.mock('../services/envase.service', () => ({
  listEnvasePlantBucketBalances: listEnvasePlantBucketBalancesMock,
}));

vi.mock('../services/product.service', () => ({
  listProducts: listProductsMock,
}));

import {
  cancelRouteDispatchController,
  cancelRouteReturnController,
  listDispatchProductsController,
} from '../controllers/route-inventory.controller';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('dispatch products returnable stock comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication and records a dispatch cancellation reason', async () => {
    cancelRouteDispatchMock.mockResolvedValueOnce({ idDespacho: 90, anulada: true });
    const response = createResponse();

    await cancelRouteDispatchController(
      {
        auth: { userId: 12 },
        params: { id: '40' },
        body: { motivo: 'Estado capturado incorrectamente' },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(cancelRouteDispatchMock).toHaveBeenCalledWith(
      40,
      12,
      'Estado capturado incorrectamente',
      undefined,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { idDespacho: 90, anulada: true },
      message: 'Despacho anulado con reversión auditada; puede registrarse nuevamente',
    });
  });

  it('passes idDespacho through when disambiguating among several active dispatches', async () => {
    cancelRouteDispatchMock.mockResolvedValueOnce({ idDespacho: 91, anulada: true });
    const response = createResponse();

    await cancelRouteDispatchController(
      {
        auth: { userId: 12 },
        params: { id: '40' },
        body: { motivo: 'Corrección', idDespacho: 91 },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(cancelRouteDispatchMock).toHaveBeenCalledWith(40, 12, 'Corrección', 91);
  });

  it('records a route-return cancellation with its reason and authenticated user', async () => {
    cancelRouteReturnMock.mockResolvedValueOnce({ idDevolucion: 92, anulada: true });
    const response = createResponse();

    await cancelRouteReturnController(
      {
        auth: { userId: 12 },
        params: { id: '40' },
        body: { motivo: 'Se clasificaron mal los envases' },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(cancelRouteReturnMock).toHaveBeenCalledWith(40, 12, 'Se clasificaron mal los envases', undefined);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: { idDevolucion: 92, anulada: true },
      message: 'Devolución anulada con trazabilidad; puede registrarse nuevamente',
    });
  });

  it('compares sellable catalog stock to full containers, not all physical containers', async () => {
    listProductsMock.mockResolvedValueOnce({
      items: [{
        id: 47,
        existencia: 150,
        esEnvaseRetornable: true,
      }],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    listEnvasePlantBucketBalancesMock.mockResolvedValueOnce([
      { idInventarioItem: 47, estado: 'LLENO', cantidad: 150 },
      { idInventarioItem: 47, estado: 'VACIO', cantidad: 50 },
      { idInventarioItem: 47, estado: 'PENDIENTE_CONTEO', cantidad: 0 },
    ]);
    const response = createResponse();

    await listDispatchProductsController(
      { query: {} } as Request,
      response as unknown as Response,
    );

    expect(listProductsMock).toHaveBeenCalledWith({
      anulado: false,
      esVendible: true,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        items: [{
          id: 47,
          existencia: 150,
          esEnvaseRetornable: true,
          stockEnvasePlanta: {
            vacio: 50,
            lleno: 150,
            pendienteClasificacion: 0,
            diferenciaCatalogo: 0,
          },
        }],
      }),
    });
  });

  it('reports only excess full containers as exceeding sellable catalog stock', async () => {
    listProductsMock.mockResolvedValueOnce({
      items: [{ id: 47, existencia: 150, esEnvaseRetornable: true }],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    listEnvasePlantBucketBalancesMock.mockResolvedValueOnce([
      { idInventarioItem: 47, estado: 'LLENO', cantidad: 155 },
      { idInventarioItem: 47, estado: 'VACIO', cantidad: 50 },
    ]);
    const response = createResponse();

    await listDispatchProductsController(
      { query: {} } as Request,
      response as unknown as Response,
    );

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        items: [expect.objectContaining({
          stockEnvasePlanta: expect.objectContaining({
            diferenciaCatalogo: -5,
          }),
        })],
      }),
    }));
  });
});
