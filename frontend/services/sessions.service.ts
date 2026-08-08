import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  DeleteSessionPayload,
  RestoreSessionPayload,
  SessionDto,
  SessionsListResponse,
} from "@/types/sessions";

export async function listSessions(): Promise<SessionDto[]> {
  const { data } = await api.get<SessionsListResponse>("/api/sessions");
  return data.data ?? [];
}

export async function listAnulatedSessions(): Promise<SessionDto[]> {
  const { data } = await api.get<SessionsListResponse>("/api/sessions/anulados");
  return data.data ?? [];
}

export async function deleteSession(id: number, payload?: DeleteSessionPayload): Promise<void> {
  await api.delete(`/api/sessions/${id}`, { data: payload });
}

export async function restoreSession(
  id: number,
  payload?: RestoreSessionPayload,
): Promise<SessionDto> {
  const { data } = await api.patch<ApiResponse<SessionDto>>(
    `/api/sessions/${id}/restaurar`,
    payload,
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar sesion");
  }

  return data.data;
}
