import type { ApiResponse } from "@/types/auth";

export interface ProviderEntityDto {
  id: number;
  nombreCompleto: string;
  sexo: string | null;
  fechaNacimiento: string | null;
  telefono1: string | null;
  telefono2: string | null;
  correoElectronico: string | null;
  rutaImagen: string | null;
  nit: string | null;
  dpi: string | null;
  anulado: boolean;
}

export interface ProviderDto {
  id: number;
  idEntidad: number;
  idUsuario: number;
  nombre: string;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  entidad: ProviderEntityDto;
}

export type ProvidersListResponse = ApiResponse<ProviderDto[]>;

export interface CreateProviderPayload {
  idUsuario: number;
  entidad: {
    nombreCompleto: string;
    sexo?: string;
    fechaNacimiento?: string;
    telefono1?: string;
    telefono2?: string;
    correoElectronico?: string;
    rutaImagen?: string;
    nit?: string;
    dpi?: string;
  };
}

export interface UpdateProviderPayload {
  idUsuario?: number;
  idUsuarioModificador?: number;
  entidad?: {
    nombreCompleto?: string;
    sexo?: string;
    fechaNacimiento?: string;
    telefono1?: string;
    telefono2?: string;
    correoElectronico?: string;
    rutaImagen?: string;
    nit?: string;
    dpi?: string;
  };
}

export interface DeleteProviderPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreProviderPayload {
  idUsuarioModificador?: number;
}
