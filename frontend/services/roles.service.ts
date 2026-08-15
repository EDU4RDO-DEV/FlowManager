import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  CreateRolePayload,
  DeleteRolePayload,
  RolePermissionsDto,
  RoleDto,
  RestoreRolePayload,
  RolesListResponse,
  UpdateRolePermissionsPayload,
  UpdateRolePayload,
} from "@/types/roles";

export async function listRoles(): Promise<RoleDto[]> {
  const { data } = await api.get<RolesListResponse>("/api/roles");
  return data.data ?? [];
}

export async function listAnulatedRoles(): Promise<RoleDto[]> {
  const { data } = await api.get<RolesListResponse>("/api/roles/anulados");
  return data.data ?? [];
}

export async function getRoleById(id: number): Promise<RoleDto> {
  const { data } = await api.get<ApiResponse<RoleDto>>(`/api/roles/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener rol");
  }
  return data.data;
}

export async function createRole(payload: CreateRolePayload): Promise<RoleDto> {
  const { data } = await api.post<ApiResponse<RoleDto>>("/api/roles", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear rol");
  }
  return data.data;
}

export async function updateRole(id: number, payload: UpdateRolePayload): Promise<RoleDto> {
  const { data } = await api.patch<ApiResponse<RoleDto>>(`/api/roles/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar rol");
  }
  return data.data;
}

export async function deleteRole(id: number, payload?: DeleteRolePayload): Promise<void> {
  await api.delete(`/api/roles/${id}`, { data: payload });
}

export async function restoreRole(id: number, payload?: RestoreRolePayload): Promise<RoleDto> {
  const { data } = await api.patch<ApiResponse<RoleDto>>(`/api/roles/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar rol");
  }
  return data.data;
}

export async function getRolePermissions(id: number): Promise<RolePermissionsDto> {
  const { data } = await api.get<ApiResponse<RolePermissionsDto>>(`/api/roles/${id}/permisos`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener permisos");
  }
  return data.data;
}

export async function updateRolePermissions(
  id: number,
  payload: UpdateRolePermissionsPayload,
): Promise<RolePermissionsDto> {
  const { data } = await api.patch<ApiResponse<RolePermissionsDto>>(`/api/roles/${id}/permisos`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar permisos");
  }
  return data.data;
}
