import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { anulateFelInvoice, emitFelInvoice } from './fel.service';
import { registerInventoryMovement } from './inventory-movement.service';
import { NotificationEvents, send } from './notification.service';

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

type CuentaPorCobrarEstado = 'ACTIVO' | 'PAGADO' | 'ANULADO';

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

function getCuentaPorCobrarEstadoBySaldo(saldo: number): CuentaPorCobrarEstado {
  return saldo <= 0 ? 'PAGADO' : 'ACTIVO';
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

async function getClienteCondicionCreditoVigente(
  tx: PrismaClient | Prisma.TransactionClient,
  idCliente: number,
  fechaOperacion: Date,
) {
  const condicion = await tx.clienteCondicionCredito.findFirst({
    where: {
      IdCliente: idCliente,
      HabilitadoCredito: true,
      Anulado: false,
      FechaInicioVigencia: {
        lte: fechaOperacion,
      },
      OR: [{ FechaFinVigencia: null }, { FechaFinVigencia: { gte: fechaOperacion } }],
    },
    orderBy: [{ FechaInicioVigencia: 'desc' }, { Id: 'desc' }],
    select: {
      Id: true,
      IdTipoCredito: true,
    },
  });

  if (!condicion) {
    throw new Error('Cliente no habilitado para crédito');
  }

  return condicion;
}

async function syncCuentaPorCobrarFromSale(
  tx: Prisma.TransactionClient,
  idVenta: number,
  recalculated: { saldo: number },
  idUsuarioModificador?: number,
) {
  const cuenta = await tx.cuentaPorCobrar.findFirst({
    where: {
      IdVenta: idVenta,
      Anulado: false,
    },
    select: {
      Id: true,
      Estado: true,
    },
  });

  if (!cuenta || cuenta.Estado === 'ANULADO') {
    return;
  }

  const estado = getCuentaPorCobrarEstadoBySaldo(recalculated.saldo);

  await tx.cuentaPorCobrar.update({
    where: { Id: cuenta.Id },
    data: {
      Estado: estado,
      FechaLiquidacion: estado === 'PAGADO' ? new Date() : null,
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
    },
  });
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
  tx: PrismaClient | Prisma.TransactionClient,
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
  tx: PrismaClient | Prisma.TransactionClient,
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
        AND: [
          { OR: [{ FechaFin: null }, { FechaFin: { gte: now } }] },
          // Rango completo: respeta CantidadMaxima cuando está definida.
          { OR: [{ CantidadMaxima: null }, { CantidadMaxima: { gte: item.cantidad } }] },
        ],
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
    rutaPdfFel: sale.RutaPdfFel,
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
  const { page, limit, skip } = resolvePagination(input);

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
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getSaleById(id: number) {
  const sale = await getSaleByIdInternal(prisma, id, true);
  if (!sale) {
    throw new Error('Venta no existe');
  }

  return toSaleDto(sale);
}

export async function resolveSalePrice(idCliente: number, idInventarioItem: number) {
  const cliente = await getClienteActivo(idCliente);
  const precioUnitario = await resolveApplicablePrice(
    prisma,
    idInventarioItem,
    cliente.IdTipoCliente,
    new Date(),
  );

  return {
    idCliente,
    idInventarioItem,
    idTipoCliente: cliente.IdTipoCliente,
    precioUnitario,
  };
}

export async function previewSaleBonuses(detalle: Array<{ idInventarioItem: number; cantidad: number }>) {
  const bonuses = await buildAutoBonusDetails(prisma, detalle);
  if (bonuses.length === 0) {
    return [];
  }

  const items = await prisma.inventarioItem.findMany({
    where: {
      Id: { in: bonuses.map((bonus) => bonus.idInventarioItem) },
    },
    select: { Id: true, Nombre: true },
  });

  const nameById = new Map(items.map((item) => [item.Id, item.Nombre]));

  return bonuses.map((bonus) => ({
    idInventarioItem: bonus.idInventarioItem,
    nombre: nameById.get(bonus.idInventarioItem) ?? `Producto ${bonus.idInventarioItem}`,
    cantidad: bonus.cantidad,
  }));
}

// Datos del evento PEDIDO_CREADO: "id" representa el número de pedido visible
// para el usuario (Venta.NumeroVenta), no el Id interno de la fila.
export function buildPedidoCreadoDatos(sale: ReturnType<typeof toSaleDto>) {
  return {
    id: sale.numeroVenta,
    cliente: sale.cliente.nombre,
    productos: sale.detalle.length,
    total: sale.total,
    pago: sale.condicionPago,
    estado: sale.estadoPago,
  };
}

// Notificación fire-and-forget: nunca debe bloquear ni afectar la venta ya creada.
// send() no lanza excepciones (siempre resuelve un resultado clasificado), pero
// el fallo se registra sin exponer el secreto del webhook.
export function notifyPedidoCreado(sale: ReturnType<typeof toSaleDto>): void {
  send(NotificationEvents.PEDIDO_CREADO, buildPedidoCreadoDatos(sale))
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[notificaciones] No se pudo notificar PEDIDO_CREADO (venta #${sale.numeroVenta}): ${result.reason} - ${result.message}`,
        );
      }
    })
    .catch((error) => {
      console.error(
        `[notificaciones] Error inesperado notificando PEDIDO_CREADO (venta #${sale.numeroVenta}):`,
        error instanceof Error ? error.message : error,
      );
    });
}

