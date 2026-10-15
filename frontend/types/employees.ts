import type { ApiResponse } from "@/types/auth";

export interface EmployeeEntityDto {
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

export interface EmployeeDto {
  id: number;
  idEntidad: number;
  idUsuario: number;
  idUsuarioVinculado: number | null;
  idConfiguracionComision: number | null;
  idTipoTrabajador: number | null;
  tipoTrabajador: { id: number; clave: string; nombre: string } | null;
  historialSueldos: Array<{
    id: number;
    sueldoBase: number;
    fechaInicioVigencia: string;
    fechaFinVigencia: string | null;
  }>;
  puestoTrabajo: string;
  descripcionPuesto: string | null;
  fechaContratacion: string;
  fechaSalida: string | null;
  sueldoBase: number;
  fechaRegistro: string | null;
  idUsuarioModificador: number | null;
  fechaModificacion: string | null;
  anulado: boolean;
  idUsuarioAnulador: number | null;
  fechaAnulacion: string | null;
  entidad: EmployeeEntityDto;
}

export type EmployeesListResponse = ApiResponse<EmployeeDto[]>;

export interface CreateEmployeePayload {
  idUsuario: number;
  idUsuarioVinculado?: number;
  idConfiguracionComision?: number;
  idTipoTrabajador: number;
  puestoTrabajo: string;
  descripcionPuesto?: string;
  fechaContratacion: string;
  fechaSalida?: string;
  sueldoBase: number;
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

export interface UpdateEmployeePayload {
  idUsuario?: number;
  idUsuarioVinculado?: number | null;
  idUsuarioModificador?: number;
  idConfiguracionComision?: number | null;
  idTipoTrabajador?: number | null;
  puestoTrabajo?: string;
  descripcionPuesto?: string | null;
  fechaContratacion?: string;
  fechaSalida?: string | null;
  sueldoBase?: number;
  fechaInicioVigenciaSueldo?: string;
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

export interface DeleteEmployeePayload {
  idUsuarioAnulador?: number;
}

export interface RestoreEmployeePayload {
  idUsuarioModificador?: number;
}

export interface UploadEmployeeImageResult {
  rutaImagen: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export type UploadEmployeeImageResponse = ApiResponse<UploadEmployeeImageResult>;
