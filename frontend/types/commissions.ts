import type { ApiResponse } from "@/types/auth";

export type CommissionRuleType = "PORCENTAJE_VENTA" | "MONTO_POR_UNIDAD";

export interface CommissionConfigDto {
  id: number;
  idUsuario: number;
  nombre: string;
  esGeneral: boolean;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  totalReglasActivas?: number;
}

export interface CommissionRuleDto {
  id: number;
  idConfiguracionComision: number;
  idInventarioItem: number;
  cantidadMinima: number;
  cantidadMaxima: number | null;
  tipoCalculo: CommissionRuleType;
  porcentaje: number;
  montoPorUnidad: number | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  inventarioItem?: {
    id: number;
    nombre: string;
  };
}

export interface CommissionConfigDetailDto extends CommissionConfigDto {
  reglas: CommissionRuleDto[];
  reglasPorCategoria: Array<{
    id: number;
    idCategoriaComision: number;
    categoria: CommissionCategoryDto;
    montoMinimoVenta: number;
    porcentaje: number;
    fechaInicioVigencia: string;
    fechaFinVigencia: string | null;
  }>;
}

export interface CommissionCategoryDto {
  id: number;
  clave: string;
  nombre: string;
}

export interface CommissionCategorySchedulePayload {
  idUsuario: number;
  fechaInicioVigencia: string;
  categorias: Array<{
    idCategoriaComision: number;
    reglas: Array<{ montoMinimoVenta: number; porcentaje: number }>;
  }>;
}

export type CommissionsListResponse = ApiResponse<CommissionConfigDto[]>;

export interface CreateCommissionConfigPayload {
  idUsuario: number;
  nombre: string;
  esGeneral?: boolean;
  fechaInicioVigencia?: string;
}

export interface UpdateCommissionConfigPayload {
  nombre?: string;
  esGeneral?: boolean;
  idUsuarioModificador?: number;
}

export interface DeleteCommissionConfigPayload {
  idUsuarioAnulador?: number;
}

export interface RestoreCommissionConfigPayload {
  idUsuarioModificador?: number;
}

export interface CreateCommissionRulePayload {
  idInventarioItem: number;
  cantidadMinima: number;
  cantidadMaxima?: number;
  tipoCalculo: CommissionRuleType;
  porcentaje: number;
  montoPorUnidad?: number;
}

export interface UpdateCommissionRulePayload {
  idInventarioItem?: number;
  cantidadMinima?: number;
  cantidadMaxima?: number | null;
  tipoCalculo?: CommissionRuleType;
  porcentaje?: number;
  montoPorUnidad?: number | null;
  idUsuarioModificador?: number;
}

export interface DeleteCommissionRulePayload {
  idUsuarioAnulador?: number;
}

export interface RestoreCommissionRulePayload {
  idUsuarioModificador?: number;
}
