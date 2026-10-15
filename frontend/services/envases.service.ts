import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  EnvaseClienteSaldoDto,
  EnvasePhysicalBalanceDto,
  EnvasePhysicalCountPayload,
  EnvasesListResponse,
  MovimientoEnvaseDto,
  RegistrarBajaEnvasePayload,
  RegistrarDevolucionPayload,
  RegistrarPerdidaEnvasePayload,
  RegistrarPrestamoPayload,
  ReconcileEnvasePhysicalStockPayload,
} from "@/types/envases";

const pendingIdempotencyKeys = new Map<string, string>();

async function postIdempotent<T>(url: string, payload: unknown): Promise<T> {
  const identity = `${url}:${JSON.stringify(payload)}`;
  const key = pendingIdempotencyKeys.get(identity) ?? crypto.randomUUID();
  pendingIdempotencyKeys.set(identity, key);
  const { data } = await api.post<T>(url, payload, {
    headers: { "Idempotency-Key": key },
  });
  pendingIdempotencyKeys.delete(identity);
  return data;
}

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

export async function listEnvasePhysicalBalances(): Promise<EnvasePhysicalBalanceDto[]> {
  const { data } = await api.get<EnvasesListResponse<EnvasePhysicalBalanceDto>>("/api/envases/existencias");
  return data.data ?? [];
}

export async function reconcileEnvasePhysicalStock(
  payload: ReconcileEnvasePhysicalStockPayload,
): Promise<void> {
  await api.post("/api/envases/existencias/reconciliar", payload);
}

export async function registerEnvasePhysicalCount(
  payload: EnvasePhysicalCountPayload,
  regularize = false,
): Promise<void> {
  await postIdempotent(
    `/api/envases/existencias/${regularize ? "regularizar" : "conteo"}`,
    payload,
  );
}

export async function registrarPrestamoEnvase(
  payload: RegistrarPrestamoPayload,
): Promise<MovimientoEnvaseDto> {
  const data = await postIdempotent<ApiResponse<MovimientoEnvaseDto>>("/api/envases/prestamos", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar préstamo");
  }
  return data.data;
}

export async function registrarDevolucionEnvase(
  payload: RegistrarDevolucionPayload,
): Promise<MovimientoEnvaseDto> {
  const data = await postIdempotent<ApiResponse<MovimientoEnvaseDto>>("/api/envases/devoluciones", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar devolución");
  }
  return data.data;
}

export async function registrarPerdidaEnvase(
  payload: RegistrarPerdidaEnvasePayload,
): Promise<MovimientoEnvaseDto> {
  const data = await postIdempotent<ApiResponse<MovimientoEnvaseDto>>("/api/envases/perdidas", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar pérdida");
  }
  return data.data;
}

export async function registrarBajaEnvase(
  payload: RegistrarBajaEnvasePayload,
): Promise<MovimientoEnvaseDto> {
  const data = await postIdempotent<ApiResponse<MovimientoEnvaseDto>>("/api/envases/bajas", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al registrar baja");
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
