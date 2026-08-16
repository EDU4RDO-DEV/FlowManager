import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ClientDto,
  ClientsListResponse,
  CreateClientPayload,
  DeleteClientPayload,
  RestoreClientPayload,
  UploadClientImageResponse,
  UploadClientImageResult,
  UpdateClientPayload,
} from "@/types/clients";

export async function listClients(): Promise<ClientDto[]> {
  const { data } = await api.get<ClientsListResponse>("/api/clients");
  return data.data ?? [];
}

export async function listAnulatedClients(): Promise<ClientDto[]> {
  const { data } = await api.get<ClientsListResponse>("/api/clients/anulados");
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

export async function restoreClient(
  id: number,
  payload?: RestoreClientPayload,
): Promise<ClientDto> {
  const { data } = await api.patch<ApiResponse<ClientDto>>(`/api/clients/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar cliente");
  }
  return data.data;
}

export async function uploadClientImage(file: File): Promise<UploadClientImageResult> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<UploadClientImageResponse>(
    "/api/clients/upload-image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al subir imagen");
  }

  return data.data;
}
