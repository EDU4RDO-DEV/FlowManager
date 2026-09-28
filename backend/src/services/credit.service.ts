import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { anulateSalePayment, createSalePayment, listSalePayments } from './sale.service';

type ListCreditsInput = {
  page?: number;
  limit?: number;
  idCliente?: number;
  estado?: 'ACTIVO' | 'PAGADO' | 'ANULADO';
  anulado?: boolean;
};

type CreditPaymentInput = {
  idUsuario: number;
  monto: number;
  metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'POS';
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaFirma?: string;
  observaciones?: string;
};

function toNumber(value: unknown): number {
  return Number(value);
}

function calculateSaldo(totalOriginal: number, totalAbonado: number): number {
  return Number(Math.max(0, totalOriginal - totalAbonado).toFixed(2));
}

function toCreditDto(
  credit: {
    Id: number;
    IdVenta: number;
    IdTipoCreditoAplicado: number | null;
    IdClienteCondicionCreditoAplicada: number | null;
    TotalOriginal: Prisma.Decimal;
    Estado: string;
    FechaCreacion: Date | null;
    FechaVencimiento: Date | null;
    FechaLiquidacion: Date | null;
    MotivoCierre: string | null;
    Anulado: boolean;
    IdUsuarioAnulador: number | null;
    FechaAnulacion: Date | null;
    Venta: {
      Id: number;
      NumeroVenta: number;
      CondicionPago: string;
      EstadoPago: string;
      Anulado: boolean;
      Cliente: {
        Id: number;
        Entidad: {
          NombreCompleto: string;
          Nit: string | null;
        };
      };
      PagoVenta: Array<{
        Monto: Prisma.Decimal;
      }>;
    };
    TipoCredito: {
      Id: number;
      Nombre: string;
    } | null;
  },
) {
  const totalOriginal = toNumber(credit.TotalOriginal);
  const totalAbonado = Number(
    credit.Venta.PagoVenta.reduce((sum, payment) => sum + toNumber(payment.Monto), 0).toFixed(2),
  );

  return {
    id: credit.Id,
    idVenta: credit.IdVenta,
    idTipoCreditoAplicado: credit.IdTipoCreditoAplicado,
    idClienteCondicionCreditoAplicada: credit.IdClienteCondicionCreditoAplicada,
    totalOriginal,
    totalAbonado,
    saldo: calculateSaldo(totalOriginal, totalAbonado),
    estado: credit.Estado,
    fechaCreacion: credit.FechaCreacion,
    fechaVencimiento: credit.FechaVencimiento,
    fechaLiquidacion: credit.FechaLiquidacion,
    motivoCierre: credit.MotivoCierre,
    anulado: credit.Anulado,
    idUsuarioAnulador: credit.IdUsuarioAnulador,
    fechaAnulacion: credit.FechaAnulacion,
    venta: {
      id: credit.Venta.Id,
      numeroVenta: credit.Venta.NumeroVenta,
      condicionPago: credit.Venta.CondicionPago,
      estadoPago: credit.Venta.EstadoPago,
      anulado: credit.Venta.Anulado,
    },
    cliente: {
      id: credit.Venta.Cliente.Id,
      nombre: credit.Venta.Cliente.Entidad.NombreCompleto,
      nit: credit.Venta.Cliente.Entidad.Nit,
    },
    tipoCredito: credit.TipoCredito
      ? {
          id: credit.TipoCredito.Id,
          nombre: credit.TipoCredito.Nombre,
        }
      : null,
  };
}

async function getCreditByIdInternal(id: number) {
  return prisma.cuentaPorCobrar.findFirst({
    where: {
      Id: id,
    },
    include: {
      TipoCredito: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
      Venta: {
        select: {
          Id: true,
          NumeroVenta: true,
          CondicionPago: true,
          EstadoPago: true,
          Anulado: true,
          Cliente: {
            select: {
              Id: true,
              Entidad: {
                select: {
                  NombreCompleto: true,
                  Nit: true,
                },
              },
            },
          },
          PagoVenta: {
            where: { Anulado: false },
            select: {
              Monto: true,
            },
          },
        },
      },
    },
  });
}

async function getCreditSaleId(id: number): Promise<number> {
  const credit = await prisma.cuentaPorCobrar.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    select: {
      IdVenta: true,
    },
  });

  if (!credit) {
    throw new Error('CuentaPorCobrar no existe');
  }

  return credit.IdVenta;
}

