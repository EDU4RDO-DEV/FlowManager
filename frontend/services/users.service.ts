import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ChangePasswordPayload,
  CreateUserPayload,
  DeleteUserPayload,
  ResetPasswordPayload,
  RoleDto,
  RestoreUserPayload,
  RolesListResponse,
  UpdateUserPayload,
  UserDto,
  UsersListResponse,
} from "@/types/users";

export async function listUsers(): Promise<UserDto[]> {
  const { data } = await api.get<UsersListResponse>("/api/users");
  return data.data ?? [];
}

export async function listAvailableUsers(includeEmployeeId?: number): Promise<UserDto[]> {
  const { data } = await api.get<UsersListResponse>("/api/users/disponibles", {
    params: includeEmployeeId ? { includeEmployeeId } : undefined,
  });
  return data.data ?? [];
}

export async function listAnulatedUsers(): Promise<UserDto[]> {
  const { data } = await api.get<UsersListResponse>("/api/users/anulados");
  return data.data ?? [];
}

export async function getUserById(id: number): Promise<UserDto> {
  const { data } = await api.get<ApiResponse<UserDto>>(`/api/users/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener usuario");
  }
  return data.data;
}

export async function listRoles(): Promise<RoleDto[]> {
  const { data } = await api.get<RolesListResponse>("/api/roles");
  return data.data ?? [];
}

export async function createUser(payload: CreateUserPayload): Promise<UserDto> {
  const { data } = await api.post<ApiResponse<UserDto>>("/api/users", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear usuario");
  }
  return data.data;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<UserDto> {
  const { data } = await api.patch<ApiResponse<UserDto>>(`/api/users/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar usuario");
  }
  return data.data;
}

export async function deleteUser(id: number, payload?: DeleteUserPayload): Promise<void> {
  await api.delete(`/api/users/${id}`, { data: payload });
}

export async function restoreUser(
  id: number,
  payload?: RestoreUserPayload,
): Promise<UserDto> {
  const { data } = await api.patch<ApiResponse<UserDto>>(`/api/users/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar usuario");
  }
  return data.data;
}

export async function changeUserPassword(
  id: number,
  payload: ChangePasswordPayload,
): Promise<void> {
  await api.patch(`/api/users/${id}/password`, payload);
}

export async function resetUserPassword(
  id: number,
  payload: ResetPasswordPayload,
): Promise<void> {
  await api.patch(`/api/users/${id}/password/reset`, payload);
}
