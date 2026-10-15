import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  CreateGastoVehiculoPayload,
  CreateMantenimientoPayload,
  CreateRutaPayload,
  CreateRutaSesionPayload,
  CreateVehiculoPayload,
  GastoVehiculoDto,
  LogisticsListResponse,
  MantenimientoVehiculoDto,
  RutaDto,
  RutaSesionDto,
  RouteInventoryDto,
  UpdateGastoVehiculoPayload,
  UpdateMantenimientoPayload,
  UpdateRutaPayload,
  UpdateRutaSesionPayload,
  UpdateVehiculoPayload,
  VehiculoDto,
} from "@/types/logistics";

export async function listVehiculos(params?: {
  anulado?: boolean;
  estado?: string;
  disponible?: boolean;
}): Promise<VehiculoDto[]> {
  const { data } = await api.get<LogisticsListResponse<VehiculoDto>>("/api/logistics/vehiculos", {
    params: {
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
      ...(params?.estado ? { estado: params.estado } : {}),
      ...(params?.disponible !== undefined ? { disponible: String(params.disponible) } : {}),
    },
  });

  return data.data ?? [];
}

export async function createVehiculo(payload: CreateVehiculoPayload): Promise<VehiculoDto> {
  const { data } = await api.post<ApiResponse<VehiculoDto>>("/api/logistics/vehiculos", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear vehículo");
  }
  return data.data;
}

export async function updateVehiculo(id: number, payload: UpdateVehiculoPayload): Promise<VehiculoDto> {
  const { data } = await api.patch<ApiResponse<VehiculoDto>>(`/api/logistics/vehiculos/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar vehículo");
  }
  return data.data;
}

export async function deleteVehiculo(id: number, payload?: { idUsuarioAnulador: number }): Promise<void> {
  await api.delete(`/api/logistics/vehiculos/${id}`, { data: payload });
}

export async function restoreVehiculo(id: number, payload?: { idUsuarioModificador: number }): Promise<VehiculoDto> {
  const { data } = await api.patch<ApiResponse<VehiculoDto>>(
    `/api/logistics/vehiculos/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar vehículo");
  }
  return data.data;
}

export async function listRutas(params?: { anulado?: boolean }): Promise<RutaDto[]> {
  const { data } = await api.get<LogisticsListResponse<RutaDto>>("/api/logistics/rutas", {
    params: {
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
    },
  });
  return data.data ?? [];
}

export async function createRuta(payload: CreateRutaPayload): Promise<RutaDto> {
  const { data } = await api.post<ApiResponse<RutaDto>>("/api/logistics/rutas", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear ruta");
  }
  return data.data;
}

export async function updateRuta(id: number, payload: UpdateRutaPayload): Promise<RutaDto> {
  const { data } = await api.patch<ApiResponse<RutaDto>>(`/api/logistics/rutas/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar ruta");
  }
  return data.data;
}

export async function deleteRuta(id: number, payload?: { idUsuarioAnulador: number }): Promise<void> {
  await api.delete(`/api/logistics/rutas/${id}`, { data: payload });
}

export async function restoreRuta(id: number, payload?: { idUsuarioModificador: number }): Promise<RutaDto> {
  const { data } = await api.patch<ApiResponse<RutaDto>>(`/api/logistics/rutas/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar ruta");
  }
  return data.data;
}

export async function listRutaSesiones(params?: {
  idRuta?: number;
  idVehiculo?: number;
  anulado?: boolean;
  estado?: string;
}): Promise<RutaSesionDto[]> {
  const { data } = await api.get<LogisticsListResponse<RutaSesionDto>>("/api/logistics/rutas/sesiones", {
    params: {
      ...(params?.idRuta !== undefined ? { idRuta: params.idRuta } : {}),
      ...(params?.idVehiculo !== undefined ? { idVehiculo: params.idVehiculo } : {}),
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
      ...(params?.estado ? { estado: params.estado } : {}),
    },
  });

  return data.data ?? [];
}

