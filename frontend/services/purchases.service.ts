import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  AnulatePurchasePayload,
  CreatePurchaseExpensePayload,
  CreatePurchasePayload,
  DeletePurchaseExpensePayload,
  PurchaseDto,
  PurchaseExpenseItemDto,
  PurchaseExpenseResponse,
  PurchaseExpensesResponse,
  PurchaseFilters,
  PurchaseResponse,
  RestorePurchaseExpensePayload,
  RestorePurchasePayload,
  PurchasesListResponse,
  PurchasesListResult,
  UpdatePurchaseExpensePayload,
} from "@/types/purchases";

export async function listPurchases(
  filters: PurchaseFilters = {},
): Promise<PurchasesListResult> {
  const { data } = await api.get<PurchasesListResponse>("/api/compras", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
      ...(filters.idProveedor !== undefined
        ? { idProveedor: filters.idProveedor }
        : {}),
      ...(filters.esGasto !== undefined
        ? { esGasto: String(filters.esGasto) }
        : {}),
      ...(filters.anulado !== undefined
        ? { anulado: String(filters.anulado) }
        : {}),
      ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde } : {}),
      ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta } : {}),
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

export async function getPurchaseById(id: number): Promise<PurchaseDto> {
  const { data } = await api.get<PurchaseResponse>(`/api/compras/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener compra");
  }

  return data.data;
}

export async function createPurchase(
  payload: CreatePurchasePayload,
): Promise<PurchaseDto> {
  const { data } = await api.post<PurchaseResponse>("/api/compras", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear compra");
  }

  return data.data;
}

export async function anulatePurchase(
  id: number,
  payload?: AnulatePurchasePayload,
): Promise<void> {
  await api.patch(`/api/compras/${id}/anular`, payload);
}

export async function restorePurchase(
  id: number,
  payload?: RestorePurchasePayload,
): Promise<PurchaseDto> {
  const { data } = await api.patch<PurchaseResponse>(`/api/compras/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar compra");
  }

  return data.data;
}

export async function listPurchaseExpenses(
  idCompra: number,
): Promise<PurchaseExpenseItemDto[]> {
  const { data } = await api.get<PurchaseExpensesResponse>(
    `/api/compras/${idCompra}/gastos`,
  );
  return data.data ?? [];
}

export async function createPurchaseExpense(
  idCompra: number,
  payload: CreatePurchaseExpensePayload,
): Promise<PurchaseExpenseItemDto> {
  const { data } = await api.post<PurchaseExpenseResponse>(
    `/api/compras/${idCompra}/gastos`,
    payload,
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear gasto de compra");
  }

  return data.data;
}

export async function updatePurchaseExpense(
  idCompra: number,
  idGasto: number,
  payload: UpdatePurchaseExpensePayload,
): Promise<PurchaseExpenseItemDto> {
  const { data } = await api.patch<PurchaseExpenseResponse>(
    `/api/compras/${idCompra}/gastos/${idGasto}`,
    payload,
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar gasto");
  }

  return data.data;
}

export async function deletePurchaseExpense(
  idCompra: number,
  idGasto: number,
  payload?: DeletePurchaseExpensePayload,
): Promise<void> {
  await api.delete(`/api/compras/${idCompra}/gastos/${idGasto}`, {
    data: payload,
  });
}

export async function restorePurchaseExpense(
  idCompra: number,
  idGasto: number,
  payload?: RestorePurchaseExpensePayload,
): Promise<PurchaseExpenseItemDto> {
  const { data } = await api.patch<PurchaseExpenseResponse>(
    `/api/compras/${idCompra}/gastos/${idGasto}/restaurar`,
    payload,
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar gasto");
  }

  return data.data;
}
