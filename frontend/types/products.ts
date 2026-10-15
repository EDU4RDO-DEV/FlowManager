import type { ApiResponse } from "@/types/auth";

export interface ProductProviderDto {
  id: number;
  nombre: string;
  anulado: boolean;
}

export interface ProductDto {
  id: number;
  idUsuario: number;
  idProveedor: number;
  nombre: string;
  categoria: "ENVASE" | "INSUMO" | "PRODUCTO_TERMINADO" | "MATERIA_PRIMA";
  unidadMedida: string | null;
  existencia: number;
  costoPromedio: number;
  precioVenta: number;
  rutaImagen: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  proveedor: ProductProviderDto;
}

export interface ProductListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResult {
  items: ProductDto[];
  pagination: ProductListPagination;
}

export type ProductsListResponse = ApiResponse<ProductListResult>;
export type AnulatedProductsListResponse = ApiResponse<ProductDto[]>;

export interface ProductFilters {
  page?: number;
  limit?: number;
  busqueda?: string;
  categoria?: ProductDto["categoria"];
  anulado?: boolean;
  idProveedor?: number;
}

export interface CreateProductPayload {
  idUsuario: number;
  idProveedor: number;
  nombre: string;
  categoria: ProductDto["categoria"];
  unidadMedida?: string;
  costoPromedio: number;
  precioVenta?: number;
  rutaImagen?: string;
}

export interface UpdateProductPayload {
  idUsuario?: number;
  idUsuarioModificador?: number;
  idProveedor?: number;
  nombre?: string;
  categoria?: ProductDto["categoria"];
  unidadMedida?: string | null;
  costoPromedio?: number;
  precioVenta?: number;
  rutaImagen?: string;
}

export interface DeleteProductPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreProductPayload {
  idUsuarioModificador?: number;
}

export interface UploadProductImageResult {
  rutaImagen: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export type UploadProductImageResponse = ApiResponse<UploadProductImageResult>;
