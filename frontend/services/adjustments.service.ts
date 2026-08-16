import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  AdjustmentDto,
  AdjustmentFilters,
  AdjustmentListResult,
  AdjustmentsListResponse,
  AnulatedAdjustmentsListResponse,
  CreateAdjustmentPayload,
  CreateAdjustmentResult,
  DeleteAdjustmentPayload,
  RestoreAdjustmentPayload,
} from "@/types/adjustments";

export async function listAdjustments(
  filters: AdjustmentFilters = {},
): Promise<AdjustmentListResult> {
  const { data } = await api.get<AdjustmentsListResponse>("/api/adjustments", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
      ...(filters.tipoAjuste ? { tipoAjuste: filters.tipoAjuste } : {}),
      ...(filters.anulado !== undefined ? { anulado: String(filters.anulado) } : {}),
      ...(filters.idInventarioItem !== undefined
        ? { idInventarioItem: filters.idInventarioItem }
        : {}),
    },
  });

  return (
    data.data ?? {
      items: [],
      pagination: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        total: 0,
        totalPages: 0,
      },
    }
  );
}

export async function listAnulatedAdjustments(): Promise<AdjustmentDto[]> {
  const { data } = await api.get<AnulatedAdjustmentsListResponse>("/api/adjustments/anulados");
  return data.data ?? [];
}

export async function getAdjustmentById(id: number): Promise<AdjustmentDto> {
  const { data } = await api.get<ApiResponse<AdjustmentDto>>(`/api/adjustments/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener ajuste");
  }
  return data.data;
}

export async function createAdjustment(payload: CreateAdjustmentPayload): Promise<CreateAdjustmentResult> {
  const { data } = await api.post<ApiResponse<CreateAdjustmentResult>>("/api/adjustments", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear ajuste");
  }
  return data.data;
}

export async function deleteAdjustment(
  id: number,
  payload?: DeleteAdjustmentPayload,
): Promise<void> {
  await api.delete(`/api/adjustments/${id}`, { data: payload });
}

export async function restoreAdjustment(
  id: number,
  payload?: RestoreAdjustmentPayload,
): Promise<AdjustmentDto> {
  const { data } = await api.patch<ApiResponse<AdjustmentDto>>(
    `/api/adjustments/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar ajuste");
  }
  return data.data;
}
