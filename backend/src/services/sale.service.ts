import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { uploadsRootPath } from '../utils/paths';
import { anulateFelInvoice, emitFelInvoice } from './fel.service';
import { anulateEnvaseMovementInTransaction } from './envase.service';
import {
  ensurePlantEnvaseBucketQuantity,
  registerEnvaseBucketChange,
  registerInventoryMovement,
} from './inventory-movement.service';
import { NotificationEvents, send } from './notification.service';
import {
  recordCashPaymentMovement,
  reverseSalePaymentCashMovement,
} from './cash.service';
import { accrueMonthlyCommissionsForSale } from './commission-accrual.service';
import { processExpiredProformaReservations } from './proforma-reservation.service';
import { getRouteAvailableQuantities } from './route-inventory.service';
import {
  assertRouteSessionAccess,
  assertSaleAccess,
  getSaleVisibilityWhere,
  type OperationalActor,
} from './operational-scope.service';

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
  estadoEnvase?: 'VACIO' | 'LLENO';
  modoEnvase?: 'CLIENTE_PROPIO' | 'PRESTAMO_EMPRESA';
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
  idEmpleadoVendedor?: number;
  idRutaSesion?: number;
  idTalonario?: number;
  numeroProForma?: number;
  tipoRegistro: 'VENTA' | 'PROFORMA';
  fechaExpiracionProforma?: string;
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

type SalePaymentResult = {
  id: number;
  idVenta: number;
  idUsuario: number;
  monto: number;
  metodoPago: string;
  numeroReferencia: string | null;
  banco: string | null;
  fechaPago: Date | null;
  rutaFirma: string | null;
  observaciones: string | null;
  estadoPago: string;
  saldo: number;
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
      HabilitadoCredito: true,
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
  const fechaOperacionCalendario = new Date(
    Date.UTC(fechaOperacion.getUTCFullYear(), fechaOperacion.getUTCMonth(), fechaOperacion.getUTCDate()),
  );
  const condicion = await tx.clienteCondicionCredito.findFirst({
    where: {
      IdCliente: idCliente,
      HabilitadoCredito: true,
      Anulado: false,
      TipoCredito: { is: { Activo: true, Anulado: false } },
      FechaInicioVigencia: {
        lte: fechaOperacionCalendario,
      },
      OR: [{ FechaFinVigencia: null }, { FechaFinVigencia: { gte: fechaOperacionCalendario } }],
    },
    orderBy: [{ FechaInicioVigencia: 'desc' }, { Id: 'desc' }],
    select: {
      Id: true,
      IdTipoCredito: true,
      TipoCredito: {
        select: {
          Id: true,
          Nombre: true,
          PlazoDias: true,
        },
      },
    },
  });

  return condicion;
}

async function validateClienteCreditoHabilitado(
  tx: PrismaClient | Prisma.TransactionClient,
  idCliente: number,
) {
  const cliente = await tx.cliente.findFirst({
    where: {
      Id: idCliente,
      Anulado: false,
      Entidad: { Anulado: false },
    },
    select: { HabilitadoCredito: true },
  });

  if (!cliente) {
    throw new Error('Cliente no existe');
  }

  if (!cliente.HabilitadoCredito) {
    throw new Error('Cliente no tiene habilitado el crédito');
  }
}

export type CustomerCreditAuthorization = {
  idCliente: number;
  nombreCliente: string;
  nitCliente: string | null;
  habilitadoCredito: boolean;
  limiteCredito: number;
  saldoPendiente: number;
  saldoVencido: number;
  creditoDisponible: number;
  condicionVigente: {
    id: number;
    idTipoCredito: number;
    nombreTipoCredito: string;
    plazoDias: number | null;
  } | null;
  motivoNoAutorizado: string | null;
};

