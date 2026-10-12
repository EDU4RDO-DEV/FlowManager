import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

const MAX_SERIALIZATION_ATTEMPTS = 3;

export function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  async function execute(attempt: number): Promise<T> {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= MAX_SERIALIZATION_ATTEMPTS
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
      return execute(attempt + 1);
    }
  }

  return execute(1);
}
