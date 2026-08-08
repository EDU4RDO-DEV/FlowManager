import { api } from "@/lib/api";
import type {
  InventoryLogAnulatedListResponse,
  InventoryLogFilters,
  InventoryLogItemDto,
  InventoryLogListResponse,
  InventoryLogListResult,
} from "@/types/inventory-log";

export async function listInventoryLog(
  filters: InventoryLogFilters = {},
): Promise<InventoryLogListResult> {
  const { data } = await api.get<InventoryLogListResponse>("/api/inventory-log", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
      ...(filters.tipoMovimiento !== undefined
        ? { tipoMovimiento: String(filters.tipoMovimiento) }
        : {}),
      ...(filters.anulado !== undefined ? { anulado: String(filters.anulado) } : {}),
      ...(filters.idInventarioItem !== undefined
        ? { idInventarioItem: filters.idInventarioItem }
        : {}),
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

export async function listAnulatedInventoryLog(): Promise<InventoryLogItemDto[]> {
  const { data } = await api.get<InventoryLogAnulatedListResponse>("/api/inventory-log/anulados");
  return data.data ?? [];
}
