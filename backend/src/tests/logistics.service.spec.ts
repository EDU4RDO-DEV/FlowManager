import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    vehiculo: { findFirst: vi.fn(), update: vi.fn() },
    rutaSesion: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { deleteRutaSesion } from '../services/logistics.service';

describe('Fase 10 - logística: sincronización de estado de vehículo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no sobreescribe el estado MANTENIMIENTO de un vehículo al anular una sesión de ruta', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 1, IdVehiculo: 5 });
    prismaMock.rutaSesion.update.mockResolvedValueOnce({});
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Estado: 'MANTENIMIENTO' });

    await deleteRutaSesion(1, 9);

    expect(prismaMock.vehiculo.update).not.toHaveBeenCalled();
  });

  it('sincroniza a DISPONIBLE cuando el vehículo no está en mantenimiento ni tiene sesión activa', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({ Id: 1, IdVehiculo: 5 });
    prismaMock.rutaSesion.update.mockResolvedValueOnce({});
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Estado: 'EN_RUTA' });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(null);
    prismaMock.vehiculo.update.mockResolvedValueOnce({});

    await deleteRutaSesion(1, 9);

    expect(prismaMock.vehiculo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Estado: 'DISPONIBLE' }) }),
    );
  });
});
