import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

type LoginInput = {
  correo: string;
  clave: string;
  ip?: string;
  nombreDispositivo?: string;
};

type LoginResult = {
  token: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  user: {
    id: number;
    nombre: string;
    correo: string;
    idRol: number | null;
    nombreRol: string | null;
    permisos: UserPermissionsMap;
  };
};

type CrudAction = 'read' | 'create' | 'update' | 'delete';
type FrontendModuleKey =
  | 'resumen'
  | 'usuarios'
  | 'roles'
  | 'empleados'
  | 'clientes'
  | 'proveedores'
  | 'compras'
  | 'sesiones'
  | 'produccion'
  | 'inventario';

type BackendModuleKey = Exclude<FrontendModuleKey, 'resumen' | 'produccion'>;

type UserPermissionsMap = Partial<Record<FrontendModuleKey, CrudAction[]>>;

type RoleGroupKey =
  | 'adminGerencia'
  | 'produccion'
  | 'logistica'
  | 'cajeroVendedor'
  | 'inventario'
  | 'sinRol';

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

type RefreshInput = {
  refreshToken: string;
};

const ACCESS_TOKEN_EXPIRES_IN_MINUTES = Number(process.env.JWT_ACCESS_EXPIRES_IN_MINUTES ?? '480');
const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7');
const JWT_ISSUER = process.env.JWT_ISSUER ?? 'flowmanager.api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'flowmanager.web';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? '12');
const RBAC_PERSISTED_MODE = process.env.RBAC_PERSISTED_MODE ?? 'fallback';

const CRUD_ACTIONS: CrudAction[] = ['read', 'create', 'update', 'delete'];
const FRONTEND_MODULES: FrontendModuleKey[] = [
  'resumen',
  'usuarios',
  'roles',
  'empleados',
  'clientes',
  'proveedores',
  'compras',
  'sesiones',
  'produccion',
  'inventario',
];

const BACKEND_MODULES: BackendModuleKey[] = [
  'usuarios',
  'roles',
  'empleados',
  'clientes',
  'proveedores',
  'compras',
  'sesiones',
  'inventario',
];

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

const ROLE_GROUPS: Record<Exclude<RoleGroupKey, 'sinRol'>, string[]> = {
  adminGerencia: parseRoleNamesFromEnv('RBAC_ADMIN_ROLE_NAMES', [
    'ADMINISTRADOR / GERENTE',
    'ADMINISTRADOR',
    'GERENTE',
  ]),
  produccion: parseRoleNamesFromEnv('RBAC_PRODUCCION_ROLE_NAMES', [
    'PERSONAL DE PRODUCCION',
  ]),
  logistica: parseRoleNamesFromEnv('RBAC_LOGISTICA_ROLE_NAMES', [
    'PERSONAL DE LOGISTICA / REPARTIDOR',
  ]),
  cajeroVendedor: parseRoleNamesFromEnv('RBAC_CAJERO_ROLE_NAMES', [
    'CAJERO / VENDEDOR (PUNTO DE VENTA)',
  ]),
  inventario: parseRoleNamesFromEnv('RBAC_INVENTARIO_ROLE_NAMES', [
    'ENCARGADO DE INVENTARIO',
  ]),
};

const FALLBACK_MATRIX: Record<RoleGroupKey, Partial<Record<FrontendModuleKey, readonly CrudAction[]>>> = {
  adminGerencia: {
    resumen: ['read'],
    usuarios: ['read', 'create', 'update', 'delete'],
    roles: ['read', 'create', 'update', 'delete'],
    empleados: ['read', 'create', 'update', 'delete'],
    clientes: ['read', 'create', 'update', 'delete'],
    proveedores: ['read', 'create', 'update', 'delete'],
    compras: ['read', 'create', 'update', 'delete'],
    sesiones: ['read', 'create', 'update', 'delete'],
    produccion: ['read'],
    inventario: ['read', 'create', 'update', 'delete'],
  },
  produccion: {
    resumen: ['read'],
    empleados: ['read'],
    produccion: ['read'],
    inventario: ['read'],
  },
  logistica: {
    resumen: ['read'],
    clientes: ['read'],
    sesiones: ['read'],
    inventario: ['read'],
  },
  cajeroVendedor: {
    resumen: ['read'],
    clientes: ['read', 'create', 'update'],
    sesiones: ['read'],
    inventario: ['read'],
  },
  inventario: {
    resumen: ['read'],
    proveedores: ['read', 'create', 'update'],
    compras: ['read', 'create', 'update', 'delete'],
    inventario: ['read', 'create', 'update', 'delete'],
  },
  sinRol: {
    resumen: ['read'],
  },
};

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

