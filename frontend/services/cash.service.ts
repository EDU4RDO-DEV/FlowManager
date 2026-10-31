import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";

export interface CashMovementDto {
  Id: number;
  Tipo: "INGRESO" | "EGRESO";
  MetodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  Monto: number;
  FechaMovimiento: string;
  Concepto: string;
  Usuario: { Id: number; Nombre: string };
}

export interface CashSessionDto {
  Id: number;
  Estado: "ABIERTA" | "CERRADA";
  FechaApertura: string;
  FechaCierre: string | null;
  SaldoInicial: number;
  EfectivoEsperado: number | null;
  EfectivoContado: number | null;
  DiferenciaEfectivo: number | null;
  ObservacionesCierre: string | null;
  UsuarioApertura: { Id: number; Nombre: string };
  UsuarioCierre: { Id: number; Nombre: string } | null;
  Totales: {
    efectivoIngresos: number;
    efectivoEgresos: number;
    transferenciasIngresos: number;
    transferenciasEgresos: number;
    otrosIngresos: number;
    otrosEgresos: number;
  };
  Movimientos: CashMovementDto[];
}

export async function getCurrentCashSession(): Promise<CashSessionDto | null> {
  const { data } = await api.get<ApiResponse<CashSessionDto | null>>("/api/cash/current");
  return data.data ?? null;
}

export async function listCashSessions(): Promise<CashSessionDto[]> {
  const { data } = await api.get<ApiResponse<CashSessionDto[]>>("/api/cash/sessions");
  return data.data ?? [];
}

export async function openCashSession(saldoInicial: number): Promise<CashSessionDto> {
  const { data } = await api.post<ApiResponse<CashSessionDto>>("/api/cash/open", { saldoInicial });
  if (!data.data) throw new Error(data.message || "No se pudo abrir la caja");
  return data.data;
}

export async function closeCashSession(
  id: number,
  payload: { efectivoContado: number; observaciones?: string },
): Promise<CashSessionDto> {
  const { data } = await api.post<ApiResponse<CashSessionDto>>(
    `/api/cash/sessions/${id}/close`,
    payload,
  );
  if (!data.data) throw new Error(data.message || "No se pudo cerrar la caja");
  return data.data;
}
