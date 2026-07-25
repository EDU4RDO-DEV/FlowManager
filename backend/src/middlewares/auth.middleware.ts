import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { prisma } from '../config/prisma';

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function parsePositiveInt(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

function normalizeRoleName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseAdminRoleNames(): string[] {
  const configured = process.env.RBAC_ADMIN_ROLE_NAMES;
  if (!configured) {
    return ['ADMINISTRADOR / GERENTE', 'ADMINISTRADOR', 'GERENTE'].map(
      normalizeRoleName,
    );
  }

  return configured
    .split(',')
    .map(normalizeRoleName)
    .filter((name) => name.length > 0);
}

type TokenPayload = JwtPayload & {
  sub?: string | number;
  correo?: string;
  idRol?: number | null;
  nombre?: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      ok: false,
      message: 'Token requerido. Usa Authorization: Bearer <token>',
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      ok: false,
      message: 'JWT_SECRET no está configurado',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== 'object' || decoded === null) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    const payload = decoded as TokenPayload;
    const userId = Number(payload.sub);
    const roleId = payload.idRol !== undefined && payload.idRol !== null
      ? Number(payload.idRol)
      : null;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    req.auth = {
      userId,
      idRol: roleId !== null && Number.isInteger(roleId) && roleId > 0 ? roleId : null,
      correo: payload.correo,
      nombre: payload.nombre,
    };

    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o expirado',
    });
  }
}

export async function requireBootstrapOrAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const usersCount = await prisma.usuario.count({
    where: { Anulado: false },
  });

  if (usersCount === 0) {
    return next();
  }

  return requireAuth(req, res, next);
}

export async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.idRol) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para esta operación',
      });
    }

    const role = await prisma.rol.findFirst({
      where: {
        Id: req.auth.idRol,
        Anulado: false,
      },
      select: {
        Nombre: true,
      },
    });

    if (!role) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para esta operación',
      });
    }

    const roleName = normalizeRoleName(role.Nombre);
    const adminRoleNames = parseAdminRoleNames();
    if (!adminRoleNames.includes(roleName)) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para esta operación',
      });
    }

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function requireSelfOrAdmin(req: Request, res: Response, next: NextFunction) {
  const targetId = parsePositiveInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'id debe ser un entero positivo',
    });
  }

  if (req.auth?.userId === targetId) {
    return next();
  }

  return requireAdminRole(req, res, next);
}