function getRoleGroup(nombreRol: string | null): RoleGroupKey {
  if (!nombreRol) {
    return 'sinRol';
  }

  const normalized = normalizeRoleName(nombreRol);

  for (const [group, names] of Object.entries(ROLE_GROUPS) as [Exclude<RoleGroupKey, 'sinRol'>, string[]][]) {
    if (names.includes(normalized)) {
      return group;
    }
  }

  return 'sinRol';
}

function buildDefaultPermissions(): UserPermissionsMap {
  const map: UserPermissionsMap = {};
  for (const moduleKey of FRONTEND_MODULES) {
    map[moduleKey] = [];
  }
  return map;
}

function buildFallbackPermissions(nombreRol: string | null): UserPermissionsMap {
  const map = buildDefaultPermissions();
  const group = getRoleGroup(nombreRol);
  const rules = FALLBACK_MATRIX[group];

  for (const [moduleKey, actions] of Object.entries(rules) as [FrontendModuleKey, readonly CrudAction[]][]) {
    map[moduleKey] = [...actions];
  }

  return map;
}

async function resolveEffectivePermissions(idRol: number | null, nombreRol: string | null): Promise<UserPermissionsMap> {
  const fallback = buildFallbackPermissions(nombreRol);
  if (!idRol) {
    return fallback;
  }

  const tablesExist = await persistedTablesExist();
  if (!tablesExist) {
    return fallback;
  }

  const configured = await persistedPermissionsConfigured();
  if (!configured) {
    return RBAC_PERSISTED_MODE === 'strict' ? buildDefaultPermissions() : fallback;
  }

  const rows = await prisma.rolPermiso.findMany({
    where: {
      IdRol: idRol,
      Permitido: true,
      Anulado: false,
      ModuloSistema: {
        Clave: { in: [...BACKEND_MODULES] },
        Anulado: false,
      },
      AccionSistema: {
        Clave: { in: [...CRUD_ACTIONS] },
        Anulado: false,
      },
    },
    select: {
      ModuloSistema: { select: { Clave: true } },
      AccionSistema: { select: { Clave: true } },
    },
  });

  const map = buildDefaultPermissions();
  map.resumen = fallback.resumen ?? [];
  map.produccion = fallback.produccion ?? [];

  for (const row of rows) {
    const moduleKey = row.ModuloSistema.Clave as BackendModuleKey;
    const action = row.AccionSistema.Clave as CrudAction;
    const current = map[moduleKey] ?? [];
    if (!current.includes(action)) {
      map[moduleKey] = [...current, action];
    }
  }

  return map;
}

function getJwtSecrets() {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret) {
    throw new Error('JWT_SECRET no está configurado');
  }

  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET no está configurado');
  }

  return { accessSecret, refreshSecret };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function sanitizeRefreshDays(): number {
  if (!Number.isFinite(REFRESH_TOKEN_EXPIRES_IN_DAYS) || REFRESH_TOKEN_EXPIRES_IN_DAYS < 1) {
    return 7;
  }

  return Math.floor(REFRESH_TOKEN_EXPIRES_IN_DAYS);
}

