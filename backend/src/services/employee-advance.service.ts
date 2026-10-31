import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { recordCashPaymentMovement } from './cash.service';

export interface EmployeeAdvanceInput {
  idEmpleado: number;
  monto: number;
  fecha: string;
  metodoPago: 'EFECTIVO' | 'TRANSFERENCIA';
  numeroReferencia?: string;
  banco?: string;
  observacion?: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export async function listEmployeeAdvances(idEmpleado?: number) {
  const advances = await prisma.adelantoEmpleado.findMany({
    where: {
      Anulado: false,
      ...(idEmpleado ? { IdEmpleado: idEmpleado } : {}),
    },
    include: {
      Empleado: { include: { Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
      Aplicaciones: {
        where: { Anulado: false },
        include: {
          PlanillaMensual: {
            select: { Mes: true, Anio: true, Estado: true, Anulado: true },
          },
        },
        orderBy: { FechaAplicacion: 'asc' },
      },
    },
    orderBy: [{ Fecha: 'desc' }, { Id: 'desc' }],
  });

  return advances.map((advance) => {
    const total = Number(advance.Monto.toString());
    const aplicado = advance.Aplicaciones
      .filter((application) => !application.PlanillaMensual.Anulado)
      .reduce((sum, application) => sum + Number(application.MontoAplicado.toString()), 0);
    return {
      id: advance.Id,
      idEmpleado: advance.IdEmpleado,
      empleado: advance.Empleado.Entidad.NombreCompleto,
      fecha: advance.Fecha,
      monto: total,
      montoAplicado: Number(aplicado.toFixed(2)),
      saldoPendiente: Number(Math.max(0, total - aplicado).toFixed(2)),
      metodoPago: advance.MetodoPago,
      numeroReferencia: advance.NumeroReferencia,
      banco: advance.Banco,
      observacion: advance.Observacion,
      registradoPor: advance.Usuario.Nombre,
      aplicaciones: advance.Aplicaciones.map((application) => ({
        id: application.Id,
        idPlanilla: application.IdPlanillaMensual,
        mes: application.PlanillaMensual.Mes,
        anio: application.PlanillaMensual.Anio,
        monto: Number(application.MontoAplicado.toString()),
        fecha: application.FechaAplicacion,
        vigente: !application.Anulado && !application.PlanillaMensual.Anulado,
      })),
    };
  });
}

export async function createEmployeeAdvance(
  idUsuario: number,
  input: EmployeeAdvanceInput,
  idempotencyKey: string,
) {
  const keyHash = sha256(idempotencyKey);
  const requestHash = sha256(JSON.stringify({ idUsuario, ...input }));
  const fecha = new Date(`${input.fecha}T00:00:00.000Z`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const prior = await tx.adelantoEmpleado.findFirst({
        where: { IdempotencyKeyHash: keyHash },
        select: { Id: true, HuellaSolicitud: true },
      });
      if (prior) {
        if (prior.HuellaSolicitud !== requestHash) {
          throw new Error('La clave idempotente ya fue utilizada con otros datos');
        }
        return { replayed: true, idEmpleado: input.idEmpleado };
      }

      const employee = await tx.empleado.findFirst({
        where: {
          Id: input.idEmpleado,
          Anulado: false,
          OR: [{ FechaSalida: null }, { FechaSalida: { gte: fecha } }],
        },
        select: { Id: true },
      });
      if (!employee) throw new Error('Empleado no existe o ya fue retirado');

      const advance = await tx.adelantoEmpleado.create({
        data: {
          IdEmpleado: input.idEmpleado,
          IdUsuarioRegistro: idUsuario,
          Fecha: fecha,
          Monto: new Prisma.Decimal(input.monto),
          MetodoPago: input.metodoPago,
          NumeroReferencia: input.numeroReferencia?.trim() || null,
          Banco: input.banco?.trim() || null,
          IdempotencyKeyHash: keyHash,
          HuellaSolicitud: requestHash,
          Observacion: input.observacion?.trim() || null,
          Anulado: false,
        },
        select: { Id: true, Monto: true, Fecha: true },
      });

      await recordCashPaymentMovement(tx, {
        idUsuario,
        metodoPago: input.metodoPago,
        monto: advance.Monto,
        fecha: advance.Fecha,
        source: 'ADELANTO',
        sourceId: advance.Id,
        concepto: `Anticipo a empleado #${input.idEmpleado}`,
      });

      return { replayed: false, idEmpleado: input.idEmpleado };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const advances = await listEmployeeAdvances(input.idEmpleado);
    return { ...result, advances };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const prior = await prisma.adelantoEmpleado.findFirst({
        where: { IdempotencyKeyHash: keyHash },
        select: { Id: true, HuellaSolicitud: true },
      });
      if (prior?.HuellaSolicitud === requestHash) {
        return { replayed: true, advances: await listEmployeeAdvances(input.idEmpleado) };
      }
    }
    throw error;
  }
}
