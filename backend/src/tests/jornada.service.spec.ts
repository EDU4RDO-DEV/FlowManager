import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    jornada: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    rutaSesion: { findMany: vi.fn() },
    transferenciaVehiculo: { findMany: vi.fn() },
    relevoVehiculo: { findMany: vi.fn() },
    usuario: { findFirst: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import { closeJornada, createJornada, getJornadaById, listJornadas } from '../services/jornada.service';

describe('jornada.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('creates an ABIERTA jornada for a given date', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.jornada.create.mockResolvedValueOnce({
      Id: 1,
      Fecha: new Date('2026-10-30T00:00:00.000Z'),
      Estado: 'ABIERTA',
      IdUsuarioResponsable: 3,
      Observaciones: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      RutaSesion: [],
    });

    const result = await createJornada({ fecha: '2026-10-30', idUsuarioResponsable: 3 });

    expect(result.estado).toBe('ABIERTA');
    expect(prismaMock.jornada.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Estado: 'ABIERTA', IdUsuarioResponsable: 3 }) }),
    );
  });

  it('lists jornadas with their non-annulled RutaSesion summaries', async () => {
    prismaMock.jornada.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        Fecha: new Date('2026-10-30T00:00:00.000Z'),
        Estado: 'ABIERTA',
        IdUsuarioResponsable: null,
        Observaciones: null,
        FechaRegistro: new Date(),
        IdUsuarioModificador: null,
        FechaModificacion: null,
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        RutaSesion: [
          { Id: 10, IdVehiculo: 2, IdUsuarioChofer: 5, IdUsuarioVendedor: 6, Estado: 'EN_CURSO', Anulado: false },
          { Id: 11, IdVehiculo: 3, IdUsuarioChofer: 7, IdUsuarioVendedor: 8, Estado: 'CERRADA', Anulado: true },
        ],
      },
    ]);

    const result = await listJornadas({});

    expect(result).toHaveLength(1);
    expect(result[0].rutaSesiones).toEqual([
      { id: 10, idVehiculo: 2, idUsuarioChofer: 5, idUsuarioVendedor: 6, estado: 'EN_CURSO' },
    ]);
  });

  it('limits a driver journey listing to assigned sessions and linked transfer or handoff sessions', async () => {
    prismaMock.rutaSesion.findMany
      .mockResolvedValueOnce([{ Id: 10 }])
      .mockResolvedValueOnce([{ Id: 10 }, { Id: 11 }, { Id: 12 }]);
    prismaMock.transferenciaVehiculo.findMany.mockResolvedValueOnce([
      { IdRutaSesionOrigen: 10, IdRutaSesionDestino: 11 },
    ]);
    prismaMock.relevoVehiculo.findMany.mockResolvedValueOnce([
      { IdRutaSesionSaliente: 10, IdRutaSesionEntrante: 12 },
    ]);
    prismaMock.jornada.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        Fecha: new Date('2026-10-30T00:00:00.000Z'),
        Estado: 'ABIERTA',
        IdUsuarioResponsable: null,
        Observaciones: null,
        FechaRegistro: new Date(),
        IdUsuarioModificador: null,
        FechaModificacion: null,
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        RutaSesion: [
          { Id: 10, IdVehiculo: 2, IdUsuarioChofer: 5, IdUsuarioVendedor: 6, Estado: 'EN_CURSO', Anulado: false },
          { Id: 11, IdVehiculo: 3, IdUsuarioChofer: 7, IdUsuarioVendedor: 8, Estado: 'EN_CURSO', Anulado: false },
          { Id: 12, IdVehiculo: 4, IdUsuarioChofer: 9, IdUsuarioVendedor: 10, Estado: 'EN_CURSO', Anulado: false },
          { Id: 13, IdVehiculo: 5, IdUsuarioChofer: 14, IdUsuarioVendedor: 15, Estado: 'EN_CURSO', Anulado: false },
        ],
      },
    ]);

    const result = await listJornadas({}, { userId: 5, roleName: 'Chofer' });

    expect(result[0].rutaSesiones.map((session) => session.id)).toEqual([10, 11, 12]);
    expect(prismaMock.rutaSesion.findMany).toHaveBeenLastCalledWith({
      where: { Id: { in: [10, 11, 12] }, Anulado: false },
      select: { Id: true },
    });
    expect(prismaMock.jornada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          RutaSesion: { some: { Id: { in: [10, 11, 12] }, Anulado: false } },
        }),
        include: {
          RutaSesion: expect.objectContaining({
            where: { Anulado: false, Id: { in: [10, 11, 12] } },
          }),
        },
      }),
    );
    expect(prismaMock.transferenciaVehiculo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          Anulado: false,
          EstadoConfirmacion: { in: ['PENDIENTE', 'CONFIRMADA'] },
        }),
      }),
    );
    expect(prismaMock.relevoVehiculo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ Anulado: false }) }),
    );
  });

  it('does not query journeys when the authenticated seller has no assigned sessions', async () => {
    prismaMock.rutaSesion.findMany.mockResolvedValueOnce([]);

    await expect(listJornadas({}, { userId: 34, roleName: 'Vendedor' })).resolves.toEqual([]);

    expect(prismaMock.jornada.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transferenciaVehiculo.findMany).not.toHaveBeenCalled();
  });

  it('does not return a journey with no sessions visible to the authenticated user', async () => {
    prismaMock.rutaSesion.findMany
      .mockResolvedValueOnce([{ Id: 10 }])
      .mockResolvedValueOnce([{ Id: 10 }]);
    prismaMock.transferenciaVehiculo.findMany.mockResolvedValueOnce([]);
    prismaMock.relevoVehiculo.findMany.mockResolvedValueOnce([]);
    prismaMock.jornada.findFirst.mockResolvedValueOnce(null);

    await expect(getJornadaById(99, { userId: 5, roleName: 'Chofer' })).rejects.toThrow('Jornada no existe');
    expect(prismaMock.jornada.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          Id: 99,
          Anulado: false,
          RutaSesion: { some: { Id: { in: [10] }, Anulado: false } },
        },
      }),
    );
  });

  it('assigns a created jornada to the authenticated seller instead of a submitted user id', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 17 });
    prismaMock.jornada.create.mockResolvedValueOnce({
      Id: 2,
      Fecha: new Date('2026-10-30T00:00:00.000Z'),
      Estado: 'ABIERTA',
      IdUsuarioResponsable: 17,
      Observaciones: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      RutaSesion: [],
    });

    await createJornada(
      { fecha: '2026-10-30', idUsuarioResponsable: 88 },
      { userId: 17, roleName: 'Vendedor' },
    );

    expect(prismaMock.jornada.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdUsuarioResponsable: 17 }),
      }),
    );
    expect(prismaMock.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ Id: 17 }) }),
    );
  });

  it('throws when the jornada does not exist', async () => {
    prismaMock.jornada.findFirst.mockResolvedValueOnce(null);
    await expect(getJornadaById(99)).rejects.toThrow('Jornada no existe');
  });

  it('closes a jornada only when every active RutaSesion is already CERRADA', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.jornada.findFirst.mockResolvedValueOnce({
      Id: 1,
      Estado: 'ABIERTA',
      RutaSesion: [{ Id: 10, Estado: 'CERRADA' }],
    });
    prismaMock.jornada.update.mockResolvedValueOnce({
      Id: 1,
      Fecha: new Date(),
      Estado: 'CERRADA',
      IdUsuarioResponsable: null,
      Observaciones: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: 3,
      FechaModificacion: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      RutaSesion: [],
    });

    const result = await closeJornada(1, 3);

    expect(result.estado).toBe('CERRADA');
  });

  it('blocks closing a jornada while a RutaSesion is still open', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.jornada.findFirst.mockResolvedValueOnce({
      Id: 1,
      Estado: 'ABIERTA',
      RutaSesion: [{ Id: 10, Estado: 'EN_CURSO' }],
    });

    await expect(closeJornada(1, 3)).rejects.toThrow(
      'No se puede cerrar la jornada mientras existan sesiones de ruta activas o programadas sin cerrar',
    );
    expect(prismaMock.jornada.update).not.toHaveBeenCalled();
  });

  it('does not let a driver close a jornada containing another user session', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 5 });
    prismaMock.rutaSesion.findMany
      .mockResolvedValueOnce([{ Id: 10 }])
      .mockResolvedValueOnce([{ Id: 10 }]);
    prismaMock.transferenciaVehiculo.findMany.mockResolvedValueOnce([]);
    prismaMock.relevoVehiculo.findMany.mockResolvedValueOnce([]);
    prismaMock.jornada.findFirst.mockResolvedValueOnce({
      Id: 1,
      Estado: 'ABIERTA',
      RutaSesion: [{ Id: 10, Estado: 'CERRADA' }, { Id: 20, Estado: 'CERRADA' }],
    });

    await expect(
      closeJornada(1, 5, { userId: 5, roleName: 'Chofer' }),
    ).rejects.toThrow('Jornada no existe o no está asignada al usuario');
    expect(prismaMock.jornada.update).not.toHaveBeenCalled();
  });
});
