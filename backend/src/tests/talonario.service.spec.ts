import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    talonario: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { restoreTalonario, updateTalonario } from '../services/talonario.service';

describe('Fase 11 - auditoría en talonarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateTalonario registra IdUsuarioModificador y FechaModificacion', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.talonario.update.mockResolvedValueOnce({});

    await updateTalonario(3, { idUsuarioModificador: 7 });

    expect(prismaMock.talonario.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: expect.objectContaining({
        IdUsuarioModificador: 7,
        FechaModificacion: expect.any(Date),
      }),
    });
  });

  it('restoreTalonario limpia anulación y registra IdUsuarioModificador/FechaModificacion', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.talonario.findFirst.mockResolvedValueOnce(null);
    prismaMock.talonario.update.mockResolvedValueOnce({});

    await restoreTalonario(3, 7);

    expect(prismaMock.talonario.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: expect.objectContaining({
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: 7,
        FechaModificacion: expect.any(Date),
      }),
    });
  });
});
