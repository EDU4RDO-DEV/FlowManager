import type { ApiResponse } from "@/types/auth";

export interface ClientEntityDto {
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

export interface ClientDto {
  id: number;
  idEntidad: number;
  idUsuario: number;
  habilitadoCredito: boolean;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  entidad: ClientEntityDto;
}

export type ClientsListResponse = ApiResponse<ClientDto[]>;

export interface CreateClientPayload {
  idUsuario: number;
  habilitadoCredito?: boolean;
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

export interface UpdateClientPayload {
  idUsuario?: number;
  idUsuarioModificador?: number;
  habilitadoCredito?: boolean;
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

export interface DeleteClientPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreClientPayload {
  idUsuarioModificador?: number;
}

export interface UploadClientImageResult {
  rutaImagen: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export type UploadClientImageResponse = ApiResponse<UploadClientImageResult>;
