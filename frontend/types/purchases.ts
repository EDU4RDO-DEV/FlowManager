import type { ApiResponse } from "./auth";

export interface PurchaseProviderDto {
  id: number;
  nombre: string;
  anulado: boolean;
}

export interface PurchaseUserDto {
  id: number;
  nombre: string;
  correo: string;
}

export interface PurchaseInventoryItemDto {
  id: number;
  nombre: string;
  categoria: string;
  existencia: number;
  anulado: boolean;
}

export interface PurchaseDetailItemDto {
  id: number;
  idCompra: number;
  idInventarioItem: number;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  inventarioItem: PurchaseInventoryItemDto;
}

export interface PurchaseExpenseItemDto {
  id: number;
  idCompra: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
}

export interface PurchaseDto {
  id: number;
  idProveedor: number;
  idUsuario: number;
  numeroCompra: number;
  numeroFactura: string;
  esGasto: boolean;
  observaciones: string | null;
  fechaFactura: string;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  proveedor: PurchaseProviderDto;
  usuario: PurchaseUserDto;
  detalleCompra: PurchaseDetailItemDto[];
  detalleGasto: PurchaseExpenseItemDto[];
  totalDetalleCompra: number;
  totalDetalleGasto: number;
  totalGeneral: number;
}

export interface PurchasesListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PurchasesListResult {
  items: PurchaseDto[];
  pagination: PurchasesListPagination;
}

export type PurchasesListResponse = ApiResponse<PurchasesListResult>;
export type PurchaseResponse = ApiResponse<PurchaseDto>;

export interface PurchaseFilters {
  page?: number;
  limit?: number;
  busqueda?: string;
  idProveedor?: number;
  esGasto?: boolean;
  anulado?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface CreatePurchaseDetailPayload {
  idInventarioItem: number;
  cantidad: number;
  costoUnitario: number;
}

export interface CreatePurchaseExpensePayload {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CreatePurchasePayload {
  idUsuario: number;
  idProveedor: number;
  numeroFactura: string;
  esGasto: boolean;
  observaciones?: string;
  fechaFactura: string;
  detalleCompra?: CreatePurchaseDetailPayload[];
  detalleGasto?: CreatePurchaseExpensePayload[];
}

export interface AnulatePurchasePayload {
  idUsuarioAnulador?: number;
}

export type PurchaseExpensesResponse = ApiResponse<PurchaseExpenseItemDto[]>;
export type PurchaseExpenseResponse = ApiResponse<PurchaseExpenseItemDto>;

export interface UpdatePurchaseExpensePayload {
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
}

export interface DeletePurchaseExpensePayload {
  idUsuarioAnulador?: number;
}
