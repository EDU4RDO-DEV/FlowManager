import { prisma } from '../config/prisma';

type CreateRoleInput = {
  idUsuario: number;
  nombre: string;
  descripcion?: string;
};

type UpdateRoleInput = {
  nombre?: string;
  descripcion?: string | null;
  idUsuarioModificador?: number;
};

function toRoleDto(role: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  Descripcion: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  return {
    id: role.Id,
    idUsuario: role.IdUsuario,
    nombre: role.Nombre,
    descripcion: role.Descripcion,
    fechaRegistro: role.FechaRegistro,
    idUsuarioModificador: role.IdUsuarioModificador,
    fechaModificacion: role.FechaModificacion,
    anulado: role.Anulado,
    idUsuarioAnulador: role.IdUsuarioAnulador,
    fechaAnulacion: role.FechaAnulacion,
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

async function validateRoleNameAvailable(nombre: string, exceptId?: number) {
  const existing = await prisma.rol.findFirst({
    where: {
      Nombre: nombre,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe un rol con ese nombre');
  }
}

export async function listRoles() {
  const roles = await prisma.rol.findMany({
    where: { Anulado: false },
    orderBy: { Id: 'desc' },
  });

  return roles.map(toRoleDto);
}

export async function getRoleById(id: number) {
  const role = await prisma.rol.findFirst({
    where: { Id: id, Anulado: false },
  });

  if (!role) {
    throw new Error('Rol no existe');
  }

  return toRoleDto(role);
}

export async function createRole(input: CreateRoleInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateRoleNameAvailable(input.nombre);

  const created = await prisma.rol.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre,
      Descripcion: input.descripcion ?? null,
      Anulado: false,
    },
  });

  return toRoleDto(created);
}

export async function updateRole(id: number, input: UpdateRoleInput) {
  const existing = await prisma.rol.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Rol no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.nombre !== undefined) {
    await validateRoleNameAvailable(input.nombre, id);
  }

  const updated = await prisma.rol.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.descripcion !== undefined ? { Descripcion: input.descripcion } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });

  return toRoleDto(updated);
}

export async function deleteRole(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.rol.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Rol no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.rol.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}