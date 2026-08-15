import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';

const accessSecret = 'test-access-secret';
const refreshSecret = 'test-refresh-secret';

function buildAccessToken(roleName: string) {
  return jwt.sign(
    {
      sub: 101,
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

describe('Module endpoints RBAC/integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
  });

  it('returns 403 when read-only inventory role tries to restore adjustment', async () => {
    const app = createApp();
    const token = buildAccessToken('CAJERO / VENDEDOR (PUNTO DE VENTA)');

    const response = await request(app)
      .patch('/api/adjustments/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 when logistics role tries to restore purchase', async () => {
    const app = createApp();
    const token = buildAccessToken('PERSONAL DE LOGISTICA / REPARTIDOR');

    const response = await request(app)
      .patch('/api/compras/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 when adjustments list receives invalid query', async () => {
    const app = createApp();
    const token = buildAccessToken('CAJERO / VENDEDOR (PUNTO DE VENTA)');

    const response = await request(app)
      .get('/api/adjustments?page=0')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 when inventory-log/anulados receives invalid query', async () => {
    const app = createApp();
    const token = buildAccessToken('CAJERO / VENDEDOR (PUNTO DE VENTA)');

    const response = await request(app)
      .get('/api/inventory-log/anulados?limit=101')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 or 404 when logistics role tries to restore client', async () => {
    const app = createApp();
    const token = buildAccessToken('PERSONAL DE LOGISTICA / REPARTIDOR');

    const response = await request(app)
      .patch('/api/clients/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([403, 404]).toContain(response.status);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 when restore client id is invalid', async () => {
    const app = createApp();
    const token = buildAccessToken('ADMINISTRADOR / GERENTE');

    const response = await request(app)
      .patch('/api/clients/abc/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 when cajero role tries to restore provider', async () => {
    const app = createApp();
    const token = buildAccessToken('CAJERO / VENDEDOR (PUNTO DE VENTA)');

    const response = await request(app)
      .patch('/api/providers/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 or 403 when restore provider id is invalid', async () => {
    const app = createApp();
    const token = buildAccessToken('ADMINISTRADOR / GERENTE');

    const response = await request(app)
      .patch('/api/providers/abc/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([400, 403]).toContain(response.status);
    expect(response.body.ok).toBe(false);
  });

  it('returns 403 when produccion role tries to restore employee', async () => {
    const app = createApp();
    const token = buildAccessToken('PERSONAL DE PRODUCCION');

    const response = await request(app)
      .patch('/api/employees/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('returns 400 or 403 when restore employee id is invalid', async () => {
    const app = createApp();
    const token = buildAccessToken('ADMINISTRADOR / GERENTE');

    const response = await request(app)
      .patch('/api/employees/abc/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([400, 403]).toContain(response.status);
    expect(response.body.ok).toBe(false);
  });
});
