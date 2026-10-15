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

export interface RestoreRolePayload {
  idUsuarioModificador?: number;
}

export interface RolePermissionActionDto {
  action: "read" | "create" | "update" | "delete" | "allow-negative-stock";
  actionName: string;
  permitido: boolean;
}

export interface RolePermissionModuleDto {
  moduleKey:
    | "resumen"
    | "usuarios"
    | "roles"
    | "clientes"
    | "ventas"
    | "empleados"
    | "proveedores"
    | "compras"
    | "inventario"
    | "planilla"
    | "sesiones"
    | "produccion"
    | "envases"
    | "calidad"
    | "reportes"
    | "empresa";
  moduleName: string;
  actions: RolePermissionActionDto[];
}

export interface RolePermissionsDto {
  roleId: number;
  modules: RolePermissionModuleDto[];
}

export interface UpdateRolePermissionsPayload {
  idUsuarioModificador?: number;
  permissions: Array<{
    moduleKey: RolePermissionModuleDto["moduleKey"];
    action: RolePermissionActionDto["action"];
    permitido: boolean;
  }>;
}
