import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { recordCashPaymentMovement } from './cash.service';

export interface PayrollPaymentInput {
  monto: number;
  metodoPago: 'EFECTIVO' | 'TRANSFERENCIA';
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaComprobante?: string;
  observaciones?: string;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function paymentSummary(planilla: {
  Id: number;
  Estado: string;
  EstadoPago: string | null;
  SueldoLiquido: Prisma.Decimal;
  Pagos: Array<{
    Id: number;
    IdUsuario: number;
    Monto: Prisma.Decimal;
    MetodoPago: string;
    NumeroReferencia: string | null;
    Banco: string | null;
    RutaComprobante: string | null;
    FechaPago: Date;
    Observaciones: string | null;
    Usuario: { Nombre: string };
  }>;
}) {
  const payable = Number(planilla.SueldoLiquido.toString());
  const paid = planilla.Pagos.reduce((sum, payment) => sum + Number(payment.Monto.toString()), 0);
  return {
    idPlanilla: planilla.Id,
    estadoPlanilla: planilla.Estado,
    estadoPago: planilla.EstadoPago ?? (paid >= payable ? 'PAGADA' : paid > 0 ? 'PARCIAL' : 'PENDIENTE'),
    totalPlanilla: payable,
    totalPagado: Number(paid.toFixed(2)),
    saldoPendiente: Number(Math.max(0, payable - paid).toFixed(2)),
    pagos: planilla.Pagos.map((payment) => ({
      id: payment.Id,
      idUsuario: payment.IdUsuario,
      usuario: payment.Usuario.Nombre,
      monto: Number(payment.Monto.toString()),
      metodoPago: payment.MetodoPago,
      numeroReferencia: payment.NumeroReferencia,
      banco: payment.Banco,
      rutaComprobante: payment.RutaComprobante,
      fechaPago: payment.FechaPago,
      observaciones: payment.Observaciones,
    })),
  };
}

async function loadPlanillaPayments(
  client: Pick<Prisma.TransactionClient, 'planillaMensual'>,
  id: number,
) {
  const planilla = await client.planillaMensual.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      Estado: true,
      EstadoPago: true,
      SueldoLiquido: true,
      Pagos: {
        where: { Anulado: false },
        orderBy: { FechaPago: 'asc' },
        select: {
          Id: true,
          IdUsuario: true,
          Monto: true,
          MetodoPago: true,
          NumeroReferencia: true,
          Banco: true,
          RutaComprobante: true,
          FechaPago: true,
          Observaciones: true,
          Usuario: { select: { Nombre: true } },
        },
      },
    },
  });
  if (!planilla) throw new Error('Planilla no existe');
  return paymentSummary(planilla);
}

export async function getPayrollPayments(id: number) {
  return loadPlanillaPayments(prisma, id);
}

export async function registerPayrollPayment(
  idPlanilla: number,
  idUsuario: number,
  input: PayrollPaymentInput,
  idempotencyKey: string,
) {
  const keyHash = hash(idempotencyKey);
  const requestFingerprint = hash(JSON.stringify({
    idPlanilla,
    idUsuario,
    monto: input.monto,
    metodoPago: input.metodoPago,
    numeroReferencia: input.numeroReferencia ?? null,
    banco: input.banco ?? null,
    fechaPago: input.fechaPago ?? null,
    rutaComprobante: input.rutaComprobante ?? null,
    observaciones: input.observaciones ?? null,
  }));
  const fechaPago = input.fechaPago ? new Date(input.fechaPago) : new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.pagoPlanillaEmpleado.findUnique({
        where: { IdempotencyKeyHash: keyHash },
        select: { IdPlanillaMensual: true, HuellaSolicitud: true },
      });
      if (existing) {
        if (existing.HuellaSolicitud !== requestFingerprint) {
          throw new Error('La clave idempotente ya fue utilizada con otros datos');
        }
        return loadPlanillaPayments(tx, existing.IdPlanillaMensual);
      }

      const planilla = await tx.planillaMensual.findFirst({
        where: { Id: idPlanilla, Anulado: false },
        select: { Id: true, Estado: true, SueldoLiquido: true },
      });
      if (!planilla) throw new Error('Planilla no existe');
      if (planilla.Estado !== 'CERRADA') {
        throw new Error('Solo se puede pagar una planilla cerrada');
      }

      const priorPayments = await tx.pagoPlanillaEmpleado.findMany({
        where: { IdPlanillaMensual: idPlanilla, Anulado: false },
        select: { Monto: true },
      });
      const paid = priorPayments.reduce((sum, payment) => sum + Number(payment.Monto.toString()), 0);
      const outstanding = Number((Number(planilla.SueldoLiquido.toString()) - paid).toFixed(2));
      if (outstanding <= 0) throw new Error('La planilla ya está pagada');
      if (input.monto > outstanding) {
        throw new Error('El pago no puede superar el saldo pendiente de la planilla');
      }

      const payment = await tx.pagoPlanillaEmpleado.create({
        data: {
          IdPlanillaMensual: idPlanilla,
          IdUsuario: idUsuario,
          Monto: new Prisma.Decimal(input.monto),
          MetodoPago: input.metodoPago,
          NumeroReferencia: input.numeroReferencia?.trim() || null,
          Banco: input.banco?.trim() || null,
          RutaComprobante: input.rutaComprobante?.trim() || null,
          FechaPago: fechaPago,
          IdempotencyKeyHash: keyHash,
          HuellaSolicitud: requestFingerprint,
          Observaciones: input.observaciones?.trim() || null,
        },
        select: { Id: true, Monto: true, FechaPago: true },
      });

      await recordCashPaymentMovement(tx, {
        idUsuario,
        metodoPago: input.metodoPago,
        monto: payment.Monto,
        fecha: payment.FechaPago,
        source: 'PAGO_PLANILLA',
        sourceId: payment.Id,
        concepto: `Pago de planilla #${idPlanilla}`,
      });

      const newPaid = paid + input.monto;
      const estadoPago = newPaid >= Number(planilla.SueldoLiquido.toString())
        ? 'PAGADA'
        : 'PARCIAL';
      await tx.planillaMensual.update({
        where: { Id: idPlanilla },
        data: { EstadoPago: estadoPago },
      });

      return loadPlanillaPayments(tx, idPlanilla);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.pagoPlanillaEmpleado.findUnique({
        where: { IdempotencyKeyHash: keyHash },
        select: { IdPlanillaMensual: true, HuellaSolicitud: true },
      });
      if (existing?.HuellaSolicitud === requestFingerprint) {
        return getPayrollPayments(existing.IdPlanillaMensual);
      }
    }
    throw error;
  }
}