export function buildFacturaEmitidaDatos(sale: ReturnType<typeof toSaleDto>) {
  return {
    numeroVenta: sale.numeroVenta,
    cliente: sale.cliente.nombre,
    autorizacionFel: sale.autorizacionFel,
    numeroFel: sale.numeroFel,
    serieFel: sale.serieFel,
    total: sale.total,
  };
}

// Se dispara únicamente después del commit de createSale, nunca dentro del
// callback de la transacción (un rollback posterior no debe generar un aviso
// de una factura que nunca quedó confirmada).
export function notifyFacturaEmitida(sale: ReturnType<typeof toSaleDto>): void {
  send(NotificationEvents.FACTURA_EMITIDA, buildFacturaEmitidaDatos(sale))
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[notificaciones] No se pudo notificar FACTURA_EMITIDA (venta #${sale.numeroVenta}): ${result.reason} - ${result.message}`,
        );
      }
    })
    .catch((error) => {
      console.error(
        `[notificaciones] Error inesperado notificando FACTURA_EMITIDA (venta #${sale.numeroVenta}):`,
        error instanceof Error ? error.message : error,
      );
    });
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
      const condicionCreditoAplicada =
        input.condicionPago === 'CREDITO'
          ? await getClienteCondicionCreditoVigente(tx, input.idCliente, fechaOperacion)
          : null;

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

      if (input.condicionPago === 'CREDITO') {
        const saldoInicial = Number(Math.max(0, totals.total - totalPagoInicial).toFixed(2));
        const estadoCxC = getCuentaPorCobrarEstadoBySaldo(saldoInicial);

        await tx.cuentaPorCobrar.create({
          data: {
            IdVenta: createdSale.Id,
            IdTipoCreditoAplicado: condicionCreditoAplicada?.IdTipoCredito,
            IdClienteCondicionCreditoAplicada: condicionCreditoAplicada?.Id,
            IdUsuarioCreacion: input.idUsuario,
            TotalOriginal: totals.total,
            Estado: estadoCxC,
            FechaLiquidacion: estadoCxC === 'PAGADO' ? new Date() : null,
            Anulado: false,
          },
        });
      }

      if (input.requiereFactura) {
        const nitFacturado = input.nitFacturado ?? cliente.Entidad.Nit;
        const nombreClienteFacturado =
          input.nombreClienteFacturado ?? cliente.Entidad.NombreCompleto;

        if (!nitFacturado || !nombreClienteFacturado) {
          throw new Error('FEL: nitFacturado y nombreClienteFacturado son obligatorios');
        }

        const felResult = await emitFelInvoice(
          {
            idVenta: createdSale.Id,
            numeroVenta: createdSale.NumeroVenta,
            nitFacturado,
            nombreClienteFacturado,
            direccionClienteFacturado: input.direccionClienteFacturado,
            items: detailRows.map((item) => ({
              nombre: item.nombre,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              esBonificacion: item.esBonificacion,
            })),
            total: totals.total,
            fechaEmision: fechaOperacion,
          },
          tx,
        );

        await tx.venta.update({
          where: { Id: createdSale.Id },
          data: {
            AutorizacionFel: felResult.autorizacionFel,
            NumeroFel: felResult.numeroFel,
            SerieFel: felResult.serieFel,
            QrFel: felResult.qrFel,
            RutaPdfFel: felResult.rutaPdfFel,
            FechaEmisionFel: felResult.fechaEmisionFel,
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

  // Efecto secundario: la venta ya quedó confirmada en la transacción anterior.
  // Un fallo de n8n/Telegram nunca debe afectar la operación de negocio ya exitosa.
  notifyPedidoCreado(created);

  if (created.autorizacionFel && created.numeroFel && created.serieFel) {
    notifyFacturaEmitida(created);
  }

  return created;
}

export function buildPedidoEntregadoDatos(sale: ReturnType<typeof toSaleDto>) {
  return {
    numeroVenta: sale.numeroVenta,
    cliente: sale.cliente.nombre,
  };
}

export function notifyPedidoEntregado(sale: ReturnType<typeof toSaleDto>): void {
  send(NotificationEvents.PEDIDO_ENTREGADO, buildPedidoEntregadoDatos(sale))
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[notificaciones] No se pudo notificar PEDIDO_ENTREGADO (venta #${sale.numeroVenta}): ${result.reason} - ${result.message}`,
        );
      }
    })
    .catch((error) => {
      console.error(
        `[notificaciones] Error inesperado notificando PEDIDO_ENTREGADO (venta #${sale.numeroVenta}):`,
        error instanceof Error ? error.message : error,
      );
    });
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
      Cliente: {
        select: {
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
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

  const updatedDto = toSaleDto(updated);

  // El guard previo ya impide modificar una venta con EstadoEntrega === 'ENTREGADO',
  // por lo que llegar aquí con este valor siempre representa una transición real.
  if (input.estadoEntrega === 'ENTREGADO') {
    notifyPedidoEntregado(updatedDto);
  }

  return updatedDto;
}

export function buildVentaAnuladaDatos(sale: { numeroVenta: number; cliente: string }) {
  return {
    numeroVenta: sale.numeroVenta,
    cliente: sale.cliente,
  };
}

export function notifyVentaAnulada(sale: { numeroVenta: number; cliente: string }): void {
  send(NotificationEvents.VENTA_ANULADA, buildVentaAnuladaDatos(sale))
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[notificaciones] No se pudo notificar VENTA_ANULADA (venta #${sale.numeroVenta}): ${result.reason} - ${result.message}`,
        );
      }
    })
    .catch((error) => {
      console.error(
        `[notificaciones] Error inesperado notificando VENTA_ANULADA (venta #${sale.numeroVenta}):`,
        error instanceof Error ? error.message : error,
      );
    });
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
      Cliente: {
        select: {
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    throw new Error('Venta no existe o ya está anulada');
  }

  let rutaPdfFelAnulacion: string | null = null;

  if (sale.RequiereFactura && sale.AutorizacionFel && sale.SerieFel && sale.NumeroFel) {
    const anulacionResult = await anulateFelInvoice({
      idVenta: sale.Id,
      numeroVenta: sale.NumeroVenta,
      autorizacionFel: sale.AutorizacionFel,
      serieFel: sale.SerieFel,
      numeroFel: sale.NumeroFel,
      motivo: `ANULACION VENTA ${sale.NumeroVenta}`,
      fechaAnulacion: new Date(),
    });

    rutaPdfFelAnulacion = anulacionResult.rutaPdfFel;
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
        ...(rutaPdfFelAnulacion ? { RutaPdfFel: rutaPdfFelAnulacion } : {}),
      },
    });

    await tx.cuentaPorCobrar.updateMany({
      where: {
        IdVenta: sale.Id,
        Anulado: false,
      },
      data: {
        Estado: 'ANULADO',
        MotivoCierre: `ANULACION_VENTA_${sale.NumeroVenta}`,
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
        FechaModificacion: fechaAnulacion,
        IdUsuarioModificador: idUsuarioAnulador,
      },
    });
  });

  // Se notifica solo cuando FEL (si aplicaba) y la transacción de anulación
  // ya terminaron correctamente; nunca entre ambos pasos.
  notifyVentaAnulada({ numeroVenta: sale.NumeroVenta, cliente: sale.Cliente.Entidad.NombreCompleto });
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

