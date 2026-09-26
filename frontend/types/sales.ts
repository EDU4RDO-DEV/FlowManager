import type { ApiResponse } from "@/types/auth";

export interface SaleCustomerDto {
  id: number;
  nombre: string;
  nit: string | null;
  tipoCliente: {
    id: number;
    nombre: string;
  } | null;
}

export interface SaleUserDto {
  id: number;
  nombre: string;
  correo: string;
}

export interface SaleDto {
  id: number;
  numeroVenta: number;
  condicionPago: "CONTADO" | "CREDITO";
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  estadoEntrega: "PENDIENTE" | "EN_RUTA" | "ENTREGADO" | "PARCIAL";
  requiereFactura: boolean;
  anulado: boolean;
  fechaRegistro: string | null;
  cliente: SaleCustomerDto;
  usuario: SaleUserDto;
  subtotal: number;
  total: number;
  totalPagado: number;
  saldo: number;
}

export interface SalesListResult {
  items: SaleDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type SalesListResponse = ApiResponse<SalesListResult>;

export interface SalesFilters {
  page?: number;
  limit?: number;
  busqueda?: string;
  anulado?: boolean;
  condicionPago?: "CONTADO" | "CREDITO";
  estadoPago?: "PENDIENTE" | "PARCIAL" | "PAGADO";
}

export interface FelPingRequest {
  nitReceptor?: string;
  validarNit?: boolean;
}

export interface FelPingResult {
  ok: boolean;
  entorno: "mock" | "real";
  servidor: string;
  endpointDocumento: string;
  endpointAnulacion: string;
  endpointValidarNit: string;
  nitValidado: boolean;
}

export type FelPingResponse = ApiResponse<FelPingResult>;

export interface TalonarioDto {
  id: number;
  idUsuario: number;
  nombre: string;
  correlativoInicial: number;
  correlativoFinal: number;
  ultimoUtilizado: number | null;
  siguienteCorrelativo: number | null;
  disponible: boolean;
  fechaRegistro: string | null;
  anulado: boolean;
}

export type TalonariosResponse = ApiResponse<TalonarioDto[]>;
