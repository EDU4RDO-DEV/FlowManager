import { api } from "@/lib/api";
import type {
  FelPingRequest,
  FelPingResponse,
  FelPingResult,
  SalesFilters,
  SalesListResponse,
  SalesListResult,
  TalonarioDto,
  TalonariosResponse,
} from "@/types/sales";

export async function listSales(filters: SalesFilters = {}): Promise<SalesListResult> {
  const { data } = await api.get<SalesListResponse>("/api/ventas", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
      ...(filters.anulado !== undefined ? { anulado: String(filters.anulado) } : {}),
      ...(filters.condicionPago ? { condicionPago: filters.condicionPago } : {}),
      ...(filters.estadoPago ? { estadoPago: filters.estadoPago } : {}),
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

export async function pingFel(payload: FelPingRequest): Promise<FelPingResult> {
  const { data } = await api.post<FelPingResponse>("/api/ventas/fel/ping", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida de diagnóstico FEL");
  }

  return data.data;
}

export async function listTalonarios(): Promise<TalonarioDto[]> {
  const { data } = await api.get<TalonariosResponse>("/api/talonarios");
  return data.data ?? [];
}
