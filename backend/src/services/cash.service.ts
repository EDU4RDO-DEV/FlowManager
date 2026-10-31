import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

type CashDataClient = Pick<Prisma.TransactionClient, 'cajaSesion' | 'movimientoCaja'>;

type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'POS';
type PaymentSource = 'PAGO_VENTA' | 'PAGO_PLANILLA' | 'ADELANTO';

interface CashPaymentMovementInput {
  idUsuario: number;
  metodoPago: PaymentMethod;
  monto: Prisma.Decimal | number;
  fecha: Date;
  source: PaymentSource;
  sourceId: number;
  concepto: string;
}

function toNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null) return null;
  return Number(value.toString());
}

async function calculateSessionTotals(
  tx: CashDataClient,
  sessionId: number,
) {
  const movements = await tx.movimientoCaja.findMany({
    where: { IdCajaSesion: sessionId },
    select: { Tipo: true, MetodoPago: true, Monto: true },
  });

  let efectivoIngresos = 0;
  let efectivoEgresos = 0;
  let transferenciasIngresos = 0;
  let transferenciasEgresos = 0;
  let otrosIngresos = 0;
  let otrosEgresos = 0;

  for (const movement of movements) {
    const amount = Number(movement.Monto.toString());
    if (movement.MetodoPago === 'EFECTIVO') {
      if (movement.Tipo === 'INGRESO') efectivoIngresos += amount;
      else efectivoEgresos += amount;
    } else if (movement.MetodoPago === 'TRANSFERENCIA') {
      if (movement.Tipo === 'INGRESO') transferenciasIngresos += amount;
      else transferenciasEgresos += amount;
    } else {
      if (movement.Tipo === 'INGRESO') otrosIngresos += amount;
      else otrosEgresos += amount;
    }
  }

  return {
    efectivoIngresos,
    efectivoEgresos,
    transferenciasIngresos,
    transferenciasEgresos,
    otrosIngresos,
    otrosEgresos,
  };
}

async function sessionWithSummary(
  tx: CashDataClient,
  sessionId: number,
) {
  const session = await tx.cajaSesion.findUnique({
    where: { Id: sessionId },
    include: {
      UsuarioApertura: { select: { Id: true, Nombre: true } },
      UsuarioCierre: { select: { Id: true, Nombre: true } },
      Movimientos: {
        orderBy: { FechaMovimiento: 'desc' },
        include: { Usuario: { select: { Id: true, Nombre: true } } },
      },
    },
  });

  if (!session) return null;

  const totals = await calculateSessionTotals(tx, session.Id);
  const expectedCash =
    Number(session.SaldoInicial.toString()) +
    totals.efectivoIngresos -
    totals.efectivoEgresos;

  return {
    ...session,
    SaldoInicial: toNumber(session.SaldoInicial),
    EfectivoEsperado: session.Estado === 'ABIERTA'
      ? expectedCash
      : toNumber(session.EfectivoEsperado),
    EfectivoContado: toNumber(session.EfectivoContado),
    DiferenciaEfectivo: toNumber(session.DiferenciaEfectivo),
    Totales: totals,
    Movimientos: session.Movimientos.map((movement) => ({
      ...movement,
      Monto: Number(movement.Monto.toString()),
    })),
  };
}

export async function getCurrentCashSession() {
  const active = await prisma.cajaSesion.findFirst({
    where: { Estado: 'ABIERTA' },
    select: { Id: true },
  });
  if (!active) return null;
  return sessionWithSummary(prisma, active.Id);
}

export async function listCashSessions(limit = 100) {
  const sessions = await prisma.cajaSesion.findMany({
    orderBy: { FechaApertura: 'desc' },
    take: limit,
    select: { Id: true },
  });
  return Promise.all(sessions.map(({ Id }) => sessionWithSummary(prisma, Id)));
}

