import { api } from "@/lib/api";
import type {
  AnulateSalePayload,
  AnulateTalonarioPayload,
  BonusPreviewItem,
  BonusPreviewResponse,
  CreateSalePaymentPayload,
  CreateSalePaymentResponse,
  CreateSalePaymentResult,
  CreateSalePayload,
  CreateSaleResponse,
  CreateSaleResult,
  CreateTalonarioPayload,
  FelPingRequest,
  FelPingResponse,
  FelPingResult,
  FelReceptorResponse,
  FelReceptorResult,
  ResolveSalePriceResponse,
  ResolveSalePriceResult,
  RestoreTalonarioPayload,
  RouteSessionOptionDto,
  RouteSessionOptionsResponse,
  SaleByIdResponse,
  SaleDto,
  SalePaymentDto,
  SalePaymentsResponse,
  SalesFilters,
  SalesListResponse,
  SalesListResult,
  TalonarioResponse,
  TalonarioDto,
  TalonariosResponse,
  UploadSaleImageResponse,
  UploadSaleImageResult,
  UpdateTalonarioPayload,
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
      ...(filters.estadoEntrega ? { estadoEntrega: filters.estadoEntrega } : {}),
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

export async function pingFel(payload: FelPingRequest): Promise<FelPingResult> {
  const { data } = await api.post<FelPingResponse>("/api/ventas/fel/ping", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida de diagnóstico FEL");
  }

  return data.data;
}

export async function getFelReceptorInfo(nit: string): Promise<FelReceptorResult> {
  const { data } = await api.get<FelReceptorResponse>("/api/ventas/fel/receptor", {
    params: { nit },
  });

  if (!data.data) {
    throw new Error(data.message || "No se pudo consultar el receptor FEL");
  }

  return data.data;
}

export async function listTalonarios(): Promise<TalonarioDto[]> {
  const { data } = await api.get<TalonariosResponse>("/api/talonarios");
  return data.data ?? [];
}

export async function listAnulatedTalonarios(): Promise<TalonarioDto[]> {
  const { data } = await api.get<TalonariosResponse>("/api/talonarios/anulados");
  return data.data ?? [];
}

export async function createTalonario(payload: CreateTalonarioPayload): Promise<TalonarioDto> {
  const { data } = await api.post<TalonarioResponse>("/api/talonarios", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al crear talonario");
  }

  return data.data;
}

export async function updateTalonario(id: number, payload: UpdateTalonarioPayload): Promise<TalonarioDto> {
  const { data } = await api.patch<TalonarioResponse>(`/api/talonarios/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al actualizar talonario");
  }

  return data.data;
}

export async function anulateTalonario(id: number, payload?: AnulateTalonarioPayload): Promise<void> {
  await api.patch(`/api/talonarios/${id}/anular`, payload ?? {});
}

export async function restoreTalonario(id: number, payload?: RestoreTalonarioPayload): Promise<TalonarioDto> {
  const { data } = await api.patch<TalonarioResponse>(`/api/talonarios/${id}/restaurar`, payload ?? {});
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al restaurar talonario");
  }

  return data.data;
}

export async function createSale(payload: CreateSalePayload): Promise<CreateSaleResult> {
  const { data } = await api.post<CreateSaleResponse>("/api/ventas", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al crear venta");
  }

  return data.data;
}

export async function getSaleById(id: number): Promise<SaleDto> {
  const { data } = await api.get<SaleByIdResponse>(`/api/ventas/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al obtener venta");
  }

  return data.data;
}

export async function listSalePayments(idVenta: number): Promise<SalePaymentDto[]> {
  const { data } = await api.get<SalePaymentsResponse>(`/api/ventas/${idVenta}/pagos`);
  return data.data ?? [];
}

export async function createSalePayment(
  idVenta: number,
  payload: CreateSalePaymentPayload,
): Promise<CreateSalePaymentResult> {
  const { data } = await api.post<CreateSalePaymentResponse>(`/api/ventas/${idVenta}/pagos`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al registrar pago");
  }

  return data.data;
}

export async function anulateSalePayment(idVenta: number, idPago: number, idUsuarioAnulador?: number): Promise<void> {
  await api.patch(`/api/ventas/${idVenta}/pagos/${idPago}/anular`, {
    ...(idUsuarioAnulador ? { idUsuarioAnulador } : {}),
  });
}

export async function uploadSaleProofImage(file: File): Promise<UploadSaleImageResult> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<UploadSaleImageResponse>("/api/ventas/upload-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al subir imagen de constancia");
  }

  return data.data;
}

export async function resolveSalePrice(idCliente: number, idInventarioItem: number): Promise<ResolveSalePriceResult> {
  const { data } = await api.get<ResolveSalePriceResponse>("/api/ventas/precio", {
    params: { idCliente, idInventarioItem },
  });

  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al resolver precio");
  }

  return data.data;
}

export async function previewSaleBonuses(
  detalle: Array<{ idInventarioItem: number; cantidad: number }>,
): Promise<BonusPreviewItem[]> {
  const { data } = await api.post<BonusPreviewResponse>("/api/ventas/bonificaciones/preview", { detalle });
  return data.data ?? [];
}

export async function listAvailableRouteSessions(idUsuarioVendedor?: number): Promise<RouteSessionOptionDto[]> {
  const { data } = await api.get<RouteSessionOptionsResponse>("/api/ventas/rutas-sesiones", {
    params: idUsuarioVendedor !== undefined ? { idUsuarioVendedor } : undefined,
  });
  return data.data ?? [];
}

export async function anulateSale(id: number, payload?: AnulateSalePayload): Promise<void> {
  await api.patch(`/api/ventas/${id}/anular`, payload ?? {});
}

