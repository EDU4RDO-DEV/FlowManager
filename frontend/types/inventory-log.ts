import type { ApiResponse } from "./auth";

export interface InventoryLogItemDto {
  id: number;
  idInventarioItem: number;
  idUsuario: number;
  tipoDocumento: string | null;
  documento: string | null;
  nombre: string;
  tipoMovimiento: boolean;
  existenciaAnterior: number;
  cantidad: number;
  nuevaExistencia: number;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  inventarioItem: {
    id: number;
    nombre: string;
    categoria: string;
    anulado: boolean;
  };
  usuario: {
    id: number;
    nombre: string;
    correo: string;
  };
}

export interface InventoryLogListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InventoryLogListResult {
  items: InventoryLogItemDto[];
  pagination: InventoryLogListPagination;
}

export type InventoryLogListResponse = ApiResponse<InventoryLogListResult>;
export type InventoryLogAnulatedListResponse = ApiResponse<InventoryLogItemDto[]>;

export interface InventoryLogFilters {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoMovimiento?: boolean;
  anulado?: boolean;
  idInventarioItem?: number;
}
