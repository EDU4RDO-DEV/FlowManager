import type { ApiResponse } from "@/types/auth";

export interface SessionDto {
  id: number;
  idUsuario: number;
  ip: string;
  nombreDispositivo: string;
  latitud: number | null;
  longitud: number | null;
  precision: number | null;
  fechaExpiracionToken: string;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
}

export type SessionsListResponse = ApiResponse<SessionDto[]>;

export interface DeleteSessionPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreSessionPayload {
  idUsuarioModificador?: number;
}
