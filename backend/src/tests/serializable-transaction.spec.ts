import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { runSerializableTransaction } from '../utils/serializable-transaction';

function serializationConflict() {
  return new Prisma.PrismaClientKnownRequestError('Serialization conflict', {
    code: 'P2034',
    clientVersion: 'test',
  });
}

describe('runSerializableTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retries serialization conflicts within a bounded attempt count', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(serializationConflict())
      .mockRejectedValueOnce(serializationConflict())
      .mockResolvedValueOnce('committed');

    await expect(
      runSerializableTransaction(async () => 'unused'),
    ).resolves.toBe('committed');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('surfaces the last serialization conflict after exhausting retries', async () => {
    const error = serializationConflict();
    prismaMock.$transaction.mockRejectedValue(error);

    await expect(
      runSerializableTransaction(async () => 'unused'),
    ).rejects.toBe(error);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-serialization errors', async () => {
    const error = new Error('database unavailable');
    prismaMock.$transaction.mockRejectedValue(error);

    await expect(
      runSerializableTransaction(async () => 'unused'),
    ).rejects.toBe(error);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
