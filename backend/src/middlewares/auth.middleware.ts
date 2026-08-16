import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'flowmanager.api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'flowmanager.web';

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

type CrudAction = 'read' | 'create' | 'update' | 'delete';
type BackendModuleKey =
  | 'resumen'
  | 'usuarios'
  | 'roles'
  | 'clientes'
  | 'empleados'
  | 'proveedores'
  | 'compras'
  | 'inventario'
  | 'planilla'
  | 'sesiones'
  | 'produccion';

type PersistedDecision = 'allow' | 'deny' | 'not-configured';

function parseCountValue(row: Record<string, unknown> | undefined): number {
  if (!row) {
    return 0;
  }

  const firstValue = Object.values(row)[0];
  const count = Number(firstValue);
  return Number.isFinite(count) ? count : 0;
}

async function persistedTablesExist(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME IN ('ModuloSistema', 'AccionSistema', 'RolPermiso')
  `);

  return parseCountValue(rows[0]) === 3;
}

async function persistedPermissionsConfigured(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM RolPermiso
    WHERE Anulado = 0 AND Permitido = 1
  `);

  return parseCountValue(rows[0]) > 0;
}

async function evaluatePersistedPermission(
  idRol: number,
  moduleKey: BackendModuleKey,
  action: CrudAction,
): Promise<PersistedDecision> {
  const tablesExist = await persistedTablesExist();
  if (!tablesExist) {
    return 'not-configured';
  }

  const configured = await persistedPermissionsConfigured();
  if (!configured) {
    return 'not-configured';
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM RolPermiso rp
    INNER JOIN ModuloSistema m ON m.Id = rp.IdModuloSistema
    INNER JOIN AccionSistema a ON a.Id = rp.IdAccionSistema
    WHERE rp.IdRol = ${idRol}
      AND rp.Anulado = 0
      AND rp.Permitido = 1
      AND m.Anulado = 0
      AND a.Anulado = 0
      AND m.Clave = ${moduleKey}
      AND a.Clave = ${action}
  `);

  const allowed = parseCountValue(rows[0]) > 0;
  return allowed ? 'allow' : 'deny';
}

type TokenPayload = JwtPayload & {
  sub?: string | number;
  sid?: string | number;
  correo?: string;
  idRol?: number | null;
  nombreRol?: string | null;
  nombre?: string;
  tokenType?: string;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (typeof decoded !== 'object' || decoded === null) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    const payload = decoded as TokenPayload;
    if (payload.tokenType !== 'access') {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    const userId = Number(payload.sub);
    const sessionId = payload.sid !== undefined ? Number(payload.sid) : null;
    const roleId = payload.idRol !== undefined && payload.idRol !== null
      ? Number(payload.idRol)
      : null;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido o expirado',
      });
    }

    if (sessionId !== null) {
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(401).json({
          ok: false,
          message: 'Token inválido o expirado',
        });
      }

      const activeSession = await prisma.sesion.findFirst({
        where: {
          Id: sessionId,
          IdUsuario: userId,
          Anulado: false,
          FechaExpiracionToken: {
            gt: new Date(),
          },
        },
        select: {
          Id: true,
        },
      });

      if (!activeSession) {
        return res.status(401).json({
          ok: false,
          message: 'Token inválido o expirado',
        });
      }
    }

    req.auth = {
      userId,
      sessionId,
      idRol: roleId !== null && Number.isInteger(roleId) && roleId > 0 ? roleId : null,
      nombreRol: payload.nombreRol,
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

  return requireModulePermission('usuarios', 'update')(req, res, next);
}

export function requireModulePermission(moduleKey: BackendModuleKey, action: CrudAction) {
  return async function modulePermissionGuard(req: Request, res: Response, next: NextFunction) {
    try {
      const roleId = req.auth?.idRol;
      if (!roleId || !Number.isInteger(roleId) || roleId <= 0) {
        return res.status(403).json({
          ok: false,
          message: 'No tienes permisos para esta operación',
        });
      }

      const persistedDecision = await evaluatePersistedPermission(roleId, moduleKey, action);
      if (persistedDecision === 'allow') {
        return next();
      }

      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para esta operación',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return res.status(500).json({ ok: false, message });
    }
  };
}