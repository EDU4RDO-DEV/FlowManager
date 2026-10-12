import { api } from "@/lib/api";
import type {
  CreateCreditPaymentPayload,
  CreateCreditPaymentResponse,
  CreateCreditPaymentResult,
  CreditDto,
  CreditResponse,
  CreditsFilters,
  CreditsListResponse,
  CreditsListResult,
  CustomerCreditsResponse,
} from "@/types/credits";

export async function listCredits(filters: CreditsFilters = {}): Promise<CreditsListResult> {
  const { data } = await api.get<CreditsListResponse>("/api/credits", {
    params: {
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.idCliente !== undefined ? { idCliente: filters.idCliente } : {}),
      ...(filters.estadoPago ? { estadoPago: filters.estadoPago } : {}),
      ...(filters.anulado !== undefined ? { anulado: String(filters.anulado) } : {}),
      ...(filters.incluirAnulados !== undefined ? { incluirAnulados: String(filters.incluirAnulados) } : {}),
      ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde } : {}),
      ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta } : {}),
      ...(filters.busqueda ? { busqueda: filters.busqueda } : {}),
    },
  });

  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar cuentas por cobrar");
  }

  return data.data;
}

export async function getCreditById(id: number): Promise<CreditDto> {
  const { data } = await api.get<CreditResponse>(`/api/credits/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar la cuenta por cobrar");
  }

  return data.data;
}

export async function listCreditsByCustomer(idCliente: number): Promise<CreditDto[]> {
  const { data } = await api.get<CustomerCreditsResponse>(`/api/credits/customer/${idCliente}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar las cuentas del cliente");
  }

  return data.data;
}

export async function createCreditPayment(
  idCredit: number,
  payload: CreateCreditPaymentPayload,
  idempotencyKey: string,
): Promise<CreateCreditPaymentResult> {
  const { data } = await api.post<CreateCreditPaymentResponse>(
    `/api/credits/${idCredit}/payments`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al registrar el abono");
  }

  return data.data;
}
