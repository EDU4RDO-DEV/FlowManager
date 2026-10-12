import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    sesion: sessionMock,
  },
}));

import { restoreSession } from '../services/session.service';

describe('A01 revoked session restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never reactivates a revoked session or its previous credentials', async () => {
    sessionMock.findFirst.mockResolvedValueOnce({ Id: 23 });

    await expect(restoreSession(23)).rejects.toThrow(
      'Las sesiones revocadas no se pueden restaurar; inicia sesión nuevamente',
    );

    expect(sessionMock.findFirst).toHaveBeenCalledWith({
      where: { Id: 23, Anulado: true },
      select: { Id: true },
    });
    expect(sessionMock.update).not.toHaveBeenCalled();
  });
});
