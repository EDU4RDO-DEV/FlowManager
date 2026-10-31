import type { ApiResponse } from "@/types/auth";
import type { ProductDto, ProductListPagination } from "@/types/products";

export type VehiculoEstado = "DISPONIBLE" | "EN_RUTA" | "MANTENIMIENTO" | "NO_DISPONIBLE";
export type RutaSesionEstado = "PROGRAMADA" | "EN_CURSO" | "CERRADA";
export type GastoEstadoPago = "PENDIENTE" | "PAGADO";

export interface DispatchProductDto extends ProductDto {
  stockEnvasePlanta?: {
    vacio: number;
    lleno: number;
    pendienteClasificacion: number;
    diferenciaCatalogo: number;
  };
}

export interface DispatchProductListResult {
  items: DispatchProductDto[];
  pagination: ProductListPagination;
}

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
  idUsuarioChofer: number | null;
  idUsuarioVendedor: number | null;
  idEmpleadoChofer: number | null;
  idEmpleadoVendedor: number | null;
  idJornada: number | null;
  fechaSesion: string;
  kmInicial: number | null;
  kmFinal: number | null;
  estado: RutaSesionEstado;
  fechaCierre: string | null;
  idUsuarioCierre: number | null;
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
    correo: string | null;
  };
  vendedor?: {
    id: number;
    nombre: string;
    correo: string | null;
  };
}

export interface RouteInventoryLineDto {
  idInventarioItem: number;
  nombre: string;
  unidadMedida: string | null;
  despachado: number;
  estadoEnvaseDespachado?: "VACIO" | "LLENO" | null;
  esEnvaseRetornable: boolean;
  vendido: number;
  devolucionComercial: number;
  noVendibleComercial: number;
  devuelto: number;
  danado: number;
  ajustado: number;
  reservado: number;
  envasePrestado?: number;
  envaseDevuelto?: number;
  envaseBaja?: number;
  transferidoSaliente?: number;
  transferidoRecibido?: number;
  pendienteConciliacion: number;
  disponible: number;
}

export interface RouteInventoryDto {
  idRutaSesion: number;
  estado: RutaSesionEstado;
  despacho: { id: number; observaciones: string | null; fechaRegistro: string | null } | null;
  // Lista de TODOS los despachos activos (puede haber varios por reabastecimiento),
  // para permitir anular uno específico por su Id.
  despachos?: Array<{ id: number; observaciones: string | null; fechaRegistro: string | null }>;
  devolucion: { id: number; observaciones: string | null; fechaRegistro: string | null } | null;
  // Lista de TODAS las devoluciones activas (puede haber varias), para permitir anular
  // una específica por su Id.
  devoluciones?: Array<{ id: number; observaciones: string | null; fechaRegistro: string | null }>;
  devolucionesAnuladas?: Array<{
    id: number;
    fechaRegistro: string | null;
    fechaAnulacion: string | null;
    motivoAnulacion: string | null;
    usuarioAnulador: { id: number; nombre: string } | null;
  }>;
  productos: RouteInventoryLineDto[];
  diferenciasPendientes?: RouteInventoryLineDto[];
  conciliada?: boolean;
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
  idEmpleadoChofer: number;
  idEmpleadoVendedor: number;
  idUsuarioChofer?: number;
  idUsuarioVendedor?: number;
  idJornada?: number;
  fechaSesion: string;
  kmInicial?: number;
  kmFinal?: number;
  estado?: RutaSesionEstado;
};

export type UpdateRutaSesionPayload = {
  idRuta?: number;
  idVehiculo?: number;
  idEmpleadoChofer?: number;
  idEmpleadoVendedor?: number;
  idUsuarioChofer?: number;
  idUsuarioVendedor?: number;
  idJornada?: number | null;
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

// Fase 2 - Distribución (D-DIST-01, D-DIST-04, D-DIST-02/03, D-DIST-06)

export type JornadaEstado = "ABIERTA" | "CERRADA";

export interface JornadaDto {
  id: number;
  fecha: string;
  estado: JornadaEstado;
  idUsuarioResponsable: number | null;
  observaciones: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  rutaSesiones: Array<{
    id: number;
    idVehiculo: number;
    idUsuarioChofer: number | null;
    idUsuarioVendedor: number | null;
    idEmpleadoChofer: number | null;
    idEmpleadoVendedor: number | null;
    estado: RutaSesionEstado;
  }>;
}

export type CreateJornadaPayload = {
  fecha: string;
  idUsuarioResponsable?: number;
  observaciones?: string;
};

export type TransferenciaEstadoConfirmacion = "PENDIENTE" | "CONFIRMADA" | "RECHAZADA";

export interface TransferenciaVehiculoDetalleDto {
  idInventarioItem: number;
  nombre: string;
  unidadMedida: string | null;
  cantidad: number;
  estadoEnvase: "VACIO" | "LLENO" | null;
}

export interface TransferenciaVehiculoDto {
  id: number;
  idRutaSesionOrigen: number;
  idRutaSesionDestino: number;
  idUsuario: number;
  motivo: string;
  estadoConfirmacion: TransferenciaEstadoConfirmacion;
  idUsuarioConfirma: number | null;
  fechaConfirmacion: string | null;
  fechaRegistro: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  motivoAnulacion: string | null;
  detalle: TransferenciaVehiculoDetalleDto[];
}

export type TransferDetailLineInput = {
  idInventarioItem: number;
  cantidad: number;
  estadoEnvase?: "VACIO" | "LLENO";
};

export type CreateVehicleTransferPayload = {
  idRutaSesionOrigen: number;
  idRutaSesionDestino: number;
  motivo: string;
  detalle: TransferDetailLineInput[];
};

export type RejectOrCancelTransferPayload = {
  motivo?: string;
};

export type CreateVehicleHandoffPayload = {
  motivo: string;
  idRuta: number;
  idVehiculo: number;
  idEmpleadoChofer: number;
  idEmpleadoVendedor: number;
  kmInicialEntrante: number;
  detalle?: TransferDetailLineInput[];
};

export interface VehicleHandoffResultDto {
  relevo: {
    id: number;
    idRutaSesionSaliente: number;
    idRutaSesionEntrante: number;
    idUsuarioAutoriza: number;
    motivo: string;
    fechaRegistro: string | null;
  };
  sesionEntrante: RutaSesionDto;
  transferenciaInventario: TransferenciaVehiculoDto | null;
  custodia: {
    saliente: { idRutaSesion: number; productos: RouteInventoryLineDto[] };
    entrante: { idRutaSesion: number; productos: RouteInventoryLineDto[] };
  };
}