export async function createRutaSesion(payload: CreateRutaSesionPayload): Promise<RutaSesionDto> {
  const { data } = await api.post<ApiResponse<RutaSesionDto>>("/api/logistics/rutas/sesiones", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear sesión");
  }
  return data.data;
}

export async function updateRutaSesion(
  idRuta: number,
  idSesion: number,
  payload: UpdateRutaSesionPayload,
): Promise<RutaSesionDto> {
  const { data } = await api.patch<ApiResponse<RutaSesionDto>>(
    `/api/logistics/rutas/${idRuta}/sesiones/${idSesion}`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar sesión");
  }
  return data.data;
}

export async function getRouteInventory(idRutaSesion: number): Promise<RouteInventoryDto> {
  const { data } = await api.get<ApiResponse<RouteInventoryDto>>(
    `/api/logistics/rutas/sesiones/${idRutaSesion}/inventario`,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al consultar inventario de ruta");
  }
  return data.data;
}

export async function getRouteSettlement(idRutaSesion: number): Promise<RouteInventoryDto> {
  const { data } = await api.get<ApiResponse<RouteInventoryDto>>(
    `/api/logistics/rutas/sesiones/${idRutaSesion}/liquidacion`,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al consultar liquidación de ruta");
  }
  return data.data;
}

export async function createRouteDispatch(
  idRutaSesion: number,
  payload: {
    observaciones?: string;
    detalle: Array<{
      idInventarioItem: number;
      cantidad: number;
      estadoEnvase?: "VACIO" | "LLENO";
    }>;
  },
): Promise<void> {
  await api.post(`/api/logistics/rutas/sesiones/${idRutaSesion}/despacho`, payload);
}

export async function createRouteReturn(
  idRutaSesion: number,
  payload: {
    observaciones?: string;
    detalle: Array<{
      idInventarioItem: number;
      cantidadRecibida: number;
      cantidadDanada: number;
      cantidadEnvaseVacio?: number;
      cantidadEnvaseLleno?: number;
      estadoEnvaseDanado?: "VACIO" | "LLENO";
      observaciones?: string;
      ubicacionDanada?: string;
    }>;
  },
): Promise<void> {
  await api.post(`/api/logistics/rutas/sesiones/${idRutaSesion}/devolucion`, payload);
}

export async function createRouteAdjustment(
  idRutaSesion: number,
  payload: {
    idInventarioItem: number;
    clasificacion: "FALTANTE" | "DANADO" | "OTRO";
    cantidad: number;
    motivo: string;
  },
): Promise<void> {
  await api.post(`/api/logistics/rutas/sesiones/${idRutaSesion}/ajustes`, payload);
}

export async function deleteRutaSesion(
  idRuta: number,
  idSesion: number,
  payload?: { idUsuarioAnulador: number },
): Promise<void> {
  await api.delete(`/api/logistics/rutas/${idRuta}/sesiones/${idSesion}`, { data: payload });
}

export async function restoreRutaSesion(
  idRuta: number,
  idSesion: number,
  payload?: { idUsuarioModificador: number },
): Promise<RutaSesionDto> {
  const { data } = await api.patch<ApiResponse<RutaSesionDto>>(
    `/api/logistics/rutas/${idRuta}/sesiones/${idSesion}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar sesión");
  }
  return data.data;
}

export async function listGastosVehiculo(params?: {
  idRutaSesion?: number;
  idRuta?: number;
  anulado?: boolean;
  estadoPago?: string;
}): Promise<GastoVehiculoDto[]> {
  const { data } = await api.get<LogisticsListResponse<GastoVehiculoDto>>("/api/logistics/gastos", {
    params: {
      ...(params?.idRutaSesion !== undefined ? { idRutaSesion: params.idRutaSesion } : {}),
      ...(params?.idRuta !== undefined ? { idRuta: params.idRuta } : {}),
      ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
      ...(params?.estadoPago ? { estadoPago: params.estadoPago } : {}),
    },
  });

  return data.data ?? [];
}

export async function createGastoVehiculo(payload: CreateGastoVehiculoPayload): Promise<GastoVehiculoDto> {
  const { data } = await api.post<ApiResponse<GastoVehiculoDto>>("/api/logistics/gastos", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear gasto");
  }
  return data.data;
}

export async function updateGastoVehiculo(id: number, payload: UpdateGastoVehiculoPayload): Promise<GastoVehiculoDto> {
  const { data } = await api.patch<ApiResponse<GastoVehiculoDto>>(`/api/logistics/gastos/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar gasto");
  }
  return data.data;
}

