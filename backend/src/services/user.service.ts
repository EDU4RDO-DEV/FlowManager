import bcrypt from 'bcryptjs';

import { prisma } from '../config/prisma';

type CreateUserInput = {
  nombre: string;
  correo: string;
  clave: string;
  idUsuario?: number;
  idRol?: number;
  idEmpleadoVinculado?: number;
  entidad?: EntidadInput;
};

type EntidadInput = {
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

type UpdateUserInput = {
  nombre?: string;
  correo?: string;
  clave?: string;
  idUsuario?: number | null;
  idEntidad?: number | null;
  idRol?: number | null;
  idEmpleadoVinculado?: number | null;
  idUsuarioModificador?: number;
  entidad?: EntidadInput;
};

type ChangeUserPasswordInput = {
  claveActual: string;
  nuevaClave: string;
  idUsuarioModificador?: number;
};

type ResetUserPasswordInput = {
  nuevaClave: string;
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
  Entidad_Usuario_IdEntidadToEntidad?: {
    Id: number;
    NombreCompleto: string;
    Sexo: string | null;
    FechaNacimiento: Date | null;
    Telefono1: string | null;
    Telefono2: string | null;
    CorreoElectronico: string | null;
    RutaImagen: string | null;
    Nit: string | null;
    Dpi: string | null;
    Anulado: boolean;
  } | null;
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
    ...(usuario.Entidad_Usuario_IdEntidadToEntidad
      ? {
          entidad: {
            id: usuario.Entidad_Usuario_IdEntidadToEntidad.Id,
            nombreCompleto: usuario.Entidad_Usuario_IdEntidadToEntidad.NombreCompleto,
            sexo: usuario.Entidad_Usuario_IdEntidadToEntidad.Sexo,
            fechaNacimiento: usuario.Entidad_Usuario_IdEntidadToEntidad.FechaNacimiento,
            telefono1: usuario.Entidad_Usuario_IdEntidadToEntidad.Telefono1,
            telefono2: usuario.Entidad_Usuario_IdEntidadToEntidad.Telefono2,
            correoElectronico: usuario.Entidad_Usuario_IdEntidadToEntidad.CorreoElectronico,
            rutaImagen: usuario.Entidad_Usuario_IdEntidadToEntidad.RutaImagen,
            nit: usuario.Entidad_Usuario_IdEntidadToEntidad.Nit,
            dpi: usuario.Entidad_Usuario_IdEntidadToEntidad.Dpi,
            anulado: usuario.Entidad_Usuario_IdEntidadToEntidad.Anulado,
          },
        }
      : {}),
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

async function getEmployeeEntidadId(idEmpleado: number): Promise<number> {
  const empleado = await prisma.empleado.findFirst({
    where: { Id: idEmpleado, Anulado: false },
    select: { IdEntidad: true },
  });

  if (!empleado) {
    throw new Error('Empleado no existe');
  }

  return empleado.IdEntidad;
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

async function getActiveUserWithPassword(id: number) {
  const user = await prisma.usuario.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Clave: true },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }

  return user;
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

type ListUsersAvailableForEmployeeLinkInput = {
  includeEmployeeId?: number;
};

async function validateEntidadNotLinkedToOtherUser(idEntidad: number, exceptUserId?: number) {
  const existing = await prisma.usuario.findFirst({
    where: {
      Anulado: false,
      IdEntidad: idEntidad,
      ...(exceptUserId !== undefined ? { NOT: { Id: exceptUserId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('La entidad ya está vinculada a otro usuario');
  }
}

// Empleado.IdUsuarioVinculado es la única fuente de verdad de la relación laboral.
async function validateEmpleadoDisponibleParaUsuario(idEmpleado: number, exceptUserId?: number) {
  const empleado = await prisma.empleado.findFirst({
    where: { Id: idEmpleado, Anulado: false },
    select: { IdUsuarioVinculado: true },
  });

  if (!empleado) {
    throw new Error('Empleado no existe');
  }

  if (
    empleado.IdUsuarioVinculado !== null &&
    (exceptUserId === undefined || empleado.IdUsuarioVinculado !== exceptUserId)
  ) {
    throw new Error('El empleado ya está vinculado a otro usuario');
  }
}

export async function listUsersAvailableForEmployeeLink(
  input: ListUsersAvailableForEmployeeLinkInput = {},
) {
  let currentEmployeeUsuarioId: number | null = null;

  if (input.includeEmployeeId !== undefined) {
    const employee = await prisma.empleado.findFirst({
      where: {
        Id: input.includeEmployeeId,
        Anulado: false,
      },
      select: {
        IdUsuarioVinculado: true,
      },
    });

    if (!employee) {
      throw new Error('Empleado no existe');
    }

    currentEmployeeUsuarioId = employee.IdUsuarioVinculado;
  }

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

  // Disponible si ningún empleado activo lo tiene como IdUsuarioVinculado, salvo el vínculo actual en edición.
  const linkedEmpleados = await prisma.empleado.findMany({
    where: {
      Anulado: false,
      IdUsuarioVinculado: { not: null },
    },
    select: { IdUsuarioVinculado: true },
  });

  const blockedUserIds = new Set<number>(
    linkedEmpleados
      .map((item) => item.IdUsuarioVinculado)
      .filter((idUsuario): idUsuario is number => idUsuario !== null),
  );

  return users
    .filter((user) => {
      if (currentEmployeeUsuarioId !== null && user.Id === currentEmployeeUsuarioId) {
        return true;
      }

      return !blockedUserIds.has(user.Id);
    })
    .map(toUserDto);
}

export async function listAnulatedUsers() {
  const users = await prisma.usuario.findMany({
    where: { Anulado: true },
    orderBy: { FechaAnulacion: 'desc' },
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
      Entidad_Usuario_IdEntidadToEntidad: {
        select: {
          Id: true,
          NombreCompleto: true,
          Sexo: true,
          FechaNacimiento: true,
          Telefono1: true,
          Telefono2: true,
          CorreoElectronico: true,
          RutaImagen: true,
          Nit: true,
          Dpi: true,
          Anulado: true,
        },
      },
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

  let entidadVinculadaId: number | undefined;
  if (input.idEmpleadoVinculado !== undefined) {
    await validateEmpleadoDisponibleParaUsuario(input.idEmpleadoVinculado);
    entidadVinculadaId = await getEmployeeEntidadId(input.idEmpleadoVinculado);
    await validateEntidadExists(entidadVinculadaId);
    await validateEntidadNotLinkedToOtherUser(entidadVinculadaId);
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
        IdEntidad: entidadVinculadaId ?? null,
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

    if (entidadVinculadaId !== undefined) {
      await tx.entidad.update({
        where: { Id: entidadVinculadaId },
        data: {
          NombreCompleto: input.entidad?.nombreCompleto?.trim() || input.nombre,
          Sexo: input.entidad?.sexo,
          ...(input.entidad?.fechaNacimiento !== undefined
            ? { FechaNacimiento: fechaNacimiento }
            : {}),
          Telefono1: input.entidad?.telefono1,
          Telefono2: input.entidad?.telefono2,
          CorreoElectronico: input.entidad?.correoElectronico ?? input.correo,
          RutaImagen: input.entidad?.rutaImagen,
          Nit: input.entidad?.nit,
          Dpi: input.entidad?.dpi,
          FechaModificacion: new Date(),
        },
      });

      // Empleado.IdUsuarioVinculado es la fuente de verdad autoritativa del vínculo laboral.
      await tx.empleado.update({
        where: { Id: input.idEmpleadoVinculado },
        data: { IdUsuarioVinculado: createdUser.Id },
      });

      return tx.usuario.findFirstOrThrow({
        where: { Id: createdUser.Id },
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
    await validateEntidadNotLinkedToOtherUser(input.idEntidad, id);
  }

  if (input.idEmpleadoVinculado !== undefined && input.idEmpleadoVinculado !== null) {
    await validateEmpleadoDisponibleParaUsuario(input.idEmpleadoVinculado, id);
    input.idEntidad = await getEmployeeEntidadId(input.idEmpleadoVinculado);
    await validateEntidadExists(input.idEntidad);
    await validateEntidadNotLinkedToOtherUser(input.idEntidad, id);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const claveHash = input.clave ? await bcrypt.hash(input.clave, 10) : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.usuario.update({
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

    if (input.idEmpleadoVinculado !== undefined) {
      // Empleado.IdUsuarioVinculado es la fuente de verdad autoritativa del vínculo laboral.
      const previousEmpleado = await tx.empleado.findFirst({
        where: { IdUsuarioVinculado: id, Anulado: false },
        select: { Id: true },
      });

      if (input.idEmpleadoVinculado === null) {
        if (previousEmpleado) {
          await tx.empleado.update({
            where: { Id: previousEmpleado.Id },
            data: { IdUsuarioVinculado: null },
          });
        }
      } else {
        if (previousEmpleado && previousEmpleado.Id !== input.idEmpleadoVinculado) {
          await tx.empleado.update({
            where: { Id: previousEmpleado.Id },
            data: { IdUsuarioVinculado: null },
          });
        }

        await tx.empleado.update({
          where: { Id: input.idEmpleadoVinculado },
          data: { IdUsuarioVinculado: id },
        });
      }
    }

    return updatedUser;
  });

  const shouldUpdateEntidad =
    input.nombre !== undefined ||
    input.correo !== undefined ||
    input.entidad !== undefined;

  if (updated.IdEntidad && shouldUpdateEntidad) {
    const fechaNacimiento =
      input.entidad?.fechaNacimiento !== undefined
        ? new Date(input.entidad.fechaNacimiento)
        : undefined;

    if (fechaNacimiento && Number.isNaN(fechaNacimiento.getTime())) {
      throw new Error('fechaNacimiento inválida');
    }

    await prisma.entidad.update({
      where: { Id: updated.IdEntidad },
      data: {
        ...(input.nombre !== undefined
          ? { NombreCompleto: input.nombre }
          : input.entidad?.nombreCompleto !== undefined
            ? { NombreCompleto: input.entidad.nombreCompleto }
            : {}),
        ...(input.correo !== undefined
          ? { CorreoElectronico: input.correo }
          : input.entidad?.correoElectronico !== undefined
            ? { CorreoElectronico: input.entidad.correoElectronico }
            : {}),
        ...(input.entidad?.sexo !== undefined ? { Sexo: input.entidad.sexo } : {}),
        ...(input.entidad?.fechaNacimiento !== undefined
          ? { FechaNacimiento: fechaNacimiento }
          : {}),
        ...(input.entidad?.telefono1 !== undefined
          ? { Telefono1: input.entidad.telefono1 }
          : {}),
        ...(input.entidad?.telefono2 !== undefined
          ? { Telefono2: input.entidad.telefono2 }
          : {}),
        ...(input.entidad?.rutaImagen !== undefined
          ? { RutaImagen: input.entidad.rutaImagen }
          : {}),
        ...(input.entidad?.nit !== undefined ? { Nit: input.entidad.nit } : {}),
        ...(input.entidad?.dpi !== undefined ? { Dpi: input.entidad.dpi } : {}),
        ...(input.idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: input.idUsuarioModificador }
          : {}),
        FechaModificacion: new Date(),
      },
    });
  }

  const refreshed = await prisma.usuario.findFirst({
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
      Entidad_Usuario_IdEntidadToEntidad: {
        select: {
          Id: true,
          NombreCompleto: true,
          Sexo: true,
          FechaNacimiento: true,
          Telefono1: true,
          Telefono2: true,
          CorreoElectronico: true,
          RutaImagen: true,
          Nit: true,
          Dpi: true,
          Anulado: true,
        },
      },
    },
  });

  if (!refreshed) {
    throw new Error('Usuario no existe');
  }

  return toUserDto(refreshed);
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

  const fechaAnulacion = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { Id: id },
      data: {
        Anulado: true,
        ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
        FechaAnulacion: fechaAnulacion,
      },
    });

    await tx.sesion.updateMany({
      where: {
        IdUsuario: id,
        Anulado: false,
      },
      data: {
        Anulado: true,
        ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
        FechaAnulacion: fechaAnulacion,
      },
    });
  });
}

export async function restoreUser(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.usuario.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, Correo: true },
  });

  if (!existing) {
    throw new Error('Usuario anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await validateCorreoDisponible(existing.Correo, id);

  const restored = await prisma.$transaction(async (tx) => {
    const fechaRevocacion = new Date();

    await tx.sesion.updateMany({
      where: { IdUsuario: id, Anulado: false },
      data: {
        Anulado: true,
        ...(idUsuarioModificador !== undefined
          ? { IdUsuarioAnulador: idUsuarioModificador }
          : {}),
        FechaAnulacion: fechaRevocacion,
      },
    });

    return tx.usuario.update({
      where: { Id: id },
      data: {
        Anulado: false,
        ...(idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: idUsuarioModificador }
          : {}),
        FechaModificacion: new Date(),
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
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

  return toUserDto(restored);
}

export async function changeUserPassword(id: number, input: ChangeUserPasswordInput) {
  const user = await getActiveUserWithPassword(id);

  if (input.idUsuarioModificador !== undefined) {
    const usuarioModificador = await prisma.usuario.findFirst({
      where: { Id: input.idUsuarioModificador, Anulado: false },
      select: { Id: true },
    });

    if (!usuarioModificador) {
      throw new Error('Usuario modificador no existe');
    }
  }

  const currentPasswordOk = await bcrypt.compare(input.claveActual, user.Clave);
  if (!currentPasswordOk) {
    throw new Error('Clave actual incorrecta');
  }

  const isSamePassword = await bcrypt.compare(input.nuevaClave, user.Clave);
  if (isSamePassword) {
    throw new Error('La nueva clave debe ser diferente a la actual');
  }

  const newPasswordHash = await bcrypt.hash(input.nuevaClave, 10);

  await prisma.usuario.update({
    where: { Id: id },
    data: {
      Clave: newPasswordHash,
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });
}

export async function resetUserPassword(id: number, input: ResetUserPasswordInput) {
  const user = await getActiveUserWithPassword(id);

  if (input.idUsuarioModificador !== undefined) {
    const usuarioModificador = await prisma.usuario.findFirst({
      where: { Id: input.idUsuarioModificador, Anulado: false },
      select: { Id: true },
    });

    if (!usuarioModificador) {
      throw new Error('Usuario modificador no existe');
    }
  }

  const isSamePassword = await bcrypt.compare(input.nuevaClave, user.Clave);
  if (isSamePassword) {
    throw new Error('La nueva clave debe ser diferente a la actual');
  }

  const newPasswordHash = await bcrypt.hash(input.nuevaClave, 10);

  await prisma.usuario.update({
    where: { Id: id },
    data: {
      Clave: newPasswordHash,
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });
}