import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { anulateSalePayment, createSalePayment, listSalePayments } from './sale.service';

type ListCreditsInput = {
  page?: number;
  limit?: number;
  idCliente?: number;
  estado?: 'ACTIVO' | 'PAGADO' | 'ANULADO';
  estadoPago?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  anulado?: boolean;
  incluirAnulados?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
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
      NumeroProForma: number | null;
      CondicionPago: string;
      EstadoPago: string;
      Anulado: boolean;
      AutorizacionFel: string | null;
      NumeroFel: string | null;
      SerieFel: string | null;
      FechaEmisionFel: Date | null;
      FechaRegistro: Date | null;
      Cliente: {
        Id: number;
        Entidad: {
          NombreCompleto: string;
          Nit: string | null;
        };
      };
      PagoVenta: Array<{
        Monto: Prisma.Decimal;
        Id?: number;
        MetodoPago?: string;
        NumeroReferencia?: string | null;
        Banco?: string | null;
        FechaPago?: Date | null;
        RutaFirma?: string | null;
        Observaciones?: string | null;
        Anulado?: boolean;
        FechaAnulacion?: Date | null;
        Usuario?: {
          Id: number;
          Nombre: string;
          Correo: string;
        };
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
    credit.Venta.PagoVenta
      .filter((payment) => payment.Anulado !== true)
      .reduce((sum, payment) => sum + toNumber(payment.Monto), 0)
      .toFixed(2),
  );
  const cuentaAnulada = credit.Anulado || credit.Estado === 'ANULADO' || credit.Venta.Anulado;

  return {
    id: credit.Id,
    idVenta: credit.IdVenta,
    idTipoCreditoAplicado: credit.IdTipoCreditoAplicado,
    idClienteCondicionCreditoAplicada: credit.IdClienteCondicionCreditoAplicada,
    totalOriginal,
    totalAbonado,
    saldo: cuentaAnulada ? 0 : calculateSaldo(totalOriginal, totalAbonado),
    estado: cuentaAnulada ? 'ANULADO' : credit.Estado,
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
      numeroProForma: credit.Venta.NumeroProForma,
      condicionPago: credit.Venta.CondicionPago,
      estadoPago: credit.Venta.EstadoPago,
      anulado: credit.Venta.Anulado,
      autorizacionFel: credit.Venta.AutorizacionFel,
      numeroFel: credit.Venta.NumeroFel,
      serieFel: credit.Venta.SerieFel,
      fechaEmision: credit.Venta.FechaEmisionFel ?? credit.Venta.FechaRegistro,
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
    pagos: credit.Venta.PagoVenta.flatMap((payment) => {
      if (payment.Id === undefined || !payment.Usuario || payment.MetodoPago === undefined) {
        return [];
      }

      return [{
        id: payment.Id,
        idVenta: credit.Venta.Id,
        monto: toNumber(payment.Monto),
        metodoPago: payment.MetodoPago,
        numeroReferencia: payment.NumeroReferencia ?? null,
        banco: payment.Banco ?? null,
        fechaPago: payment.FechaPago ?? null,
        rutaFirma: payment.RutaFirma ?? null,
        observaciones: payment.Observaciones ?? null,
        anulado: payment.Anulado === true,
        fechaAnulacion: payment.FechaAnulacion ?? null,
        estado: payment.Anulado === true ? 'ANULADO' : 'REGISTRADO',
        usuario: {
          id: payment.Usuario.Id,
          nombre: payment.Usuario.Nombre,
          correo: payment.Usuario.Correo,
        },
      }];
    }),
  };
}

