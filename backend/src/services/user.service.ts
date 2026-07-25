import bcrypt from 'bcryptjs';

import { prisma } from '../config/prisma';

type CreateUserInput = {
  nombre: string;
  correo: string;
  clave: string;
  idUsuario?: number;
  idRol?: number;
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
};

type UpdateUserInput = {
  nombre?: string;
  correo?: string;
  clave?: string;
  idUsuario?: number | null;
  idEntidad?: number | null;
  idRol?: number | null;
  idUsuarioModificador?: number;
};

function toUserDto(usuario: {
  Id: number;
  IdUsuario: number | null;
  IdEntidad: number | null;
  IdRol: number | null;
  Nombre: string;
  Correo: string;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  return {
    id: usuario.Id,
    idUsuario: usuario.IdUsuario,
    idEntidad: usuario.IdEntidad,
    idRol: usuario.IdRol,
    nombre: usuario.Nombre,
    correo: usuario.Correo,
    fechaRegistro: usuario.FechaRegistro,
    idUsuarioModificador: usuario.IdUsuarioModificador,
    fechaModificacion: usuario.FechaModificacion,
    anulado: usuario.Anulado,
    idUsuarioAnulador: usuario.IdUsuarioAnulador,
    fechaAnulacion: usuario.FechaAnulacion,
  };
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

async function validateRolExists(idRol: number) {
  const rol = await prisma.rol.findFirst({
    where: { Id: idRol, Anulado: false },
    select: { Id: true },
  });

  if (!rol) {
    throw new Error('Rol no existe');
  }
}

async function validateEntidadExists(idEntidad: number) {
  const entidad = await prisma.entidad.findFirst({
    where: { Id: idEntidad, Anulado: false },
    select: { Id: true },
  });

  if (!entidad) {
    throw new Error('Entidad no existe');
  }
}

async function validateCorreoDisponible(correo: string, exceptId?: number) {
  const existing = await prisma.usuario.findFirst({
    where: {
      Correo: correo,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('El correo ya está registrado');
  }
}

export async function listUsers() {
  const users = await prisma.usuario.findMany({
    where: { Anulado: false },
    orderBy: { Id: 'desc' },
    select: {
      Id: true,
      IdUsuario: true,
      IdEntidad: true,
      IdRol: true,
      Nombre: true,
      Correo: true,
      FechaRegistro: true,
      IdUsuarioModificador: true,
      FechaModificacion: true,
      Anulado: true,
      IdUsuarioAnulador: true,
      FechaAnulacion: true,
    },
  });

  return users.map(toUserDto);
}

export async function getUserById(id: number) {
  const user = await prisma.usuario.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdUsuario: true,
      IdEntidad: true,
      IdRol: true,
      Nombre: true,
      Correo: true,
      FechaRegistro: true,
      IdUsuarioModificador: true,
      FechaModificacion: true,
      Anulado: true,
      IdUsuarioAnulador: true,
      FechaAnulacion: true,
    },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }

  return toUserDto(user);
}

export async function createUser(input: CreateUserInput) {
  await validateCorreoDisponible(input.correo);

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idRol !== undefined) {
    await validateRolExists(input.idRol);
  }

  const claveHash = await bcrypt.hash(input.clave, 10);

  const created = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.usuario.create({
      data: {
        Nombre: input.nombre,
        Correo: input.correo,
        Clave: claveHash,
        IdUsuario: input.idUsuario ?? null,
        IdRol: input.idRol ?? null,
        IdEntidad: null,
        Anulado: false,
      },
      select: {
        Id: true,
      },
    });

    let fechaNacimiento: Date | undefined;
    if (input.entidad?.fechaNacimiento) {
      fechaNacimiento = new Date(input.entidad.fechaNacimiento);
      if (Number.isNaN(fechaNacimiento.getTime())) {
        throw new Error('fechaNacimiento inválida');
      }
    }

    const createdEntidad = await tx.entidad.create({
      data: {
        IdUsuario: createdUser.Id,
        NombreCompleto: input.entidad?.nombreCompleto?.trim() || input.nombre,
        Sexo: input.entidad?.sexo,
        FechaNacimiento: fechaNacimiento,
        Telefono1: input.entidad?.telefono1,
        Telefono2: input.entidad?.telefono2,
        CorreoElectronico: input.entidad?.correoElectronico ?? input.correo,
        RutaImagen: input.entidad?.rutaImagen,
        Nit: input.entidad?.nit,
        Dpi: input.entidad?.dpi,
        Anulado: false,
      },
      select: {
        Id: true,
      },
    });

    return tx.usuario.update({
      where: { Id: createdUser.Id },
      data: {
        IdEntidad: createdEntidad.Id,
      },
      select: {
        Id: true,
        IdUsuario: true,
        IdEntidad: true,
        IdRol: true,
        Nombre: true,
        Correo: true,
        FechaRegistro: true,
        IdUsuarioModificador: true,
        FechaModificacion: true,
        Anulado: true,
        IdUsuarioAnulador: true,
        FechaAnulacion: true,
      },
    });
  });

  return toUserDto(created);
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const existing = await prisma.usuario.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Usuario no existe');
  }

  if (input.correo !== undefined) {
    await validateCorreoDisponible(input.correo, id);
  }

  if (input.idUsuario !== undefined && input.idUsuario !== null) {
    if (input.idUsuario === id) {
      throw new Error('idUsuario padre no puede ser el mismo usuario');
    }

    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idRol !== undefined && input.idRol !== null) {
    await validateRolExists(input.idRol);
  }

  if (input.idEntidad !== undefined && input.idEntidad !== null) {
    await validateEntidadExists(input.idEntidad);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const claveHash = input.clave ? await bcrypt.hash(input.clave, 10) : undefined;

  const updated = await prisma.usuario.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.correo !== undefined ? { Correo: input.correo } : {}),
      ...(claveHash !== undefined ? { Clave: claveHash } : {}),
      ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
      ...(input.idRol !== undefined ? { IdRol: input.idRol } : {}),
      ...(input.idEntidad !== undefined ? { IdEntidad: input.idEntidad } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
    select: {
      Id: true,
      IdUsuario: true,
      IdEntidad: true,
      IdRol: true,
      Nombre: true,
      Correo: true,
      FechaRegistro: true,
      IdUsuarioModificador: true,
      FechaModificacion: true,
      Anulado: true,
      IdUsuarioAnulador: true,
      FechaAnulacion: true,
    },
  });

  if (updated.IdEntidad && (input.nombre !== undefined || input.correo !== undefined)) {
    await prisma.entidad.update({
      where: { Id: updated.IdEntidad },
      data: {
        ...(input.nombre !== undefined ? { NombreCompleto: input.nombre } : {}),
        ...(input.correo !== undefined ? { CorreoElectronico: input.correo } : {}),
      },
    });
  }

  return toUserDto(updated);
}

export async function deleteUser(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.usuario.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Usuario no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.usuario.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}