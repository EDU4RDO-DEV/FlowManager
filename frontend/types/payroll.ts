import type { ApiResponse } from "@/types/auth";

export type PayrollState = "BORRADOR" | "CERRADA";
export type PayrollAdjustmentType = "BONO_META" | "ADELANTO" | "FALTANTE";

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
  diasTrabajados: number;
  tarifaViaticoAplicada: number | null;
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
  idConfiguracionComision: number | null;
  idReglaComision: number | null;
  idReglaComisionCategoria: number | null;
  idCategoriaComision: number | null;
  baseCategoriaAplicada: number | null;
  categoriaComisionSnapshot: string | null;
  cantidadMinimaAplicada: number | null;
  cantidadMaximaAplicada: number | null;
  nombreProducto: string;
  cantidad: number;
  baseCalculo: number;
  tipoCalculo: string;
  valorAplicado: number;
  montoComision: number;
  fuentes: Array<{
    idDetalleVenta: number;
    idVenta: number;
    idRutaSesion: number;
    fechaSesion: string;
    sesionAnulada: boolean;
    estadoPago: string;
    ventaAnulada: boolean;
    detalleVentaAnulado: boolean;
    esBonificacion: boolean;
    idUsuarioChofer: number;
    idUsuarioVendedor: number;
    idUsuarioAtribuido: number;
    rolAtribucion: string;
    cantidad: number;
    precioUnitario: number;
    baseCalculo: number;
  }>;
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
  idUsuarioVinculado: number | null;
  sueldoBase: number;
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  diasTrabajados: number;
  tarifaViaticoAplicada: number | null;
  sueldoLiquido: number;
  detalleComisiones: Array<{
    idReglaComision: number | null;
    idReglaComisionCategoria?: number;
    idCategoriaComision?: number;
    baseCategoriaAplicada?: number;
    categoriaComisionSnapshot?: string;
    idConfiguracionComision: number;
    cantidadMinimaAplicada: number;
    cantidadMaximaAplicada: number | null;
    idInventarioItem: number;
    nombreProducto: string;
    cantidad: number;
    baseCalculo: number;
    tipoCalculo: string;
    valorAplicado: number;
    montoComision: number;
    fuentes: PayrollCommissionDetailDto["fuentes"];
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
  previewId: string;
  planillas: PayrollPreviewRow[];
  validaciones: PayrollValidation[];
}

export interface PayrollValidation {
  idEmpleado: number;
  nombreEmpleado: string;
  codigo:
    | "USUARIO_VINCULADO_FALTANTE"
    | "CONFIGURACION_FALTANTE"
    | "CONFIGURACION_NO_DISPONIBLE"
    | "REGLAS_NO_CONFIGURADAS"
    | "REGLA_FALTANTE"
    | "REGLAS_SOLAPADAS"
    | "DATOS_CALCULO_INVALIDOS"
    | "PLANILLA_EXISTENTE"
    | "TIPO_TRABAJADOR_FALTANTE"
    | "TARIFA_VIATICO_NO_CONFIGURADA"
    | "CATEGORIA_COMISION_FALTANTE";
  mensaje: string;
  idInventarioItem?: number;
  nombreProducto?: string;
}

export type PayrollListResponse = ApiResponse<PayrollDto[]>;

export interface PayrollAdjustmentPayload {
  tipoAjuste: "BONO_META";
  descripcion: string;
  monto: number;
}

export interface PayrollEmployeeInputPayload {
  idEmpleado: number;
  diasTrabajados?: number;
  ajustes?: PayrollAdjustmentPayload[];
}

export interface PreviewPayrollPayload {
  mes: number;
  anio: number;
  idEmpleado?: number;
  empleados?: PayrollEmployeeInputPayload[];
}

export interface GeneratePayrollPayload extends PreviewPayrollPayload {
  previewId: string;
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

export interface ReopenPayrollPayload {
  motivo: string;
}
