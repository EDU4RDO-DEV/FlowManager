import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    devolucionComercial: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    devolucionComercialDetalle: { findMany: vi.fn() },
    usuario: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn() },
    rutaSesion: { findFirst: vi.fn() },
    despachoRuta: { findUnique: vi.fn() },
    devolucionRuta: { findUnique: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

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
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
    prismaMock.devolucionComercial.findUnique.mockResolvedValue(null);
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 12 });
    prismaMock.venta.findFirst.mockResolvedValue({
      Id: 90,
      IdRutaSesion: 70,
      DetalleVenta: [{ Id: 301, IdInventarioItem: 8, Cantidad: 5 }],
    });
    prismaMock.rutaSesion.findFirst.mockResolvedValue({ Estado: 'EN_CURSO' });
    prismaMock.despachoRuta.findUnique.mockResolvedValue({
      Detalles: [{ IdInventarioItem: 8 }],
    });
    prismaMock.devolucionRuta.findUnique.mockResolvedValue(null);
    prismaMock.devolucionComercialDetalle.findMany.mockResolvedValue([]);
    prismaMock.devolucionComercial.create.mockResolvedValue({ Id: 44, Detalles: [] });
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
    prismaMock.devolucionRuta.findUnique.mockResolvedValueOnce({ Id: 99 });

    await expect(
      createCommercialReturn(90, 12, 'b866ea50-f739-4ec5-996f-15a00a30e080', input),
    ).rejects.toThrow('No se pueden registrar devoluciones comerciales después');
  });
});