function sanitizeSaltRounds(): number {
  if (!Number.isFinite(BCRYPT_SALT_ROUNDS) || BCRYPT_SALT_ROUNDS < 10) {
    return 12;
  }

  return Math.floor(BCRYPT_SALT_ROUNDS);
}

function normalizeEmail(correo: string): string {
  return correo.trim().toLowerCase();
}

function sanitizeAccessMinutes(): number {
  if (!Number.isFinite(ACCESS_TOKEN_EXPIRES_IN_MINUTES) || ACCESS_TOKEN_EXPIRES_IN_MINUTES < 1) {
    return 480;
  }

  return Math.floor(ACCESS_TOKEN_EXPIRES_IN_MINUTES);
}

async function buildUserDto(usuario: {
  Id: number;
  Nombre: string;
  Correo: string;
  IdRol: number | null;
  Rol_Usuario_IdRolToRol: { Nombre: string } | null;
}) {
  const permisos = await resolveEffectivePermissions(
    usuario.IdRol,
    usuario.Rol_Usuario_IdRolToRol?.Nombre ?? null,
  );

  return {
    id: usuario.Id,
    nombre: usuario.Nombre,
    correo: usuario.Correo,
    idRol: usuario.IdRol,
    nombreRol: usuario.Rol_Usuario_IdRolToRol?.Nombre ?? null,
    permisos,
  };
}