function getCreditListWhere(input: ListCreditsInput): Prisma.CuentaPorCobrarWhereInput {
  const search = input.busqueda?.trim();
  const numeroDocumento = search && /^\d+$/.test(search) ? Number(search) : undefined;
  const fechaDesde = input.fechaDesde ? new Date(`${input.fechaDesde}T00:00:00.000Z`) : undefined;
  const fechaHasta = input.fechaHasta ? new Date(`${input.fechaHasta}T00:00:00.000Z`) : undefined;

  if (fechaHasta) {
    fechaHasta.setUTCDate(fechaHasta.getUTCDate() + 1);
  }

  const dateRange = fechaDesde || fechaHasta
    ? {
        ...(fechaDesde ? { gte: fechaDesde } : {}),
        ...(fechaHasta ? { lt: fechaHasta } : {}),
      }
    : undefined;
  const searchWhere: Prisma.VentaWhereInput | undefined = search
    ? {
        OR: [
          { Cliente: { Entidad: { NombreCompleto: { contains: search } } } },
          { Cliente: { Entidad: { Nit: { contains: search } } } },
          { NitFacturado: { contains: search } },
          { NumeroFel: { contains: search } },
          { SerieFel: { contains: search } },
          { AutorizacionFel: { contains: search } },
          ...(numeroDocumento !== undefined && Number.isSafeInteger(numeroDocumento)
            ? [
                { Id: numeroDocumento },
                { IdCliente: numeroDocumento },
                { NumeroVenta: numeroDocumento },
                { NumeroProForma: numeroDocumento },
              ]
            : []),
        ],
      }
    : undefined;
  const ventaConditions: Prisma.VentaWhereInput[] = [];

  if (dateRange) {
    ventaConditions.push({
      OR: [
        { FechaEmisionFel: dateRange },
        { AND: [{ FechaEmisionFel: null }, { FechaRegistro: dateRange }] },
      ],
    });
  }
  if (searchWhere) {
    ventaConditions.push(searchWhere);
  }

  const ventaWhere: Prisma.VentaWhereInput = {
    ...(input.incluirAnulados ? {} : { Anulado: false }),
    ...(input.idCliente ? { IdCliente: input.idCliente } : {}),
    ...(input.estadoPago ? { EstadoPago: input.estadoPago } : {}),
    ...(ventaConditions.length > 0 ? { AND: ventaConditions } : {}),
  };

  const filters: Prisma.CuentaPorCobrarWhereInput = {
    ...(input.incluirAnulados
      ? {}
      : { Anulado: input.anulado !== undefined ? input.anulado : false }),
    ...(input.estado ? { Estado: input.estado } : {}),
  };

  if (search && numeroDocumento !== undefined && Number.isSafeInteger(numeroDocumento) && searchWhere) {
    return {
      ...filters,
      AND: [
        { Venta: ventaWhere },
        {
          OR: [
            { Id: numeroDocumento },
            { IdVenta: numeroDocumento },
            { Venta: searchWhere },
          ],
        },
      ],
    };
  }

  return {
    ...filters,
    Venta: ventaWhere,
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
          NumeroProForma: true,
          CondicionPago: true,
          EstadoPago: true,
          Anulado: true,
          AutorizacionFel: true,
          NumeroFel: true,
          SerieFel: true,
          FechaEmisionFel: true,
          FechaRegistro: true,
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

async function getCreditSaleId(id: number, includeAnulado = false): Promise<number> {
  const credit = await prisma.cuentaPorCobrar.findFirst({
    where: {
      Id: id,
      ...(includeAnulado ? {} : { Anulado: false }),
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
  const { page, limit, skip } = resolvePagination(input);
  const where = getCreditListWhere(input);

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
            NumeroProForma: true,
            CondicionPago: true,
            EstadoPago: true,
            Anulado: true,
            AutorizacionFel: true,
            NumeroFel: true,
            SerieFel: true,
            FechaEmisionFel: true,
            FechaRegistro: true,
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
    pagination: buildPaginationMeta(page, limit, total),
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
          NumeroProForma: true,
          CondicionPago: true,
          EstadoPago: true,
          Anulado: true,
          AutorizacionFel: true,
          NumeroFel: true,
          SerieFel: true,
          FechaEmisionFel: true,
          FechaRegistro: true,
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
            select: {
              Id: true,
              Monto: true,
              MetodoPago: true,
              NumeroReferencia: true,
              Banco: true,
              FechaPago: true,
              RutaFirma: true,
              Observaciones: true,
              Anulado: true,
              FechaAnulacion: true,
              Usuario: {
                select: {
                  Id: true,
                  Nombre: true,
                  Correo: true,
                },
              },
            },
            orderBy: { Id: 'desc' },
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
      Venta: { Anulado: false },
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
  const idVenta = await getCreditSaleId(id, true);
  return listSalePayments(idVenta);
}

export async function createCreditPayment(id: number, input: CreditPaymentInput, idempotencyKey: string) {
  const idVenta = await getCreditSaleId(id);
  return createSalePayment(idVenta, input, idempotencyKey);
}

export async function anulateCreditPayment(id: number, idPago: number, idUsuarioAnulador?: number) {
  const idVenta = await getCreditSaleId(id);
  await anulateSalePayment(idVenta, idPago, idUsuarioAnulador);
}
