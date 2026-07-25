import type { ApiResponse } from "@/types/auth";

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

export type RolesListResponse = ApiResponse<RoleDto[]>;

export interface CreateRolePayload {
  idUsuario: number;
  nombre: string;
  descripcion?: string;
}

export interface UpdateRolePayload {
  nombre?: string;
  descripcion?: string | null;
  idUsuarioModificador?: number;
}

export interface DeleteRolePayload {
  idUsuarioAnulador?: number;
}