function signAccessToken(input: {
  accessSecret: string;
  userId: number;
  correo: string;
  idRol: number | null;
  nombreRol: string | null;
  nombre: string;
  sessionId: number;
}): string {
  const accessExpiresInSeconds = sanitizeAccessMinutes() * 60;

  return jwt.sign(
    {
      sub: input.userId,
      correo: input.correo,
      idRol: input.idRol,
      nombreRol: input.nombreRol,
      nombre: input.nombre,
      sid: input.sessionId,
      tokenType: 'access',
    },
    input.accessSecret,
    {
      algorithm: 'HS256',
      expiresIn: accessExpiresInSeconds,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

function signRefreshToken(input: {
  refreshSecret: string;
  userId: number;
  correo: string;
  idRol: number | null;
  nombre: string;
}): string {
  const refreshExpiresInSeconds = sanitizeRefreshDays() * 24 * 60 * 60;

  return jwt.sign(
    {
      sub: input.userId,
      correo: input.correo,
      idRol: input.idRol,
      nombre: input.nombre,
      tokenType: 'refresh',
      jti: crypto.randomUUID(),
    },
    input.refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: refreshExpiresInSeconds,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

type RefreshPayload = {
  sub: string | number;
  tokenType?: string;
};

function verifyRefreshToken(refreshToken: string, refreshSecret: string): RefreshPayload {
  try {
    const decoded = jwt.verify(refreshToken, refreshSecret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Refresh token inválido o expirado');
    }

    const payload = decoded as RefreshPayload;
    if (payload.tokenType !== 'refresh') {
      throw new Error('Refresh token inválido o expirado');
    }

    return payload;
  } catch {
    throw new Error('Refresh token inválido o expirado');
  }
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { clave, ip, nombreDispositivo } = input;
  const correo = normalizeEmail(input.correo);

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

  const { accessSecret, refreshSecret } = getJwtSecrets();

  const refreshToken = signRefreshToken({
    refreshSecret,
    userId: usuario.Id,
    correo: usuario.Correo,
    idRol: usuario.IdRol,
    nombre: usuario.Nombre,
  });

  const refreshExpiresAt = addDays(new Date(), sanitizeRefreshDays());

  const createdSession = await prisma.sesion.create({
    data: {
      IdUsuario: usuario.Id,
      IP: ip ?? '0.0.0.0',
      NombreDispositivo: nombreDispositivo ?? 'No informado',
      TokenSesion: hashToken(refreshToken),
      FechaExpiracionToken: refreshExpiresAt,
      Anulado: false,
    },
    select: {
      Id: true,
    },
  });

  const accessToken = signAccessToken({
    accessSecret,
    userId: usuario.Id,
    correo: usuario.Correo,
    idRol: usuario.IdRol,
    nombreRol: usuario.Rol_Usuario_IdRolToRol?.Nombre ?? null,
    nombre: usuario.Nombre,
    sessionId: createdSession.Id,
  });

  const user = await buildUserDto(usuario);

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    accessTokenExpiresIn: `${sanitizeAccessMinutes()}m`,
    user,
  };
}

export async function refreshAuthTokens(input: RefreshInput): Promise<LoginResult> {
  const { refreshToken } = input;
  const { accessSecret, refreshSecret } = getJwtSecrets();

  const payload = verifyRefreshToken(refreshToken, refreshSecret);
  const userId = Number(payload.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Refresh token inválido o expirado');
  }

  const tokenHash = hashToken(refreshToken);

  const session = await prisma.sesion.findFirst({
    where: {
      IdUsuario: userId,
      TokenSesion: tokenHash,
      Anulado: false,
      FechaExpiracionToken: {
        gt: new Date(),
      },
    },
    select: {
      Id: true,
      IdUsuario: true,
    },
  });

  if (!session) {
    throw new Error('Refresh token inválido o expirado');
  }

  const usuario = await prisma.usuario.findFirst({
    where: {
      Id: userId,
      Anulado: false,
    },
    select: {
      Id: true,
      Nombre: true,
      Correo: true,
      IdRol: true,
      Rol_Usuario_IdRolToRol: {
        select: {
          Nombre: true,
        },
      },
    },
  });

  if (!usuario) {
    throw new Error('Refresh token inválido o expirado');
  }

  const nextRefreshToken = signRefreshToken({
    refreshSecret,
    userId: usuario.Id,
    correo: usuario.Correo,
    idRol: usuario.IdRol,
    nombre: usuario.Nombre,
  });

  const nextRefreshExpiresAt = addDays(new Date(), sanitizeRefreshDays());

  await prisma.sesion.update({
    where: { Id: session.Id },
    data: {
      TokenSesion: hashToken(nextRefreshToken),
      FechaExpiracionToken: nextRefreshExpiresAt,
    },
  });

  const accessToken = signAccessToken({
    accessSecret,
    userId: usuario.Id,
    correo: usuario.Correo,
    idRol: usuario.IdRol,
    nombreRol: usuario.Rol_Usuario_IdRolToRol?.Nombre ?? null,
    nombre: usuario.Nombre,
    sessionId: session.Id,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken: nextRefreshToken,
    accessTokenExpiresIn: `${sanitizeAccessMinutes()}m`,
    user: await buildUserDto(usuario),
  };
}

export async function getCurrentAuthUser(idUsuario: number) {
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
      Rol_Usuario_IdRolToRol: {
        select: {
          Nombre: true,
        },
      },
    },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }

  return buildUserDto(usuario);
}

export async function revokeRefreshToken(
  refreshToken: string,
  requestedByUserId?: number,
): Promise<boolean> {
  const { refreshSecret } = getJwtSecrets();

  try {
    const payload = verifyRefreshToken(refreshToken, refreshSecret);
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return false;
    }

    if (requestedByUserId !== undefined && requestedByUserId !== userId) {
      return false;
    }

    const result = await prisma.sesion.updateMany({
      where: {
        IdUsuario: userId,
        TokenSesion: hashToken(refreshToken),
        Anulado: false,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: requestedByUserId ?? userId,
        FechaAnulacion: new Date(),
      },
    });

    return result.count > 0;
  } catch {
    return false;
  }
}

export async function revokeAllUserSessions(idUsuario: number, idUsuarioAnulador: number) {
  await prisma.sesion.updateMany({
    where: {
      IdUsuario: idUsuario,
      Anulado: false,
    },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { nombre, clave, idRol, idEntidad } = input;
  const correo = normalizeEmail(input.correo);

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

  const hashedPassword = await bcrypt.hash(clave, sanitizeSaltRounds());

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
