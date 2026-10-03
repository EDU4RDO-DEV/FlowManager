import type { ApiResponse } from "@/types/auth";

export type VehiculoEstado = "DISPONIBLE" | "EN_RUTA" | "MANTENIMIENTO" | "NO_DISPONIBLE";
export type RutaSesionEstado = "PROGRAMADA" | "EN_CURSO" | "CERRADA";
export type GastoEstadoPago = "PENDIENTE" | "PAGADO";

export interface VehiculoDto {
  id: number;
  idUsuario: number;
  placa: string;
  marca: string;
  modelo: string;
  color: string | null;
  estado: VehiculoEstado;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
}

export interface RutaDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  fechaRegistro: string | null;
  anulado: boolean;
}

export interface RutaSesionDto {
  id: number;
  idRuta: number;
  idVehiculo: number;
  idUsuarioChofer: number;
  idUsuarioVendedor: number;
  fechaSesion: string;
  kmInicial: number | null;
  kmFinal: number | null;
  estado: RutaSesionEstado;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  ruta?: {
    id: number;
    nombre: string;
  };
  vehiculo?: {
    id: number;
    placa: string;
    marca: string;
    modelo: string;
  };
  chofer?: {
    id: number;
    nombre: string;
    correo: string;
  };
  vendedor?: {
    id: number;
    nombre: string;
    correo: string;
  };
}

export interface GastoVehiculoDto {
  id: number;
  idRutaSesion: number;
  idUsuario: number;
  idProveedor: number | null;
  descripcion: string;
  monto: number;
  metodoPago: string;
  numeroVale: number | null;
  rutaImagen: string | null;
  estadoPago: GastoEstadoPago;
  fechaPago: string | null;
  referenciaPago: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  rutaSesion?: {
    id: number;
    fechaSesion: string;
    idRuta: number;
    ruta: {
      id: number;
      nombre: string;
    };
  };
  proveedor?: {
    id: number;
    nombre: string;
  } | null;
}

export type LogisticsListResponse<T> = ApiResponse<T[]>;

export type CreateVehiculoPayload = {
  idUsuario: number;
  placa: string;
  marca: string;
  modelo: string;
  color?: string;
  estado?: VehiculoEstado;
};

export type UpdateVehiculoPayload = {
  placa?: string;
  marca?: string;
  modelo?: string;
  color?: string | null;
  estado?: VehiculoEstado;
  idUsuarioModificador?: number;
};

export type CreateRutaPayload = {
  nombre: string;
  descripcion?: string;
};

export type UpdateRutaPayload = {
  nombre?: string;
  descripcion?: string | null;
};

export type CreateRutaSesionPayload = {
  idRuta: number;
  idVehiculo: number;
  idUsuarioChofer: number;
  idUsuarioVendedor: number;
  fechaSesion: string;
  kmInicial?: number;
  kmFinal?: number;
  estado?: RutaSesionEstado;
};

export type UpdateRutaSesionPayload = {
  idRuta?: number;
  idVehiculo?: number;
  idUsuarioChofer?: number;
  idUsuarioVendedor?: number;
  fechaSesion?: string;
  kmInicial?: number | null;
  kmFinal?: number | null;
  estado?: RutaSesionEstado;
  idUsuarioModificador?: number;
};

export type CreateGastoVehiculoPayload = {
  idRutaSesion: number;
  idUsuario: number;
  idProveedor?: number;
  descripcion: string;
  monto: number;
  metodoPago: string;
  numeroVale?: number;
  rutaImagen?: string;
  estadoPago?: GastoEstadoPago;
  fechaPago?: string;
  referenciaPago?: string;
};

export type UpdateGastoVehiculoPayload = {
  idRutaSesion?: number;
  idUsuario?: number;
  idProveedor?: number | null;
  descripcion?: string;
  monto?: number;
  metodoPago?: string;
  numeroVale?: number | null;
  rutaImagen?: string | null;
  estadoPago?: GastoEstadoPago;
  fechaPago?: string;
  referenciaPago?: string | null;
  idUsuarioModificador?: number;
};

export type TipoMantenimiento = "PREVENTIVO" | "CORRECTIVO";
export type EstadoMantenimiento = "PROGRAMADO" | "REALIZADO" | "CANCELADO";

export interface MantenimientoVehiculoDto {
  id: number;
  idVehiculo: number;
  idProveedor: number | null;
  idUsuario: number;
  tipoMantenimiento: TipoMantenimiento;
  descripcion: string;
  fechaMantenimiento: string;
  costo: number | null;
  estado: EstadoMantenimiento;
  proximoMantenimiento: string | null;
  observaciones: string | null;
  rutaImagen: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  vehiculo?: {
    id: number;
    placa: string;
    marca: string;
    modelo: string;
  };
  proveedor?: {
    id: number;
    nombre: string;
  } | null;
  usuario?: {
    id: number;
    nombre: string;
  };
}

export type CreateMantenimientoPayload = {
  idVehiculo: number;
  idProveedor?: number;
  tipoMantenimiento: TipoMantenimiento;
  descripcion: string;
  fechaMantenimiento: string;
  costo?: number;
  estado?: EstadoMantenimiento;
  proximoMantenimiento?: string;
  observaciones?: string;
  rutaImagen?: string;
};

export type UpdateMantenimientoPayload = {
  idProveedor?: number | null;
  tipoMantenimiento?: TipoMantenimiento;
  descripcion?: string;
  fechaMantenimiento?: string;
  costo?: number | null;
  estado?: EstadoMantenimiento;
  proximoMantenimiento?: string | null;
  observaciones?: string | null;
  rutaImagen?: string | null;
  idUsuarioModificador?: number;
};
