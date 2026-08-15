import type { ApiResponse } from "@/types/auth";

export interface UserDto {
  id: number;
  idUsuario: number | null;
  idEntidad: number | null;
  idRol: number | null;
  nombre: string;
  correo: string;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  entidad?: {
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
  };
}

export interface RoleDto {
  id: number;
  idUsuario: number;
  nombre: string;
  descripcion: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
}

export type UsersListResponse = ApiResponse<UserDto[]>;
export type RolesListResponse = ApiResponse<RoleDto[]>;

export interface CreateUserPayload {
  nombre: string;
  correo: string;
  clave: string;
  idRol?: number;
  idEmpleadoVinculado?: number;
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

export interface UpdateUserPayload {
  nombre?: string;
  correo?: string;
  idRol?: number | null;
  idEmpleadoVinculado?: number | null;
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

export interface DeleteUserPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreUserPayload {
  idUsuarioModificador?: number;
}

export interface ChangePasswordPayload {
  claveActual: string;
  nuevaClave: string;
  idUsuarioModificador?: number;
}

export interface ResetPasswordPayload {
  nuevaClave: string;
  idUsuarioModificador?: number;
}
