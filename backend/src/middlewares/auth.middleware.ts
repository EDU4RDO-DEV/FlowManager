import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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
    jwt.verify(token, secret);
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