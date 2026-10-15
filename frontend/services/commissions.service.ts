import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  CommissionConfigDetailDto,
  CommissionConfigDto,
  CommissionsListResponse,
  CreateCommissionConfigPayload,
  CreateCommissionRulePayload,
  DeleteCommissionConfigPayload,
  DeleteCommissionRulePayload,
  RestoreCommissionConfigPayload,
  RestoreCommissionRulePayload,
  UpdateCommissionConfigPayload,
  UpdateCommissionRulePayload,
  CommissionRuleDto,
  CommissionCategoryDto,
  CommissionCategorySchedulePayload,
} from "@/types/commissions";

export async function listCommissionCategories(): Promise<CommissionCategoryDto[]> {
  const { data } = await api.get<ApiResponse<Array<{ Id: number; Clave: string; Nombre: string }>>>(
    "/api/planilla/comisiones/categorias",
  );
  return (data.data ?? []).map((category) => ({
    id: category.Id,
    clave: category.Clave,
    nombre: category.Nombre,
  }));
}

export async function listCommissionConfigs(): Promise<CommissionConfigDto[]> {
  const { data } = await api.get<CommissionsListResponse>("/api/planilla/comisiones");
  return data.data ?? [];
}

export async function listAnulatedCommissionConfigs(): Promise<CommissionConfigDto[]> {
  const { data } = await api.get<CommissionsListResponse>("/api/planilla/comisiones/anulados");
  return data.data ?? [];
}

export async function getCommissionConfigById(id: number): Promise<CommissionConfigDetailDto> {
  const { data } = await api.get<ApiResponse<CommissionConfigDetailDto>>(`/api/planilla/comisiones/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener configuración");
  }
  return data.data;
}

export async function createCommissionConfig(
  payload: CreateCommissionConfigPayload,
): Promise<CommissionConfigDto> {
  const { data } = await api.post<ApiResponse<CommissionConfigDto>>("/api/planilla/comisiones", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear configuración");
  }
  return data.data;
}

export async function updateCommissionConfig(
  id: number,
  payload: UpdateCommissionConfigPayload,
): Promise<CommissionConfigDto> {
  const { data } = await api.patch<ApiResponse<CommissionConfigDto>>(`/api/planilla/comisiones/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar configuración");
  }
  return data.data;
}

export async function setCommissionCategorySchedule(
  configId: number,
  payload: CommissionCategorySchedulePayload,
): Promise<void> {
  await api.put(`/api/planilla/comisiones/${configId}/reglas-categoria`, payload);
}

export async function deleteCommissionConfig(
  id: number,
  payload?: DeleteCommissionConfigPayload,
): Promise<void> {
  await api.delete(`/api/planilla/comisiones/${id}`, { data: payload });
}

export async function restoreCommissionConfig(
  id: number,
  payload?: RestoreCommissionConfigPayload,
): Promise<CommissionConfigDto> {
  const { data } = await api.patch<ApiResponse<CommissionConfigDto>>(
    `/api/planilla/comisiones/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar configuración");
  }
  return data.data;
}

export async function listCommissionRules(configId: number): Promise<CommissionRuleDto[]> {
  const { data } = await api.get<ApiResponse<CommissionRuleDto[]>>(
    `/api/planilla/comisiones/${configId}/reglas`,
  );
  return data.data ?? [];
}

export async function listAnulatedCommissionRules(configId: number): Promise<CommissionRuleDto[]> {
  const { data } = await api.get<ApiResponse<CommissionRuleDto[]>>(
    `/api/planilla/comisiones/${configId}/reglas/anuladas`,
  );
  return data.data ?? [];
}

export async function createCommissionRule(
  configId: number,
  payload: CreateCommissionRulePayload,
): Promise<CommissionRuleDto> {
  const { data } = await api.post<ApiResponse<CommissionRuleDto>>(
    `/api/planilla/comisiones/${configId}/reglas`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear regla");
  }
  return data.data;
}

export async function updateCommissionRule(
  configId: number,
  ruleId: number,
  payload: UpdateCommissionRulePayload,
): Promise<CommissionRuleDto> {
  const { data } = await api.patch<ApiResponse<CommissionRuleDto>>(
    `/api/planilla/comisiones/${configId}/reglas/${ruleId}`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar regla");
  }
  return data.data;
}

export async function deleteCommissionRule(
  configId: number,
  ruleId: number,
  payload?: DeleteCommissionRulePayload,
): Promise<void> {
  await api.delete(`/api/planilla/comisiones/${configId}/reglas/${ruleId}`, { data: payload });
}

export async function restoreCommissionRule(
  configId: number,
  ruleId: number,
  payload?: RestoreCommissionRulePayload,
): Promise<CommissionRuleDto> {
  const { data } = await api.patch<ApiResponse<CommissionRuleDto>>(
    `/api/planilla/comisiones/${configId}/reglas/${ruleId}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar regla");
  }
  return data.data;
}
