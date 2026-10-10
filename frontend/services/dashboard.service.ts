import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type { DashboardData, DashboardFilters } from "@/types/dashboard";

export async function getDashboardData(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const { data } = await api.get<ApiResponse<DashboardData>>("/api/dashboard", {
    params: filters,
    signal,
  });

  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar el dashboard");
  }

  return data.data;
}
