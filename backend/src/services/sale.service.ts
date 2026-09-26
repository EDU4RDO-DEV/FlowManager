import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../config/prisma';
import { registerInventoryMovement } from './inventory-movement.service';

type ListSalesInput = {
  page?: number;
  limit?: number;
  numeroVenta?: number;
  idCliente?: number;
  idUsuario?: number;
  idRutaSesion?: number;
  condicionPago?: 'CONTADO' | 'CREDITO';
  estadoPago?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  estadoEntrega?: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'PARCIAL';
  requiereFactura?: boolean;
  anulado?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
};

type CreateSaleDetailInput = {
  idInventarioItem: number;
  cantidad: number;
  precioUnitario?: number;
  esBonificacion?: boolean;
};

type SalePaymentInput = {
  monto: number;
  metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'POS';
  numeroReferencia?: string;
  banco?: string;
  fechaPago?: string;
  rutaFirma?: string;
  observaciones?: string;
};

type CreateSaleInput = {
  idUsuario: number;
  idCliente: number;
  idRutaSesion?: number;
  idTalonario?: number;
  numeroProForma?: number;
  tipoRegistro: 'VENTA' | 'PROFORMA';
  estadoEntrega: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'PARCIAL';
  condicionPago: 'CONTADO' | 'CREDITO';
  requiereFactura: boolean;
  nitFacturado?: string;
  nombreClienteFacturado?: string;
  direccionClienteFacturado?: string;
  lugarEntrega?: string;
  fechaEntregaEsperada?: string;
  detalle: CreateSaleDetailInput[];
  pagoInicial?: SalePaymentInput;
};

type UpdateSaleInput = {
  estadoEntrega?: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'PARCIAL';
  requiereFactura?: boolean;
  lugarEntrega?: string;
  fechaEntregaEsperada?: string;
  idUsuarioModificador?: number;
};

type CreateSalePaymentInput = SalePaymentInput & {
  idUsuario: number;
};

function toNumber(value: unknown): number {
  return Number(value);
}

function toDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Fecha inválida');
  }

  return date;
}

function getPaymentState(totalVenta: number, totalPagado: number): 'PENDIENTE' | 'PARCIAL' | 'PAGADO' {
  if (totalPagado <= 0) {
    return 'PENDIENTE';
  }

  if (totalPagado >= totalVenta) {
    return 'PAGADO';
  }

  return 'PARCIAL';
}

