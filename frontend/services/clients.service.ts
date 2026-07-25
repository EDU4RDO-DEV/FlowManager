import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ClientDto,
  ClientsListResponse,
  CreateClientPayload,
  DeleteClientPayload,
  UpdateClientPayload,
} from "@/types/clients";

export async function listClients(): Promise<ClientDto[]> {
  const { data } = await api.get<ClientsListResponse>("/api/clients");
  return data.data ?? [];
}

export async function getClientById(id: number): Promise<ClientDto> {
  const { data } = await api.get<ApiResponse<ClientDto>>(`/api/clients/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener cliente");
  }
  return data.data;
}

export async function createClient(payload: CreateClientPayload): Promise<ClientDto> {
  const { data } = await api.post<ApiResponse<ClientDto>>("/api/clients", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear cliente");
  }
  return data.data;
}

export async function updateClient(id: number, payload: UpdateClientPayload): Promise<ClientDto> {
  const { data } = await api.patch<ApiResponse<ClientDto>>(`/api/clients/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar cliente");
  }
  return data.data;
}

export async function deleteClient(id: number, payload?: DeleteClientPayload): Promise<void> {
  await api.delete(`/api/clients/${id}`, { data: payload });
}
