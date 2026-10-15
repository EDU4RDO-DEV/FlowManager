import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    empleado: { findFirst: vi.fn() },
    ruta: { findFirst: vi.fn() },
    vehiculo: { findFirst: vi.fn(), update: vi.fn() },
    rutaSesion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { createRutaSesion, updateRutaSesion } from '../services/logistics.service';

describe('logistics vehicle reservation transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('checks availability and creates the session in a Serializable transaction', async () => {
    prismaMock.ruta.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.usuario.findFirst
      .mockResolvedValueOnce({ Id: 11 })
      .mockResolvedValueOnce({ Id: 12 });
    prismaMock.empleado.findFirst
      .mockResolvedValueOnce({ Id: 21 })
      .mockResolvedValueOnce({ Id: 22 });
    prismaMock.rutaSesion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.vehiculo.findFirst
      .mockResolvedValueOnce({ Id: 5, Estado: 'DISPONIBLE' })
      .mockResolvedValueOnce({ Estado: 'DISPONIBLE' });
    prismaMock.rutaSesion.create.mockResolvedValueOnce({
      Id: 70,
      IdRuta: 1,
      IdVehiculo: 5,
      IdUsuarioChofer: 11,
      IdUsuarioVendedor: 12,
      FechaSesion: new Date('2026-10-12T00:00:00.000Z'),
      KmInicial: null,
      KmFinal: null,
      Estado: 'PROGRAMADA',
      FechaRegistro: null,
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Ruta: { Id: 1, Nombre: 'Centro' },
      Vehiculo: { Id: 5, Placa: 'P123ABC', Marca: 'Toyota', Modelo: 'Hilux' },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        Id: 11,
        Nombre: 'Chofer',
        Correo: 'chofer@example.test',
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        Id: 12,
        Nombre: 'Vendedor',
        Correo: 'vendedor@example.test',
      },
    });
    prismaMock.vehiculo.update.mockResolvedValueOnce({});

    const result = await createRutaSesion({
      idRuta: 1,
      idVehiculo: 5,
      idUsuarioChofer: 11,
      idUsuarioVendedor: 12,
      fechaSesion: '2026-10-12',
      estado: 'PROGRAMADA',
    });

    expect(result.id).toBe(70);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.rutaSesion.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          IdVehiculo: 5,
          FechaSesion: new Date('2026-10-12T00:00:00.000Z'),
          Estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
        }),
      }),
    );
    expect(prismaMock.rutaSesion.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a conflicting reservation without creating another session', async () => {
    prismaMock.ruta.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.usuario.findFirst
      .mockResolvedValueOnce({ Id: 11 })
      .mockResolvedValueOnce({ Id: 12 });
    prismaMock.empleado.findFirst
      .mockResolvedValueOnce({ Id: 21 })
      .mockResolvedValueOnce({ Id: 22 });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 69 });

    await expect(
      createRutaSesion({
        idRuta: 1,
        idVehiculo: 5,
        idUsuarioChofer: 11,
        idUsuarioVendedor: 12,
        fechaSesion: '2026-10-12',
        estado: 'PROGRAMADA',
      }),
    ).rejects.toThrowError('Vehiculo no disponible para la fecha seleccionada');

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.rutaSesion.create).not.toHaveBeenCalled();
  });

  it('rejects a conflicting session update inside a Serializable transaction', async () => {
    prismaMock.rutaSesion.findFirst
      .mockResolvedValueOnce({
        Id: 70,
        IdRuta: 1,
        IdVehiculo: 5,
        IdUsuarioChofer: 11,
        IdUsuarioVendedor: 12,
        FechaSesion: new Date('2026-10-12T00:00:00.000Z'),
        KmInicial: null,
        KmFinal: null,
        Estado: 'PROGRAMADA',
        DespachoRuta: null,
        Venta: [],
      })
      .mockResolvedValueOnce({ Id: 71 });
    prismaMock.ruta.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.usuario.findFirst
      .mockResolvedValueOnce({ Id: 11 })
      .mockResolvedValueOnce({ Id: 12 });
    prismaMock.empleado.findFirst
      .mockResolvedValueOnce({ Id: 21 })
      .mockResolvedValueOnce({ Id: 22 });

    await expect(
      updateRutaSesion(70, {}),
    ).rejects.toThrowError('Vehiculo no disponible para la fecha seleccionada');

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.rutaSesion.update).not.toHaveBeenCalled();
  });

  it('blocks ordinary updates to a closed route session', async () => {
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 70,
      Estado: 'CERRADA',
      DespachoRuta: { Id: 80 },
      Venta: [],
    });

    await expect(updateRutaSesion(70, {})).rejects.toThrow('La sesión está cerrada y no admite modificaciones');
    expect(prismaMock.rutaSesion.update).not.toHaveBeenCalled();
  });
});