export async function openCashSession(idUsuario: number, saldoInicial: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const active = await tx.cajaSesion.findFirst({
        where: { Estado: 'ABIERTA' },
        select: { Id: true },
      });
      if (active) throw new Error('Ya existe una caja abierta');

      const session = await tx.cajaSesion.create({
        data: {
          Estado: 'ABIERTA',
          IdUsuarioApertura: idUsuario,
          SaldoInicial: new Prisma.Decimal(saldoInicial),
        },
        select: { Id: true },
      });
      return sessionWithSummary(tx, session.Id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new Error('Ya existe una caja abierta');
    }
    throw error;
  }
}

export async function closeCashSession(
  id: number,
  idUsuario: number,
  efectivoContado: number,
  observaciones?: string,
) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.cajaSesion.findFirst({
      where: { Id: id, Estado: 'ABIERTA' },
      select: { Id: true, SaldoInicial: true },
    });
    if (!session) throw new Error('La caja no existe o ya está cerrada');

    const totals = await calculateSessionTotals(tx, id);
    const expected =
      Number(session.SaldoInicial.toString()) +
      totals.efectivoIngresos -
      totals.efectivoEgresos;
    const updated = await tx.cajaSesion.updateMany({
      where: { Id: id, Estado: 'ABIERTA' },
      data: {
        Estado: 'CERRADA',
        IdUsuarioCierre: idUsuario,
        FechaCierre: new Date(),
        EfectivoEsperado: new Prisma.Decimal(expected.toFixed(2)),
        EfectivoContado: new Prisma.Decimal(efectivoContado),
        DiferenciaEfectivo: new Prisma.Decimal((efectivoContado - expected).toFixed(2)),
        ObservacionesCierre: observaciones?.trim() || null,
      },
    });
    if (updated.count !== 1) throw new Error('La caja ya fue cerrada por otro usuario');
    return sessionWithSummary(tx, id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordCashPaymentMovement(
  tx: Prisma.TransactionClient,
  input: CashPaymentMovementInput,
) {
  const active = await tx.cajaSesion.findFirst({
    where: { Estado: 'ABIERTA' },
    select: { Id: true },
  });

  if (!active) {
    if (input.metodoPago === 'EFECTIVO') {
      throw new Error('Debe abrir la caja antes de registrar un pago en efectivo');
    }
    return;
  }

  await tx.movimientoCaja.create({
    data: {
      IdCajaSesion: active.Id,
      IdUsuario: input.idUsuario,
      Tipo: input.source === 'PAGO_VENTA' ? 'INGRESO' : 'EGRESO',
      MetodoPago: input.metodoPago,
      Monto: input.monto,
      FechaMovimiento: input.fecha,
      Concepto: input.concepto,
      ...(input.source === 'PAGO_VENTA'
        ? { IdPagoVenta: input.sourceId }
        : input.source === 'PAGO_PLANILLA'
          ? { IdPagoPlanilla: input.sourceId }
          : { IdAdelantoEmpleado: input.sourceId }),
    },
  });
}

export async function reverseSalePaymentCashMovement(
  tx: Prisma.TransactionClient,
  input: { idPagoVenta: number; idUsuario: number | undefined; concepto: string },
) {
  const original = await tx.movimientoCaja.findFirst({
    where: { IdPagoVenta: input.idPagoVenta },
    select: { Id: true, IdCajaSesion: true, Tipo: true, MetodoPago: true, Monto: true },
  });
  if (!original) return;

  const reversal = await tx.movimientoCaja.findFirst({
    where: { IdMovimientoReversado: original.Id },
    select: { Id: true },
  });
  if (reversal) return;

  const active = await tx.cajaSesion.findFirst({
    where: { Estado: 'ABIERTA' },
    select: { Id: true },
  });
  if (!active && original.MetodoPago === 'EFECTIVO') {
    throw new Error('Debe abrir la caja antes de anular un pago en efectivo');
  }
  if (!active) return;
  if (!input.idUsuario) throw new Error('Se requiere usuario para registrar la reversión de caja');

  await tx.movimientoCaja.create({
    data: {
      IdCajaSesion: active.Id,
      IdUsuario: input.idUsuario,
      IdMovimientoReversado: original.Id,
      Tipo: original.Tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO',
      MetodoPago: original.MetodoPago,
      Monto: original.Monto,
      Concepto: input.concepto,
    },
  });
}
