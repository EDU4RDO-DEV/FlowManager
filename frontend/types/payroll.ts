import type { ApiResponse } from "@/types/auth";

export type PayrollState = "BORRADOR" | "CERRADA";
export type PayrollAdjustmentType = "BONO_META" | "VIATICO" | "DESCUENTO";

export interface PayrollDto {
  id: number;
  idEmpleado: number;
  mes: number;
  anio: number;
  estado: PayrollState;
  idUsuarioGenerador: number | null;
  sueldoBase: number;
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  observaciones: string | null;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  empleado?: {
    id: number;
    idUsuarioVinculado: number | null;
    entidad: {
      id: number;
      nombreCompleto: string;
    };
  };
}

export interface PayrollCommissionDetailDto {
  id: number;
  idInventarioItem: number;
  nombreProducto: string;
  cantidad: number;
  baseCalculo: number;
  tipoCalculo: string;
  valorAplicado: number;
  montoComision: number;
}

export interface PayrollAdjustmentDetailDto {
  id: number;
  tipoAjuste: PayrollAdjustmentType;
  descripcion: string;
  monto: number;
}

export interface PayrollDetailDto extends PayrollDto {
  detalleComisiones: PayrollCommissionDetailDto[];
  detalleAjustes: PayrollAdjustmentDetailDto[];
}

export interface PayrollPreviewRow {
  idEmpleado: number;
  nombreEmpleado: string;
  idUsuarioVinculado: number;
  sueldoBase: number;
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  detalleComisiones: Array<{
    idInventarioItem: number;
    nombreProducto: string;
    cantidad: number;
    baseCalculo: number;
    tipoCalculo: string;
    valorAplicado: number;
    montoComision: number;
  }>;
  detalleAjustes: Array<{
    tipoAjuste: PayrollAdjustmentType;
    descripcion: string;
    monto: number;
  }>;
}

export interface PayrollPreviewResult {
  mes: number;
  anio: number;
  planillas: PayrollPreviewRow[];
}

export type PayrollListResponse = ApiResponse<PayrollDto[]>;

export interface PayrollAdjustmentPayload {
  tipoAjuste: PayrollAdjustmentType;
  descripcion: string;
  monto: number;
}

export interface PreviewPayrollPayload {
  mes: number;
  anio: number;
  idEmpleado?: number;
  ajustes?: PayrollAdjustmentPayload[];
}

export interface GeneratePayrollPayload extends PreviewPayrollPayload {
  observaciones?: string;
}

export interface UpdatePayrollPayload {
  observaciones?: string | null;
  ajustes?: PayrollAdjustmentPayload[];
}

export interface DeletePayrollPayload {
  idUsuarioAnulador?: number;
}

export interface RestorePayrollPayload {
  idUsuarioModificador?: number;
}

export interface ClosePayrollPayload {
  idUsuarioModificador?: number;
}
