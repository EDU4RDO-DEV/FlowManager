import crypto from 'crypto';

import { prisma } from '../config/prisma';

type CreateSessionInput = {
  idUsuario: number;
  ip: string;
  nombreDispositivo: string;
  tokenSesion: string;
  latitud?: number;
  longitud?: number;
  precision?: number;
  fechaExpiracionToken: string;
};

type UpdateSessionInput = Partial<CreateSessionInput>;

function toSessionDto(session: {
  Id: number;
  IdUsuario: number;
  IP: string;
  NombreDispositivo: string;
  Latitud: unknown;
  Longitud: unknown;
  Precision: unknown;
  FechaExpiracionToken: Date;
  FechaRegistro: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  return {
    id: session.Id,
    idUsuario: session.IdUsuario,
    ip: session.IP,
    nombreDispositivo: session.NombreDispositivo,
    latitud: session.Latitud !== null ? Number(session.Latitud) : null,
    longitud: session.Longitud !== null ? Number(session.Longitud) : null,
    precision: session.Precision !== null ? Number(session.Precision) : null,
    fechaExpiracionToken: session.FechaExpiracionToken,
    fechaRegistro: session.FechaRegistro,
    anulado: session.Anulado,
    idUsuarioAnulador: session.IdUsuarioAnulador,
    fechaAnulacion: session.FechaAnulacion,
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

export async function listSessions() {
  const sessions = await prisma.sesion.findMany({
    where: { Anulado: false },
    orderBy: { Id: 'desc' },
  });

  return sessions.map(toSessionDto);
}

export async function listAnulatedSessions() {
  const sessions = await prisma.sesion.findMany({
    where: { Anulado: true },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return sessions.map(toSessionDto);
}

export async function getSessionById(id: number) {
  const session = await prisma.sesion.findFirst({
    where: { Id: id, Anulado: false },
  });

  if (!session) {
    throw new Error('Sesion no existe');
  }

  return toSessionDto(session);
}

export async function createSession(input: CreateSessionInput) {
  await validateUsuarioExists(input.idUsuario);

  const fechaExpiracion = new Date(input.fechaExpiracionToken);
  if (Number.isNaN(fechaExpiracion.getTime())) {
    throw new Error('fechaExpiracionToken inválida');
  }

  const created = await prisma.sesion.create({
    data: {
      IdUsuario: input.idUsuario,
      IP: input.ip,
      NombreDispositivo: input.nombreDispositivo,
      TokenSesion: hashToken(input.tokenSesion),
      Latitud: input.latitud,
      Longitud: input.longitud,
      Precision: input.precision,
      FechaExpiracionToken: fechaExpiracion,
      Anulado: false,
    },
  });

  return toSessionDto(created);
}

export async function updateSession(id: number, input: UpdateSessionInput) {
  const existing = await prisma.sesion.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Sesion no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  let fechaExpiracionToken: Date | undefined;
  if (input.fechaExpiracionToken !== undefined) {
    fechaExpiracionToken = new Date(input.fechaExpiracionToken);
    if (Number.isNaN(fechaExpiracionToken.getTime())) {
      throw new Error('fechaExpiracionToken inválida');
    }
  }

  const updated = await prisma.sesion.update({
    where: { Id: id },
    data: {
      ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
      ...(input.ip !== undefined ? { IP: input.ip } : {}),
      ...(input.nombreDispositivo !== undefined
        ? { NombreDispositivo: input.nombreDispositivo }
        : {}),
      ...(input.tokenSesion !== undefined
        ? { TokenSesion: hashToken(input.tokenSesion) }
        : {}),
      ...(input.latitud !== undefined ? { Latitud: input.latitud } : {}),
      ...(input.longitud !== undefined ? { Longitud: input.longitud } : {}),
      ...(input.precision !== undefined ? { Precision: input.precision } : {}),
      ...(fechaExpiracionToken !== undefined
        ? { FechaExpiracionToken: fechaExpiracionToken }
        : {}),
    },
  });

  return toSessionDto(updated);
}

export async function deleteSession(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.sesion.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Sesion no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.sesion.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreSession(id: number) {
  const existing = await prisma.sesion.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Sesion anulada no existe');
  }

  throw new Error('Las sesiones revocadas no se pueden restaurar; inicia sesión nuevamente');
}