import type { ApiResponse } from "@/types/auth";

export interface ProductionRecipeComponentDto {
  idInventarioItem: number;
  nombre: string;
  categoria: string;
  cantidadPorUnidad: number;
  unidadMedida: string | null;
  existencia: number;
  activo: boolean;
}

export interface ProductionRecipeDto {
  id: number;
  nombre: string;
  existencia: number;
  unidadMedida: string | null;
  componentes: ProductionRecipeComponentDto[];
  aptoParaProduccion: boolean;
  errores: string[];
}

export interface ProductionOrderDetailDto {
  idInventarioItem: number;
  nombre: string;
  cantidadPorUnidad: number;
  cantidadRequerida: number;
  unidadMedida: string;
}

export interface ProductionOrderDto {
  id: number;
  idProductoTerminado: number;
  productoTerminado: {
    id: number;
    nombre: string;
  };
  cantidadProducir: number;
  unidadMedida: string;
  estado: "PENDIENTE" | "FABRICADA" | "CANCELADA";
  fechaRegistro: string | null;
  detalles: ProductionOrderDetailDto[];
}

export interface ProductionInventoryMovementDto {
  id: number;
  idInventarioItem: number;
  nombre: string;
  tipo: "ENTRADA" | "CONSUMO";
  cantidad: number;
  existenciaAnterior: number;
  nuevaExistencia: number;
  unidadMedida: string | null;
  fechaRegistro: string | null;
  anulado: boolean;
}

export interface ProductionOrderDetailDto extends ProductionOrderDto {
  movimientos: ProductionInventoryMovementDto[];
}

export interface ProductionOrderListResult {
  items: ProductionOrderDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ProductionRecipesResponse = ApiResponse<ProductionRecipeDto[]>;
export type ProductionOrdersResponse = ApiResponse<ProductionOrderListResult>;
export type ProductionOrderDetailResponse = ApiResponse<ProductionOrderDetailDto>;
