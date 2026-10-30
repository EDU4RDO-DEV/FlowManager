import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { parseDateOnlyUtc, validateUsuarioExists } from './logistics.service';

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
    IdUsuarioChofer: number;
    IdUsuarioVendedor: number;
    Estado: string;
    Anulado: boolean;
  }[];
}) {
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
      .filter((sesion) => !sesion.Anulado)
      .map((sesion) => ({
        id: sesion.Id,
        idVehiculo: sesion.IdVehiculo,
        idUsuarioChofer: sesion.IdUsuarioChofer,
        idUsuarioVendedor: sesion.IdUsuarioVendedor,
        estado: sesion.Estado,
      })),
  };
}

const jornadaInclude = {
  RutaSesion: {
    select: {
      Id: true,
      IdVehiculo: true,
      IdUsuarioChofer: true,
      IdUsuarioVendedor: true,
      Estado: true,
      Anulado: true,
    },
  },
} as const;

export async function listJornadas(filters: { anulado?: boolean; estado?: JornadaEstado }) {
  const rows = await prisma.jornada.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.estado !== undefined ? { Estado: filters.estado } : {}),
    },
    include: jornadaInclude,
    orderBy: [{ Fecha: 'desc' }, { Id: 'desc' }],
  });

  return rows.map(toJornadaDto);
}

export async function getJornadaById(id: number) {
  const row = await prisma.jornada.findFirst({
    where: { Id: id, Anulado: false },
    include: jornadaInclude,
  });

  if (!row) {
    throw new Error('Jornada no existe');
  }

  return toJornadaDto(row);
}

export async function createJornada(input: CreateJornadaInput) {
  const fecha = parseDateOnlyUtc(input.fecha);

  if (input.idUsuarioResponsable !== undefined) {
    await validateUsuarioExists(input.idUsuarioResponsable);
  }

  const created = await prisma.jornada.create({
    data: {
      Fecha: fecha,
      Estado: 'ABIERTA',
      IdUsuarioResponsable: input.idUsuarioResponsable,
      Observaciones: input.observaciones?.trim(),
      Anulado: false,
    },
    include: jornadaInclude,
  });

  return toJornadaDto(created);
}

export async function closeJornada(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const updated = await runSerializableTransaction(async (tx) => {
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
    if (jornada.Estado === 'CERRADA') {
      throw new Error('La jornada ya está cerrada');
    }

    const sesionesAbiertas = jornada.RutaSesion.filter((sesion) => sesion.Estado !== 'CERRADA');
    if (sesionesAbiertas.length > 0) {
      throw new Error(
        'No se puede cerrar la jornada mientras existan sesiones de ruta activas o programadas sin cerrar',
      );
    }

    return tx.jornada.update({
      where: { Id: id },
      data: {
        Estado: 'CERRADA',
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
      include: jornadaInclude,
    });
  });

  return toJornadaDto(updated);
}
