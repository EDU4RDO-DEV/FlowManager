import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ProductionOrderDto,
  ProductionOrderDetailDto,
  ProductionOrderDetailResponse,
  ProductionOrderListResult,
  ProductionOrdersResponse,
  ProductionRecipeDto,
  ProductionRecipesResponse,
} from "@/types/production";

export async function listProductionRecipes(): Promise<ProductionRecipeDto[]> {
  const { data } = await api.get<ProductionRecipesResponse>("/api/production/recipes");
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al cargar recetas");
  }
  return data.data;
}

export async function listProductionOrders(input: {
  page?: number;
  limit?: number;
  busqueda?: string;
  estado?: ProductionOrderDto["estado"];
} = {}): Promise<ProductionOrderListResult> {
  const { data } = await api.get<ProductionOrdersResponse>("/api/production/orders", {
    params: input,
  });
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al cargar órdenes");
  }
  return data.data;
}

export async function getProductionOrder(id: number): Promise<ProductionOrderDetailDto> {
  const { data } = await api.get<ProductionOrderDetailResponse>(`/api/production/orders/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al consultar la orden");
  }
  return data.data;
}

export async function createProductionOrder(input: {
  idProductoTerminado: number;
  cantidadProducir: number;
}): Promise<ProductionOrderDto> {
  const { data } = await api.post<ApiResponse<ProductionOrderDto>>("/api/production/orders", input);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear orden");
  }
  return data.data;
}

export async function confirmProductionOrder(id: number): Promise<ProductionOrderDto> {
  const { data } = await api.post<ApiResponse<ProductionOrderDto>>(`/api/production/orders/${id}/confirm`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al confirmar fabricación");
  }
  return data.data;
}

export async function cancelProductionOrder(id: number): Promise<ProductionOrderDto> {
  const { data } = await api.patch<ApiResponse<ProductionOrderDto>>(`/api/production/orders/${id}/cancel`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al cancelar orden");
  }
  return data.data;
}
