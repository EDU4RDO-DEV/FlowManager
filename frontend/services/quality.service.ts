import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ControlCalidadDto,
  CreateControlCalidadPayload,
  QualityListResponse,
  UpdateControlCalidadPayload,
} from "@/types/quality";

export async function listControlCalidad(params?: { anio?: number; mes?: number; anulado?: boolean }): Promise<
  ControlCalidadDto[]
> {
  const { data } = await api.get<QualityListResponse>("/api/calidad", {
    params: {
      ...(params?.anio !== undefined ? { anio: params.anio } : {}),
      ...(params?.mes !== undefined ? { mes: params.mes } : {}),
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
    },
  });

  return data.data ?? [];
}

export async function listAnulatedControlCalidad(): Promise<ControlCalidadDto[]> {
  const { data } = await api.get<QualityListResponse>("/api/calidad/anulados");
  return data.data ?? [];
}

export async function createControlCalidad(
  payload: CreateControlCalidadPayload,
): Promise<ControlCalidadDto> {
  const { data } = await api.post<ApiResponse<ControlCalidadDto>>("/api/calidad", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar control de calidad");
  }
  return data.data;
}

export async function updateControlCalidad(
  id: number,
  payload: UpdateControlCalidadPayload,
): Promise<ControlCalidadDto> {
  const { data } = await api.patch<ApiResponse<ControlCalidadDto>>(`/api/calidad/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar control de calidad");
  }
  return data.data;
}

export async function validateControlCalidad(
  id: number,
  payload?: { idUsuarioValidador: number },
): Promise<ControlCalidadDto> {
  const { data } = await api.patch<ApiResponse<ControlCalidadDto>>(`/api/calidad/${id}/validar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al validar control de calidad");
  }
  return data.data;
}

export async function deleteControlCalidad(id: number, payload?: { idUsuarioAnulador: number }): Promise<void> {
  await api.delete(`/api/calidad/${id}`, { data: payload });
}

export async function restoreControlCalidad(
  id: number,
  payload?: { idUsuarioModificador: number },
): Promise<ControlCalidadDto> {
  const { data } = await api.patch<ApiResponse<ControlCalidadDto>>(`/api/calidad/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar control de calidad");
  }
  return data.data;
}
