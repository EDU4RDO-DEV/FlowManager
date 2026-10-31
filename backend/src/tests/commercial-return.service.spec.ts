import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  registerEnvaseBucketChangeMock,
  registerInventoryMovementMock,
  syncSaleReceivableAfterCommercialReturnMock,
} = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    devolucionComercial: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    devolucionComercialDetalle: { findMany: vi.fn() },
    usuario: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn() },
    rutaSesion: { findFirst: vi.fn() },
    despachoRuta: { findFirst: vi.fn() },
    devolucionRuta: { findFirst: vi.fn() },
    envaseClienteSaldo: { findFirst: vi.fn(), update: vi.fn() },
    movimientoEnvase: { create: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
  },
  registerEnvaseBucketChangeMock: vi.fn(),
  registerInventoryMovementMock: vi.fn(),
  syncSaleReceivableAfterCommercialReturnMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/inventory-movement.service', () => ({
  registerEnvaseBucketChange: registerEnvaseBucketChangeMock,
  registerInventoryMovement: registerInventoryMovementMock,
}));
vi.mock('../services/sale.service', () => ({
  syncSaleReceivableAfterCommercialReturn: syncSaleReceivableAfterCommercialReturnMock,
}));
vi.mock('../services/commission-accrual.service', () => ({
  accrueMonthlyCommissionsForSale: vi.fn().mockResolvedValue(undefined),
}));

import { createCommercialReturn } from '../services/commercial-return.service';

const input = {
  detalle: [{
    idDetalleVenta: 301,
    cantidad: 2,
    motivo: 'Producto devuelto por el cliente',
    condicionFisica: 'VENDIBLE' as const,
  }],
};

