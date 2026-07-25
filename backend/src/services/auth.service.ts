import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { prisma } from '../config/prisma';

type LoginInput = {
  correo: string;
  clave: string;
};

type LoginResult = {
  token: string;
  user: {
    id: number;
    nombre: string;
    correo: string;
    idRol: number | null;
    nombreRol: string | null;
  };
};

type RegisterInput = {
  nombre: string;
  correo: string;
  clave: string;
  idRol?: number;
  idEntidad?: number;
};

type RegisterResult = {
  id: number;
  nombre: string;
  correo: string;
  idRol: number | null;
  idEntidad: number | null;
};

type AssignRoleEntityInput = {
  idUsuario: number;
  idRol: number;
  idEntidad?: number;
};

type AssignRoleEntityResult = {
  id: number;
  nombre: string;
  correo: string;
  idRol: number | null;
  idEntidad: number | null;
};

export async function login(input: LoginInput): Promise<LoginResult> {
  const { correo, clave } = input;

  const usuario = await prisma.usuario.findFirst({
    where: {
      Correo: correo,
      Anulado: false,
    },
    select: {
      Id: true,
      Nombre: true,
      Correo: true,
      Clave: true,
      IdRol: true,
      Rol_Usuario_IdRolToRol: {
        select: {
          Nombre: true,
        },
      },
    },
  });

  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  const passwordOk = await bcrypt.compare(clave, usuario.Clave);
  if (!passwordOk) {
    throw new Error('Credenciales inválidas');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado');
  }

  const token = jwt.sign(
    {
      sub: usuario.Id,
      correo: usuario.Correo,
      idRol: usuario.IdRol,
      nombre: usuario.Nombre,
    },
    secret,
    { expiresIn: '8h' },
  );

  return {
    token,
    user: {
      id: usuario.Id,
      nombre: usuario.Nombre,
      correo: usuario.Correo,
      idRol: usuario.IdRol,
      nombreRol: usuario.Rol_Usuario_IdRolToRol?.Nombre ?? null,
    },
  };
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { nombre, correo, clave, idRol, idEntidad } = input;

  const existing = await prisma.usuario.findFirst({
    where: {
      Correo: correo,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('El correo ya está registrado');
  }

  const hashedPassword = await bcrypt.hash(clave, 10);

  const created = await prisma.usuario.create({
    data: {
      Nombre: nombre,
      Correo: correo,
      Clave: hashedPassword,
      IdRol: idRol ?? null,
      IdEntidad: idEntidad ?? null,
      Anulado: false,
    },
    select: {
      Id: true,
      Nombre: true,
      Correo: true,
      IdRol: true,
      IdEntidad: true,
    },
  });

  return {
    id: created.Id,
    nombre: created.Nombre,
    correo: created.Correo,
    idRol: created.IdRol,
    idEntidad: created.IdEntidad,
  };
}

export async function assignUserRoleEntity(
  input: AssignRoleEntityInput,
): Promise<AssignRoleEntityResult> {
  const { idUsuario, idRol, idEntidad } = input;

  const usuario = await prisma.usuario.findFirst({
    where: {
      Id: idUsuario,
      Anulado: false,
    },
    select: {
      Id: true,
      Nombre: true,
      Correo: true,
      IdRol: true,
      IdEntidad: true,
    },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }

  const rol = await prisma.rol.findFirst({
    where: {
      Id: idRol,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!rol) {
    throw new Error('Rol no existe');
  }

  if (idEntidad !== undefined) {
    const entidad = await prisma.entidad.findFirst({
      where: {
        Id: idEntidad,
        Anulado: false,
      },
      select: { Id: true },
    });

    if (!entidad) {
      throw new Error('Entidad no existe');
    }
  }

  const isNoOpConflict =
    usuario.IdRol === idRol &&
    (idEntidad === undefined || usuario.IdEntidad === idEntidad);

  if (isNoOpConflict) {
    throw new Error('El usuario ya tiene la misma asignación de rol/entidad');
  }

  const updated = await prisma.usuario.update({
    where: { Id: idUsuario },
    data: {
      IdRol: idRol,
      ...(idEntidad !== undefined ? { IdEntidad: idEntidad } : {}),
    },
    select: {
      Id: true,
      Nombre: true,
      Correo: true,
      IdRol: true,
      IdEntidad: true,
    },
  });

  return {
    id: updated.Id,
    nombre: updated.Nombre,
    correo: updated.Correo,
    idRol: updated.IdRol,
    idEntidad: updated.IdEntidad,
  };
}
