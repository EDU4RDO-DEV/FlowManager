import type { ApiResponse } from "./auth";

export type AdjustmentNameOption =
  | "AJUSTE POR CONTEO"
  | "MERMA POR DANIO"
  | "MERMA POR VENCIMIENTO"
  | "DEVOLUCION A PROVEEDOR"
  | "CONSUMO INTERNO"
  | "RECLASIFICACION DE INVENTARIO";

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
  nombreAjuste: string | null;
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
  nombreAjuste: AdjustmentNameOption;
  observacion: string;
  items: Array<{
    idInventarioItem: number;
    tipoAjuste: "ENTRADA" | "SALIDA";
    cantidadAjustada: number;
  }>;
}

export interface CreateAdjustmentResult {
  numeroAjuste: number;
  nombreAjuste: string;
  totalItems: number;
  items: AdjustmentDto[];
}

export interface DeleteAdjustmentPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreAdjustmentPayload {
  idUsuarioModificador?: number;
}
