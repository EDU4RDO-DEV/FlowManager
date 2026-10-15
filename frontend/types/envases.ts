import type { ApiResponse } from "@/types/auth";

export type TipoMovimientoEnvase =
  | "PRESTAMO"
  | "DEVOLUCION"
  | "DEVOLUCION_DANADA"
  | "PERDIDA"
  | "BAJA";

export interface MovimientoEnvaseDto {
  id: number;
  idInventarioItem: number;
  idCliente: number | null;
  idVenta: number | null;
  idUsuario: number;
  tipoMovimiento: TipoMovimientoEnvase;
  estadoEnvase: string | null;
  ubicacionEnvase: string | null;
  idRutaSesion: number | null;
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

export interface EnvasePhysicalBalanceDto {
  idInventarioItem: number;
  nombre: string;
  existenciaCatalogo: number;
  ubicacion: string;
  estado: string;
  idRutaSesion: number | null;
  cantidad: number;
}

export type EnvasesListResponse<T> = ApiResponse<T[]>;

export type RegistrarPrestamoPayload = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idRutaSesion?: number;
  cantidad: number;
  estadoEnvase?: "VACIO" | "LLENO";
  rutaFirma?: string;
  observaciones?: string;
};

export type RegistrarDevolucionPayload = Omit<RegistrarPrestamoPayload, "estadoEnvase"> & {
  estadoEnvase?: "VACIO" | "LLENO" | "DANADO";
};

export type ReconcileEnvasePhysicalStockPayload = {
  idInventarioItem: number;
  cantidadVacia: number;
  cantidadLlena: number;
  cantidadDanada: number;
};

export type EnvasePhysicalCountPayload = {
  idInventarioItem: number;
  ubicacionEnvase: "PLANTA" | "RUTA" | "CUARENTENA";
  idRutaSesion?: number;
  cantidadVacia: number;
  cantidadLlena: number;
  cantidadDanada: number;
  observaciones: string;
};

export type RegistrarPerdidaEnvasePayload = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idRutaSesion?: number;
  cantidad: number;
  observaciones?: string;
};

export type RegistrarBajaEnvasePayload = {
  idInventarioItem: number;
  idRutaSesion?: number;
  cantidad: number;
  estadoEnvase: "VACIO" | "LLENO" | "DANADO";
  ubicacionEnvase: "PLANTA" | "RUTA" | "CUARENTENA";
  observaciones?: string;
};
