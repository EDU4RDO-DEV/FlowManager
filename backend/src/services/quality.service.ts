import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

type CreateControlCalidadInput = {
  idUsuario: number;
  fecha: string;
  diaNoLaborado?: boolean;
  cloroAntesFiltrado?: number;
  cloroDespuesFiltrado?: number;
  phAntesFiltrado?: number;
  phDespuesFiltrado?: number;
  observaciones?: string;
};

type UpdateControlCalidadInput = {
  diaNoLaborado?: boolean;
  cloroAntesFiltrado?: number | null;
  cloroDespuesFiltrado?: number | null;
  phAntesFiltrado?: number | null;
  phDespuesFiltrado?: number | null;
  observaciones?: string | null;
  idUsuarioModificador?: number;
};

type ListControlCalidadInput = {
  anio?: number;
  mes?: number;
  anulado?: boolean;
};

const FECHA_DUPLICADA_MESSAGE = 'Ya existe un registro activo de control de calidad para esa fecha';
const REGISTRO_VALIDADO_MESSAGE = 'No se puede editar un registro ya validado';

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toControlCalidadDto(registro: {
  Id: number;
  IdUsuario: number;
  Fecha: Date;
  DiaNoLaborado: boolean;
  CloroAntesFiltrado: unknown;
  CloroDespuesFiltrado: unknown;
  PhAntesFiltrado: unknown;
  PhDespuesFiltrado: unknown;
  Observaciones: string | null;
  Validado: boolean;
  IdUsuarioValidador: number | null;
  FechaValidacion: Date | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Usuario?: { Id: number; Nombre: string };
  UsuarioValidador?: { Id: number; Nombre: string } | null;
}) {
  return {
    id: registro.Id,
    idUsuario: registro.IdUsuario,
    fecha: registro.Fecha,
    diaNoLaborado: registro.DiaNoLaborado,
    cloroAntesFiltrado: registro.CloroAntesFiltrado === null ? null : Number(registro.CloroAntesFiltrado),
    cloroDespuesFiltrado:
      registro.CloroDespuesFiltrado === null ? null : Number(registro.CloroDespuesFiltrado),
    phAntesFiltrado: registro.PhAntesFiltrado === null ? null : Number(registro.PhAntesFiltrado),
    phDespuesFiltrado: registro.PhDespuesFiltrado === null ? null : Number(registro.PhDespuesFiltrado),
    observaciones: registro.Observaciones,
    validado: registro.Validado,
    idUsuarioValidador: registro.IdUsuarioValidador,
    fechaValidacion: registro.FechaValidacion,
    fechaRegistro: registro.FechaRegistro,
    idUsuarioModificador: registro.IdUsuarioModificador,
    fechaModificacion: registro.FechaModificacion,
    anulado: registro.Anulado,
    idUsuarioAnulador: registro.IdUsuarioAnulador,
    fechaAnulacion: registro.FechaAnulacion,
    usuario: registro.Usuario ? { id: registro.Usuario.Id, nombre: registro.Usuario.Nombre } : undefined,
    usuarioValidador: registro.UsuarioValidador
      ? { id: registro.UsuarioValidador.Id, nombre: registro.UsuarioValidador.Nombre }
      : undefined,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({ where: { Id: idUsuario, Anulado: false }, select: { Id: true } });
  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

function parseDateOnly(value: string, fieldName: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

function assertMedicionesCompletas(input: {
  diaNoLaborado?: boolean;
  cloroAntesFiltrado?: number;
  cloroDespuesFiltrado?: number;
  phAntesFiltrado?: number;
  phDespuesFiltrado?: number;
}) {
  if (input.diaNoLaborado) {
    return;
  }

  const faltantes =
    input.cloroAntesFiltrado === undefined ||
    input.cloroDespuesFiltrado === undefined ||
    input.phAntesFiltrado === undefined ||
    input.phDespuesFiltrado === undefined;

  if (faltantes) {
    throw new Error(
      'Debe registrar las 4 mediciones (cloro y pH antes/después de filtrado) salvo que sea un día no laborado',
    );
  }
}

async function validateFechaDisponible(fecha: Date, exceptId?: number) {
  const existing = await prisma.controlCalidadAgua.findFirst({
    where: {
      Fecha: fecha,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error(FECHA_DUPLICADA_MESSAGE);
  }
}

const includeUsuarios = {
  Usuario: { select: { Id: true, Nombre: true } },
  UsuarioValidador: { select: { Id: true, Nombre: true } },
};

export async function listControlCalidad(filters: ListControlCalidadInput) {
  const registros = await prisma.controlCalidadAgua.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : { Anulado: false }),
      ...(filters.anio !== undefined || filters.mes !== undefined
        ? {
            Fecha: {
              ...(filters.anio !== undefined && filters.mes !== undefined
                ? {
                    gte: new Date(Date.UTC(filters.anio, filters.mes - 1, 1)),
                    lt: new Date(Date.UTC(filters.anio, filters.mes, 1)),
                  }
                : {}),
            },
          }
        : {}),
    },
    include: includeUsuarios,
    orderBy: { Fecha: 'desc' },
  });

  return registros.map(toControlCalidadDto);
}

export async function listAnulatedControlCalidad() {
  const registros = await prisma.controlCalidadAgua.findMany({
    where: { Anulado: true },
    include: includeUsuarios,
    orderBy: { FechaAnulacion: 'desc' },
  });

  return registros.map(toControlCalidadDto);
}

export async function getControlCalidadById(id: number) {
  const registro = await prisma.controlCalidadAgua.findFirst({
    where: { Id: id, Anulado: false },
    include: includeUsuarios,
  });

  if (!registro) {
    throw new Error('Registro de control de calidad no existe');
  }

  return toControlCalidadDto(registro);
}

export async function createControlCalidad(input: CreateControlCalidadInput) {
  await validateUsuarioExists(input.idUsuario);
  assertMedicionesCompletas(input);

  const fecha = parseDateOnly(input.fecha, 'fecha');
  await validateFechaDisponible(fecha);

  let created;
  try {
    created = await prisma.controlCalidadAgua.create({
      data: {
        IdUsuario: input.idUsuario,
        Fecha: fecha,
        DiaNoLaborado: input.diaNoLaborado ?? false,
        CloroAntesFiltrado: input.cloroAntesFiltrado,
        CloroDespuesFiltrado: input.cloroDespuesFiltrado,
        PhAntesFiltrado: input.phAntesFiltrado,
        PhDespuesFiltrado: input.phDespuesFiltrado,
        Observaciones: input.observaciones,
        Validado: false,
        Anulado: false,
      },
      include: includeUsuarios,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(FECHA_DUPLICADA_MESSAGE);
    }
    throw error;
  }

  return toControlCalidadDto(created);
}

export async function updateControlCalidad(id: number, input: UpdateControlCalidadInput) {
  const existing = await prisma.controlCalidadAgua.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      Validado: true,
      DiaNoLaborado: true,
      CloroAntesFiltrado: true,
      CloroDespuesFiltrado: true,
      PhAntesFiltrado: true,
      PhDespuesFiltrado: true,
    },
  });

  if (!existing) {
    throw new Error('Registro de control de calidad no existe');
  }

  if (existing.Validado) {
    throw new Error(REGISTRO_VALIDADO_MESSAGE);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const diaNoLaborado = input.diaNoLaborado ?? existing.DiaNoLaborado;
  assertMedicionesCompletas({
    diaNoLaborado,
    cloroAntesFiltrado:
      input.cloroAntesFiltrado !== undefined
        ? (input.cloroAntesFiltrado ?? undefined)
        : existing.CloroAntesFiltrado === null
          ? undefined
          : Number(existing.CloroAntesFiltrado),
    cloroDespuesFiltrado:
      input.cloroDespuesFiltrado !== undefined
        ? (input.cloroDespuesFiltrado ?? undefined)
        : existing.CloroDespuesFiltrado === null
          ? undefined
          : Number(existing.CloroDespuesFiltrado),
    phAntesFiltrado:
      input.phAntesFiltrado !== undefined
        ? (input.phAntesFiltrado ?? undefined)
        : existing.PhAntesFiltrado === null
          ? undefined
          : Number(existing.PhAntesFiltrado),
    phDespuesFiltrado:
      input.phDespuesFiltrado !== undefined
        ? (input.phDespuesFiltrado ?? undefined)
        : existing.PhDespuesFiltrado === null
          ? undefined
          : Number(existing.PhDespuesFiltrado),
  });

  const updateResult = await prisma.controlCalidadAgua.updateMany({
    where: { Id: id, Anulado: false, Validado: false },
    data: {
      ...(input.diaNoLaborado !== undefined ? { DiaNoLaborado: input.diaNoLaborado } : {}),
      ...(input.cloroAntesFiltrado !== undefined ? { CloroAntesFiltrado: input.cloroAntesFiltrado } : {}),
      ...(input.cloroDespuesFiltrado !== undefined
        ? { CloroDespuesFiltrado: input.cloroDespuesFiltrado }
        : {}),
      ...(input.phAntesFiltrado !== undefined ? { PhAntesFiltrado: input.phAntesFiltrado } : {}),
      ...(input.phDespuesFiltrado !== undefined ? { PhDespuesFiltrado: input.phDespuesFiltrado } : {}),
      ...(input.observaciones !== undefined ? { Observaciones: input.observaciones } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });

  if (updateResult.count === 0) {
    const current = await prisma.controlCalidadAgua.findFirst({
      where: { Id: id, Anulado: false },
      select: { Id: true, Validado: true },
    });

    if (!current) {
      throw new Error('Registro de control de calidad no existe');
    }

    throw new Error(REGISTRO_VALIDADO_MESSAGE);
  }

  return getControlCalidadById(id);
}

export async function validateControlCalidadRegistro(id: number, idUsuarioValidador: number) {
  await validateUsuarioExists(idUsuarioValidador);

  const existing = await prisma.controlCalidadAgua.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Validado: true },
  });

  if (!existing) {
    throw new Error('Registro de control de calidad no existe');
  }

  if (existing.Validado) {
    return getControlCalidadById(id);
  }

  const updateResult = await prisma.controlCalidadAgua.updateMany({
    where: { Id: id, Anulado: false, Validado: false },
    data: {
      Validado: true,
      IdUsuarioValidador: idUsuarioValidador,
      FechaValidacion: new Date(),
    },
  });

  if (updateResult.count === 0) {
    return getControlCalidadById(id);
  }

  return getControlCalidadById(id);
}

