import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rol: { findFirst: vi.fn() },
    rolPermiso: { findMany: vi.fn() },
    sesion: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    usuario: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { refreshAuthTokens, revokeRefreshToken } from '../services/auth.service';

const accessSecret = 'a01-test-access-secret';
const refreshSecret = 'a01-test-refresh-secret';

function buildRefreshToken(): string {
  return jwt.sign(
    { sub: 9, tokenType: 'refresh' },
    refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: 3600,
      issuer: 'flowmanager.api',
      audience: 'flowmanager.web',
    },
  );
}

function setupValidRefresh() {
  const refreshToken = buildRefreshToken();
  prismaMock.sesion.findFirst.mockResolvedValueOnce({ Id: 77, IdUsuario: 9 });
  prismaMock.usuario.findFirst.mockResolvedValueOnce({
    Id: 9,
    Nombre: 'Test User',
    Correo: 'user@example.test',
    IdRol: 3,
    Rol_Usuario_IdRolToRol: { Nombre: 'Test role' },
  });
  prismaMock.rol.findFirst.mockResolvedValueOnce({ Id: 3 });
  prismaMock.$queryRaw
    .mockResolvedValueOnce([{ total: 3 }])
    .mockResolvedValueOnce([{ total: 1 }]);
  prismaMock.rolPermiso.findMany.mockResolvedValueOnce([]);

  return refreshToken;
}

describe('A01 refresh-token rotation compare-and-swap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
  });

  it('rejects a concurrent refresh after its presented token has already been consumed', async () => {
    const refreshToken = setupValidRefresh();
    prismaMock.sesion.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(refreshAuthTokens({ refreshToken })).rejects.toThrow(
      'Refresh token inválido o expirado',
    );

    expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          Id: 77,
          IdUsuario: 9,
          TokenSesion: crypto.createHash('sha256').update(refreshToken).digest('hex'),
          Anulado: false,
          FechaExpiracionToken: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('returns only the refresh token whose conditional rotation was persisted', async () => {
    const refreshToken = setupValidRefresh();
    prismaMock.sesion.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await refreshAuthTokens({ refreshToken });

    expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          TokenSesion: crypto.createHash('sha256').update(result.refreshToken).digest('hex'),
        }),
      }),
    );
    expect(result.accessToken).toBeTruthy();
  });

  it('revokes the matching persisted refresh session during logout', async () => {
    const refreshToken = buildRefreshToken();
    prismaMock.sesion.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(revokeRefreshToken(refreshToken, 9)).resolves.toBe(true);

    expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          IdUsuario: 9,
          TokenSesion: crypto.createHash('sha256').update(refreshToken).digest('hex'),
          Anulado: false,
        },
        data: expect.objectContaining({
          Anulado: true,
          IdUsuarioAnulador: 9,
          FechaAnulacion: expect.any(Date),
        }),
      }),
    );
  });
});
