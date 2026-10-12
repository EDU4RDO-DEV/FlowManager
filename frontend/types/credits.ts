import type { ApiResponse } from "@/types/auth";

export type CreditPaymentStatus = "PENDIENTE" | "PARCIAL" | "PAGADO";

export interface CreditPaymentDto {
  id: number;
  idVenta: number;
  monto: number;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  numeroReferencia: string | null;
  banco: string | null;
  fechaPago: string | null;
  rutaFirma: string | null;
  observaciones: string | null;
  anulado: boolean;
  fechaAnulacion: string | null;
  estado: "REGISTRADO" | "ANULADO";
  usuario: {
    id: number;
    nombre: string;
    correo: string;
  };
}

export interface CreditDto {
  id: number;
  idVenta: number;
  totalOriginal: number;
  totalAbonado: number;
  saldo: number;
  estado: "ACTIVO" | "PAGADO" | "ANULADO";
  fechaCreacion: string | null;
  fechaVencimiento: string | null;
  fechaLiquidacion: string | null;
  fechaAnulacion: string | null;
  motivoCierre: string | null;
  anulado: boolean;
  venta: {
    id: number;
    numeroVenta: number;
    numeroProForma: number | null;
    condicionPago: string;
    estadoPago: CreditPaymentStatus;
    anulado: boolean;
    autorizacionFel: string | null;
    numeroFel: string | null;
    serieFel: string | null;
    fechaEmision: string | null;
  };
  cliente: {
    id: number;
    nombre: string;
    nit: string | null;
  };
  pagos: CreditPaymentDto[];
}

export interface CreditsListResult {
  items: CreditDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreditsFilters {
  page?: number;
  limit?: number;
  idCliente?: number;
  estadoPago?: CreditPaymentStatus;
  anulado?: boolean;
  incluirAnulados?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
}

export interface CreateCreditPaymentPayload {
  idUsuario: number;
  monto: number;
  metodoPago: CreditPaymentDto["metodoPago"];
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaFirma?: string;
  observaciones?: string;
}

export interface CreateCreditPaymentResult {
  id: number;
  idVenta: number;
  idUsuario: number;
  monto: number;
  metodoPago: CreditPaymentDto["metodoPago"];
  numeroReferencia: string | null;
  banco: string | null;
  fechaPago: string | null;
  rutaFirma: string | null;
  observaciones: string | null;
  estadoPago: CreditPaymentStatus;
  saldo: number;
}

export type CreditsListResponse = ApiResponse<CreditsListResult>;
export type CreditResponse = ApiResponse<CreditDto>;
export type CustomerCreditsResponse = ApiResponse<CreditDto[]>;
export type CreateCreditPaymentResponse = ApiResponse<CreateCreditPaymentResult>;
