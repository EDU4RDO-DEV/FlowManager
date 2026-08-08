import type { ApiResponse } from "@/types/auth";

export interface ProductStructureMateriaPrimaDto {
  id: number;
  nombre: string;
  categoria: string;
  existencia: number;
  costoPromedio: number;
  precioVenta: number;
  esProductoFinal: boolean;
  rutaImagen: string | null;
  anulado: boolean;
}

export interface ProductStructureDto {
  id: number;
  idProductoTerminado: number;
  idMateriaPrima: number;
  cantidadRequerida: number;
  fechaRegistro: string | null;
  anulado: boolean;
  materiaPrima: ProductStructureMateriaPrimaDto;
}

export type ProductStructureListResponse = ApiResponse<ProductStructureDto[]>;

export interface CreateProductStructurePayload {
  idProductoTerminado: number;
  idMateriaPrima: number;
  cantidadRequerida: number;
}

export interface UpdateProductStructurePayload {
  cantidadRequerida?: number;
}
