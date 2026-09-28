import { prisma } from '../config/prisma';

const TIPOS_MANTENIMIENTO = ['PREVENTIVO', 'CORRECTIVO'] as const;
const ESTADOS_MANTENIMIENTO = ['PROGRAMADO', 'REALIZADO', 'CANCELADO'] as const;

type TipoMantenimiento = (typeof TIPOS_MANTENIMIENTO)[number];
type EstadoMantenimiento = (typeof ESTADOS_MANTENIMIENTO)[number];

type CreateMaintenanceInput = {
  idUsuario: number;
  idVehiculo: number;
  idProveedor?: number;
  tipoMantenimiento: TipoMantenimiento;
  descripcion: string;
  fechaMantenimiento: string;
  costo?: number;
  estado?: EstadoMantenimiento;
  proximoMantenimiento?: string;
  observaciones?: string;
  rutaImagen?: string;
};

type UpdateMaintenanceInput = {
  idProveedor?: number | null;
  tipoMantenimiento?: TipoMantenimiento;
  descripcion?: string;
  fechaMantenimiento?: string;
  costo?: number | null;
  estado?: EstadoMantenimiento;
  proximoMantenimiento?: string | null;
  observaciones?: string | null;
  rutaImagen?: string | null;
  idUsuarioModificador?: number;
};

type ListMaintenanceInput = {
  idVehiculo?: number;
  estado?: EstadoMantenimiento;
  tipoMantenimiento?: TipoMantenimiento;
  anulado?: boolean;
};

function toMaintenanceDto(registro: {
  Id: number;
  IdVehiculo: number;
  IdProveedor: number | null;
  IdUsuario: number;
  TipoMantenimiento: string;
  Descripcion: string;
  FechaMantenimiento: Date;
  Costo: unknown;
  Estado: string;
  ProximoMantenimiento: Date | null;
  Observaciones: string | null;
  RutaImagen: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Vehiculo?: { Id: number; Placa: string; Marca: string; Modelo: string };
  Proveedor?: { Id: number; Entidad: { NombreCompleto: string } } | null;
  Usuario?: { Id: number; Nombre: string };
}) {
  return {
    id: registro.Id,
    idVehiculo: registro.IdVehiculo,
    idProveedor: registro.IdProveedor,
    idUsuario: registro.IdUsuario,
    tipoMantenimiento: registro.TipoMantenimiento,
    descripcion: registro.Descripcion,
    fechaMantenimiento: registro.FechaMantenimiento,
    costo: registro.Costo === null ? null : Number(registro.Costo),
    estado: registro.Estado,
    proximoMantenimiento: registro.ProximoMantenimiento,
    observaciones: registro.Observaciones,
    rutaImagen: registro.RutaImagen,
    fechaRegistro: registro.FechaRegistro,
    idUsuarioModificador: registro.IdUsuarioModificador,
    fechaModificacion: registro.FechaModificacion,
    anulado: registro.Anulado,
    idUsuarioAnulador: registro.IdUsuarioAnulador,
    fechaAnulacion: registro.FechaAnulacion,
    vehiculo: registro.Vehiculo
      ? {
          id: registro.Vehiculo.Id,
          placa: registro.Vehiculo.Placa,
          marca: registro.Vehiculo.Marca,
          modelo: registro.Vehiculo.Modelo,
        }
      : undefined,
    proveedor: registro.Proveedor
      ? { id: registro.Proveedor.Id, nombre: registro.Proveedor.Entidad.NombreCompleto }
      : registro.Proveedor === null
        ? null
        : undefined,
    usuario: registro.Usuario ? { id: registro.Usuario.Id, nombre: registro.Usuario.Nombre } : undefined,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({ where: { Id: idUsuario, Anulado: false }, select: { Id: true } });
  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateVehiculoExists(idVehiculo: number) {
  const vehiculo = await prisma.vehiculo.findFirst({ where: { Id: idVehiculo, Anulado: false }, select: { Id: true } });
  if (!vehiculo) {
    throw new Error('Vehiculo no existe');
  }
}

async function validateProveedorExists(idProveedor: number) {
  const proveedor = await prisma.proveedor.findFirst({
    where: { Id: idProveedor, Anulado: false, Entidad: { Anulado: false } },
    select: { Id: true },
  });
  if (!proveedor) {
    throw new Error('Proveedor no existe');
  }
}

function parseDateOnly(value: string, fieldName: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

function assertCostoRequeridoSiRealizado(estado: EstadoMantenimiento, costo: number | null | undefined) {
  if (estado === 'REALIZADO' && (costo === undefined || costo === null)) {
    throw new Error('costo es obligatorio cuando el mantenimiento está REALIZADO');
  }
}

const includeRelations = {
  Vehiculo: { select: { Id: true, Placa: true, Marca: true, Modelo: true } },
  Proveedor: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
  Usuario: { select: { Id: true, Nombre: true } },
};

export async function listMaintenances(filters: ListMaintenanceInput) {
  const registros = await prisma.mantenimientoVehiculo.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : { Anulado: false }),
      ...(filters.idVehiculo !== undefined ? { IdVehiculo: filters.idVehiculo } : {}),
      ...(filters.estado !== undefined ? { Estado: filters.estado } : {}),
      ...(filters.tipoMantenimiento !== undefined ? { TipoMantenimiento: filters.tipoMantenimiento } : {}),
    },
    include: includeRelations,
    orderBy: { FechaMantenimiento: 'desc' },
  });

  return registros.map(toMaintenanceDto);
}

