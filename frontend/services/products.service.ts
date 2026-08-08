import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  AnulatedProductsListResponse,
  CreateProductPayload,
  DeleteProductPayload,
  ProductDto,
  ProductFilters,
  ProductListResult,
  ProductsListResponse,
  RestoreProductPayload,
  UploadProductImageResponse,
  UploadProductImageResult,
  UpdateProductPayload,
} from "@/types/products";

export async function listProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
  const { data } = await api.get<ProductsListResponse>("/api/products", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
      ...(filters.categoria ? { categoria: filters.categoria } : {}),
      ...(filters.esProductoFinal !== undefined
        ? { esProductoFinal: String(filters.esProductoFinal) }
        : {}),
      ...(filters.anulado !== undefined ? { anulado: String(filters.anulado) } : {}),
      ...(filters.idProveedor !== undefined ? { idProveedor: filters.idProveedor } : {}),
    },
  });

  return (
    data.data ?? {
      items: [],
      pagination: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        total: 0,
        totalPages: 0,
      },
    }
  );
}

export async function getProductById(id: number): Promise<ProductDto> {
  const { data } = await api.get<ApiResponse<ProductDto>>(`/api/products/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener producto");
  }
  return data.data;
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductDto> {
  const { data } = await api.post<ApiResponse<ProductDto>>("/api/products", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear producto");
  }
  return data.data;
}

export async function updateProduct(id: number, payload: UpdateProductPayload): Promise<ProductDto> {
  const { data } = await api.patch<ApiResponse<ProductDto>>(`/api/products/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar producto");
  }
  return data.data;
}

export async function deleteProduct(id: number, payload?: DeleteProductPayload): Promise<void> {
  await api.delete(`/api/products/${id}`, { data: payload });
}

export async function listAnulatedProducts(): Promise<ProductDto[]> {
  const { data } = await api.get<AnulatedProductsListResponse>("/api/products/anulados");
  return data.data ?? [];
}

export async function restoreProduct(
  id: number,
  payload?: RestoreProductPayload,
): Promise<ProductDto> {
  const { data } = await api.patch<ApiResponse<ProductDto>>(`/api/products/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar producto");
  }
  return data.data;
}

export async function uploadProductImage(file: File): Promise<UploadProductImageResult> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<UploadProductImageResponse>(
    "/api/products/upload-image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al subir imagen");
  }

  return data.data;
}
