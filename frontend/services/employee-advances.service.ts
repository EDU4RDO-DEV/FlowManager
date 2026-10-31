import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";

export interface EmployeeAdvanceDto {
  id: number;
  idEmpleado: number;
  empleado: string;
  fecha: string;
  monto: number;
  montoAplicado: number;
  saldoPendiente: number;
  metodoPago: string | null;
  numeroReferencia: string | null;
  banco: string | null;
  observacion: string | null;
  registradoPor: string;
  aplicaciones: Array<{
    id: number;
    idPlanilla: number;
    mes: number;
    anio: number;
    monto: number;
    fecha: string;
    vigente: boolean;
  }>;
}

export async function listEmployeeAdvances(idEmpleado?: number): Promise<EmployeeAdvanceDto[]> {
  const { data } = await api.get<ApiResponse<EmployeeAdvanceDto[]>>("/api/planilla/adelantos", {
    params: idEmpleado ? { idEmpleado } : undefined,
  });
  return data.data ?? [];
}

export async function createEmployeeAdvance(payload: {
  idEmpleado: number;
  monto: number;
  fecha: string;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA";
  numeroReferencia?: string;
  banco?: string;
  observacion?: string;
}): Promise<EmployeeAdvanceDto[]> {
  const { data } = await api.post<ApiResponse<EmployeeAdvanceDto[]>>(
    "/api/planilla/adelantos",
    payload,
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  );
  if (!data.data) throw new Error(data.message || "No se pudo registrar el anticipo");
  return data.data;
}
