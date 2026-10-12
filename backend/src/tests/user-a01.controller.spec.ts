import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUserMock, updateUserMock, changePasswordMock, resetPasswordMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  changePasswordMock: vi.fn(),
  resetPasswordMock: vi.fn(),
}));

vi.mock('../services/user.service', () => ({
  changeUserPassword: changePasswordMock,
  createUser: createUserMock,
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
  listAnulatedUsers: vi.fn(),
  listUsersAvailableForEmployeeLink: vi.fn(),
  listUsers: vi.fn(),
  resetUserPassword: resetPasswordMock,
  restoreUser: vi.fn(),
  updateUser: updateUserMock,
}));

import {
  changeUserPasswordController,
  createUserController,
  resetUserPasswordController,
  updateUserController,
} from '../controllers/user.controller';
import { loginSchema } from '../validators/auth.validators';

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
): Request {
  return { body, params } as unknown as Request;
}

describe('A01 password policy consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createUserMock.mockResolvedValue({});
    updateUserMock.mockResolvedValue({});
    changePasswordMock.mockResolvedValue({});
    resetPasswordMock.mockResolvedValue({});
  });

  it('rejects short and overlong administrative creation passwords', async () => {
    for (const clave of ['short', 'a'.repeat(129)]) {
      const response = makeResponse();
      await createUserController(
        makeRequest({ nombre: 'User', correo: 'user@example.test', clave }),
        response,
      );
      expect(response.status).toHaveBeenCalledWith(400);
    }

    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('accepts the login minimum for administrative creation', async () => {
    const response = makeResponse();

    await createUserController(
      makeRequest({ nombre: 'User', correo: 'user@example.test', clave: '12345678' }),
      response,
    );

    expect(createUserMock).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('uses the same 8–128 character bounds at login without new complexity rules', () => {
    expect(loginSchema.safeParse({ correo: 'user@example.test', clave: '12345678' }).success).toBe(true);
    expect(loginSchema.safeParse({ correo: 'user@example.test', clave: 'a'.repeat(129) }).success).toBe(false);
  });

  it('applies the same maximum to direct user updates', async () => {
    const response = makeResponse();

    await updateUserController(
      makeRequest({ clave: 'a'.repeat(129) }, { id: '12' }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('applies the shared bounds to password change and reset', async () => {
    const changeResponse = makeResponse();
    await changeUserPasswordController(
      makeRequest({ claveActual: 'current-password', nuevaClave: 'a'.repeat(129) }, { id: '12' }),
      changeResponse,
    );

    const resetResponse = makeResponse();
    await resetUserPasswordController(
      makeRequest({ nuevaClave: 'short' }, { id: '12' }),
      resetResponse,
    );

    expect(changeResponse.status).toHaveBeenCalledWith(400);
    expect(resetResponse.status).toHaveBeenCalledWith(400);
    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });
});
