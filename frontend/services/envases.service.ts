import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  EnvaseClienteSaldoDto,
  EnvasesListResponse,
  MovimientoEnvaseDto,
  RegistrarDevolucionPayload,
  RegistrarPrestamoPayload,
} from "@/types/envases";

export async function listMovimientosEnvase(params?: {
  idCliente?: number;
  idInventarioItem?: number;
  idVenta?: number;
  tipoMovimiento?: string;
  anulado?: boolean;
}): Promise<MovimientoEnvaseDto[]> {
  const { data } = await api.get<EnvasesListResponse<MovimientoEnvaseDto>>("/api/envases/movimientos", {
    params: {
      ...(params?.idCliente !== undefined ? { idCliente: params.idCliente } : {}),
      ...(params?.idInventarioItem !== undefined ? { idInventarioItem: params.idInventarioItem } : {}),
      ...(params?.idVenta !== undefined ? { idVenta: params.idVenta } : {}),
      ...(params?.tipoMovimiento ? { tipoMovimiento: params.tipoMovimiento } : {}),
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
    },
  });

  return data.data ?? [];
}

export async function listEnvaseSaldos(params?: {
  idCliente?: number;
  soloConSaldo?: boolean;
}): Promise<EnvaseClienteSaldoDto[]> {
  const { data } = await api.get<EnvasesListResponse<EnvaseClienteSaldoDto>>("/api/envases/saldos", {
    params: {
      ...(params?.idCliente !== undefined ? { idCliente: params.idCliente } : {}),
      ...(params?.soloConSaldo !== undefined ? { soloConSaldo: String(params.soloConSaldo) } : {}),
    },
  });

  return data.data ?? [];
}

export async function registrarPrestamoEnvase(
  payload: RegistrarPrestamoPayload,
): Promise<MovimientoEnvaseDto> {
  const { data } = await api.post<ApiResponse<MovimientoEnvaseDto>>("/api/envases/prestamos", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar préstamo");
  }
  return data.data;
}

export async function registrarDevolucionEnvase(
  payload: RegistrarDevolucionPayload,
): Promise<MovimientoEnvaseDto> {
  const { data } = await api.post<ApiResponse<MovimientoEnvaseDto>>("/api/envases/devoluciones", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar devolución");
  }
  return data.data;
}

export async function anulateMovimientoEnvase(
  id: number,
  payload?: { idUsuarioAnulador: number },
): Promise<void> {
  await api.patch(`/api/envases/movimientos/${id}/anular`, payload);
}

export async function restoreMovimientoEnvase(
  id: number,
  payload?: { idUsuarioModificador: number },
): Promise<MovimientoEnvaseDto> {
  const { data } = await api.patch<ApiResponse<MovimientoEnvaseDto>>(
    `/api/envases/movimientos/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar movimiento");
  }
  return data.data;
}
