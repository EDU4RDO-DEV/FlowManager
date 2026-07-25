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
}

export interface UpdateUserPayload {
  nombre?: string;
  correo?: string;
  idRol?: number | null;
  idUsuarioModificador?: number;
}

export interface DeleteUserPayload {
  idUsuarioAnulador?: number;
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
