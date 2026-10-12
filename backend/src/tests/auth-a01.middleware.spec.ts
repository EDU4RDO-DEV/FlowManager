import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rol: { findFirst: vi.fn() },
    sesion: { findFirst: vi.fn() },
    usuario: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { requireAuth, requireModulePermission } from '../middlewares/auth.middleware';

const accessSecret = 'a01-test-access-secret';

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeRequest(): Request {
  const token = jwt.sign(
    {
      sub: 101,
      sid: 501,
      idRol: 7,
      tokenType: 'access',
    },
    accessSecret,
    {
      algorithm: 'HS256',
      expiresIn: 60,
      issuer: 'flowmanager.api',
      audience: 'flowmanager.web',
    },
  );

  return {
    headers: { authorization: `Bearer ${token}` },
    params: {},
  } as unknown as Request;
}

describe('A01 auth middleware invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
  });

  it('rejects a revoked session before a protected operation runs', async () => {
    prismaMock.sesion.findFirst.mockResolvedValueOnce(null);
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(makeRequest(), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(prismaMock.usuario.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an active session when its user has been deactivated', async () => {
    prismaMock.sesion.findFirst.mockResolvedValueOnce({ Id: 501 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null);
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(makeRequest(), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(prismaMock.usuario.findFirst).toHaveBeenCalledWith({
      where: { Id: 101, Anulado: false },
      select: { Id: true },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies persisted grants when the token role has been deactivated', async () => {
    prismaMock.rol.findFirst.mockResolvedValueOnce(null);
    const request = { auth: { idRol: 7 } } as unknown as Request;
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireModulePermission('usuarios', 'read')(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
