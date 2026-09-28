import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';

const accessSecret = 'test-access-secret';
const refreshSecret = 'test-refresh-secret';

function buildAdminToken() {
  return jwt.sign(
    {
      sub: 101,
      correo: 'tester@basan.com',
      idRol: 1,
      nombreRol: 'Administrador',
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

describe('Fase 3 - wiring de rutas de catálogo comercial', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
  });

  it('lista tipos de cliente (ruta montada y permiso clientes:read)', async () => {
    const app = createApp();
    const token = buildAdminToken();

    const response = await request(app)
      .get('/api/client-catalog/tipos-cliente')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('lista tipos de crédito (ruta montada y permiso ventas:read)', async () => {
    const app = createApp();
    const token = buildAdminToken();

    const response = await request(app)
      .get('/api/commercial-rules/tipos-credito')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('valida body al crear regla de bonificación (400 por datos incompletos)', async () => {
    const app = createApp();
    const token = buildAdminToken();

    const response = await request(app)
      .post('/api/commercial-rules/bonificaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });
});
