import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";

export interface CommissionAccrualDto {
  id: number;
  idEmpleado: number;
  empleado: string;
  idVenta: number;
  numeroVenta: number;
  condicionPago: string;
  estadoCobro: string;
  producto: string;
  categoria: string | null;
  fechaVenta: string;
  cantidad: number;
  baseCalculo: number;
  baseCategoria: number | null;
  regla: number | null;
  tipoMovimiento: string;
  monto: number;
  tipoCalculo: string;
  valorAplicado: number;
}

export interface CommissionReversalRequestDto {
  Id: number;
  IdEmpleado: number;
  IdVenta: number;
  Estado: string;
  MontoSolicitado: number;
  MontoAplicado: number;
  Motivo: string;
  ObservacionesRevision: string | null;
  FechaSolicitud: string;
  FechaRevision: string | null;
  DevolucionComercial: { Id: number; FechaAutorizacion: string } | null;
  Empleado: { Entidad: { NombreCompleto: string } };
  Venta: { NumeroVenta: number };
  DetalleVenta: { Nombre: string };
  Solicitante: { Id: number; Nombre: string };
  Revisor: { Id: number; Nombre: string } | null;
}

export async function listCommissionAccruals(mes: number, anio: number) {
  const { data } = await api.get<ApiResponse<CommissionAccrualDto[]>>(
    "/api/planilla/comisiones/devengadas",
    { params: { mes, anio } },
  );
  return data.data ?? [];
}

export async function listCommissionReversalRequests() {
  const { data } = await api.get<ApiResponse<CommissionReversalRequestDto[]>>(
    "/api/planilla/comisiones/reversiones",
  );
  return data.data ?? [];
}

export async function reviewCommissionReversalRequest(
  id: number,
  decision: "APROBAR" | "RECHAZAR",
  observaciones: string,
) {
  await api.post(`/api/planilla/comisiones/reversiones/${id}/revisar`, { decision, observaciones });
}

export async function cancelCommissionReversalRequest(id: number, observaciones: string) {
  await api.patch(`/api/planilla/comisiones/reversiones/${id}/anular`, { observaciones });
}