export async function deleteGastoVehiculo(id: number, payload?: { idUsuarioAnulador: number }): Promise<void> {
  await api.delete(`/api/logistics/gastos/${id}`, { data: payload });
}

export async function restoreGastoVehiculo(id: number, payload?: { idUsuarioModificador: number }): Promise<GastoVehiculoDto> {
  const { data } = await api.patch<ApiResponse<GastoVehiculoDto>>(`/api/logistics/gastos/${id}/restaurar`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar gasto");
  }
  return data.data;
}

export async function uploadGastoVehiculoImage(file: File): Promise<{ rutaImagen: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ApiResponse<{ rutaImagen: string; url: string }>>(
    "/api/logistics/gastos/upload-image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al subir comprobante");
  }

  return data.data;
}

export async function listMantenimientos(params?: {
  idVehiculo?: number;
  estado?: string;
  tipoMantenimiento?: string;
  anulado?: boolean;
}): Promise<MantenimientoVehiculoDto[]> {
  const { data } = await api.get<LogisticsListResponse<MantenimientoVehiculoDto>>(
    "/api/logistics/mantenimientos",
    {
      params: {
        ...(params?.idVehiculo !== undefined ? { idVehiculo: params.idVehiculo } : {}),
        ...(params?.estado ? { estado: params.estado } : {}),
        ...(params?.tipoMantenimiento ? { tipoMantenimiento: params.tipoMantenimiento } : {}),
        ...(params?.anulado !== undefined ? { anulado: String(params.anulado) } : {}),
      },
    },
  );

  return data.data ?? [];
}

export async function listAnulatedMantenimientos(): Promise<MantenimientoVehiculoDto[]> {
  const { data } = await api.get<LogisticsListResponse<MantenimientoVehiculoDto>>(
    "/api/logistics/mantenimientos/anulados",
  );
  return data.data ?? [];
}

export async function createMantenimiento(
  payload: CreateMantenimientoPayload,
): Promise<MantenimientoVehiculoDto> {
  const { data } = await api.post<ApiResponse<MantenimientoVehiculoDto>>(
    "/api/logistics/mantenimientos",
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear mantenimiento");
  }
  return data.data;
}

export async function updateMantenimiento(
  id: number,
  payload: UpdateMantenimientoPayload,
): Promise<MantenimientoVehiculoDto> {
  const { data } = await api.patch<ApiResponse<MantenimientoVehiculoDto>>(
    `/api/logistics/mantenimientos/${id}`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar mantenimiento");
  }
  return data.data;
}

export async function deleteMantenimiento(id: number, payload?: { idUsuarioAnulador: number }): Promise<void> {
  await api.delete(`/api/logistics/mantenimientos/${id}`, { data: payload });
}

export async function restoreMantenimiento(
  id: number,
  payload?: { idUsuarioModificador: number },
): Promise<MantenimientoVehiculoDto> {
  const { data } = await api.patch<ApiResponse<MantenimientoVehiculoDto>>(
    `/api/logistics/mantenimientos/${id}/restaurar`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al restaurar mantenimiento");
  }
  return data.data;
}