export async function listCredits(input: ListCreditsInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.CuentaPorCobrarWhereInput = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.estado ? { Estado: input.estado } : {}),
    ...(input.idCliente
      ? {
          Venta: {
            IdCliente: input.idCliente,
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.cuentaPorCobrar.count({ where }),
    prisma.cuentaPorCobrar.findMany({
      where,
      skip,
      take: limit,
      orderBy: { Id: 'desc' },
      include: {
        TipoCredito: {
          select: {
            Id: true,
            Nombre: true,
          },
        },
        Venta: {
          select: {
            Id: true,
            NumeroVenta: true,
            CondicionPago: true,
            EstadoPago: true,
            Anulado: true,
            Cliente: {
              select: {
                Id: true,
                Entidad: {
                  select: {
                    NombreCompleto: true,
                    Nit: true,
                  },
                },
              },
            },
            PagoVenta: {
              where: { Anulado: false },
              select: {
                Monto: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map(toCreditDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCreditById(id: number) {
  const credit = await getCreditByIdInternal(id);

  if (!credit) {
    throw new Error('CuentaPorCobrar no existe');
  }

  return toCreditDto(credit);
}

export async function listCreditsByCustomer(idCliente: number) {
  const rows = await prisma.cuentaPorCobrar.findMany({
    where: {
      Venta: {
        IdCliente: idCliente,
      },
      Anulado: false,
    },
    orderBy: { Id: 'desc' },
    include: {
      TipoCredito: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
      Venta: {
        select: {
          Id: true,
          NumeroVenta: true,
          CondicionPago: true,
          EstadoPago: true,
          Anulado: true,
          Cliente: {
            select: {
              Id: true,
              Entidad: {
                select: {
                  NombreCompleto: true,
                  Nit: true,
                },
              },
            },
          },
          PagoVenta: {
            where: { Anulado: false },
            select: {
              Monto: true,
            },
          },
        },
      },
    },
  });

  return rows.map(toCreditDto);
}

export async function getCreditsPortfolio() {
  const rows = await prisma.cuentaPorCobrar.findMany({
    where: {
      Anulado: false,
    },
    include: {
      Venta: {
        select: {
          IdCliente: true,
          Cliente: {
            select: {
              Id: true,
              Entidad: {
                select: {
                  NombreCompleto: true,
                  Nit: true,
                },
              },
            },
          },
          PagoVenta: {
            where: { Anulado: false },
            select: {
              Monto: true,
            },
          },
        },
      },
    },
  });

  const grouped = new Map<number, {
    idCliente: number;
    nombre: string;
    nit: string | null;
    creditos: number;
    totalOriginal: number;
    totalAbonado: number;
    saldo: number;
    creditosActivos: number;
    creditosPagados: number;
    creditosAnulados: number;
  }>();

  for (const row of rows) {
    const idCliente = row.Venta.Cliente.Id;
    const current = grouped.get(idCliente) ?? {
      idCliente,
      nombre: row.Venta.Cliente.Entidad.NombreCompleto,
      nit: row.Venta.Cliente.Entidad.Nit,
      creditos: 0,
      totalOriginal: 0,
      totalAbonado: 0,
      saldo: 0,
      creditosActivos: 0,
      creditosPagados: 0,
      creditosAnulados: 0,
    };

    const totalOriginal = toNumber(row.TotalOriginal);
    const totalAbonado = Number(
      row.Venta.PagoVenta.reduce((sum, payment) => sum + toNumber(payment.Monto), 0).toFixed(2),
    );
    const saldo = calculateSaldo(totalOriginal, totalAbonado);

    current.creditos += 1;
    current.totalOriginal = Number((current.totalOriginal + totalOriginal).toFixed(2));
    current.totalAbonado = Number((current.totalAbonado + totalAbonado).toFixed(2));
    current.saldo = Number((current.saldo + saldo).toFixed(2));

    if (row.Estado === 'PAGADO') {
      current.creditosPagados += 1;
    } else if (row.Estado === 'ANULADO') {
      current.creditosAnulados += 1;
    } else {
      current.creditosActivos += 1;
    }

    grouped.set(idCliente, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.saldo - a.saldo);
}

export async function listCreditPayments(id: number) {
  const idVenta = await getCreditSaleId(id);
  return listSalePayments(idVenta);
}

export async function createCreditPayment(id: number, input: CreditPaymentInput) {
  const idVenta = await getCreditSaleId(id);
  return createSalePayment(idVenta, input);
}

export async function anulateCreditPayment(id: number, idPago: number, idUsuarioAnulador?: number) {
  const idVenta = await getCreditSaleId(id);
  await anulateSalePayment(idVenta, idPago, idUsuarioAnulador);
}
