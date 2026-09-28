import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';

const accessSecret = 'test-access-secret';
const refreshSecret = 'test-refresh-secret';

// Ids sembrados por prisma/seed.ts en orden fijo: Administrador, Vendedor, Chofer,
// Encargado de Producción, Auxiliar de Planta.
const ROLE_IDS = {
  administrador: 1,
  vendedor: 2,
  chofer: 3,
  encargadoProduccion: 4,
  auxiliarPlanta: 5,
};

function buildAccessToken(idRol: number, nombreRol: string) {
  return jwt.sign(
    {
      sub: 101,
      correo: 'tester@basan.com',
      idRol,
      nombreRol,
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

describe('Fase 2 - matriz Rol -> Módulo -> Acción (seed real)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_ISSUER = 'flowmanager.api';
    process.env.JWT_AUDIENCE = 'flowmanager.web';
  });

  it('Administrador tiene acceso total (usuarios:read permitido)', async () => {
    const app = createApp();
    const token = buildAccessToken(ROLE_IDS.administrador, 'Administrador');

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('Vendedor puede leer clientes pero no administrar usuarios', async () => {
    const app = createApp();
    const token = buildAccessToken(ROLE_IDS.vendedor, 'Vendedor');

    const clientsResponse = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);
    expect(clientsResponse.status).toBe(200);

    const usersResponse = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(usersResponse.status).toBe(403);
  });

  it('Chofer puede leer logística pero no clientes', async () => {
    const app = createApp();
    const token = buildAccessToken(ROLE_IDS.chofer, 'Chofer');

    const logisticsResponse = await request(app)
      .get('/api/logistics/vehiculos')
      .set('Authorization', `Bearer ${token}`);
    expect(logisticsResponse.status).toBe(200);

    const clientsResponse = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);
    expect(clientsResponse.status).toBe(403);
  });

  it('Encargado de Producción puede leer inventario pero no crear ajustes', async () => {
    const app = createApp();
    const token = buildAccessToken(ROLE_IDS.encargadoProduccion, 'Encargado de Producción');

    const readResponse = await request(app)
      .get('/api/adjustments')
      .set('Authorization', `Bearer ${token}`);
    expect(readResponse.status).toBe(200);

    const createResponse = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(createResponse.status).toBe(403);
  });

  it('Auxiliar de Planta puede leer inventario pero no restaurar ajustes', async () => {
    const app = createApp();
    const token = buildAccessToken(ROLE_IDS.auxiliarPlanta, 'Auxiliar de Planta');

    const readResponse = await request(app)
      .get('/api/adjustments')
      .set('Authorization', `Bearer ${token}`);
    expect(readResponse.status).toBe(200);

    const restoreResponse = await request(app)
      .patch('/api/adjustments/1/restaurar')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(restoreResponse.status).toBe(403);
  });
});
