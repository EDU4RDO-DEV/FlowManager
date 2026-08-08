import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

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

function normalizeRoleName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseRoleNamesFromEnv(envVarName: string, defaults: string[]): string[] {
  const configured = process.env[envVarName];
  if (!configured) {
    return defaults.map(normalizeRoleName);
  }

  return configured
    .split(',')
    .map(normalizeRoleName)
    .filter((name) => name.length > 0);
}

const ADMIN_ROLE_NAMES = parseRoleNamesFromEnv('RBAC_ADMIN_ROLE_NAMES', [
  'ADMINISTRADOR / GERENTE',
  'ADMINISTRADOR',
  'GERENTE',
]);

const PRODUCCION_ROLE_NAMES = parseRoleNamesFromEnv('RBAC_PRODUCCION_ROLE_NAMES', [
  'PERSONAL DE PRODUCCION',
]);

const LOGISTICA_ROLE_NAMES = parseRoleNamesFromEnv('RBAC_LOGISTICA_ROLE_NAMES', [
  'PERSONAL DE LOGISTICA / REPARTIDOR',
]);

const CAJERO_ROLE_NAMES = parseRoleNamesFromEnv('RBAC_CAJERO_ROLE_NAMES', [
  'CAJERO / VENDEDOR (PUNTO DE VENTA)',
]);

const INVENTARIO_ROLE_NAMES = parseRoleNamesFromEnv('RBAC_INVENTARIO_ROLE_NAMES', [
  'ENCARGADO DE INVENTARIO',
]);

export const ROLE_GROUPS = {
  adminGerencia: ADMIN_ROLE_NAMES,
  produccion: PRODUCCION_ROLE_NAMES,
  logistica: LOGISTICA_ROLE_NAMES,
  cajeroVendedor: CAJERO_ROLE_NAMES,
  inventario: INVENTARIO_ROLE_NAMES,
} as const;

type RoleGroupKey = keyof typeof ROLE_GROUPS;
type CrudAction = 'read' | 'create' | 'update' | 'delete';
type BackendModuleKey =
  | 'usuarios'
  | 'roles'
  | 'clientes'
  | 'empleados'
  | 'proveedores'
  | 'sesiones';

const RBAC_MATRIX: Record<BackendModuleKey, Record<CrudAction, readonly RoleGroupKey[]>> = {
  usuarios: {
    read: ['adminGerencia'],
    create: ['adminGerencia'],
    update: ['adminGerencia'],
    delete: ['adminGerencia'],
  },
  roles: {
    read: ['adminGerencia'],
    create: ['adminGerencia'],
    update: ['adminGerencia'],
    delete: ['adminGerencia'],
  },
  clientes: {
    read: ['adminGerencia', 'cajeroVendedor', 'logistica'],
    create: ['adminGerencia', 'cajeroVendedor'],
    update: ['adminGerencia', 'cajeroVendedor'],
    delete: ['adminGerencia'],
  },
  empleados: {
    read: ['adminGerencia', 'produccion'],
    create: ['adminGerencia'],
    update: ['adminGerencia'],
    delete: ['adminGerencia'],
  },
  proveedores: {
    read: ['adminGerencia', 'inventario'],
    create: ['adminGerencia', 'inventario'],
    update: ['adminGerencia', 'inventario'],
    delete: ['adminGerencia'],
  },
  sesiones: {
    read: ['adminGerencia', 'logistica', 'cajeroVendedor'],
    create: ['adminGerencia'],
    update: ['adminGerencia'],
    delete: ['adminGerencia'],
  },
};

type TokenPayload = JwtPayload & {
  sub?: string | number;
  correo?: string;
  idRol?: number | null;
  nombreRol?: string | null;
  nombre?: string;
  tokenType?: string;
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

export function requireRoleNames(allowedRoleNames: readonly string[]) {
  const allowed = allowedRoleNames.map(normalizeRoleName);

  return async function roleGuard(req: Request, res: Response, next: NextFunction) {
    try {
      const tokenRoleName = req.auth?.nombreRol;
      if (typeof tokenRoleName === 'string' && tokenRoleName.trim().length > 0) {
        const normalizedTokenRole = normalizeRoleName(tokenRoleName);

        if (allowed.includes(normalizedTokenRole)) {
          return next();
        }

        return res.status(403).json({
          ok: false,
          message: 'No tienes permisos para esta operación',
        });
      }

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
      if (!allowed.includes(roleName)) {
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
  };
}

export const requireAdminRole = requireRoleNames(ROLE_GROUPS.adminGerencia);

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

function roleNamesFromGroups(groups: readonly RoleGroupKey[]): string[] {
  return groups.flatMap((group) => ROLE_GROUPS[group]);
}

export function requireModulePermission(moduleKey: BackendModuleKey, action: CrudAction) {
  const allowedGroups = RBAC_MATRIX[moduleKey][action];
  const allowedRoleNames = roleNamesFromGroups(allowedGroups);
  return requireRoleNames(allowedRoleNames);
}