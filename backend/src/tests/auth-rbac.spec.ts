import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { prisma } from '../config/prisma';

const accessSecret = 'test-access-secret';
const refreshSecret = 'test-refresh-secret';
const testUserId = 101;
const testSessionId = 81001;
const originalUserFindFirst = prisma.usuario.findFirst.bind(prisma.usuario);

function buildAccessToken(roleName: string) {
  return jwt.sign(
    {
      sub: testUserId,
      sid: testSessionId,
      correo: 'tester@basan.com',
      idRol: 5,
      nombreRol: roleName,
      nombre: 'Tester',
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
}

function buildAccessTokenWithSid(roleName: string, sid: unknown) {
  return jwt.sign(
    {
      sub: 101,
      sid,
      correo: 'tester@basan.com',
      idRol: 5,
      nombreRol: roleName,
      nombre: 'Tester',
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
}

function buildRefreshTokenForAuthHeader() {
  return jwt.sign(
    {
      sub: 202,
      correo: 'refresh-header@basan.com',
      idRol: 5,
      nombreRol: 'ADMINISTRADOR / GERENTE',
      nombre: 'Refresh Header',
      tokenType: 'refresh',
    },
    accessSecret,
    {
      algorithm: 'HS256',
      expiresIn: 60,
      issuer: 'flowmanager.api',
      audience: 'flowmanager.web',
    },
  );
}

describe('Auth/RBAC critical flows', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
    vi.spyOn(prisma.sesion, 'findFirst').mockImplementation((args) =>
      Promise.resolve(
        args.where.Id === testSessionId ? { Id: testSessionId } : null,
      ) as never,
    );
    vi.spyOn(prisma.usuario, 'findFirst').mockImplementation((args) => {
      if (
        args.where.Id === testUserId &&
        typeof args.select === 'object' &&
        args.select !== null &&
        'IdRol' in args.select
      ) {
        return Promise.resolve({ Id: testUserId, IdRol: 5 }) as never;
      }

      return originalUserFindFirst(args);
    });
  });

  afterAll(() => vi.restoreAllMocks());

  it('returns 401 when protected route is called without token', async () => {
    const app = createApp();

    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 when role has no permission for module/action', async () => {
    const app = createApp();
    const token = buildAccessToken('ENCARGADO DE INVENTARIO');

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 when role has no permission to create products', async () => {
    const app = createApp();
    const token = buildAccessToken('CAJERO / VENDEDOR (PUNTO DE VENTA)');

    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idUsuario: 1,
        idProveedor: 1,
        nombre: 'Garrafon 18L',
        categoria: 'PRODUCTO_TERMINADO',
        costoPromedio: 1,
        precioVenta: 2,
      });

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 401 on refresh with invalid token', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('returns 404 on logout revoke with invalid refresh token', async () => {
    const app = createApp();
    const token = buildAccessToken('ADMINISTRADOR / GERENTE');

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken: 'invalid-token' });

    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
  });

  it('returns 401 when using refresh token as bearer token', async () => {
    const app = createApp();
    const token = buildRefreshTokenForAuthHeader();

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('returns 401 when access token includes invalid sid type', async () => {
    const app = createApp();
    const token = buildAccessTokenWithSid('ADMINISTRADOR / GERENTE', 'sid-invalido');

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('returns 401 when access token sid does not match active session', async () => {
    const app = createApp();
    const token = buildAccessTokenWithSid('ADMINISTRADOR / GERENTE', 99999999);

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 on malformed JSON body', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Content-Type', 'application/json')
      .send('{"refreshToken":');

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.message).toBe('JSON inválido en el cuerpo de la solicitud');
  });
});
