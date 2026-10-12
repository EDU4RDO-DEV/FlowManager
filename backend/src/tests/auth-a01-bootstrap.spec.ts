import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, transactionMock } = vi.hoisted(() => {
  const transaction = {
    rol: { findFirst: vi.fn() },
    usuario: { findFirst: vi.fn(), create: vi.fn() },
  };

  return {
    transactionMock: transaction,
    prismaMock: {
      usuario: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { register } from '../services/auth.service';

const registration = {
  nombre: 'Primer administrador',
  correo: 'admin@example.test',
  clave: 'TestPassword123',
  bootstrap: true,
};

describe('A01 first-administrator bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    transactionMock.rol.findFirst.mockResolvedValue({ Id: 1 });
    transactionMock.usuario.findFirst.mockResolvedValue(null);
    transactionMock.usuario.create.mockImplementation(({ data }) =>
      Promise.resolve({
        Id: 10,
        Nombre: data.Nombre,
        Correo: data.Correo,
        IdRol: data.IdRol,
        IdEntidad: data.IdEntidad,
      }),
    );
    prismaMock.$transaction.mockImplementation(
      async (callback, options) => {
        expect(options).toEqual({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
        return callback(transactionMock);
      },
    );
  });

  it('assigns the active administrator role within a serializable transaction', async () => {
    const result = await register(registration);

    expect(result.idRol).toBe(1);
    expect(transactionMock.rol.findFirst).toHaveBeenCalledWith({
      where: { Nombre: 'Administrador', Anulado: false },
      select: { Id: true },
    });
    expect(transactionMock.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdRol: 1 }),
      }),
    );
  });

  it('does not create a second bootstrap account once an administrator exists', async () => {
    transactionMock.usuario.findFirst.mockResolvedValueOnce({ Id: 4 });

    await expect(register(registration)).rejects.toThrow('El administrador inicial ya fue creado');
    expect(transactionMock.usuario.create).not.toHaveBeenCalled();
  });

  it('retries a serialization conflict and rejects bootstrap after another request wins', async () => {
    const serializationConflict = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock.',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaMock.$transaction
      .mockImplementationOnce(async (callback) => {
        await callback(transactionMock);
        throw serializationConflict;
      })
      .mockImplementationOnce(async (callback) => {
        transactionMock.usuario.findFirst.mockResolvedValueOnce({ Id: 12 });
        return callback(transactionMock);
      });

    await expect(register(registration)).rejects.toThrow('El administrador inicial ya fue creado');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });
});
