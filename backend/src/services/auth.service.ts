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
