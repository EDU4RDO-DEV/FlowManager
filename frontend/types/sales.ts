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

export interface SaleRouteDto {
  id: number;
  estado: "PROGRAMADA" | "EN_CURSO" | "CERRADA";
  fechaSesion: string | null;
  ruta: {
    id: number;
    nombre: string;
  };
}

export interface SaleTalonarioRefDto {
  id: number;
  nombre: string;
}

export interface SaleDetailItemDto {
  id: number;
  idVenta: number;
  idInventarioItem: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  esBonificacion: boolean;
  subtotal: number;
  inventarioItem: {
    id: number;
    nombre: string;
    categoria: "ENVASE" | "INSUMO" | "PRODUCTO_TERMINADO" | "MATERIA_PRIMA";
    existencia: number;
  };
}

export interface SalePaymentDto {
  id: number;
  idVenta: number;
  idUsuario: number;
  monto: number;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  numeroReferencia: string | null;
  banco: string | null;
  fechaPago: string | null;
  rutaFirma: string | null;
  observaciones: string | null;
  usuario: SaleUserDto;
}

export interface SaleDto {
  id: number;
  idCliente: number;
  idUsuario: number;
  idRutaSesion: number | null;
  idTalonario: number | null;
  numeroVenta: number;
  numeroProForma: number | null;
  tipoRegistro: "VENTA" | "PROFORMA";
  condicionPago: "CONTADO" | "CREDITO";
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  estadoEntrega: "PENDIENTE" | "EN_RUTA" | "ENTREGADO" | "PARCIAL";
  requiereFactura: boolean;
  autorizacionFel: string | null;
  numeroFel: string | null;
  serieFel: string | null;
  qrFel: string | null;
  rutaPdfFel: string | null;
  fechaEmisionFel: string | null;
  nitFacturado: string | null;
  nombreClienteFacturado: string | null;
  direccionClienteFacturado: string | null;
  lugarEntrega: string | null;
  fechaEntregaEsperada: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  fechaRegistro: string | null;
  cliente: SaleCustomerDto;
  usuario: SaleUserDto;
  rutaSesion?: SaleRouteDto | null;
  talonario?: SaleTalonarioRefDto | null;
  detalle?: SaleDetailItemDto[];
  pagos?: SalePaymentDto[];
  subtotal: number;
  totalBonificado?: number;
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
  estadoEntrega?: "PENDIENTE" | "EN_RUTA" | "ENTREGADO" | "PARCIAL";
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface FelPingRequest {
  nitReceptor?: string;
  validarNit?: boolean;
}

export interface FelPingResult {
  ok: boolean;
  entorno: "mock" | "real";
  modoFel: "production" | "sandbox";
  servidor: string;
  endpointDocumento: string;
  endpointAnulacion: string;
  endpointValidarNit: string;
  nitValidado: boolean;
}

export type FelPingResponse = ApiResponse<FelPingResult>;

export interface FelReceptorResult {
  nit: string;
  nombre: string;
  direccion: string | null;
}

export type FelReceptorResponse = ApiResponse<FelReceptorResult>;

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

export interface CreateTalonarioPayload {
  idUsuario: number;
  nombre: string;
  correlativoInicial: number;
  correlativoFinal: number;
  ultimoUtilizado?: number;
}

export interface UpdateTalonarioPayload {
  nombre?: string;
  correlativoInicial?: number;
  correlativoFinal?: number;
  ultimoUtilizado?: number;
  idUsuarioModificador?: number;
}

export interface AnulateTalonarioPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreTalonarioPayload {
  idUsuarioModificador?: number;
}

export type TalonarioResponse = ApiResponse<TalonarioDto>;

export interface CreateSaleDetailPayload {
  idInventarioItem: number;
  cantidad: number;
  precioUnitario?: number;
  esBonificacion?: boolean;
}

export interface SalePaymentPayload {
  monto: number;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaFirma?: string;
  observaciones?: string;
}

export interface CreateSalePayload {
  idUsuario: number;
  idCliente: number;
  idRutaSesion?: number;
  idTalonario?: number;
  numeroProForma?: number;
  tipoRegistro: "VENTA" | "PROFORMA";
  estadoEntrega: "PENDIENTE" | "EN_RUTA" | "ENTREGADO" | "PARCIAL";
  condicionPago: "CONTADO" | "CREDITO";
  requiereFactura: boolean;
  nitFacturado?: string;
  nombreClienteFacturado?: string;
  direccionClienteFacturado?: string;
  lugarEntrega?: string;
  fechaEntregaEsperada?: string;
  detalle: CreateSaleDetailPayload[];
  pagoInicial?: SalePaymentPayload;
}

export interface CreateSaleResult {
  id: number;
  numeroVenta: number;
  total: number;
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
}

export type CreateSaleResponse = ApiResponse<CreateSaleResult>;

export type SaleByIdResponse = ApiResponse<SaleDto>;
export type SalePaymentsResponse = ApiResponse<SalePaymentDto[]>;

export interface CreateSalePaymentPayload {
  idUsuario: number;
  monto: number;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaFirma?: string;
  observaciones?: string;
}

export interface CreateSalePaymentResult {
  id: number;
  idVenta: number;
  idUsuario: number;
  monto: number;
  metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";
  numeroReferencia: string | null;
  banco: string | null;
  fechaPago: string | null;
  rutaFirma: string | null;
  observaciones: string | null;
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  saldo: number;
}

export type CreateSalePaymentResponse = ApiResponse<CreateSalePaymentResult>;

export interface UploadSaleImageResult {
  rutaImagen: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export type UploadSaleImageResponse = ApiResponse<UploadSaleImageResult>;

export interface ResolveSalePriceResult {
  idCliente: number;
  idInventarioItem: number;
  idTipoCliente: number | null;
  precioUnitario: number;
}

export type ResolveSalePriceResponse = ApiResponse<ResolveSalePriceResult>;

export interface BonusPreviewItem {
  idInventarioItem: number;
  nombre: string;
  cantidad: number;
}

export type BonusPreviewResponse = ApiResponse<BonusPreviewItem[]>;

export interface RouteSessionOptionDto {
  id: number;
  idRuta: number;
  idUsuarioVendedor: number;
  idUsuarioChofer: number;
  estado: "PROGRAMADA" | "EN_CURSO" | "CERRADA";
  fechaSesion: string;
  ruta?: { id: number; nombre: string };
  vendedor?: { id: number; nombre: string; correo: string };
  chofer?: { id: number; nombre: string; correo: string };
}

export type RouteSessionOptionsResponse = ApiResponse<RouteSessionOptionDto[]>;

export interface AnulateSalePayload {
  idUsuarioAnulador?: number;
}
