import type { ApiResponse } from "@/types/auth";

export interface ControlCalidadDto {
  id: number;
  idUsuario: number;
  fecha: string;
  diaNoLaborado: boolean;
  cloroAntesFiltrado: number | null;
  cloroDespuesFiltrado: number | null;
  phAntesFiltrado: number | null;
  phDespuesFiltrado: number | null;
  observaciones: string | null;
  validado: boolean;
  idUsuarioValidador: number | null;
  fechaValidacion: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  usuario?: {
    id: number;
    nombre: string;
  };
  usuarioValidador?: {
    id: number;
    nombre: string;
  };
}

export type QualityListResponse = ApiResponse<ControlCalidadDto[]>;

export type CreateControlCalidadPayload = {
  idUsuario: number;
  fecha: string;
  diaNoLaborado?: boolean;
  cloroAntesFiltrado?: number;
  cloroDespuesFiltrado?: number;
  phAntesFiltrado?: number;
  phDespuesFiltrado?: number;
  observaciones?: string;
};

export type UpdateControlCalidadPayload = {
  diaNoLaborado?: boolean;
  cloroAntesFiltrado?: number | null;
  cloroDespuesFiltrado?: number | null;
  phAntesFiltrado?: number | null;
  phDespuesFiltrado?: number | null;
  observaciones?: string | null;
  idUsuarioModificador?: number;
};