export function buildPagoRecibidoDatos(payment: {
  numeroVenta: number;
  cliente: string;
  monto: number;
  metodoPago: string;
  estadoPago: string;
  saldo: number;
}) {
  return {
    numeroVenta: payment.numeroVenta,
    cliente: payment.cliente,
    monto: payment.monto,
    metodoPago: payment.metodoPago,
    estadoPago: payment.estadoPago,
    saldo: payment.saldo,
  };
}

export function notifyPagoRecibido(payment: {
  numeroVenta: number;
  cliente: string;
  monto: number;
  metodoPago: string;
  estadoPago: string;
  saldo: number;
}): void {
  send(NotificationEvents.PAGO_RECIBIDO, buildPagoRecibidoDatos(payment))
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[notificaciones] No se pudo notificar PAGO_RECIBIDO (venta #${payment.numeroVenta}): ${result.reason} - ${result.message}`,
        );
      }
    })
    .catch((error) => {
      console.error(
        `[notificaciones] Error inesperado notificando PAGO_RECIBIDO (venta #${payment.numeroVenta}):`,
        error instanceof Error ? error.message : error,
      );
    });
}

export async function createSalePayment(idVenta: number, input: CreateSalePaymentInput) {
  await validateUsuarioExists(input.idUsuario);
  validatePaymentRules(input);

  let saleInfo: { numeroVenta: number; cliente: string } | undefined;

  const created = await prisma.$transaction(async (tx) => {
    const sale = await tx.venta.findFirst({
      where: {
        Id: idVenta,
        Anulado: false,
      },
      select: {
        Id: true,
        NumeroVenta: true,
        Cliente: {
          select: {
            Entidad: {
              select: {
                NombreCompleto: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new Error('Venta no existe');
    }

    saleInfo = { numeroVenta: sale.NumeroVenta, cliente: sale.Cliente.Entidad.NombreCompleto };

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
    await syncCuentaPorCobrarFromSale(tx, idVenta, recalculated, input.idUsuario);

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
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  if (saleInfo) {
    notifyPagoRecibido({
      numeroVenta: saleInfo.numeroVenta,
      cliente: saleInfo.cliente,
      monto: created.monto,
      metodoPago: created.metodoPago,
      estadoPago: created.estadoPago,
      saldo: created.saldo,
    });
  }

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

    const recalculated = await recalculateSalePaymentStatus(tx, idVenta);
    await syncCuentaPorCobrarFromSale(tx, idVenta, recalculated, idUsuarioAnulador);
  });
}
