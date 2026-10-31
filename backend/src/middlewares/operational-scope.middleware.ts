import { NextFunction, Request, Response } from 'express';

import { prisma } from '../config/prisma';
import {
  assertRouteSessionAccess,
  assertSaleAccess,
  getRouteSessionReadVisibilityIds,
  getRouteSessionVisibilityWhere,
  type OperationalActor,
} from '../services/operational-scope.service';

function getActor(req: Request): OperationalActor | null {
  if (!req.auth?.userId) return null;
  return { userId: req.auth.userId, roleName: req.auth.nombreRol };
}

function parseId(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) {
    if (value.length !== 1) return null;
    value = value[0];
  }
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function handleScopeError(error: unknown, res: Response) {
  const message = error instanceof Error ? error.message : 'Error interno';
  if (message.includes('no existe o no está asignada')) {
    return res.status(404).json({ ok: false, message: 'Registro no existe o no está asignado al usuario' });
  }
  return res.status(500).json({ ok: false, message });
}

export function requireAssignedRouteSessionAccess(paramName = 'id') {
  return async function assignedRouteSessionGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      await assertRouteSessionAccess(prisma, id, actor);
      return next();
    } catch (error) {
      return handleScopeError(error, res);
    }
  };
}

export function requireAssignedRouteSessionReadAccess(paramName = 'id') {
  return async function assignedRouteSessionReadGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      const visibleSessionIds = await getRouteSessionReadVisibilityIds(prisma, actor);
      if (visibleSessionIds === undefined || visibleSessionIds.includes(id)) return next();
      return res.status(404).json({
        ok: false,
        message: 'Registro no existe o no está asignado al usuario',
      });
    } catch (error) {
      return handleScopeError(error, res);
    }
  };
}

export function requireAssignedVehicleAccess(paramName = 'id') {
  return async function assignedVehicleGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      const visibleSessionIds = await getRouteSessionReadVisibilityIds(prisma, actor);
      if (visibleSessionIds === undefined) return next();

      const assignedSession = await prisma.rutaSesion.findFirst({
        where: {
          IdVehiculo: id,
          Id: { in: visibleSessionIds },
          Anulado: false,
          Estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
        },
        select: { Id: true },
      });
      if (!assignedSession) {
        return res.status(404).json({
          ok: false,
          message: 'Vehiculo no existe o no está asignado al usuario',
        });
      }

      return next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return res.status(500).json({ ok: false, message });
    }
  };
}

export function requireAssignedVehicleExpenseAccess(paramName = 'id') {
  return async function assignedVehicleExpenseGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      const expense = await prisma.gastoVehiculo.findFirst({
        where: { Id: id },
        select: { IdRutaSesion: true },
      });
      if (!expense) return res.status(404).json({ ok: false, message: 'GastoVehiculo no existe' });

      await assertRouteSessionAccess(prisma, expense.IdRutaSesion, actor);
      return next();
    } catch (error) {
      return handleScopeError(error, res);
    }
  };
}

export function requireAssignedSaleAccess(paramName = 'id') {
  return async function assignedSaleGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      await assertSaleAccess(prisma, id, actor);
      return next();
    } catch (error) {
      return handleScopeError(error, res);
    }
  };
}

export function requireAssignedCreditAccess(paramName = 'id') {
  return async function assignedCreditGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params[paramName]);
    if (!id) return res.status(400).json({ ok: false, message: `${paramName} debe ser un entero positivo` });

    try {
      const credit = await prisma.cuentaPorCobrar.findFirst({
        where: { Id: id },
        select: { IdVenta: true },
      });
      if (!credit) return res.status(404).json({ ok: false, message: 'CuentaPorCobrar no existe' });

      await assertSaleAccess(prisma, credit.IdVenta, actor);
      return next();
    } catch (error) {
      return handleScopeError(error, res);
    }
  };
}

export function requireAssignedTransferAccess(
  access: 'ORIGEN' | 'DESTINO' | 'CUALQUIERA' = 'CUALQUIERA',
) {
  return async function assignedTransferGuard(req: Request, res: Response, next: NextFunction) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ ok: false, message: 'Autenticación requerida' });

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });

    try {
      const transfer = await prisma.transferenciaVehiculo.findFirst({
        where: { Id: id, Anulado: false },
        select: { IdRutaSesionOrigen: true, IdRutaSesionDestino: true },
      });
      if (!transfer) return res.status(404).json({ ok: false, message: 'Transferencia no existe' });

      const visibilityWhere = getRouteSessionVisibilityWhere(actor);
      if (!visibilityWhere) return next();

      const sessionIds = access === 'ORIGEN'
        ? [transfer.IdRutaSesionOrigen]
        : access === 'DESTINO'
          ? [transfer.IdRutaSesionDestino]
          : [transfer.IdRutaSesionOrigen, transfer.IdRutaSesionDestino];
      const visibleSession = await prisma.rutaSesion.findFirst({
        where: {
          Id: { in: sessionIds },
          Anulado: false,
          ...visibilityWhere,
        },
        select: { Id: true },
      });
      if (!visibleSession) {
        return res.status(404).json({
          ok: false,
          message: 'Transferencia no existe o no está asignada al usuario',
        });
      }

      return next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return res.status(500).json({ ok: false, message });
    }
  };
}