describe('commercial route returns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncSaleReceivableAfterCommercialReturnMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
    prismaMock.devolucionComercial.findUnique.mockResolvedValue(null);
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 12 });
    prismaMock.venta.findFirst.mockResolvedValue({
      Id: 90,
      IdCliente: 55,
      IdRutaSesion: 70,
      DetalleVenta: [{
        Id: 301,
        IdInventarioItem: 8,
        Cantidad: 5,
        InventarioItem: { EsEnvaseRetornable: false },
        Envases: [],
      }],
    });
    prismaMock.rutaSesion.findFirst.mockResolvedValue({ Estado: 'EN_CURSO' });
    prismaMock.despachoRuta.findFirst.mockResolvedValue({
      Detalles: [{ IdInventarioItem: 8 }],
    });
    prismaMock.devolucionRuta.findFirst.mockResolvedValue(null);
    prismaMock.devolucionComercialDetalle.findMany.mockResolvedValue([]);
    prismaMock.devolucionComercial.create.mockResolvedValue({ Id: 44, Detalles: [] });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValue(null);
    prismaMock.movimientoEnvase.create.mockResolvedValue({ Id: 71 });
    prismaMock.inventarioItem.findFirst.mockResolvedValue({ Id: 8, Existencia: 20 });
    registerEnvaseBucketChangeMock.mockResolvedValue(0);
    registerInventoryMovementMock.mockResolvedValue(undefined);
  });

  it('authorizes a route return and stores its idempotency key and source line', async () => {
    const result = await createCommercialReturn(90, 12, '7ed0ca2c-66a9-4b2a-b890-b09bab6f5a0f', input);

    expect(result.replayed).toBe(false);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.devolucionComercial.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        IdVenta: 90,
        IdUsuarioAutorizacion: 12,
        IdempotencyKey: '7ed0ca2c-66a9-4b2a-b890-b09bab6f5a0f',
        Detalles: {
          create: [expect.objectContaining({
            IdDetalleVenta: 301,
            Cantidad: 2,
            CondicionFisica: 'VENDIBLE',
          })],
        },
      }),
    }));
    expect(syncSaleReceivableAfterCommercialReturnMock).toHaveBeenCalledWith(
      prismaMock,
      90,
      12,
    );
  });

  it('keeps damaged quantities traceable without treating them as sellable', async () => {
    const damagedInput = {
      detalle: [{
        idDetalleVenta: 301,
        cantidad: 1,
        motivo: 'Envase quebrado',
        condicionFisica: 'DANADO' as const,
        ubicacionNoVendible: 'Compartimento segregado del vehículo',
      }],
    };

    await createCommercialReturn(90, 12, '7834aeb4-5f73-4425-82cc-bd1ab3a83a83', damagedInput);

    expect(prismaMock.devolucionComercial.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        Detalles: {
          create: [expect.objectContaining({
            CondicionFisica: 'DANADO',
            UbicacionNoVendible: 'Compartimento segregado del vehículo',
          })],
        },
      }),
    }));
  });

  it('restores a returned borrowed container to route custody exactly once', async () => {
    prismaMock.venta.findFirst.mockResolvedValueOnce({
      Id: 90,
      IdCliente: 55,
      IdRutaSesion: 70,
      DetalleVenta: [{
        Id: 301,
        IdInventarioItem: 8,
        Cantidad: 2,
        EstadoEnvase: 'LLENO',
        InventarioItem: { EsEnvaseRetornable: true },
        Envases: [{
          Id: 600,
          IdInventarioItemEnvase: 8,
          Modo: 'PRESTAMO_EMPRESA',
          Cantidad: 2,
        }],
      }],
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce({
      Id: 33,
      CantidadPrestada: 2,
    });

    await createCommercialReturn(90, 12, '8e71e2a8-ef5c-481d-b53f-d2ad2acbe801', input);

    expect(prismaMock.envaseClienteSaldo.update).toHaveBeenCalledWith({
      where: { Id: 33 },
      data: { CantidadPrestada: 0, FechaActualizacion: expect.any(Date) },
    });
    expect(prismaMock.movimientoEnvase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        TipoMovimiento: 'DEVOLUCION',
        IdRutaSesion: 70,
        IdVenta: 90,
        IdDetalleVentaEnvase: 600,
        SaldoAnterior: 2,
        SaldoNuevo: 0,
      }),
    }));
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledTimes(1);
    expect(registerEnvaseBucketChangeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bucket: { ubicacion: 'RUTA', estado: 'LLENO', idRutaSesion: 70 },
        entrada: true,
        tipoDocumento: 'DEVCOM',
      }),
    );
  });

  it('returns a sellable plant-sale item to plant stock with one inventory movement', async () => {
    prismaMock.venta.findFirst.mockResolvedValueOnce({
      Id: 90,
      IdCliente: 55,
      IdRutaSesion: null,
      DetalleVenta: [{
        Id: 301,
        IdInventarioItem: 8,
        Cantidad: 5,
        EstadoEnvase: null,
        InventarioItem: { EsEnvaseRetornable: false, Existencia: 20, Nombre: 'Producto' },
        Envases: [],
      }],
    });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 8, Existencia: 20 });

    await createCommercialReturn(90, 12, '9f6b6d6f-d15b-4c0f-b832-3d5fc4cb0bfd', input);

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 8 },
      data: { Existencia: 22 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledTimes(1);
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipoDocumento: 'DEVCOM',
        tipoMovimiento: true,
        existenciaAnterior: 20,
        cantidad: 2,
        nuevaExistencia: 22,
      }),
    );
  });

  it('rejects returned quantities above the remaining quantity sold', async () => {
    prismaMock.devolucionComercialDetalle.findMany.mockResolvedValue([
      { IdDetalleVenta: 301, Cantidad: 4 },
    ]);

    await expect(
      createCommercialReturn(90, 12, 'e15bdfb5-9957-42d4-b72f-faf373e3854e', input),
    ).rejects.toThrow('La cantidad devuelta supera la cantidad vendida');
    expect(prismaMock.devolucionComercial.create).not.toHaveBeenCalled();
  });

  it('returns the original record for an identical idempotent retry and rejects key reuse with new data', async () => {
    prismaMock.devolucionComercial.create.mockResolvedValueOnce({ Id: 44, Detalles: [] });
    const key = '4d7a219f-5b64-407d-8fb7-6162e0d59803';

    const first = await createCommercialReturn(90, 12, key, input);
    expect(first).toEqual({ data: { Id: 44, Detalles: [] }, replayed: false });

    const payloadHash = prismaMock.devolucionComercial.create.mock.calls[0]?.[0].data.PayloadHash;
    prismaMock.devolucionComercial.findUnique.mockResolvedValueOnce({
      Id: 44,
      PayloadHash: payloadHash,
      Detalles: [],
    });
    await expect(createCommercialReturn(90, 12, key, input)).resolves.toEqual({
      data: { Id: 44, PayloadHash: payloadHash, Detalles: [] },
      replayed: true,
    });

    prismaMock.devolucionComercial.findUnique.mockResolvedValueOnce({
      Id: 44,
      PayloadHash: payloadHash,
      Detalles: [],
    });
    await expect(createCommercialReturn(90, 12, key, {
      detalle: [{ ...input.detalle[0], cantidad: 1 }],
    })).rejects.toThrow('Idempotency-Key ya fue usado con datos diferentes');
    expect(prismaMock.devolucionComercial.create).toHaveBeenCalledTimes(1);
  });

  it('rejects commercial returns after the physical route receipt starts', async () => {
    prismaMock.devolucionRuta.findFirst.mockResolvedValueOnce({ Id: 99 });

    await expect(
      createCommercialReturn(90, 12, 'b866ea50-f739-4ec5-996f-15a00a30e080', input),
    ).rejects.toThrow('No se pueden registrar devoluciones comerciales después');
  });
});