export async function listAnulatedMaintenances() {
  const registros = await prisma.mantenimientoVehiculo.findMany({
    where: { Anulado: true },
    include: includeRelations,
    orderBy: { FechaAnulacion: 'desc' },
  });

  return registros.map(toMaintenanceDto);
}

export async function getMaintenanceById(id: number) {
  const registro = await prisma.mantenimientoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    include: includeRelations,
  });

  if (!registro) {
    throw new Error('Mantenimiento no existe');
  }

  return toMaintenanceDto(registro);
}

export async function createMaintenance(input: CreateMaintenanceInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateVehiculoExists(input.idVehiculo);

  if (input.idProveedor !== undefined) {
    await validateProveedorExists(input.idProveedor);
  }

  const estado = input.estado ?? 'PROGRAMADO';
  assertCostoRequeridoSiRealizado(estado, input.costo);

  const fechaMantenimiento = parseDateOnly(input.fechaMantenimiento, 'fechaMantenimiento');
  const proximoMantenimiento =
    input.proximoMantenimiento !== undefined
      ? parseDateOnly(input.proximoMantenimiento, 'proximoMantenimiento')
      : null;

  const created = await prisma.mantenimientoVehiculo.create({
    data: {
      IdVehiculo: input.idVehiculo,
      IdProveedor: input.idProveedor,
      IdUsuario: input.idUsuario,
      TipoMantenimiento: input.tipoMantenimiento,
      Descripcion: input.descripcion,
      FechaMantenimiento: fechaMantenimiento,
      Costo: input.costo,
      Estado: estado,
      ProximoMantenimiento: proximoMantenimiento,
      Observaciones: input.observaciones,
      RutaImagen: input.rutaImagen,
      Anulado: false,
    },
    include: includeRelations,
  });

  return toMaintenanceDto(created);
}

export async function updateMaintenance(id: number, input: UpdateMaintenanceInput) {
  const existing = await prisma.mantenimientoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Estado: true, Costo: true },
  });

  if (!existing) {
    throw new Error('Mantenimiento no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idProveedor !== undefined && input.idProveedor !== null) {
    await validateProveedorExists(input.idProveedor);
  }

  const estadoFinal = input.estado ?? (existing.Estado as EstadoMantenimiento);
  const costoFinal =
    input.costo !== undefined ? input.costo : existing.Costo === null ? null : Number(existing.Costo);
  assertCostoRequeridoSiRealizado(estadoFinal, costoFinal);

  const fechaMantenimiento =
    input.fechaMantenimiento !== undefined
      ? parseDateOnly(input.fechaMantenimiento, 'fechaMantenimiento')
      : undefined;

  const proximoMantenimiento =
    input.proximoMantenimiento !== undefined && input.proximoMantenimiento !== null
      ? parseDateOnly(input.proximoMantenimiento, 'proximoMantenimiento')
      : input.proximoMantenimiento === null
        ? null
        : undefined;

  const updated = await prisma.mantenimientoVehiculo.update({
    where: { Id: id },
    data: {
      ...(input.idProveedor !== undefined ? { IdProveedor: input.idProveedor } : {}),
      ...(input.tipoMantenimiento !== undefined ? { TipoMantenimiento: input.tipoMantenimiento } : {}),
      ...(input.descripcion !== undefined ? { Descripcion: input.descripcion } : {}),
      ...(fechaMantenimiento !== undefined ? { FechaMantenimiento: fechaMantenimiento } : {}),
      ...(input.costo !== undefined ? { Costo: input.costo } : {}),
      ...(input.estado !== undefined ? { Estado: input.estado } : {}),
      ...(proximoMantenimiento !== undefined ? { ProximoMantenimiento: proximoMantenimiento } : {}),
      ...(input.observaciones !== undefined ? { Observaciones: input.observaciones } : {}),
      ...(input.rutaImagen !== undefined ? { RutaImagen: input.rutaImagen } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
    include: includeRelations,
  });

  return toMaintenanceDto(updated);
}

export async function deleteMaintenance(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.mantenimientoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Mantenimiento no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.mantenimientoVehiculo.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreMaintenance(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.mantenimientoVehiculo.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Mantenimiento anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.mantenimientoVehiculo.update({
    where: { Id: id },
    data: {
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
    include: includeRelations,
  });

  return toMaintenanceDto(restored);
}
