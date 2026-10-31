import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { parseDateOnlyUtc, validateUsuarioExists } from './logistics.service';
import {
  getRouteSessionReadVisibilityIds,
  type OperationalActor,
} from './operational-scope.service';

// D-DIST-01: Jornada agrupa 1..N RutaSesion del mismo día operativo. No reemplaza a
// RutaSesion: cada sesión conserva su propio vehículo, chofer y vendedor. Las sesiones
// existentes antes de esta fase no se modifican retroactivamente (IdJornada queda null).

type JornadaEstado = 'ABIERTA' | 'CERRADA';

type CreateJornadaInput = {
  fecha: string;
  idUsuarioResponsable?: number;
  observaciones?: string;
};

function toJornadaDto(jornada: {
  Id: number;
  Fecha: Date;
  Estado: string;
  IdUsuarioResponsable: number | null;
  Observaciones: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  RutaSesion?: {
    Id: number;
    IdVehiculo: number;
    IdUsuarioChofer: number | null;
    IdUsuarioVendedor: number | null;
    IdEmpleadoChofer: number | null;
    IdEmpleadoVendedor: number | null;
    Estado: string;
    Anulado: boolean;
  }[];
}, visibleSessionIds?: number[]) {
  const visibleIdSet = visibleSessionIds === undefined ? undefined : new Set(visibleSessionIds);

  return {
    id: jornada.Id,
    fecha: jornada.Fecha,
    estado: jornada.Estado,
    idUsuarioResponsable: jornada.IdUsuarioResponsable,
    observaciones: jornada.Observaciones,
    fechaRegistro: jornada.FechaRegistro,
    idUsuarioModificador: jornada.IdUsuarioModificador,
    fechaModificacion: jornada.FechaModificacion,
    anulado: jornada.Anulado,
    idUsuarioAnulador: jornada.IdUsuarioAnulador,
    fechaAnulacion: jornada.FechaAnulacion,
    rutaSesiones: (jornada.RutaSesion ?? [])
      .filter((sesion) => !sesion.Anulado && (visibleIdSet === undefined || visibleIdSet.has(sesion.Id)))
      .map((sesion) => ({
        id: sesion.Id,
        idVehiculo: sesion.IdVehiculo,
        idUsuarioChofer: sesion.IdUsuarioChofer,
        idUsuarioVendedor: sesion.IdUsuarioVendedor,
        idEmpleadoChofer: sesion.IdEmpleadoChofer,
        idEmpleadoVendedor: sesion.IdEmpleadoVendedor,
        estado: sesion.Estado,
      })),
  };
}

function jornadaInclude(visibleSessionIds?: number[]) {
  return {
    RutaSesion: {
      where: {
        Anulado: false,
        ...(visibleSessionIds !== undefined ? { Id: { in: visibleSessionIds } } : {}),
      },
      select: {
        Id: true,
        IdVehiculo: true,
        IdUsuarioChofer: true,
        IdUsuarioVendedor: true,
        IdEmpleadoChofer: true,
        IdEmpleadoVendedor: true,
        Estado: true,
        Anulado: true,
      },
    },
  } as const;
}

export async function listJornadas(
  filters: { anulado?: boolean; estado?: JornadaEstado },
  actor?: OperationalActor,
) {
  const visibleSessionIds = actor
    ? await getRouteSessionReadVisibilityIds(prisma, actor)
    : undefined;
  if (visibleSessionIds?.length === 0) return [];

  const rows = await prisma.jornada.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.estado !== undefined ? { Estado: filters.estado } : {}),
      ...(visibleSessionIds !== undefined
        ? { RutaSesion: { some: { Id: { in: visibleSessionIds }, Anulado: false } } }
        : {}),
    },
    include: jornadaInclude(visibleSessionIds),
    orderBy: [{ Fecha: 'desc' }, { Id: 'desc' }],
  });

  return rows.map((row) => toJornadaDto(row, visibleSessionIds));
}

export async function getJornadaById(id: number, actor?: OperationalActor) {
  const visibleSessionIds = actor
    ? await getRouteSessionReadVisibilityIds(prisma, actor)
    : undefined;
  if (visibleSessionIds?.length === 0) {
    throw new Error('Jornada no existe');
  }

  const row = await prisma.jornada.findFirst({
    where: {
      Id: id,
      Anulado: false,
      ...(visibleSessionIds !== undefined
        ? { RutaSesion: { some: { Id: { in: visibleSessionIds }, Anulado: false } } }
        : {}),
    },
    include: jornadaInclude(visibleSessionIds),
  });

  if (!row) {
    throw new Error('Jornada no existe');
  }

  return toJornadaDto(row, visibleSessionIds);
}

export async function createJornada(input: CreateJornadaInput, actor?: OperationalActor) {
  const fecha = parseDateOnlyUtc(input.fecha);
  const isOperationalUser = ['vendedor', 'chofer'].includes(actor?.roleName?.trim().toLocaleLowerCase('es') ?? '');
  const idUsuarioResponsable = isOperationalUser ? actor?.userId : input.idUsuarioResponsable;

  if (idUsuarioResponsable !== undefined) {
    await validateUsuarioExists(idUsuarioResponsable);
  }

  const created = await prisma.jornada.create({
    data: {
      Fecha: fecha,
      Estado: 'ABIERTA',
      IdUsuarioResponsable: idUsuarioResponsable,
      Observaciones: input.observaciones?.trim(),
      Anulado: false,
    },
    include: jornadaInclude(),
  });

  return toJornadaDto(created);
}

export async function closeJornada(
  id: number,
  idUsuarioModificador: number,
  actor?: OperationalActor,
) {
  await validateUsuarioExists(idUsuarioModificador);

  const result = await runSerializableTransaction(async (tx) => {
    const visibleSessionIds = actor
      ? await getRouteSessionReadVisibilityIds(tx, actor)
      : undefined;
    const jornada = await tx.jornada.findFirst({
      where: { Id: id, Anulado: false },
      select: {
        Id: true,
        Estado: true,
        RutaSesion: {
          where: { Anulado: false },
          select: { Id: true, Estado: true },
        },
      },
    });

    if (!jornada) {
      throw new Error('Jornada no existe');
    }
    if (
      visibleSessionIds !== undefined &&
      (jornada.RutaSesion.length === 0 ||
        jornada.RutaSesion.some((sesion) => !visibleSessionIds.includes(sesion.Id)))
    ) {
      throw new Error('Jornada no existe o no está asignada al usuario');
    }
    if (jornada.Estado === 'CERRADA') {
      throw new Error('La jornada ya está cerrada');
    }

    const sesionesAbiertas = jornada.RutaSesion.filter((sesion) => sesion.Estado !== 'CERRADA');
    if (sesionesAbiertas.length > 0) {
      throw new Error(
        'No se puede cerrar la jornada mientras existan sesiones de ruta activas o programadas sin cerrar',
      );
    }

    const updated = await tx.jornada.update({
      where: { Id: id },
      data: {
        Estado: 'CERRADA',
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
      include: jornadaInclude(visibleSessionIds),
    });
    return { updated, visibleSessionIds };
  });

  return toJornadaDto(result.updated, result.visibleSessionIds);
}
