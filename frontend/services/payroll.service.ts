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
  ReopenPayrollPayload,
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

export async function listMyPayrolls(): Promise<PayrollDto[]> {
  const { data } = await api.get<PayrollListResponse>("/api/planilla/mis-planillas");
  return data.data ?? [];
}

export async function downloadMyPayrollReceipt(id: number): Promise<void> {
  const { data } = await api.get<Blob>(`/api/planilla/mis-planillas/${id}/recibo.pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recibo-planilla-${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollReceipt(id: number): Promise<void> {
  const { data } = await api.get<Blob>(`/api/planilla/mensuales/${id}/recibo.pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recibo-planilla-${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getPayrollById(id: number): Promise<PayrollDetailDto> {
  const { data } = await api.get<ApiResponse<PayrollDetailDto>>(`/api/planilla/mensuales/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener planilla");
  }
  return data.data;
}

export interface PayrollPaymentSummaryDto {
  idPlanilla: number;
  estadoPlanilla: string;
  estadoPago: string;
  totalPlanilla: number;
  totalPagado: number;
  saldoPendiente: number;
  pagos: Array<{
    id: number;
    usuario: string;
    monto: number;
    metodoPago: string;
    numeroReferencia: string | null;
    banco: string | null;
    rutaComprobante: string | null;
    fechaPago: string;
    observaciones: string | null;
  }>;
}

export async function getPayrollPayments(id: number): Promise<PayrollPaymentSummaryDto> {
  const { data } = await api.get<ApiResponse<PayrollPaymentSummaryDto>>(
    `/api/planilla/mensuales/${id}/pagos`,
  );
  if (!data.data) throw new Error(data.message || "Respuesta invalida al consultar pagos");
  return data.data;
}

export function getPayrollPaymentReceiptUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const fileName = path.match(/^\/uploads\/payroll-payments\/([0-9a-f-]{36}\.(?:pdf|jpg|png|webp))$/i)?.[1];
  if (!fileName) return "";
  return api.getUri({ url: `/api/planilla/comprobantes/${encodeURIComponent(fileName)}` });
}

export async function uploadPayrollPaymentReceipt(file: File): Promise<{ rutaComprobante: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<ApiResponse<{ rutaComprobante: string }>>(
    "/api/planilla/comprobantes",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  if (!data.data) throw new Error(data.message || "Respuesta inválida al subir comprobante");
  return data.data;
}

export async function downloadPayrollPaymentReceipt(path: string): Promise<Blob> {
  const url = getPayrollPaymentReceiptUrl(path);
  if (!url) throw new Error("La ruta del comprobante no es válida");
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  return data;
}

export async function registerPayrollPayment(
  id: number,
  payload: {
    monto: number;
    metodoPago: "EFECTIVO" | "TRANSFERENCIA";
    numeroReferencia?: string;
    banco?: string;
    rutaComprobante?: string;
    observaciones?: string;
  },
  idempotencyKey: string,
): Promise<PayrollPaymentSummaryDto> {
  const { data } = await api.post<ApiResponse<PayrollPaymentSummaryDto>>(
    `/api/planilla/mensuales/${id}/pagos`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  if (!data.data) throw new Error(data.message || "Respuesta invalida al registrar pago");
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

export async function reopenPayroll(
  id: number,
  payload: ReopenPayrollPayload,
): Promise<PayrollDetailDto> {
  const { data } = await api.patch<ApiResponse<PayrollDetailDto>>(
    `/api/planilla/mensuales/${id}/reabrir`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al reabrir planilla");
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
