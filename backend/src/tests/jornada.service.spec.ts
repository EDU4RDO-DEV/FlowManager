import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    jornada: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
});
