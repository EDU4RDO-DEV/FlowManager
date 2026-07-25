import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  CreateProviderPayload,
  DeleteProviderPayload,
  ProviderDto,
  ProvidersListResponse,
  UpdateProviderPayload,
} from "@/types/providers";

export async function listProviders(): Promise<ProviderDto[]> {
  const { data } = await api.get<ProvidersListResponse>("/api/providers");
  return data.data ?? [];
}

export async function getProviderById(id: number): Promise<ProviderDto> {
  const { data } = await api.get<ApiResponse<ProviderDto>>(`/api/providers/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener proveedor");
  }
  return data.data;
}

export async function createProvider(payload: CreateProviderPayload): Promise<ProviderDto> {
  const { data } = await api.post<ApiResponse<ProviderDto>>("/api/providers", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear proveedor");
  }
  return data.data;
}

export async function updateProvider(id: number, payload: UpdateProviderPayload): Promise<ProviderDto> {
  const { data } = await api.patch<ApiResponse<ProviderDto>>(`/api/providers/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar proveedor");
  }
  return data.data;
}

export async function deleteProvider(id: number, payload?: DeleteProviderPayload): Promise<void> {
  await api.delete(`/api/providers/${id}`, { data: payload });
}
