import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  AnulatedProductStructureListResponse,
  CreateProductStructurePayload,
  DeleteProductStructurePayload,
  ProductStructureDto,
  ProductStructureListResponse,
  RestoreProductStructurePayload,
  UpdateProductStructurePayload,
} from "@/types/product-structure";

export async function listStructureByProduct(
  idProducto: number,
  anulado?: boolean,
): Promise<ProductStructureDto[]> {
  const { data } = await api.get<ProductStructureListResponse>(
    `/api/product-structure/product/${idProducto}`,
    {
      params: {
        ...(anulado !== undefined ? { anulado: String(anulado) } : {}),
      },
    },
  );

  return data.data ?? [];
}

export async function getStructureById(id: number): Promise<ProductStructureDto> {
  const { data } = await api.get<ApiResponse<ProductStructureDto>>(
    `/api/product-structure/${id}`,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener componente");
  }
  return data.data;
}

export async function createProductStructure(
  payload: CreateProductStructurePayload,
): Promise<ProductStructureDto> {
  const { data } = await api.post<ApiResponse<ProductStructureDto>>(
    "/api/product-structure",
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear componente");
  }
  return data.data;
}

export async function updateProductStructure(
  id: number,
  payload: UpdateProductStructurePayload,
): Promise<ProductStructureDto> {
  const { data } = await api.patch<ApiResponse<ProductStructureDto>>(
    `/api/product-structure/${id}`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar componente");
  }
  return data.data;
}

export async function deleteProductStructure(
  id: number,
  payload?: DeleteProductStructurePayload,
): Promise<void> {
  await api.delete(`/api/product-structure/${id}`, { data: payload });
}

export async function listAnulatedStructureByProduct(
  idProducto: number,
): Promise<ProductStructureDto[]> {
  const { data } = await api.get<AnulatedProductStructureListResponse>(
    `/api/product-structure/product/${idProducto}/anulados`,
  );
  return data.data ?? [];
}

export async function restoreProductStructure(
  id: number,
  payload?: RestoreProductStructurePayload,
): Promise<ProductStructureDto> {
  const { data } = await api.patch<ApiResponse<ProductStructureDto>>(
    `/api/product-structure/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar componente");
  }
  return data.data;
}