export async function deleteControlCalidad(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.controlCalidadAgua.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Registro de control de calidad no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.controlCalidadAgua.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreControlCalidad(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.controlCalidadAgua.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, Fecha: true },
  });

  if (!existing) {
    throw new Error('Registro anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await validateFechaDisponible(existing.Fecha, id);

  let restored;
  try {
    restored = await prisma.controlCalidadAgua.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
        FechaModificacion: new Date(),
      },
      include: includeUsuarios,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(FECHA_DUPLICADA_MESSAGE);
    }
    throw error;
  }

  return toControlCalidadDto(restored);
}

// Identifica fechas del mes sin ningún registro (activo). No asume días no laborables:
// el negocio decide qué hacer con cada fecha faltante (incluye fines de semana).
export async function listFechasFaltantes(anio: number, mes: number) {
  const registros = await prisma.controlCalidadAgua.findMany({
    where: {
      Anulado: false,
      Fecha: {
        gte: new Date(Date.UTC(anio, mes - 1, 1)),
        lt: new Date(Date.UTC(anio, mes, 1)),
      },
    },
    select: { Fecha: true },
  });

  const registradas = new Set(registros.map((r) => r.Fecha.toISOString().slice(0, 10)));

  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hoy = new Date();
  const esMesActual = hoy.getUTCFullYear() === anio && hoy.getUTCMonth() + 1 === mes;
  const limite = esMesActual ? hoy.getUTCDate() : diasEnMes;

  const faltantes: string[] = [];
  for (let dia = 1; dia <= limite; dia += 1) {
    const fechaIso = new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);
    if (!registradas.has(fechaIso)) {
      faltantes.push(fechaIso);
    }
  }

  return faltantes;
}
