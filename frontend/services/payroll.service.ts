import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ClosePayrollPayload,
  DeletePayrollPayload,
  GeneratePayrollPayload,
  PayrollDetailDto,
  PayrollDto,
  PayrollListResponse,
  PayrollPreviewResult,
  PreviewPayrollPayload,
  RestorePayrollPayload,
  UpdatePayrollPayload,
} from "@/types/payroll";

export async function listPayrolls(params?: {
  mes?: number;
  anio?: number;
  anulado?: boolean;
  idEmpleado?: number;
}): Promise<PayrollDto[]> {
  const { data } = await api.get<PayrollListResponse>("/api/planilla/mensuales", {
    params: {
      ...(params?.mes !== undefined ? { mes: params.mes } : {}),
      ...(params?.anio !== undefined ? { anio: params.anio } : {}),
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
      ...(params?.idEmpleado !== undefined ? { idEmpleado: params.idEmpleado } : {}),
    },
  });

  return data.data ?? [];
}

export async function getPayrollById(id: number): Promise<PayrollDetailDto> {
  const { data } = await api.get<ApiResponse<PayrollDetailDto>>(`/api/planilla/mensuales/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener planilla");
  }
  return data.data;
}

export async function previewPayroll(payload: PreviewPayrollPayload): Promise<PayrollPreviewResult> {
  const { data } = await api.post<ApiResponse<PayrollPreviewResult>>(
    "/api/planilla/mensuales/previsualizar",
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al previsualizar planilla");
  }
  return data.data;
}

export async function generatePayroll(payload: GeneratePayrollPayload): Promise<PayrollPreviewResult> {
  const { data } = await api.post<ApiResponse<PayrollPreviewResult>>(
    "/api/planilla/mensuales/generar",
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al generar planilla");
  }
  return data.data;
}

export async function updatePayroll(
  id: number,
  payload: UpdatePayrollPayload,
): Promise<PayrollDto> {
  const { data } = await api.patch<ApiResponse<PayrollDto>>(`/api/planilla/mensuales/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar planilla");
  }
  return data.data;
}

export async function closePayroll(id: number, payload?: ClosePayrollPayload): Promise<PayrollDetailDto> {
  const { data } = await api.patch<ApiResponse<PayrollDetailDto>>(
    `/api/planilla/mensuales/${id}/cerrar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al cerrar planilla");
  }
  return data.data;
}

export async function deletePayroll(id: number, payload?: DeletePayrollPayload): Promise<void> {
  await api.delete(`/api/planilla/mensuales/${id}`, { data: payload });
}

export async function restorePayroll(
  id: number,
  payload?: RestorePayrollPayload,
): Promise<PayrollDetailDto> {
  const { data } = await api.patch<ApiResponse<PayrollDetailDto>>(
    `/api/planilla/mensuales/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar planilla");
  }
  return data.data;
}
