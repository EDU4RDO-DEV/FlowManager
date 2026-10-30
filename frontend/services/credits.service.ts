import { api } from "@/lib/api";
import type {
  CreateCreditPaymentPayload,
  CreateCreditPaymentResponse,
  CreateCreditPaymentResult,
  CreateCreditTypePayload,
  CreateCustomerCreditConditionPayload,
  CustomerCreditAuthorization,
  CustomerCreditAuthorizationResponse,
  CustomerCreditConditionDto,
  CustomerCreditConditionResponse,
  CustomerCreditConditionsResponse,
  CreditDto,
  CreditResponse,
  CreditTypeDto,
  CreditTypeResponse,
  CreditTypesResponse,
  CreditsFilters,
  CreditsListResponse,
  CreditsListResult,
  CustomerCreditsResponse,
  UpdateCreditTypePayload,
  UpdateCustomerCreditConditionPayload,
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

export async function getCustomerCreditAuthorization(
  idCliente: number,
): Promise<CustomerCreditAuthorization> {
  const { data } = await api.get<CustomerCreditAuthorizationResponse>(
    `/api/credits/customer/${idCliente}/authorization`,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar la autorización de crédito");
  }

  return data.data;
}

export async function listCreditTypes(activo?: boolean): Promise<CreditTypeDto[]> {
  const { data } = await api.get<CreditTypesResponse>("/api/commercial-rules/tipos-credito", {
    params: activo === undefined ? undefined : { activo: String(activo) },
  });
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar los tipos de crédito");
  }
  return data.data;
}

export async function createCreditType(payload: CreateCreditTypePayload): Promise<CreditTypeDto> {
  const { data } = await api.post<CreditTypeResponse>("/api/commercial-rules/tipos-credito", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al crear el tipo de crédito");
  }
  return data.data;
}

export async function updateCreditType(
  id: number,
  payload: UpdateCreditTypePayload,
): Promise<CreditTypeDto> {
  const { data } = await api.patch<CreditTypeResponse>(`/api/commercial-rules/tipos-credito/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al actualizar el tipo de crédito");
  }
  return data.data;
}

export async function listCustomerCreditConditions(idCliente: number): Promise<CustomerCreditConditionDto[]> {
  const { data } = await api.get<CustomerCreditConditionsResponse>("/api/client-catalog/condiciones-credito", {
    params: { idCliente },
  });
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al consultar las condiciones de crédito");
  }
  return data.data;
}

export async function createCustomerCreditCondition(
  payload: CreateCustomerCreditConditionPayload,
): Promise<CustomerCreditConditionDto> {
  const { data } = await api.post<CustomerCreditConditionResponse>(
    "/api/client-catalog/condiciones-credito",
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al asignar la condición de crédito");
  }
  return data.data;
}

export async function updateCustomerCreditCondition(
  id: number,
  payload: UpdateCustomerCreditConditionPayload,
): Promise<CustomerCreditConditionDto> {
  const { data } = await api.patch<CustomerCreditConditionResponse>(
    `/api/client-catalog/condiciones-credito/${id}`,
    payload,
  );
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al actualizar la condición de crédito");
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
