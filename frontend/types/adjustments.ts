import type { ApiResponse } from "./auth";

export interface AdjustmentInventarioItemDto {
  id: number;
  nombre: string;
  categoria: string;
  existencia: number;
  anulado: boolean;
}

export interface AdjustmentDto {
  id: number;
  idInventarioItem: number;
  idUsuario: number;
  tipoAjuste: "ENTRADA" | "SALIDA";
  numeroAjuste: number;
  cantidadAjustada: number;
  observacion: string | null;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  inventarioItem: AdjustmentInventarioItemDto;
}

export interface AdjustmentListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdjustmentListResult {
  items: AdjustmentDto[];
  pagination: AdjustmentListPagination;
}

export type AdjustmentsListResponse = ApiResponse<AdjustmentListResult>;
export type AnulatedAdjustmentsListResponse = ApiResponse<AdjustmentDto[]>;

export interface AdjustmentFilters {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoAjuste?: "ENTRADA" | "SALIDA";
  anulado?: boolean;
  idInventarioItem?: number;
}

export interface CreateAdjustmentPayload {
  idUsuario: number;
  idInventarioItem: number;
  tipoAjuste: "ENTRADA" | "SALIDA";
  cantidadAjustada: number;
  observacion: string;
}

export interface DeleteAdjustmentPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreAdjustmentPayload {
  idUsuarioModificador?: number;
}