async function getCustomerCreditAuthorizationInternal(
  tx: PrismaClient | Prisma.TransactionClient,
  idCliente: number,
  fechaOperacion: Date,
  excluirIdVenta?: number,
): Promise<CustomerCreditAuthorization> {
  const cliente = await tx.cliente.findFirst({
    where: {
      Id: idCliente,
      Anulado: false,
      Entidad: { Anulado: false },
    },
    select: {
      Id: true,
      HabilitadoCredito: true,
      LimiteCredito: true,
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

  const [condicion, cuentas] = await Promise.all([
    getClienteCondicionCreditoVigente(tx, idCliente, fechaOperacion),
    tx.cuentaPorCobrar.findMany({
      where: {
        Anulado: false,
        Estado: { not: 'ANULADO' },
        Venta: {
          is: {
            IdCliente: idCliente,
            Anulado: false,
            ...(excluirIdVenta !== undefined ? { Id: { not: excluirIdVenta } } : {}),
          },
        },
      },
      select: {
        TotalOriginal: true,
        FechaVencimiento: true,
        Venta: {
          select: {
            PagoVenta: {
              where: { Anulado: false },
              select: { Monto: true },
            },
            DevolucionesComerciales: {
              select: {
                Detalles: {
                  select: {
                    Cantidad: true,
                    DetalleVenta: {
                      select: { PrecioUnitario: true, EsBonificacion: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const hoyUtc = new Date(Date.UTC(
    fechaOperacion.getUTCFullYear(),
    fechaOperacion.getUTCMonth(),
    fechaOperacion.getUTCDate(),
  ));
  const saldoPendiente = Number(
    cuentas
      .reduce((saldo, cuenta) => {
        const totalAbonado = cuenta.Venta.PagoVenta.reduce(
          (sum, pago) => sum + toNumber(pago.Monto),
          0,
        );
        const totalDevuelto = cuenta.Venta.DevolucionesComerciales
          .flatMap((devolucion) => devolucion.Detalles)
          .reduce((sum, detalle) => sum + (
            detalle.DetalleVenta.EsBonificacion
              ? 0
              : detalle.Cantidad * toNumber(detalle.DetalleVenta.PrecioUnitario)
          ), 0);
        return saldo + Math.max(0, toNumber(cuenta.TotalOriginal) - totalDevuelto - totalAbonado);
      }, 0)
      .toFixed(2),
  );
  const saldoVencido = Number(
    cuentas
      .reduce((saldo, cuenta) => {
        if (!cuenta.FechaVencimiento || cuenta.FechaVencimiento >= hoyUtc) return saldo;
        const totalAbonado = cuenta.Venta.PagoVenta.reduce(
          (sum, pago) => sum + toNumber(pago.Monto),
          0,
        );
        const totalDevuelto = cuenta.Venta.DevolucionesComerciales
          .flatMap((devolucion) => devolucion.Detalles)
          .reduce((sum, detalle) => sum + (
            detalle.DetalleVenta.EsBonificacion
              ? 0
              : detalle.Cantidad * toNumber(detalle.DetalleVenta.PrecioUnitario)
          ), 0);
        return saldo + Math.max(0, toNumber(cuenta.TotalOriginal) - totalDevuelto - totalAbonado);
      }, 0)
      .toFixed(2),
  );
  const limiteCredito = toNumber(cliente.LimiteCredito);
  const creditoDisponible = Number((limiteCredito - saldoPendiente).toFixed(2));
  const motivoNoAutorizado = !cliente.HabilitadoCredito
    ? 'El cliente no tiene habilitado el crédito'
    : !condicion
      ? 'El cliente no tiene una condición de crédito vigente con un tipo activo'
      : null;

  return {
    idCliente: cliente.Id,
    nombreCliente: cliente.Entidad.NombreCompleto,
    nitCliente: cliente.Entidad.Nit,
    habilitadoCredito: cliente.HabilitadoCredito,
    limiteCredito,
    saldoPendiente,
    saldoVencido,
    creditoDisponible,
    condicionVigente: condicion
      ? {
          id: condicion.Id,
          idTipoCredito: condicion.IdTipoCredito,
          nombreTipoCredito: condicion.TipoCredito.Nombre,
          plazoDias: condicion.TipoCredito.PlazoDias,
        }
      : null,
    motivoNoAutorizado,
  };
}

export async function getCustomerCreditAuthorization(
  idCliente: number,
): Promise<CustomerCreditAuthorization> {
  return getCustomerCreditAuthorizationInternal(prisma, idCliente, new Date());
}

async function authorizeCustomerCreditSale(
  tx: Prisma.TransactionClient,
  idCliente: number,
  consumo: number,
  fechaOperacion: Date,
  excluirIdVenta?: number,
) {
  const authorization = await getCustomerCreditAuthorizationInternal(
    tx,
    idCliente,
    fechaOperacion,
    excluirIdVenta,
  );

  if (authorization.motivoNoAutorizado) {
    throw new Error(authorization.motivoNoAutorizado);
  }

  if (consumo > authorization.creditoDisponible) {
    throw new Error(
      `Crédito insuficiente: ${consumo.toFixed(2)} de consumo supera los ${authorization.creditoDisponible.toFixed(2)} disponibles`,
    );
  }

  const condicion = await getClienteCondicionCreditoVigente(tx, idCliente, fechaOperacion);
  if (!condicion) {
    throw new Error('El cliente no tiene una condición de crédito vigente con un tipo activo');
  }

  return condicion;
}

function getCreditDueDate(fechaOperacion: Date, plazoDias: number | null): Date | null {
  if (plazoDias === null) {
    return null;
  }

  const fechaVencimiento = new Date(fechaOperacion);
  fechaVencimiento.setUTCDate(fechaVencimiento.getUTCDate() + plazoDias);
  return fechaVencimiento;
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
      EsVendible: true,
    },
  });

  if (!item) {
    throw new Error(`InventarioItem ${idInventarioItem} no existe o está anulado`);
  }
  if (!item.EsVendible) {
    throw new Error(`El artículo ${idInventarioItem} no está habilitado para la venta`);
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
        },
      },
      Usuario: {
        select: {
          Id: true,
          Nombre: true,
          Correo: true,
        },
      },
      EmpleadoVendedor: {
        select: {
          Id: true,
          Entidad: { select: { NombreCompleto: true } },
        },
      },
      RutaSesion: {
        select: {
          Id: true,
          IdVehiculo: true,
          IdUsuarioVendedor: true,
          IdUsuarioChofer: true,
          IdEmpleadoChofer: true,
          IdEmpleadoVendedor: true,
          Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
            select: {
              Id: true,
              Entidad: { select: { NombreCompleto: true } },
            },
          },
          Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
            select: {
              Id: true,
              Entidad: { select: { NombreCompleto: true } },
            },
          },
          Estado: true,
          FechaSesion: true,
          Vehiculo: {
            select: { Id: true, Placa: true },
          },
          Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
            select: { Id: true, Nombre: true },
          },
          Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
            select: { Id: true, Nombre: true },
          },
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
        include: {
          Envases: {
            include: {
              InventarioItemEnvase: { select: { Id: true, Nombre: true } },
            },
          },
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
      ReservaProforma: {
        select: {
          Estado: true,
          FechaExpiracion: true,
          FechaConsumo: true,
          FechaLiberacion: true,
          MotivoLiberacion: true,
        },
      },
      DevolucionesComerciales: {
        include: {
          UsuarioAutorizacion: {
            select: { Id: true, Nombre: true },
          },
          Detalles: {
            include: {
              DetalleVenta: {
                select: { Id: true, Nombre: true },
              },
            },
          },
        },
        orderBy: { FechaAutorizacion: 'desc' },
      },
    },
  });
}

// El archivo físico puede faltar si el entorno (DB restaurada, limpieza de disco, etc.)
// no conserva /uploads en sincronía con los registros de Venta. Sin esta verificación el
// frontend enlazaría a una ruta inexistente y el usuario vería un 404 JSON crudo.
function resolveExistingUploadPath(storedPath: string | null): string | null {
  if (!storedPath) {
    return null;
  }

  const relative = storedPath.replace(/^\/?uploads\//, '');
  const absolute = path.join(uploadsRootPath, relative);
  return fs.existsSync(absolute) ? storedPath : null;
}

function toSaleDto(sale: NonNullable<Awaited<ReturnType<typeof getSaleByIdInternal>>>) {
  const detalle = sale.DetalleVenta
    .filter((detail) => sale.Anulado || !detail.Anulado)
    .map((detail) => ({
    id: detail.Id,
    idVenta: detail.IdVenta,
    idInventarioItem: detail.IdInventarioItem,
    nombre: detail.Nombre,
    cantidad: detail.Cantidad,
    precioUnitario: toNumber(detail.PrecioUnitario),
    esBonificacion: detail.EsBonificacion,
    subtotal: Number((detail.Cantidad * toNumber(detail.PrecioUnitario)).toFixed(2)),
    envases: detail.Envases.map((allocation) => ({
      id: allocation.Id,
      idInventarioItemEnvase: allocation.IdInventarioItemEnvase,
      nombre: allocation.InventarioItemEnvase.Nombre,
      modo: allocation.Modo,
      cantidad: allocation.Cantidad,
    })),
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
    anulado: false,
    fechaAnulacion: null,
    estado: 'REGISTRADO',
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
  const saldo = sale.Anulado ? 0 : Number(Math.max(0, totals.total - totalPagado).toFixed(2));

  return {
    id: sale.Id,
    idCliente: sale.IdCliente,
    idUsuario: sale.IdUsuario,
    idEmpleadoVendedor: sale.IdEmpleadoVendedor,
    fechaVentaEfectiva: sale.FechaVentaEfectiva,
    idRutaSesion: sale.IdRutaSesion,
    origenInventario: sale.IdRutaSesion ? 'RUTA' : 'PLANTA',
    idTalonario: sale.IdTalonario,
    numeroVenta: sale.NumeroVenta,
    numeroProForma: sale.NumeroProForma,
    tipoRegistro: sale.TipoRegistro,
    reservaProforma: sale.ReservaProforma
      ? {
          estado: sale.ReservaProforma.Estado,
          fechaExpiracion: sale.ReservaProforma.FechaExpiracion,
          fechaConsumo: sale.ReservaProforma.FechaConsumo,
          fechaLiberacion: sale.ReservaProforma.FechaLiberacion,
          motivoLiberacion: sale.ReservaProforma.MotivoLiberacion,
        }
      : null,
    devolucionesComerciales: (sale.DevolucionesComerciales ?? []).map((commercialReturn) => ({
      id: commercialReturn.Id,
      idUsuarioAutorizacion: commercialReturn.IdUsuarioAutorizacion,
      usuarioAutorizacion: {
        id: commercialReturn.UsuarioAutorizacion.Id,
        nombre: commercialReturn.UsuarioAutorizacion.Nombre,
      },
      fechaAutorizacion: commercialReturn.FechaAutorizacion,
      detalle: commercialReturn.Detalles.map((detail) => ({
        id: detail.Id,
        idDetalleVenta: detail.IdDetalleVenta,
        nombreProducto: detail.DetalleVenta.Nombre,
        cantidad: detail.Cantidad,
        motivo: detail.Motivo,
        condicionFisica: detail.CondicionFisica,
        ubicacionNoVendible: detail.UbicacionNoVendible,
      })),
    })),
    estadoEntrega: sale.EstadoEntrega,
    condicionPago: sale.CondicionPago,
    estadoPago: sale.EstadoPago,
    requiereFactura: sale.RequiereFactura,
    autorizacionFel: sale.AutorizacionFel,
    numeroFel: sale.NumeroFel,
    serieFel: sale.SerieFel,
    qrFel: sale.QrFel,
    rutaPdfFel: resolveExistingUploadPath(sale.RutaPdfFel),
    fechaEmisionFel: sale.FechaEmisionFel,
    rutaPdfFelAnulacion: resolveExistingUploadPath(sale.RutaPdfFelAnulacion),
    fechaAnulacionFel: sale.FechaAnulacionFel,
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
    },
    usuario: {
      id: sale.Usuario.Id,
      nombre: sale.Usuario.Nombre,
      correo: sale.Usuario.Correo,
    },
    empleadoVendedor: sale.EmpleadoVendedor
      ? {
          id: sale.EmpleadoVendedor.Id,
          nombre: sale.EmpleadoVendedor.Entidad.NombreCompleto,
        }
      : null,
    rutaSesion: sale.RutaSesion
      ? {
          id: sale.RutaSesion.Id,
          idVehiculo: sale.RutaSesion.IdVehiculo,
          idUsuarioVendedor: sale.RutaSesion.IdUsuarioVendedor,
          idUsuarioChofer: sale.RutaSesion.IdUsuarioChofer,
          idEmpleadoVendedor: sale.RutaSesion.IdEmpleadoVendedor,
          estado: sale.RutaSesion.Estado,
          fechaSesion: sale.RutaSesion.FechaSesion,
          vehiculo: {
            id: sale.RutaSesion.Vehiculo.Id,
            placa: sale.RutaSesion.Vehiculo.Placa,
          },
          vendedor: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado
            ? {
                id: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado.Id,
                nombre: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado.Entidad.NombreCompleto,
              }
            : sale.RutaSesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario
              ? {
                  id: sale.RutaSesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Id,
                  nombre: sale.RutaSesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Nombre,
                }
              : null,
          chofer: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoChoferToEmpleado
            ? {
                id: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoChoferToEmpleado.Id,
                nombre: sale.RutaSesion.Empleado_RutaSesion_IdEmpleadoChoferToEmpleado.Entidad.NombreCompleto,
              }
            : sale.RutaSesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario
              ? {
                  id: sale.RutaSesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Id,
                  nombre: sale.RutaSesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Nombre,
                }
              : null,
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
  if (
    !Number.isFinite(payment.monto) ||
    payment.monto <= 0 ||
    payment.monto > 99_999_999.99 ||
    !Number.isInteger(Number((payment.monto * 100).toFixed(8)))
  ) {
    throw new Error('Monto inválido: debe ser positivo, con máximo dos decimales y dentro del rango permitido');
  }

  const referenceMethods = ['TRANSFERENCIA', 'CHEQUE', 'POS'];
  if (referenceMethods.includes(payment.metodoPago) && !payment.numeroReferencia) {
    throw new Error('numeroReferencia es obligatoria para este método de pago');
  }

  if ((payment.metodoPago === 'TRANSFERENCIA' || payment.metodoPago === 'CHEQUE') && !payment.banco) {
    throw new Error('banco es obligatorio para este método de pago');
  }
}

export async function listSales(input: ListSalesInput, actor?: OperationalActor) {
  const { page, limit, skip } = resolvePagination(input);
  const visibilityWhere = actor ? getSaleVisibilityWhere(actor) : undefined;

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
    ...(visibilityWhere ? { AND: [visibilityWhere] } : {}),
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
          },
        },
        Usuario: {
          select: {
            Id: true,
            Nombre: true,
            Correo: true,
          },
        },
        EmpleadoVendedor: {
          select: {
            Id: true,
            Entidad: { select: { NombreCompleto: true } },
          },
        },
        RutaSesion: {
          select: {
            Id: true,
            IdVehiculo: true,
            IdUsuarioVendedor: true,
            IdUsuarioChofer: true,
            IdEmpleadoChofer: true,
            IdEmpleadoVendedor: true,
            Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
              select: {
                Id: true,
                Entidad: { select: { NombreCompleto: true } },
              },
            },
            Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
              select: {
                Id: true,
                Entidad: { select: { NombreCompleto: true } },
              },
            },
            Estado: true,
            FechaSesion: true,
            Vehiculo: {
              select: { Id: true, Placa: true },
            },
            Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
              select: { Id: true, Nombre: true },
            },
            Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
              select: { Id: true, Nombre: true },
            },
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
            Envases: {
              include: {
                InventarioItemEnvase: { select: { Id: true, Nombre: true } },
              },
            },
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
        ReservaProforma: {
          select: {
            Estado: true,
            FechaExpiracion: true,
            FechaConsumo: true,
            FechaLiberacion: true,
            MotivoLiberacion: true,
          },
        },
        DevolucionesComerciales: {
          include: {
            UsuarioAutorizacion: {
              select: { Id: true, Nombre: true },
            },
            Detalles: {
              include: {
                DetalleVenta: {
                  select: { Id: true, Nombre: true },
                },
              },
            },
          },
          orderBy: { FechaAutorizacion: 'desc' },
        },
      },
    }),
  ]);

  return {
    items: rows.map(toSaleDto),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getSaleById(id: number, actor?: OperationalActor) {
  if (actor) await assertSaleAccess(prisma, id, actor);
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

// El proveedor FEL (sobre todo en el entorno de pruebas de Ecofactura) puede devolver un
// documento ya certificado anteriormente en lugar de uno nuevo: mismo UUID/Serie/Numero y una
// FechaCertificacion muy anterior al momento real de la operación. Si se acepta esa respuesta
// tal cual, la venta nueva queda con los datos (y el PDF) de una factura distinta e incluso ya
// anulada. Esta validación rechaza la emisión antes de persistirla para no corromper la venta.
const MAX_FEL_CERTIFICATION_DRIFT_MS = 24 * 60 * 60 * 1000; // 24 horas

async function assertFreshFelEmission(
  tx: Prisma.TransactionClient,
  felResult: { autorizacionFel: string; fechaEmisionFel: Date },
  fechaOperacion: Date,
  excludeIdVenta: number,
) {
  const duplicate = await tx.venta.findFirst({
    where: {
      AutorizacionFel: felResult.autorizacionFel,
      NOT: { Id: excludeIdVenta },
    },
    select: { Id: true, NumeroVenta: true },
  });

  if (duplicate) {
    throw new Error(
      `FEL: El proveedor devolvió un documento (UUID ${felResult.autorizacionFel}) ya asociado a la venta #${duplicate.NumeroVenta}; no se completó la emisión para evitar datos duplicados. Intente nuevamente.`,
    );
  }

  const driftMs = Math.abs(fechaOperacion.getTime() - felResult.fechaEmisionFel.getTime());
  if (driftMs > MAX_FEL_CERTIFICATION_DRIFT_MS) {
    throw new Error(
      `FEL: El proveedor devolvió una fecha de certificación (${felResult.fechaEmisionFel.toISOString()}) muy distinta al momento real de esta venta; parece un documento desactualizado o reutilizado. No se completó la emisión; intente nuevamente.`,
    );
  }
}

export async function createSale(
  input: CreateSaleInput,
  claveSolicitud: string = crypto.randomUUID(),
  actor?: OperationalActor,
) {
  const huellaSolicitud = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
  const existingRequest = await prisma.venta.findUnique({
    where: { ClaveSolicitud: claveSolicitud },
    select: { Id: true, IdUsuario: true, HuellaSolicitud: true },
  });
  if (existingRequest) {
    if (
      existingRequest.IdUsuario !== input.idUsuario ||
      existingRequest.HuellaSolicitud !== huellaSolicitud
    ) {
      throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
    }
    return getSaleById(existingRequest.Id, actor);
  }

  await validateUsuarioExists(input.idUsuario);
  const cliente = await getClienteActivo(input.idCliente);

  if (input.idRutaSesion) {
    await validateRutaSesionActiva(input.idRutaSesion);
  }

  if (input.pagoInicial) {
    validatePaymentRules(input.pagoInicial);
  }

  const isRouteProforma = Boolean(input.idRutaSesion && input.tipoRegistro === 'PROFORMA');
  const proformaExpiration = input.fechaExpiracionProforma
    ? new Date(input.fechaExpiracionProforma)
    : null;
  if (isRouteProforma && (!proformaExpiration || !Number.isFinite(proformaExpiration.getTime()) || proformaExpiration <= new Date())) {
    throw new Error('La fecha de expiración de la proforma debe ser futura');
  }

  let created: ReturnType<typeof toSaleDto>;
  const emittedFelResults: Array<{
    saleId: number;
    uuid: string;
    serie: string;
    numero: string;
    fechaCertificacion: Date;
  }> = [];
  try {
    created = await prisma.$transaction(
    async (tx) => {
      const fechaOperacion = new Date();
      const priorRequest = await tx.venta.findUnique({
        where: { ClaveSolicitud: claveSolicitud },
        select: { Id: true, IdUsuario: true, HuellaSolicitud: true },
      });
      if (priorRequest) {
        if (
          priorRequest.IdUsuario !== input.idUsuario ||
          priorRequest.HuellaSolicitud !== huellaSolicitud
        ) {
          throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
        }
        const replay = await getSaleByIdInternal(tx, priorRequest.Id, true);
        if (!replay) throw new Error('No se pudo recuperar la venta asociada a la clave de idempotencia');
        return toSaleDto(replay);
      }
      if (isRouteProforma && proformaExpiration! <= fechaOperacion) {
        throw new Error('La fecha de expiración de la proforma debe ser futura');
      }
      if (input.idRutaSesion && actor) {
        await assertRouteSessionAccess(tx, input.idRutaSesion, actor);
      }
      const rutaSesion = input.idRutaSesion
        ? await tx.rutaSesion.findFirst({
            where: { Id: input.idRutaSesion, Anulado: false },
            select: { IdEmpleadoVendedor: true },
          })
        : null;
      if (input.idRutaSesion && !rutaSesion) {
        throw new Error('RutaSesion no existe');
      }
      if (
        rutaSesion?.IdEmpleadoVendedor !== null &&
        rutaSesion?.IdEmpleadoVendedor !== undefined &&
        input.idEmpleadoVendedor !== undefined &&
        rutaSesion.IdEmpleadoVendedor !== input.idEmpleadoVendedor
      ) {
        throw new Error('El vendedor de la venta debe coincidir con el empleado asignado a la sesión');
      }
      const idEmpleadoVendedor = rutaSesion?.IdEmpleadoVendedor ?? input.idEmpleadoVendedor ?? null;
      if (idEmpleadoVendedor !== null) {
        const empleadoVendedor = await tx.empleado.findFirst({
          where: {
            Id: idEmpleadoVendedor,
            Anulado: false,
            FechaContratacion: { lte: fechaOperacion },
            OR: [{ FechaSalida: null }, { FechaSalida: { gte: fechaOperacion } }],
          },
          select: { Id: true },
        });
        if (!empleadoVendedor) {
          throw new Error('Vendedor no tiene empleado activo vinculado');
        }
      }
      if (input.tipoRegistro === 'VENTA' && input.condicionPago === 'CREDITO') {
        await validateClienteCreditoHabilitado(tx, input.idCliente);
        const condicionCredito = await getClienteCondicionCreditoVigente(
          tx,
          input.idCliente,
          fechaOperacion,
        );
        if (!condicionCredito) {
          throw new Error('Cliente no habilitado para crédito');
        }
      }
      const numeroVenta = await getNextNumeroVenta(tx);

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
          esVendible: boolean;
          esEnvaseRetornable: boolean;
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
              EsVendible: true,
              EsEnvaseRetornable: true,
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
            esVendible: item.EsVendible,
            esEnvaseRetornable: item.EsEnvaseRetornable,
          });
        }
      }

      for (const detail of mergedDetails) {
        const item = itemCache.get(detail.idInventarioItem);
        if (!item) throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
        if (!item.esVendible) {
          throw new Error(`El artículo ${item.nombre} no está habilitado para la venta`);
        }
        if (item.esEnvaseRetornable) {
          if (!detail.estadoEnvase) {
            throw new Error(`Indica si el envase vendido (${item.nombre}) estaba vacío o lleno`);
          }
          if (!Number.isInteger(detail.cantidad)) {
            throw new Error(`La cantidad de envases vendidos para ${item.nombre} debe ser entera`);
          }
          if (input.tipoRegistro === 'VENTA' && !detail.modoEnvase) {
            throw new Error(`Indica si el envase de ${item.nombre} es propio del cliente o préstamo de la empresa`);
          }
          if (detail.modoEnvase && input.tipoRegistro !== 'VENTA') {
            throw new Error(`La custodia del envase solo se define al confirmar la venta de ${item.nombre}`);
          }
        } else if (detail.estadoEnvase) {
          throw new Error(`El artículo ${item.nombre} no es un envase retornable`);
        } else if (detail.modoEnvase) {
          throw new Error(`El artículo ${item.nombre} no tiene custodia de envase retornable`);
        }
      }

      const requiredByItem = new Map<number, number>();
      const requiredProductStockByItem = new Map<number, number>();
      for (const detail of mergedDetails) {
        const current = requiredByItem.get(detail.idInventarioItem) ?? 0;
        requiredByItem.set(detail.idInventarioItem, Number((current + detail.cantidad).toFixed(2)));
        const product = itemCache.get(detail.idInventarioItem);
        if (!product || !product.esEnvaseRetornable || detail.estadoEnvase === 'LLENO') {
          const required = requiredProductStockByItem.get(detail.idInventarioItem) ?? 0;
          requiredProductStockByItem.set(
            detail.idInventarioItem,
            Number((required + detail.cantidad).toFixed(2)),
          );
        }
      }

      for (const [idItem, requiredQty] of requiredProductStockByItem) {
        const item = itemCache.get(idItem);
        if (!item) {
          throw new Error(`InventarioItem ${idItem} no existe o está anulado`);
        }

        if (input.idRutaSesion && (input.tipoRegistro === 'VENTA' || input.tipoRegistro === 'PROFORMA')) {
          continue;
        }

        if (item.existencia < requiredQty) {
          throw new Error(
            `Stock insuficiente para ${item.nombre}. Existencia actual ${item.existencia}, requerida ${requiredQty}`,
          );
        }
      }

      const routeAvailableByItem =
        input.idRutaSesion && (input.tipoRegistro === 'VENTA' || input.tipoRegistro === 'PROFORMA')
          ? await getRouteAvailableQuantities(tx, input.idRutaSesion)
          : null;

      if (routeAvailableByItem) {
        for (const [idItem, requiredQty] of requiredByItem) {
          const item = itemCache.get(idItem);
          const available = routeAvailableByItem.get(idItem);
          if (!item) {
            throw new Error(`InventarioItem ${idItem} no existe o está anulado`);
          }
          if (available === undefined) {
            throw new Error(`El producto ${item.nombre} no forma parte del despacho de la ruta`);
          }
          if (available + 0.009 < requiredQty) {
            throw new Error(
              `Existencia insuficiente en el vehículo para ${item.nombre}. Disponible ${available}, requerida ${requiredQty}`,
            );
          }
        }
      }

      const detailRows: Array<{
        idInventarioItem: number;
        nombre: string;
        cantidad: number;
        precioUnitario: number;
        esBonificacion: boolean;
        estadoEnvase?: 'VACIO' | 'LLENO';
        modoEnvase?: 'CLIENTE_PROPIO' | 'PRESTAMO_EMPRESA';
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
          estadoEnvase: detail.estadoEnvase,
          modoEnvase: detail.modoEnvase,
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

      const condicionCreditoAplicada =
        input.tipoRegistro === 'VENTA' && input.condicionPago === 'CREDITO'
          ? await authorizeCustomerCreditSale(
              tx,
              input.idCliente,
              Number(Math.max(0, totals.total - totalPagoInicial).toFixed(2)),
              fechaOperacion,
            )
          : null;

      const estadoPago = getPaymentState(totals.total, totalPagoInicial);

      const createdSale = await tx.venta.create({
        data: {
          IdCliente: input.idCliente,
          IdUsuario: input.idUsuario,
          IdRutaSesion: input.idRutaSesion,
          IdEmpleadoVendedor: idEmpleadoVendedor,
          FechaVentaEfectiva: input.tipoRegistro === 'VENTA' ? fechaOperacion : null,
          IdTalonario: input.idTalonario,
          NumeroVenta: numeroVenta,
          ClaveSolicitud: claveSolicitud,
          HuellaSolicitud: huellaSolicitud,
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

      const reservedDetailRows: Array<{ idDetalleVenta: number; cantidad: number }> = [];
      for (const detail of detailRows) {
        const createdDetail = await tx.detalleVenta.create({
          data: {
            IdVenta: createdSale.Id,
            IdInventarioItem: detail.idInventarioItem,
            Nombre: detail.nombre,
            Cantidad: detail.cantidad,
            PrecioUnitario: detail.precioUnitario,
            EstadoEnvase: detail.estadoEnvase ?? null,
            EsBonificacion: detail.esBonificacion,
            Anulado: false,
          },
          select: { Id: true },
        });

        if (isRouteProforma) {
          reservedDetailRows.push({
            idDetalleVenta: createdDetail.Id,
            cantidad: detail.cantidad,
          });
        }

        const item = itemCache.get(detail.idInventarioItem);
        if (!item) {
          throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
        }

        if (item.esEnvaseRetornable && !input.idRutaSesion) {
          await ensurePlantEnvaseBucketQuantity(tx, {
            idInventarioItem: item.id,
            idUsuario: input.idUsuario,
            estado: detail.estadoEnvase!,
            cantidad: detail.cantidad,
            nombre: `Venta #${createdSale.NumeroVenta} - ${detail.nombre}`,
            tipoDocumento: 'VEN',
            documento: createdSale.Id.toString(),
          });
        }

        const changesSellableStock = !item.esEnvaseRetornable || detail.estadoEnvase === 'LLENO';
        if (
          changesSellableStock &&
          !(input.idRutaSesion && (input.tipoRegistro === 'VENTA' || input.tipoRegistro === 'PROFORMA'))
        ) {
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

        if (item.esEnvaseRetornable && !isRouteProforma) {
          let idMovimientoEnvase: number | undefined;
          if (input.tipoRegistro === 'VENTA') {
            const detailEnvase = await tx.detalleVentaEnvase.create({
              data: {
                IdDetalleVenta: createdDetail.Id,
                IdInventarioItemEnvase: item.id,
                Modo: detail.modoEnvase!,
                Cantidad: detail.cantidad,
              },
              select: { Id: true },
            });

            if (detail.modoEnvase === 'PRESTAMO_EMPRESA') {
              const saldoExistente = await tx.envaseClienteSaldo.findFirst({
                where: { IdCliente: input.idCliente, IdInventarioItem: item.id },
                select: { Id: true, CantidadPrestada: true },
              });
              const saldoAnterior = saldoExistente?.CantidadPrestada ?? 0;
              const saldoNuevo = Number((saldoAnterior + detail.cantidad).toFixed(2));
              if (saldoExistente) {
                await tx.envaseClienteSaldo.update({
                  where: { Id: saldoExistente.Id },
                  data: { CantidadPrestada: saldoNuevo, FechaActualizacion: fechaOperacion },
                });
              } else {
                await tx.envaseClienteSaldo.create({
                  data: {
                    IdCliente: input.idCliente,
                    IdInventarioItem: item.id,
                    CantidadPrestada: saldoNuevo,
                  },
                });
              }
              const movement = await tx.movimientoEnvase.create({
                data: {
                  IdInventarioItem: item.id,
                  IdCliente: input.idCliente,
                  IdVenta: createdSale.Id,
                  IdDetalleVentaEnvase: detailEnvase.Id,
                  IdRutaSesion: input.idRutaSesion,
                  IdUsuario: input.idUsuario,
                  TipoMovimiento: 'PRESTAMO',
                  EstadoEnvase: detail.estadoEnvase,
                  UbicacionEnvase: input.idRutaSesion ? 'RUTA' : 'PLANTA',
                  Cantidad: detail.cantidad,
                  SaldoAnterior: saldoAnterior,
                  SaldoNuevo: saldoNuevo,
                  Observaciones: `Préstamo generado desde venta #${createdSale.NumeroVenta}`,
                  Anulado: false,
                },
                select: { Id: true },
              });
              idMovimientoEnvase = movement.Id;
            }
          }

          const sourceBucket = {
            ubicacion: input.idRutaSesion ? 'RUTA' as const : 'PLANTA' as const,
            estado: detail.estadoEnvase!,
            ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
          };
          await registerEnvaseBucketChange(tx, {
            idInventarioItem: item.id,
            idUsuario: input.idUsuario,
            bucket: sourceBucket,
            cantidad: detail.cantidad,
            entrada: false,
            nombre: `Venta directa de envase #${createdSale.NumeroVenta} - ${detail.nombre}`,
            tipoDocumento: 'VEN',
            documento: createdSale.Id.toString(),
            idRutaSesion: input.idRutaSesion,
            idDetalleVenta: createdDetail.Id,
            idMovimientoEnvase,
          });
        }
      }

      if (isRouteProforma) {
        if (proformaExpiration! <= new Date()) {
          throw new Error('La fecha de expiración de la proforma debe ser futura');
        }
        await tx.reservaProforma.create({
          data: {
            IdVenta: createdSale.Id,
            IdUsuario: input.idUsuario,
            FechaExpiracion: proformaExpiration!,
            Detalles: {
              create: reservedDetailRows.map((detail) => ({
                IdDetalleVenta: detail.idDetalleVenta,
                CantidadReservada: detail.cantidad,
              })),
            },
          },
        });
      }

      if (input.pagoInicial && totalPagoInicial > 0) {
        const initialPaymentDate = input.pagoInicial.fechaPago
          ? toDateOnly(input.pagoInicial.fechaPago)
          : new Date();
        const initialPayment = await tx.pagoVenta.create({
          data: {
            IdVenta: createdSale.Id,
            IdUsuario: input.idUsuario,
            Monto: totalPagoInicial,
            MetodoPago: input.pagoInicial.metodoPago,
            NumeroReferencia: input.pagoInicial.numeroReferencia,
            Banco: input.pagoInicial.banco,
            FechaPago: initialPaymentDate,
            RutaFirma: input.pagoInicial.rutaFirma,
            Observaciones: input.pagoInicial.observaciones,
            Anulado: false,
          },
          select: { Id: true },
        });
        if (['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS'].includes(input.pagoInicial.metodoPago)) {
          await recordCashPaymentMovement(tx, {
            idUsuario: input.idUsuario,
            metodoPago: input.pagoInicial.metodoPago as 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'POS',
            monto: totalPagoInicial,
            fecha: initialPaymentDate,
            source: 'PAGO_VENTA',
            sourceId: initialPayment.Id,
            concepto: `Cobro inicial de venta #${createdSale.NumeroVenta}`,
          });
        }
      }

      if (input.tipoRegistro === 'VENTA' && input.condicionPago === 'CREDITO') {
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
            FechaVencimiento: getCreditDueDate(
              fechaOperacion,
              condicionCreditoAplicada?.TipoCredito.PlazoDias ?? null,
            ),
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

        await assertFreshFelEmission(tx, felResult, fechaOperacion, createdSale.Id);

        emittedFelResults.push({
          saleId: createdSale.Id,
          uuid: felResult.autorizacionFel,
          serie: felResult.serieFel,
          numero: felResult.numeroFel,
          fechaCertificacion: felResult.fechaEmisionFel,
        });

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

      if (input.tipoRegistro === 'VENTA') {
        await accrueMonthlyCommissionsForSale(tx, createdSale.Id, input.idUsuario);
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
  } catch (error) {
    const emittedFel = emittedFelResults[0];
    if (emittedFel) {
      console.error(JSON.stringify({
        event: 'fel.persistence',
        operation: 'emission',
        saleId: emittedFel.saleId,
        outcome: 'transaction_failed_after_provider_confirmation',
        uuid: emittedFel.uuid,
        serie: emittedFel.serie,
        numero: emittedFel.numero,
        providerDate: emittedFel.fechaCertificacion.toISOString(),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
      }));
    }

    const racedRequest = await prisma.venta.findUnique({
      where: { ClaveSolicitud: claveSolicitud },
      select: { Id: true, IdUsuario: true, HuellaSolicitud: true },
    });
    if (racedRequest) {
      if (
        racedRequest.IdUsuario !== input.idUsuario ||
        racedRequest.HuellaSolicitud !== huellaSolicitud
      ) {
        throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
      }
      return getSaleById(racedRequest.Id);
    }
    throw error;
  }

  const emittedFel = emittedFelResults[0];
  if (emittedFel) {
    console.info(JSON.stringify({
      event: 'fel.persistence',
      operation: 'emission',
      saleId: emittedFel.saleId,
      outcome: 'persisted',
      uuid: emittedFel.uuid,
      serie: emittedFel.serie,
      numero: emittedFel.numero,
      providerDate: emittedFel.fechaCertificacion.toISOString(),
    }));
  }

  // Efecto secundario: la venta ya quedó confirmada en la transacción anterior.
  // Un fallo de n8n/Telegram nunca debe afectar la operación de negocio ya exitosa.
  notifyPedidoCreado(created);

  if (created.autorizacionFel && created.numeroFel && created.serieFel) {
    notifyFacturaEmitida(created);
  }

  return created;
}

export async function confirmRouteProforma(
  id: number,
  idUsuario: number,
  actor?: OperationalActor,
) {
  await validateUsuarioExists(idUsuario);
  await processExpiredProformaReservations();

  return prisma.$transaction(
    async (tx) => {
      const sale = await tx.venta.findFirst({
        where: { Id: id, Anulado: false },
        select: {
          Id: true,
          IdCliente: true,
          IdRutaSesion: true,
          TipoRegistro: true,
          CondicionPago: true,
          ReservaProforma: {
            select: {
              Id: true,
              Estado: true,
              FechaExpiracion: true,
            },
          },
        },
      });

      if (!sale) {
        throw new Error('Venta no existe o está anulada');
      }
      if (actor) await assertSaleAccess(tx, id, actor);
      if (sale.TipoRegistro !== 'PROFORMA' || !sale.IdRutaSesion) {
        throw new Error('Solo se pueden confirmar proformas asociadas a una sesión de ruta');
      }
      if (!sale.ReservaProforma) {
        throw new Error('La proforma no tiene una reserva de inventario de ruta');
      }
      if (sale.ReservaProforma.Estado !== 'ACTIVA' || sale.ReservaProforma.FechaExpiracion <= new Date()) {
        throw new Error('La reserva de la proforma ya no está activa o venció');
      }

      const paymentStatus = await recalculateSalePaymentStatus(tx, id);
      const condicionCreditoAplicada =
        sale.CondicionPago === 'CREDITO'
          ? await authorizeCustomerCreditSale(
              tx,
              sale.IdCliente,
              paymentStatus.saldo,
              new Date(),
              id,
            )
          : null;

      await getRouteAvailableQuantities(tx, sale.IdRutaSesion);

      const now = new Date();
      const consumed = await tx.reservaProforma.updateMany({
        where: {
          Id: sale.ReservaProforma.Id,
          Estado: 'ACTIVA',
          FechaExpiracion: { gt: now },
        },
        data: {
          Estado: 'CONSUMIDA',
          FechaConsumo: now,
          IdUsuarioConsumo: idUsuario,
        },
      });
      if (consumed.count !== 1) {
        throw new Error('La reserva de la proforma cambió de estado; vuelva a consultar la venta');
      }

      const updated = await tx.venta.updateMany({
        where: {
          Id: id,
          IdRutaSesion: sale.IdRutaSesion,
          TipoRegistro: 'PROFORMA',
          Anulado: false,
        },
        data: {
          TipoRegistro: 'VENTA',
          FechaVentaEfectiva: now,
          IdUsuarioModificador: idUsuario,
          FechaModificacion: now,
        },
      });
      if (updated.count !== 1) {
        throw new Error('La proforma cambió de estado; vuelva a consultar la venta');
      }

      if (condicionCreditoAplicada) {
        const existingAccount = await tx.cuentaPorCobrar.findUnique({
          where: { IdVenta: id },
          select: { Id: true },
        });
        if (!existingAccount) {
          const estadoCxC = getCuentaPorCobrarEstadoBySaldo(paymentStatus.saldo);
          await tx.cuentaPorCobrar.create({
            data: {
              IdVenta: id,
              IdTipoCreditoAplicado: condicionCreditoAplicada.IdTipoCredito,
              IdClienteCondicionCreditoAplicada: condicionCreditoAplicada.Id,
              IdUsuarioCreacion: idUsuario,
              TotalOriginal: paymentStatus.total,
              Estado: estadoCxC,
              FechaVencimiento: getCreditDueDate(
                new Date(),
                condicionCreditoAplicada.TipoCredito.PlazoDias,
              ),
              FechaLiquidacion: estadoCxC === 'PAGADO' ? new Date() : null,
              Anulado: false,
            },
          });
        }
      }

      await accrueMonthlyCommissionsForSale(tx, id, idUsuario);
      const convertedSale = await getSaleByIdInternal(tx, id, true);
      if (!convertedSale) {
        throw new Error('No se pudo confirmar la proforma');
      }

      return toSaleDto(convertedSale);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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
  if (
    input.estadoEntrega !== undefined &&
    ['PARCIAL', 'ENTREGADO'].includes(input.estadoEntrega) &&
    input.estadoEntrega !== sale.EstadoEntrega
  ) {
    throw new Error(
      'No se puede registrar una entrega parcial o total sin persistir las cantidades realmente recibidas',
    );
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
          EstadoEnvase: true,
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

  if (await prisma.devolucionComercial.findFirst({
    where: { IdVenta: sale.Id },
    select: { Id: true },
  })) {
    throw new Error('No se puede anular una venta que tiene devoluciones comerciales autorizadas');
  }

  if (sale.IdRutaSesion && sale.TipoRegistro === 'VENTA') {
    const routeDispatch = await prisma.despachoRuta.findFirst({
      where: { IdRutaSesion: sale.IdRutaSesion, Anulado: false },
      select: { Id: true },
    });
    if (routeDispatch) {
      const route = await prisma.rutaSesion.findFirst({
        where: { Id: sale.IdRutaSesion },
        select: { Estado: true },
      });
      const routeReturn = await prisma.devolucionRuta.findFirst({
        where: { IdRutaSesion: sale.IdRutaSesion, Anulado: false },
        select: { Id: true },
      });
      if (route?.Estado === 'CERRADA' || routeReturn) {
        throw new Error('No se puede anular una venta después de liquidar o recibir la ruta');
      }
    }
  }

  let felAnulacion: Awaited<ReturnType<typeof anulateFelInvoice>> | null = null;

  if (sale.RequiereFactura) {
    if (!sale.AutorizacionFel || !sale.SerieFel || !sale.NumeroFel) {
      throw new Error('FEL: No se puede anular la venta porque faltan los identificadores de la factura certificada');
    }

    if (sale.FechaAnulacionFel) {
      felAnulacion = {
        confirmada: true,
        fechaAnulacionFel: sale.FechaAnulacionFel,
        rutaPdfFel: sale.RutaPdfFelAnulacion,
        yaAnuladoEnProveedor: false,
      };
    } else {
      felAnulacion = await anulateFelInvoice({
        idVenta: sale.Id,
        numeroVenta: sale.NumeroVenta,
        autorizacionFel: sale.AutorizacionFel,
        serieFel: sale.SerieFel,
        numeroFel: sale.NumeroFel,
        motivo: `ANULACION VENTA ${sale.NumeroVenta}`,
        fechaAnulacion: new Date(),
      });

      if (felAnulacion.confirmada && felAnulacion.fechaAnulacionFel) {
        let savedConfirmation: { count: number };
        try {
          savedConfirmation = await prisma.venta.updateMany({
            where: { Id: sale.Id, Anulado: false, FechaAnulacionFel: null },
            data: {
              FechaAnulacionFel: felAnulacion.fechaAnulacionFel,
              RutaPdfFelAnulacion: felAnulacion.rutaPdfFel,
            },
          });
        } catch (error) {
          console.error(JSON.stringify({
            event: 'fel.persistence',
            operation: 'annulment',
            saleId: sale.Id,
            outcome: 'provider_confirmed_local_persistence_failed',
            uuid: sale.AutorizacionFel,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
          }));
          throw new Error('FEL: Ecofacturas confirmó la anulación, pero no se pudo guardar la confirmación local');
        }

        if (savedConfirmation.count !== 1) {
          const currentSale = await prisma.venta.findUnique({
            where: { Id: sale.Id },
            select: {
              Anulado: true,
              FechaAnulacionFel: true,
              RutaPdfFelAnulacion: true,
            },
          });
          if (!currentSale?.FechaAnulacionFel) {
            throw new Error('FEL: Ecofacturas confirmó la anulación, pero no se pudo guardar la confirmación local');
          }
          felAnulacion = {
            confirmada: true,
            fechaAnulacionFel: currentSale.FechaAnulacionFel,
            rutaPdfFel: currentSale.RutaPdfFelAnulacion,
            yaAnuladoEnProveedor: felAnulacion.yaAnuladoEnProveedor,
          };
        }

        console.info(JSON.stringify({
          event: 'fel.persistence',
          operation: 'annulment',
          saleId: sale.Id,
          outcome: 'provider_confirmation_persisted',
          uuid: sale.AutorizacionFel,
          serie: sale.SerieFel,
          numero: sale.NumeroFel,
          providerDate: felAnulacion.fechaAnulacionFel?.toISOString() ?? null,
        }));
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const saleToAnulate = await tx.venta.findFirst({
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
            EstadoEnvase: true,
          },
        },
        ReservaProforma: {
          select: { Id: true },
        },
      },
    });

    if (!saleToAnulate) {
      throw new Error('Venta no existe o ya está anulada');
    }

    if (await tx.devolucionComercial.findFirst({
      where: { IdVenta: saleToAnulate.Id },
      select: { Id: true },
    })) {
      throw new Error('No se puede anular una venta que tiene devoluciones comerciales autorizadas');
    }

    const fechaAnulacion = new Date();

    const routeDispatch =
      saleToAnulate.IdRutaSesion && saleToAnulate.TipoRegistro === 'VENTA'
        ? await tx.despachoRuta.findFirst({
            where: { IdRutaSesion: saleToAnulate.IdRutaSesion, Anulado: false },
            select: { Id: true },
          })
        : null;
    const saleWasDeductedFromRoute = Boolean(routeDispatch);
    const isReservedRouteProforma =
      Boolean(saleToAnulate.IdRutaSesion) &&
      saleToAnulate.TipoRegistro === 'PROFORMA' &&
      Boolean(saleToAnulate.ReservaProforma);
    if (saleWasDeductedFromRoute) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: saleToAnulate.IdRutaSesion! },
        select: { Estado: true },
      });
      const routeReturn = await tx.devolucionRuta.findFirst({
        where: { IdRutaSesion: saleToAnulate.IdRutaSesion!, Anulado: false },
        select: { Id: true },
      });
      if (route?.Estado === 'CERRADA' || routeReturn) {
        throw new Error('No se puede anular una venta después de liquidar o recibir la ruta');
      }
    }

    const saleEnvaseMovements = await tx.movimientoEnvase.findMany({
      where: {
        IdVenta: saleToAnulate.Id,
        TipoMovimiento: 'PRESTAMO',
        Anulado: false,
      },
      select: {
        Id: true,
        IdCliente: true,
        IdInventarioItem: true,
      },
      orderBy: { Id: 'asc' },
    });

    for (const movement of saleEnvaseMovements) {
      if (movement.IdCliente === null) {
        throw new Error('No se puede anular una venta con préstamos de envase sin cliente asociado');
      }

      const laterCustodyChange = await tx.movimientoEnvase.findFirst({
        where: {
          IdCliente: movement.IdCliente,
          IdInventarioItem: movement.IdInventarioItem,
          Id: { gt: movement.Id },
          TipoMovimiento: { in: ['DEVOLUCION', 'DEVOLUCION_DANADA', 'PERDIDA'] },
          Anulado: false,
        },
        select: { Id: true },
      });
      if (laterCustodyChange) {
        throw new Error(
          'No se puede anular una venta después de devolver, dañar o declarar perdido un envase prestado por ella',
        );
      }

      await anulateEnvaseMovementInTransaction(
        tx,
        movement.Id,
        idUsuarioAnulador ?? saleToAnulate.IdUsuario,
      );
    }

    if (isReservedRouteProforma && saleToAnulate.ReservaProforma) {
      await tx.reservaProforma.updateMany({
        where: {
          Id: saleToAnulate.ReservaProforma.Id,
          Estado: 'ACTIVA',
        },
        data: {
          Estado: 'LIBERADA',
          FechaLiberacion: fechaAnulacion,
          IdUsuarioLiberacion: idUsuarioAnulador ?? saleToAnulate.IdUsuario,
          MotivoLiberacion: 'CANCELACION',
        },
      });
    }

    for (const detail of saleToAnulate.DetalleVenta) {
      if (isReservedRouteProforma) {
        continue;
      }

      const item = await tx.inventarioItem.findFirst({
        where: {
          Id: detail.IdInventarioItem,
          Anulado: false,
        },
        select: {
          Id: true,
          Existencia: true,
          EsEnvaseRetornable: true,
        },
      });

      if (!item) {
        throw new Error(`InventarioItem ${detail.IdInventarioItem} no existe o está anulado`);
      }

      if (item.EsEnvaseRetornable) {
        if (detail.EstadoEnvase !== 'VACIO' && detail.EstadoEnvase !== 'LLENO') {
          throw new Error(
            `No se puede anular la venta del envase ${detail.Nombre} sin un estado físico verificable`,
          );
        }
        await registerEnvaseBucketChange(tx, {
          idInventarioItem: detail.IdInventarioItem,
          idUsuario: idUsuarioAnulador ?? saleToAnulate.IdUsuario,
          bucket: saleWasDeductedFromRoute
            ? { ubicacion: 'RUTA', estado: detail.EstadoEnvase, idRutaSesion: saleToAnulate.IdRutaSesion! }
            : { ubicacion: 'PLANTA', estado: detail.EstadoEnvase },
          cantidad: detail.Cantidad,
          entrada: true,
          nombre: `Entrada física por anulación venta #${saleToAnulate.NumeroVenta} - ${detail.Nombre}`,
          tipoDocumento: 'VENAN',
          documento: saleToAnulate.Id.toString(),
          idRutaSesion: saleWasDeductedFromRoute ? saleToAnulate.IdRutaSesion! : undefined,
          idDetalleVenta: detail.Id,
        });
      }

      if (
        saleWasDeductedFromRoute ||
        (item.EsEnvaseRetornable && detail.EstadoEnvase !== 'LLENO')
      ) {
        continue;
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
        idUsuario: idUsuarioAnulador ?? saleToAnulate.IdUsuario,
        tipoDocumento: 'VENAN',
        documento: saleToAnulate.Id.toString(),
        nombre: `Entrada por anulación venta #${saleToAnulate.NumeroVenta} - ${detail.Nombre}`,
        tipoMovimiento: true,
        existenciaAnterior,
        cantidad: detail.Cantidad,
        nuevaExistencia,
      });
    }

    await tx.detalleVenta.updateMany({
      where: {
        IdVenta: saleToAnulate.Id,
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
        IdVenta: saleToAnulate.Id,
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
        Id: saleToAnulate.Id,
      },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
      },
    });

    await accrueMonthlyCommissionsForSale(
      tx,
      saleToAnulate.Id,
      idUsuarioAnulador ?? saleToAnulate.IdUsuario,
      false,
    );

    await tx.cuentaPorCobrar.updateMany({
      where: {
        IdVenta: saleToAnulate.Id,
        Anulado: false,
      },
      data: {
        Estado: 'ANULADO',
        MotivoCierre: `ANULACION_VENTA_${saleToAnulate.NumeroVenta}`,
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
        FechaModificacion: fechaAnulacion,
        IdUsuarioModificador: idUsuarioAnulador,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
    if (felAnulacion) {
      console.error(JSON.stringify({
        event: 'fel.persistence',
        operation: 'annulment',
        saleId: sale.Id,
        outcome: 'transaction_failed_after_provider_confirmation',
        uuid: sale.AutorizacionFel,
        serie: sale.SerieFel,
        numero: sale.NumeroFel,
        providerDate: felAnulacion.fechaAnulacionFel?.toISOString() ?? null,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
      }));
    }
    throw error;
  });

  if (felAnulacion) {
    console.info(JSON.stringify({
      event: 'fel.persistence',
      operation: 'annulment',
      saleId: sale.Id,
      outcome: 'persisted',
      uuid: sale.AutorizacionFel,
      serie: sale.SerieFel,
      numero: sale.NumeroFel,
      providerDate: felAnulacion.fechaAnulacionFel?.toISOString() ?? null,
    }));
  }
  // Se notifica solo cuando FEL (si aplicaba) y la transacción de anulación
  // ya terminaron correctamente; nunca entre ambos pasos.
  notifyVentaAnulada({ numeroVenta: sale.NumeroVenta, cliente: sale.Cliente.Entidad.NombreCompleto });
  return {
    anulada: true,
    felAnulacion: felAnulacion
      ? {
          confirmada: felAnulacion.confirmada,
          fechaAnulacionFel: felAnulacion.fechaAnulacionFel,
          rutaPdfFel: felAnulacion.rutaPdfFel,
          yaAnuladoEnProveedor: felAnulacion.yaAnuladoEnProveedor,
        }
      : null,
  };
}

export async function listSalePayments(idVenta: number) {
  const sale = await prisma.venta.findFirst({
    where: {
      Id: idVenta,
    },
    select: { Id: true },
  });

  if (!sale) {
    throw new Error('Venta no existe');
  }

  const payments = await prisma.pagoVenta.findMany({
    where: {
      IdVenta: idVenta,
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
    anulado: payment.Anulado,
    fechaAnulacion: payment.FechaAnulacion,
    estado: payment.Anulado ? 'ANULADO' : 'REGISTRADO',
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
      DevolucionesComerciales: {
        select: {
          Detalles: {
            select: {
              Cantidad: true,
              DetalleVenta: {
                select: { PrecioUnitario: true, EsBonificacion: true },
              },
            },
          },
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
  const returnedTotal = sale.DevolucionesComerciales
    .flatMap((devolucion) => devolucion.Detalles)
    .reduce((sum, detail) => sum + (
      detail.DetalleVenta.EsBonificacion
        ? 0
        : detail.Cantidad * toNumber(detail.DetalleVenta.PrecioUnitario)
    ), 0);
  const netTotal = Number(Math.max(0, totals.total - returnedTotal).toFixed(2));

  const totalPagado = Number(
    sale.PagoVenta.reduce((sum, item) => sum + toNumber(item.Monto), 0).toFixed(2),
  );

  const estadoPago = getPaymentState(netTotal, totalPagado);
  const saldo = Number(Math.max(0, netTotal - totalPagado).toFixed(2));

  await tx.venta.update({
    where: { Id: idVenta },
    data: {
      EstadoPago: estadoPago,
    },
  });

  return {
    total: netTotal,
    totalPagado,
    estadoPago,
    saldo,
  };
}

export async function syncSaleReceivableAfterCommercialReturn(
  tx: Prisma.TransactionClient,
  idVenta: number,
  idUsuarioModificador: number,
) {
  const recalculated = await recalculateSalePaymentStatus(tx, idVenta);
  await syncCuentaPorCobrarFromSale(tx, idVenta, recalculated, idUsuarioModificador);
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

export async function createSalePayment(
  idVenta: number,
  input: CreateSalePaymentInput,
  idempotencyKey: string,
) {
  await validateUsuarioExists(input.idUsuario);
  validatePaymentRules(input);

  const claveHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
  const huellaSolicitud = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      idVenta,
      idUsuario: input.idUsuario,
      monto: input.monto,
      metodoPago: input.metodoPago,
      numeroReferencia: input.numeroReferencia ?? null,
      banco: input.banco ?? null,
      fechaPago: input.fechaPago ?? null,
      rutaFirma: input.rutaFirma ?? null,
      observaciones: input.observaciones ?? null,
    }))
    .digest('hex');

  const readReplay = async (): Promise<SalePaymentResult | null> => {
    const record = await prisma.solicitudPagoIdempotente.findUnique({
      where: {
        IdUsuario_ClaveHash: {
          IdUsuario: input.idUsuario,
          ClaveHash: claveHash,
        },
      },
      include: { PagoVenta: true },
    });

    if (!record) {
      return null;
    }

    if (record.HuellaSolicitud !== huellaSolicitud) {
      throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
    }

    return {
      id: record.PagoVenta.Id,
      idVenta: record.PagoVenta.IdVenta,
      idUsuario: record.PagoVenta.IdUsuario,
      monto: toNumber(record.PagoVenta.Monto),
      metodoPago: record.PagoVenta.MetodoPago,
      numeroReferencia: record.PagoVenta.NumeroReferencia,
      banco: record.PagoVenta.Banco,
      fechaPago: record.PagoVenta.FechaPago,
      rutaFirma: record.PagoVenta.RutaFirma,
      observaciones: record.PagoVenta.Observaciones,
      estadoPago: record.EstadoPago,
      saldo: toNumber(record.Saldo),
    };
  };

  type PaymentOutcome = {
    data: SalePaymentResult;
    replayed: boolean;
    saleInfo?: { numeroVenta: number; cliente: string };
  };

  let outcome: PaymentOutcome | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      outcome = await prisma.$transaction(async (tx) => {
        const priorRequest = await tx.solicitudPagoIdempotente.findUnique({
          where: {
            IdUsuario_ClaveHash: {
              IdUsuario: input.idUsuario,
              ClaveHash: claveHash,
            },
          },
          include: { PagoVenta: true },
        });

        if (priorRequest) {
          if (priorRequest.HuellaSolicitud !== huellaSolicitud) {
            throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
          }

          return {
            data: {
              id: priorRequest.PagoVenta.Id,
              idVenta: priorRequest.PagoVenta.IdVenta,
              idUsuario: priorRequest.PagoVenta.IdUsuario,
              monto: toNumber(priorRequest.PagoVenta.Monto),
              metodoPago: priorRequest.PagoVenta.MetodoPago,
              numeroReferencia: priorRequest.PagoVenta.NumeroReferencia,
              banco: priorRequest.PagoVenta.Banco,
              fechaPago: priorRequest.PagoVenta.FechaPago,
              rutaFirma: priorRequest.PagoVenta.RutaFirma,
              observaciones: priorRequest.PagoVenta.Observaciones,
              estadoPago: priorRequest.EstadoPago,
              saldo: toNumber(priorRequest.Saldo),
            },
            replayed: true,
          };
        }

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
        if (['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS'].includes(input.metodoPago)) {
          await recordCashPaymentMovement(tx, {
            idUsuario: input.idUsuario,
            metodoPago: input.metodoPago,
            monto: payment.Monto,
            fecha: payment.FechaPago ?? new Date(),
            source: 'PAGO_VENTA',
            sourceId: payment.Id,
            concepto: `Abono de venta #${sale.NumeroVenta}`,
          });
        }

        const recalculated = await recalculateSalePaymentStatus(tx, idVenta);
        await syncCuentaPorCobrarFromSale(tx, idVenta, recalculated, input.idUsuario);

        const data: SalePaymentResult = {
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

        await tx.solicitudPagoIdempotente.create({
          data: {
            IdUsuario: input.idUsuario,
            IdVenta: idVenta,
            IdPago: payment.Id,
            ClaveHash: claveHash,
            HuellaSolicitud: huellaSolicitud,
            EstadoPago: recalculated.estadoPago,
            Saldo: recalculated.saldo,
          },
        });

        return {
          data,
          replayed: false,
          saleInfo: {
            numeroVenta: sale.NumeroVenta,
            cliente: sale.Cliente.Entidad.NombreCompleto,
          },
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const replay = await readReplay();
        if (replay) {
          outcome = { data: replay, replayed: true };
          break;
        }

        if (error.code === 'P2034' && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
          continue;
        }
      }

      throw error;
    }
  }

  if (!outcome) {
    throw new Error('No se pudo confirmar el resultado del pago');
  }

  if (!outcome.replayed && outcome.saleInfo) {
    notifyPagoRecibido({
      numeroVenta: outcome.saleInfo.numeroVenta,
      cliente: outcome.saleInfo.cliente,
      monto: outcome.data.monto,
      metodoPago: outcome.data.metodoPago,
      estadoPago: outcome.data.estadoPago,
      saldo: outcome.data.saldo,
    });
  }

  return outcome.data;
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

    await reverseSalePaymentCashMovement(tx, {
      idPagoVenta: payment.Id,
      idUsuario: idUsuarioAnulador,
      concepto: `Anulación de pago #${payment.Id} de venta #${idVenta}`,
    });

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
