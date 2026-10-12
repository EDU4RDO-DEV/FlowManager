import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
}));

vi.mock('../services/auth.service', () => ({
  assignUserRoleEntity: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  login: vi.fn(),
  refreshAuthTokens: vi.fn(),
  register: registerMock,
  revokeAllUserSessions: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));

vi.mock('../services/user.service', () => ({
  changeUserPassword: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
  listAnulatedUsers: vi.fn(),
  listUsersAvailableForEmployeeLink: vi.fn(),
  listUsers: vi.fn(),
  resetUserPassword: vi.fn(),
  restoreUser: vi.fn(),
  updateUser: vi.fn(),
}));

import { registerController } from '../controllers/auth.controller';

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeRequest(body: Record<string, unknown>, auth?: Request['auth']): Request {
  return {
    body,
    auth,
  } as unknown as Request;
}

const bootstrapPayload = {
  nombre: 'Primer usuario',
  correo: 'primero@example.test',
  clave: 'Password123',
};

describe('A01 registration bootstrap authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMock.mockResolvedValue({
      id: 1,
      nombre: bootstrapPayload.nombre,
      correo: bootstrapPayload.correo,
      idRol: 1,
      idEntidad: null,
    });
  });

  it('rejects an unauthenticated role assignment in a bootstrap request', async () => {
    const response = makeResponse();

    await registerController(
      makeRequest({ ...bootstrapPayload, idRol: 1 }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('marks unauthenticated registration for atomic first-administrator assignment', async () => {
    const response = makeResponse();

    await registerController(makeRequest(bootstrapPayload), response);

    expect(registerMock).toHaveBeenCalledWith({
      ...bootstrapPayload,
      bootstrap: true,
      idEntidad: undefined,
    });
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('marks authenticated administrative registrations as non-bootstrap', async () => {
    const response = makeResponse();

    await registerController(
      makeRequest(bootstrapPayload, { userId: 44, sessionId: 55, idRol: 1 }),
      response,
    );

    expect(registerMock).toHaveBeenCalledWith({
      ...bootstrapPayload,
      bootstrap: false,
      idEntidad: undefined,
    });
    expect(response.status).toHaveBeenCalledWith(201);
  });
});
