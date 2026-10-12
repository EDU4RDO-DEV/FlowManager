import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sesion: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { deleteUser } from '../services/user.service';

describe('A01 user deactivation session revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 12 });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<void>) => callback(prismaMock),
    );
  });

  it('atomically deactivates the user and only that user’s active sessions', async () => {
    await deleteUser(12, 4);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { Id: 12 },
      data: {
        Anulado: true,
        IdUsuarioAnulador: 4,
        FechaAnulacion: expect.any(Date),
      },
    });
    expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith({
      where: { IdUsuario: 12, Anulado: false },
      data: {
        Anulado: true,
        IdUsuarioAnulador: 4,
        FechaAnulacion: expect.any(Date),
      },
    });
  });
});
