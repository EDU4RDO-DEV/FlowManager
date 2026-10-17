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

export interface AdjustmentOperationDto {
  numeroAjuste: number;
  nombreAjuste: string | null;
  observacion: string | null;
  fechaRegistro: string | null;
  fechaAnulacion: string | null;
  idUsuario: number;
  responsable: string;
  tiposAjuste: Array<"ENTRADA" | "SALIDA">;
  tipoAjuste: "ENTRADA" | "SALIDA" | "MIXTO";
  estado: "ACTIVO" | "ANULADO" | "PARCIAL";
  totalProductos: number;
}

export interface AdjustmentOperationDetailDto extends AdjustmentOperationDto {
  items: Array<
    AdjustmentDto & {
      existenciaAnterior: number | null;
      existenciaResultante: number | null;
    }
  >;
}

export interface AdjustmentOperationSummary {
  total: number;
  active: number;
  entradas: number;
  salidas: number;
  mixtos: number;
  anulados: number;
}

export interface AdjustmentOperationListResult {
  items: AdjustmentOperationDto[];
  pagination: AdjustmentListPagination;
  summary: AdjustmentOperationSummary;
}

export type AdjustmentsListResponse = ApiResponse<AdjustmentListResult>;
export type AnulatedAdjustmentsListResponse = ApiResponse<AdjustmentDto[]>;
export type AdjustmentOperationsListResponse = ApiResponse<AdjustmentOperationListResult>;

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

export interface AdjustmentOperationPayload {
  idUsuarioAnulador?: number;
  idUsuarioModificador?: number;
}