function getSaleTotals(detalle: Array<{ cantidad: number; precioUnitario: number; esBonificacion: boolean }>) {
  const subtotal = detalle
    .filter((item) => !item.esBonificacion)
    .reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);

  const totalBonificado = detalle
    .filter((item) => item.esBonificacion)
    .reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);

  const total = subtotal + totalBonificado;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalBonificado: Number(totalBonificado.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function getClienteActivo(idCliente: number) {
  const cliente = await prisma.cliente.findFirst({
    where: {
      Id: idCliente,
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    select: {
      Id: true,
      IdTipoCliente: true,
      Entidad: {
        select: {
          NombreCompleto: true,
          Nit: true,
        },
      },
    },
  });

  if (!cliente) {
    throw new Error('Cliente no existe');
  }

  return cliente;
}

async function validateRutaSesionActiva(idRutaSesion: number) {
  const sesion = await prisma.rutaSesion.findFirst({
    where: {
      Id: idRutaSesion,
      Anulado: false,
    },
    select: {
      Id: true,
      Estado: true,
    },
  });

  if (!sesion) {
    throw new Error('RutaSesion no existe');
  }

  if (sesion.Estado === 'CERRADA') {
    throw new Error('RutaSesion está cerrada');
  }
}

async function getNextNumeroVenta(tx: Prisma.TransactionClient): Promise<number> {
  const lastSale = await tx.venta.findFirst({
    orderBy: { NumeroVenta: 'desc' },
    select: { NumeroVenta: true },
  });

  return (lastSale?.NumeroVenta ?? 0) + 1;
}

async function getAndReserveNextTalonarioCorrelativo(tx: Prisma.TransactionClient, idTalonario: number) {
  const talonario = await tx.talonario.findFirst({
    where: {
      Id: idTalonario,
      Anulado: false,
    },
    select: {
      Id: true,
      CorrelativoInicial: true,
      CorrelativoFinal: true,
      UltimoUtilizado: true,
    },
  });

  if (!talonario) {
    throw new Error('Talonario no existe');
  }

  const siguiente = (talonario.UltimoUtilizado ?? talonario.CorrelativoInicial - 1) + 1;
  if (siguiente > talonario.CorrelativoFinal) {
    throw new Error('Talonario sin correlativos disponibles');
  }

  const updated = await tx.talonario.updateMany({
    where: {
      Id: idTalonario,
      UltimoUtilizado: talonario.UltimoUtilizado,
      Anulado: false,
    },
    data: {
      UltimoUtilizado: siguiente,
    },
  });

  if (updated.count !== 1) {
    throw new Error('No fue posible reservar correlativo de talonario');
  }

  return siguiente;
}

async function resolveApplicablePrice(
  tx: Prisma.TransactionClient,
  idInventarioItem: number,
  idTipoCliente: number | null,
  fechaOperacion: Date,
): Promise<number> {
  const item = await tx.inventarioItem.findFirst({
    where: {
      Id: idInventarioItem,
      Anulado: false,
    },
    select: {
      PrecioVenta: true,
    },
  });

  if (!item) {
    throw new Error(`InventarioItem ${idInventarioItem} no existe o está anulado`);
  }

  if (!idTipoCliente) {
    return toNumber(item.PrecioVenta);
  }

  const rule = await tx.reglaPrecioCliente.findFirst({
    where: {
      IdTipoCliente: idTipoCliente,
      IdInventarioItem: idInventarioItem,
      Anulado: false,
      OR: [{ FechaInicio: null }, { FechaInicio: { lte: fechaOperacion } }],
      AND: [{ OR: [{ FechaFin: null }, { FechaFin: { gte: fechaOperacion } }] }],
    },
    orderBy: [{ FechaInicio: 'desc' }, { Id: 'desc' }],
    select: {
      Precio: true,
    },
  });

  return rule ? toNumber(rule.Precio) : toNumber(item.PrecioVenta);
}

async function buildAutoBonusDetails(
  tx: Prisma.TransactionClient,
  detalleVenta: Array<{ idInventarioItem: number; cantidad: number }>,
): Promise<CreateSaleDetailInput[]> {
  const bonuses: CreateSaleDetailInput[] = [];
  const now = new Date();

  for (const item of detalleVenta) {
    const rules = await tx.reglaBonificacion.findMany({
      where: {
        IdInventarioItemCompra: item.idInventarioItem,
        Anulado: false,
        CantidadMinima: {
          lte: item.cantidad,
        },
        OR: [{ FechaInicio: null }, { FechaInicio: { lte: now } }],
        AND: [{ OR: [{ FechaFin: null }, { FechaFin: { gte: now } }] }],
      },
      orderBy: [{ Prioridad: 'asc' }, { Id: 'asc' }],
      select: {
        IdInventarioItemBonificado: true,
        CantidadBonificada: true,
        CantidadMinima: true,
      },
    });

    for (const rule of rules) {
      const multiplicador = Math.floor(item.cantidad / rule.CantidadMinima);
      if (multiplicador <= 0) {
        continue;
      }

      bonuses.push({
        idInventarioItem: rule.IdInventarioItemBonificado,
        cantidad: Number((rule.CantidadBonificada * multiplicador).toFixed(2)),
        precioUnitario: 0,
        esBonificacion: true,
      });
    }
  }

  return bonuses;
}

async function getSaleByIdInternal(
  prismaOrTx: PrismaClient | Prisma.TransactionClient,
  id: number,
  includeAnulado = false,
) {
  return prismaOrTx.venta.findFirst({
    where: {
      Id: id,
      ...(includeAnulado ? {} : { Anulado: false }),
    },
    include: {
      Cliente: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
              Nit: true,
            },
          },
          TipoCliente: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Usuario: {
        select: {
          Id: true,
          Nombre: true,
          Correo: true,
        },
      },
      RutaSesion: {
        select: {
          Id: true,
          Estado: true,
          FechaSesion: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Talonario: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
      DetalleVenta: {
        where: { Anulado: false },
        include: {
          InventarioItem: {
            select: {
              Id: true,
              Nombre: true,
              Categoria: true,
              Existencia: true,
            },
          },
        },
      },
      PagoVenta: {
        where: { Anulado: false },
        include: {
          Usuario: {
            select: {
              Id: true,
              Nombre: true,
              Correo: true,
            },
          },
        },
      },
    },
  });
}

function toSaleDto(sale: NonNullable<Awaited<ReturnType<typeof getSaleByIdInternal>>>) {
  const detalle = sale.DetalleVenta.map((detail) => ({
    id: detail.Id,
    idVenta: detail.IdVenta,
    idInventarioItem: detail.IdInventarioItem,
    nombre: detail.Nombre,
    cantidad: detail.Cantidad,
    precioUnitario: toNumber(detail.PrecioUnitario),
    esBonificacion: detail.EsBonificacion,
    subtotal: Number((detail.Cantidad * toNumber(detail.PrecioUnitario)).toFixed(2)),
    inventarioItem: {
      id: detail.InventarioItem.Id,
      nombre: detail.InventarioItem.Nombre,
      categoria: detail.InventarioItem.Categoria,
      existencia: detail.InventarioItem.Existencia,
    },
  }));

  const pagos = sale.PagoVenta.map((payment) => ({
    id: payment.Id,
    idVenta: payment.IdVenta,
    idUsuario: payment.IdUsuario,
    monto: toNumber(payment.Monto),
    metodoPago: payment.MetodoPago,
    numeroReferencia: payment.NumeroReferencia,
    banco: payment.Banco,
    fechaPago: payment.FechaPago,
    rutaFirma: payment.RutaFirma,
    observaciones: payment.Observaciones,
    usuario: {
      id: payment.Usuario.Id,
      nombre: payment.Usuario.Nombre,
      correo: payment.Usuario.Correo,
    },
  }));

  const totals = getSaleTotals(
    detalle.map((item) => ({
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      esBonificacion: item.esBonificacion,
    })),
  );

  const totalPagado = Number(pagos.reduce((sum, item) => sum + item.monto, 0).toFixed(2));
  const saldo = Number(Math.max(0, totals.total - totalPagado).toFixed(2));

  return {
    id: sale.Id,
    idCliente: sale.IdCliente,
    idUsuario: sale.IdUsuario,
    idRutaSesion: sale.IdRutaSesion,
    idTalonario: sale.IdTalonario,
    numeroVenta: sale.NumeroVenta,
    numeroProForma: sale.NumeroProForma,
    tipoRegistro: sale.TipoRegistro,
    estadoEntrega: sale.EstadoEntrega,
    condicionPago: sale.CondicionPago,
    estadoPago: sale.EstadoPago,
    requiereFactura: sale.RequiereFactura,
    autorizacionFel: sale.AutorizacionFel,
    numeroFel: sale.NumeroFel,
    serieFel: sale.SerieFel,
    qrFel: sale.QrFel,
    fechaEmisionFel: sale.FechaEmisionFel,
    nitFacturado: sale.NitFacturado,
    nombreClienteFacturado: sale.NombreClienteFacturado,
    direccionClienteFacturado: sale.DireccionClienteFacturado,
    lugarEntrega: sale.LugarEntrega,
    fechaEntregaEsperada: sale.FechaEntregaEsperada,
    fechaRegistro: sale.FechaRegistro,
    idUsuarioModificador: sale.IdUsuarioModificador,
    fechaModificacion: sale.FechaModificacion,
    anulado: sale.Anulado,
    idUsuarioAnulador: sale.IdUsuarioAnulador,
    fechaAnulacion: sale.FechaAnulacion,
    cliente: {
      id: sale.Cliente.Id,
      nombre: sale.Cliente.Entidad.NombreCompleto,
      nit: sale.Cliente.Entidad.Nit,
      tipoCliente: sale.Cliente.TipoCliente
        ? {
            id: sale.Cliente.TipoCliente.Id,
            nombre: sale.Cliente.TipoCliente.Nombre,
          }
        : null,
    },
    usuario: {
      id: sale.Usuario.Id,
      nombre: sale.Usuario.Nombre,
      correo: sale.Usuario.Correo,
    },
    rutaSesion: sale.RutaSesion
      ? {
          id: sale.RutaSesion.Id,
          estado: sale.RutaSesion.Estado,
          fechaSesion: sale.RutaSesion.FechaSesion,
          ruta: {
            id: sale.RutaSesion.Ruta.Id,
            nombre: sale.RutaSesion.Ruta.Nombre,
          },
        }
      : null,
    talonario: sale.Talonario
      ? {
          id: sale.Talonario.Id,
          nombre: sale.Talonario.Nombre,
        }
      : null,
    detalle,
    pagos,
    subtotal: totals.subtotal,
    totalBonificado: totals.totalBonificado,
    total: totals.total,
    totalPagado,
    saldo,
  };
}

function validatePaymentRules(payment: SalePaymentInput) {
  const referenceMethods = ['TRANSFERENCIA', 'CHEQUE', 'POS'];
  if (referenceMethods.includes(payment.metodoPago) && !payment.numeroReferencia) {
    throw new Error('numeroReferencia es obligatoria para este método de pago');
  }

  if ((payment.metodoPago === 'TRANSFERENCIA' || payment.metodoPago === 'CHEQUE') && !payment.banco) {
    throw new Error('banco es obligatorio para este método de pago');
  }
}

export async function listSales(input: ListSalesInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.VentaWhereInput = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.numeroVenta !== undefined ? { NumeroVenta: input.numeroVenta } : {}),
    ...(input.idCliente !== undefined ? { IdCliente: input.idCliente } : {}),
    ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
    ...(input.idRutaSesion !== undefined ? { IdRutaSesion: input.idRutaSesion } : {}),
    ...(input.condicionPago ? { CondicionPago: input.condicionPago } : {}),
    ...(input.estadoPago ? { EstadoPago: input.estadoPago } : {}),
    ...(input.estadoEntrega ? { EstadoEntrega: input.estadoEntrega } : {}),
    ...(input.requiereFactura !== undefined ? { RequiereFactura: input.requiereFactura } : {}),
    ...(input.fechaDesde || input.fechaHasta
      ? {
          FechaRegistro: {
            ...(input.fechaDesde ? { gte: toDateOnly(input.fechaDesde) } : {}),
            ...(input.fechaHasta ? { lte: toDateOnly(input.fechaHasta) } : {}),
          },
        }
      : {}),
    ...(input.busqueda
      ? {
          OR: [
            {
              Cliente: {
                Entidad: {
                  NombreCompleto: {
                    contains: input.busqueda,
                  },
                },
              },
            },
            {
              NitFacturado: {
                contains: input.busqueda,
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.venta.count({ where }),
    prisma.venta.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: {
        Cliente: {
          select: {
            Id: true,
            Entidad: {
              select: {
                NombreCompleto: true,
                Nit: true,
              },
            },
            TipoCliente: {
              select: {
                Id: true,
                Nombre: true,
              },
            },
          },
        },
        Usuario: {
          select: {
            Id: true,
            Nombre: true,
            Correo: true,
          },
        },
        RutaSesion: {
          select: {
            Id: true,
            Estado: true,
            FechaSesion: true,
            Ruta: {
              select: {
                Id: true,
                Nombre: true,
              },
            },
          },
        },
        Talonario: {
          select: {
            Id: true,
            Nombre: true,
          },
        },
        DetalleVenta: {
          where: { Anulado: false },
          include: {
            InventarioItem: {
              select: {
                Id: true,
                Nombre: true,
                Categoria: true,
                Existencia: true,
              },
            },
          },
        },
        PagoVenta: {
          where: { Anulado: false },
          include: {
            Usuario: {
              select: {
                Id: true,
                Nombre: true,
                Correo: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map(toSaleDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSaleById(id: number) {
  const sale = await getSaleByIdInternal(prisma, id, true);
  if (!sale) {
    throw new Error('Venta no existe');
  }

  return toSaleDto(sale);
}

export async function createSale(input: CreateSaleInput) {
  await validateUsuarioExists(input.idUsuario);
  const cliente = await getClienteActivo(input.idCliente);

  if (input.idRutaSesion) {
    await validateRutaSesionActiva(input.idRutaSesion);
  }

  if (input.pagoInicial) {
    validatePaymentRules(input.pagoInicial);
  }

  const created = await prisma.$transaction(
    async (tx) => {
      const numeroVenta = await getNextNumeroVenta(tx);
      const fechaOperacion = new Date();

      let numeroProForma = input.numeroProForma;
      if (input.idTalonario) {
        numeroProForma = await getAndReserveNextTalonarioCorrelativo(tx, input.idTalonario);
      }

      const sellItems = input.detalle.filter((item) => !item.esBonificacion);
      const autoBonusItems = await buildAutoBonusDetails(
        tx,
        sellItems.map((item) => ({
          idInventarioItem: item.idInventarioItem,
          cantidad: item.cantidad,
        })),
      );

      const mergedDetails = [...input.detalle, ...autoBonusItems];

      const itemCache = new Map<
        number,
        {
          id: number;
          nombre: string;
          existencia: number;
          precioVenta: number;
        }
      >();

      for (const detail of mergedDetails) {
        if (!itemCache.has(detail.idInventarioItem)) {
          const item = await tx.inventarioItem.findFirst({
            where: {
              Id: detail.idInventarioItem,
              Anulado: false,
            },
            select: {
              Id: true,
              Nombre: true,
              Existencia: true,
              PrecioVenta: true,
            },
          });

          if (!item) {
            throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
          }

          itemCache.set(detail.idInventarioItem, {
            id: item.Id,
            nombre: item.Nombre,
            existencia: item.Existencia,
            precioVenta: toNumber(item.PrecioVenta),
          });
        }
      }

      const requiredByItem = new Map<number, number>();
      for (const detail of mergedDetails) {
        const current = requiredByItem.get(detail.idInventarioItem) ?? 0;
        requiredByItem.set(detail.idInventarioItem, Number((current + detail.cantidad).toFixed(2)));
      }

      for (const [idItem, requiredQty] of requiredByItem) {
        const item = itemCache.get(idItem);
        if (!item) {
          throw new Error(`InventarioItem ${idItem} no existe o está anulado`);
        }

        if (item.existencia < requiredQty) {
          throw new Error(
            `Stock insuficiente para ${item.nombre}. Existencia actual ${item.existencia}, requerida ${requiredQty}`,
          );
        }
      }

      const detailRows: Array<{
        idInventarioItem: number;
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        esBonificacion: boolean;
      }> = [];

      for (const detail of mergedDetails) {
        const item = itemCache.get(detail.idInventarioItem);
        if (!item) {
          throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
        }

        const resolvedPrice = detail.esBonificacion
          ? 0
          : (detail.precioUnitario ??
            (await resolveApplicablePrice(tx, detail.idInventarioItem, cliente.IdTipoCliente, fechaOperacion)));

        detailRows.push({
          idInventarioItem: detail.idInventarioItem,
          nombre: item.nombre,
          cantidad: detail.cantidad,
          precioUnitario: Number(resolvedPrice.toFixed(2)),
          esBonificacion: Boolean(detail.esBonificacion),
        });
      }

      const totals = getSaleTotals(
        detailRows.map((item) => ({
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          esBonificacion: item.esBonificacion,
        })),
      );

      const totalPagoInicial = input.pagoInicial ? Number(input.pagoInicial.monto.toFixed(2)) : 0;

      if (input.condicionPago === 'CONTADO' && Number(totalPagoInicial.toFixed(2)) !== Number(totals.total.toFixed(2))) {
        throw new Error('Venta de contado requiere pago exacto del total');
      }

      if (input.condicionPago === 'CREDITO' && totalPagoInicial > totals.total) {
        throw new Error('Pago inicial no puede ser mayor al total de la venta');
      }

      const estadoPago = getPaymentState(totals.total, totalPagoInicial);

      const createdSale = await tx.venta.create({
        data: {
          IdCliente: input.idCliente,
          IdUsuario: input.idUsuario,
          IdRutaSesion: input.idRutaSesion,
          IdTalonario: input.idTalonario,
          NumeroVenta: numeroVenta,
          NumeroProForma: numeroProForma,
          TipoRegistro: input.tipoRegistro,
          EstadoEntrega: input.estadoEntrega,
          CondicionPago: input.condicionPago,
          EstadoPago: estadoPago,
          RequiereFactura: input.requiereFactura,
          NitFacturado: input.nitFacturado ?? cliente.Entidad.Nit ?? null,
          NombreClienteFacturado: input.nombreClienteFacturado ?? cliente.Entidad.NombreCompleto,
          DireccionClienteFacturado: input.direccionClienteFacturado,
          LugarEntrega: input.lugarEntrega,
          FechaEntregaEsperada: input.fechaEntregaEsperada ? toDateOnly(input.fechaEntregaEsperada) : null,
          Anulado: false,
        },
        select: {
          Id: true,
          NumeroVenta: true,
        },
      });

      for (const detail of detailRows) {
        await tx.detalleVenta.create({
          data: {
            IdVenta: createdSale.Id,
            IdInventarioItem: detail.idInventarioItem,
            Nombre: detail.nombre,
            Cantidad: detail.cantidad,
            PrecioUnitario: detail.precioUnitario,
            EsBonificacion: detail.esBonificacion,
            Anulado: false,
          },
        });

        const item = itemCache.get(detail.idInventarioItem);
        if (!item) {
          throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
        }

        const existenciaAnterior = item.existencia;
        const nuevaExistencia = Number((existenciaAnterior - detail.cantidad).toFixed(2));

        await tx.inventarioItem.update({
          where: { Id: detail.idInventarioItem },
          data: {
            Existencia: nuevaExistencia,
          },
        });

        await registerInventoryMovement(tx, {
          idInventarioItem: detail.idInventarioItem,
          idUsuario: input.idUsuario,
          tipoDocumento: 'VEN',
          documento: createdSale.Id.toString(),
          nombre: `Salida venta #${createdSale.NumeroVenta} - ${detail.nombre}`,
          tipoMovimiento: false,
          existenciaAnterior,
          cantidad: detail.cantidad,
          nuevaExistencia,
        });

        item.existencia = nuevaExistencia;
      }

      if (input.pagoInicial && totalPagoInicial > 0) {
        await tx.pagoVenta.create({
          data: {
            IdVenta: createdSale.Id,
            IdUsuario: input.idUsuario,
            Monto: totalPagoInicial,
            MetodoPago: input.pagoInicial.metodoPago,
            NumeroReferencia: input.pagoInicial.numeroReferencia,
            Banco: input.pagoInicial.banco,
            FechaPago: input.pagoInicial.fechaPago ? toDateOnly(input.pagoInicial.fechaPago) : new Date(),
            RutaFirma: input.pagoInicial.rutaFirma,
            Observaciones: input.pagoInicial.observaciones,
            Anulado: false,
          },
        });
      }

      const sale = await getSaleByIdInternal(tx, createdSale.Id, true);
      if (!sale) {
        throw new Error('No se pudo registrar la venta');
      }

      return toSaleDto(sale);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return created;
}

export async function updateSale(id: number, input: UpdateSaleInput) {
  const sale = await prisma.venta.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    include: {
      PagoVenta: {
        where: {
          Anulado: false,
        },
        select: {
          Id: true,
        },
      },
      RutaSesion: {
        select: {
          Estado: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error('Venta no existe');
  }

  if (sale.NumeroFel || sale.AutorizacionFel || sale.FechaEmisionFel) {
    throw new Error('No se puede modificar una venta con FEL emitido');
  }

  if (sale.PagoVenta.length > 0) {
    throw new Error('No se puede modificar una venta con pagos registrados');
  }

  if (sale.RutaSesion?.Estado === 'CERRADA') {
    throw new Error('No se puede modificar una venta de ruta cerrada');
  }

  if (sale.EstadoEntrega === 'ENTREGADO') {
    throw new Error('No se puede modificar una venta entregada');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  await prisma.venta.update({
    where: {
      Id: id,
    },
    data: {
      ...(input.estadoEntrega !== undefined ? { EstadoEntrega: input.estadoEntrega } : {}),
      ...(input.requiereFactura !== undefined ? { RequiereFactura: input.requiereFactura } : {}),
      ...(input.lugarEntrega !== undefined ? { LugarEntrega: input.lugarEntrega } : {}),
      ...(input.fechaEntregaEsperada !== undefined
        ? { FechaEntregaEsperada: toDateOnly(input.fechaEntregaEsperada) }
        : {}),
      IdUsuarioModificador: input.idUsuarioModificador,
      FechaModificacion: new Date(),
    },
  });

  const updated = await getSaleByIdInternal(prisma, id, true);
  if (!updated) {
    throw new Error('Venta no existe');
  }

  return toSaleDto(updated);
}

export async function anulateSale(id: number, idUsuarioAnulador?: number) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  const sale = await prisma.venta.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    include: {
      DetalleVenta: {
        where: { Anulado: false },
        select: {
          Id: true,
          IdInventarioItem: true,
          Cantidad: true,
          Nombre: true,
        },
      },
      PagoVenta: {
        where: { Anulado: false },
        select: {
          Id: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error('Venta no existe o ya está anulada');
  }

  await prisma.$transaction(async (tx) => {
    const fechaAnulacion = new Date();

    for (const detail of sale.DetalleVenta) {
      const item = await tx.inventarioItem.findFirst({
        where: {
          Id: detail.IdInventarioItem,
          Anulado: false,
        },
        select: {
          Id: true,
          Existencia: true,
        },
      });

      if (!item) {
        throw new Error(`InventarioItem ${detail.IdInventarioItem} no existe o está anulado`);
      }

      const existenciaAnterior = item.Existencia;
      const nuevaExistencia = Number((existenciaAnterior + detail.Cantidad).toFixed(2));

      await tx.inventarioItem.update({
        where: { Id: detail.IdInventarioItem },
        data: {
          Existencia: nuevaExistencia,
        },
      });

      await registerInventoryMovement(tx, {
        idInventarioItem: detail.IdInventarioItem,
        idUsuario: idUsuarioAnulador ?? sale.IdUsuario,
        tipoDocumento: 'VENAN',
        documento: sale.Id.toString(),
        nombre: `Entrada por anulación venta #${sale.NumeroVenta} - ${detail.Nombre}`,
        tipoMovimiento: true,
        existenciaAnterior,
        cantidad: detail.Cantidad,
        nuevaExistencia,
      });
    }

    await tx.detalleVenta.updateMany({
      where: {
        IdVenta: sale.Id,
        Anulado: false,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
      },
    });

    await tx.pagoVenta.updateMany({
      where: {
        IdVenta: sale.Id,
        Anulado: false,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
      },
    });

    await tx.venta.update({
      where: {
        Id: sale.Id,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
      },
    });
  });
}

export async function listSalePayments(idVenta: number) {
  const sale = await prisma.venta.findFirst({
    where: {
      Id: idVenta,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!sale) {
    throw new Error('Venta no existe');
  }

  const payments = await prisma.pagoVenta.findMany({
    where: {
      IdVenta: idVenta,
      Anulado: false,
    },
    orderBy: { Id: 'desc' },
    include: {
      Usuario: {
        select: {
          Id: true,
          Nombre: true,
          Correo: true,
        },
      },
    },
  });

  return payments.map((payment) => ({
    id: payment.Id,
    idVenta: payment.IdVenta,
    idUsuario: payment.IdUsuario,
    monto: toNumber(payment.Monto),
    metodoPago: payment.MetodoPago,
    numeroReferencia: payment.NumeroReferencia,
    banco: payment.Banco,
    fechaPago: payment.FechaPago,
    rutaFirma: payment.RutaFirma,
    observaciones: payment.Observaciones,
    usuario: {
      id: payment.Usuario.Id,
      nombre: payment.Usuario.Nombre,
      correo: payment.Usuario.Correo,
    },
  }));
}

async function recalculateSalePaymentStatus(
  tx: Prisma.TransactionClient,
  idVenta: number,
): Promise<{ total: number; totalPagado: number; estadoPago: string; saldo: number }> {
  const sale = await tx.venta.findFirst({
    where: {
      Id: idVenta,
      Anulado: false,
    },
    include: {
      DetalleVenta: {
        where: { Anulado: false },
        select: {
          Cantidad: true,
          PrecioUnitario: true,
          EsBonificacion: true,
        },
      },
      PagoVenta: {
        where: { Anulado: false },
        select: {
          Monto: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error('Venta no existe');
  }

  const totals = getSaleTotals(
    sale.DetalleVenta.map((detail) => ({
      cantidad: detail.Cantidad,
      precioUnitario: toNumber(detail.PrecioUnitario),
      esBonificacion: detail.EsBonificacion,
    })),
  );

  const totalPagado = Number(
    sale.PagoVenta.reduce((sum, item) => sum + toNumber(item.Monto), 0).toFixed(2),
  );

  const estadoPago = getPaymentState(totals.total, totalPagado);
  const saldo = Number(Math.max(0, totals.total - totalPagado).toFixed(2));

  await tx.venta.update({
    where: { Id: idVenta },
    data: {
      EstadoPago: estadoPago,
    },
  });

  return {
    total: totals.total,
    totalPagado,
    estadoPago,
    saldo,
  };
}

export async function createSalePayment(idVenta: number, input: CreateSalePaymentInput) {
  await validateUsuarioExists(input.idUsuario);
  validatePaymentRules(input);

  const created = await prisma.$transaction(async (tx) => {
    const sale = await tx.venta.findFirst({
      where: {
        Id: idVenta,
        Anulado: false,
      },
      select: {
        Id: true,
      },
    });

    if (!sale) {
      throw new Error('Venta no existe');
    }

    const current = await recalculateSalePaymentStatus(tx, idVenta);
    if (input.monto > current.saldo) {
      throw new Error('Pago no puede ser mayor al saldo pendiente');
    }

    const payment = await tx.pagoVenta.create({
      data: {
        IdVenta: idVenta,
        IdUsuario: input.idUsuario,
        Monto: input.monto,
        MetodoPago: input.metodoPago,
        NumeroReferencia: input.numeroReferencia,
        Banco: input.banco,
        FechaPago: input.fechaPago ? toDateOnly(input.fechaPago) : new Date(),
        RutaFirma: input.rutaFirma,
        Observaciones: input.observaciones,
        Anulado: false,
      },
    });

    const recalculated = await recalculateSalePaymentStatus(tx, idVenta);

    return {
      id: payment.Id,
      idVenta: payment.IdVenta,
      idUsuario: payment.IdUsuario,
      monto: toNumber(payment.Monto),
      metodoPago: payment.MetodoPago,
      numeroReferencia: payment.NumeroReferencia,
      banco: payment.Banco,
      fechaPago: payment.FechaPago,
      rutaFirma: payment.RutaFirma,
      observaciones: payment.Observaciones,
      estadoPago: recalculated.estadoPago,
      saldo: recalculated.saldo,
    };
  });

  return created;
}

export async function anulateSalePayment(idVenta: number, idPago: number, idUsuarioAnulador?: number) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.pagoVenta.findFirst({
      where: {
        Id: idPago,
        IdVenta: idVenta,
        Anulado: false,
      },
      select: {
        Id: true,
      },
    });

    if (!payment) {
      throw new Error('Pago no existe');
    }

    await tx.pagoVenta.update({
      where: {
        Id: idPago,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });

    await recalculateSalePaymentStatus(tx, idVenta);
  });
}
