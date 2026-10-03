import type { ApiResponse } from "@/types/auth";

export type TipoMovimientoEnvase = "PRESTAMO" | "DEVOLUCION";

export interface MovimientoEnvaseDto {
  id: number;
  idInventarioItem: number;
  idCliente: number;
  idVenta: number | null;
  idUsuario: number;
  tipoMovimiento: TipoMovimientoEnvase;
  cantidad: number;
  saldoAnterior: number;
  saldoNuevo: number;
  rutaFirma: string | null;
  observaciones: string | null;
  fechaMovimiento: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  inventarioItem?: {
    id: number;
    nombre: string;
  };
  cliente?: {
    id: number;
    nombre: string;
  };
  usuario?: {
    id: number;
    nombre: string;
  };
}

export interface EnvaseClienteSaldoDto {
  id: number;
  idCliente: number;
  idInventarioItem: number;
  cantidadPrestada: number;
  fechaActualizacion: string | null;
  cliente?: {
    id: number;
    nombre: string;
  };
  inventarioItem?: {
    id: number;
    nombre: string;
  };
}

export type EnvasesListResponse<T> = ApiResponse<T[]>;

export type RegistrarPrestamoPayload = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  cantidad: number;
  rutaFirma?: string;
  observaciones?: string;
};

export type RegistrarDevolucionPayload = RegistrarPrestamoPayload;
