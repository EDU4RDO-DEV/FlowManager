import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

type Tx = Prisma.TransactionClient;

const money = (value: number) => Number(value.toFixed(2));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function accrueMonthlyCommissionsForSale(
  tx: Tx,
  idVenta: number,
  idUsuarioSolicitante?: number,
  allowNewAccrual = true,
  idDevolucionComercial?: number,
) {
  const sale = await tx.venta.findUnique({
    where: { Id: idVenta },
    select: {
      Id: true,
      IdEmpleadoVendedor: true,
      IdUsuario: true,
      TipoRegistro: true,
      FechaVentaEfectiva: true,
      Anulado: true,
      EmpleadoVendedor: {
        select: {
          Id: true,
          IdConfiguracionComision: true,
          TipoTrabajador: { select: { Clave: true } },
        },
      },
    },
  });
  if (!sale || sale.TipoRegistro !== 'VENTA' || !sale.IdEmpleadoVendedor) return;
  if (!sale.FechaVentaEfectiva || !sale.EmpleadoVendedor) {
    throw new Error('La venta confirmada no tiene fecha efectiva o empleado vendedor válido');
  }
  if (sale.EmpleadoVendedor.TipoTrabajador?.Clave === 'PLANTA') return;

  const date = sale.FechaVentaEfectiva;
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const configuration = sale.EmpleadoVendedor.IdConfiguracionComision
    ? await tx.configuracionComision.findFirst({
        where: { Id: sale.EmpleadoVendedor.IdConfiguracionComision, Anulado: false },
        select: { Id: true },
      })
    : await tx.configuracionComision.findFirst({
        where: { EsGeneral: true, Anulado: false },
        select: { Id: true },
      });
  if (!configuration) {
    throw new Error('El empleado vendedor no tiene una configuración de comisiones activa');
  }

  const sales = await tx.venta.findMany({
    where: {
      IdEmpleadoVendedor: sale.IdEmpleadoVendedor,
      TipoRegistro: 'VENTA',
      FechaVentaEfectiva: { gte: monthStart, lt: monthEnd },
    },
    select: {
      Id: true,
      FechaVentaEfectiva: true,
      Anulado: true,
      DetalleVenta: {
        select: {
          Id: true,
          IdInventarioItem: true,
          Nombre: true,
          Cantidad: true,
          PrecioUnitario: true,
          InventarioItem: {
            select: {
              IdCategoriaComision: true,
              CategoriaComision: { select: { Nombre: true } },
            },
          },
          Anulado: true,
          EsBonificacion: true,
          DevolucionesComerciales: { select: { Cantidad: true } },
        },
      },
    },
  });

  const details = sales.flatMap((item) => item.DetalleVenta.map((detail) => ({
    ...detail,
    ventaId: item.Id,
    fecha: item.FechaVentaEfectiva!,
    ventaAnulada: item.Anulado,
    cantidad: Math.max(0, detail.Cantidad - detail.DevolucionesComerciales.reduce((sum, returned) => sum + returned.Cantidad, 0)),
    base: Math.max(0, detail.Cantidad - detail.DevolucionesComerciales.reduce((sum, returned) => sum + returned.Cantidad, 0)) * Number(detail.PrecioUnitario),
  })));
  const targets = new Map<number, {
    amount: number;
    base: number;
    categoryBase: number | null;
    quantity: number;
    name: string;
    categoryId: number | null;
    categoryName: string | null;
    ruleId: number | null;
    categoryRuleId: number | null;
    type: string;
    rate: number;
  }>();

  const categoryBases = new Map<number, number>();
  const productQuantities = new Map<number, number>();
  for (const detail of details) {
    if (detail.ventaAnulada || detail.Anulado || detail.EsBonificacion || detail.cantidad <= 0) continue;
    if (detail.InventarioItem.IdCategoriaComision !== null) {
      const id = detail.InventarioItem.IdCategoriaComision;
      categoryBases.set(id, (categoryBases.get(id) ?? 0) + detail.base);
    } else {
      productQuantities.set(detail.IdInventarioItem, (productQuantities.get(detail.IdInventarioItem) ?? 0) + detail.cantidad);
    }

  }

  const categoryRules = await tx.reglaComisionCategoria.findMany({
    where: {
      IdConfiguracionComision: configuration.Id,
      Anulado: false,
      FechaInicioVigencia: { lte: monthEnd },
      OR: [{ FechaFinVigencia: null }, { FechaFinVigencia: { gte: monthStart } }],
    },
    select: { Id: true, IdCategoriaComision: true, MontoMinimoVenta: true, Porcentaje: true, FechaInicioVigencia: true, FechaFinVigencia: true },
  });
  const productRules = await tx.reglaComision.findMany({
    where: { IdConfiguracionComision: configuration.Id, Anulado: false },
    select: { Id: true, IdInventarioItem: true, CantidadMinima: true, CantidadMaxima: true, TipoCalculo: true, Porcentaje: true, MontoPorUnidad: true },
  });

  for (const detail of details) {
    if (detail.ventaAnulada || detail.Anulado || detail.EsBonificacion) continue;
    const categoryId = detail.InventarioItem.IdCategoriaComision;
    if (categoryId !== null) {
      const rule = categoryRules
        .filter((item) =>
          item.IdCategoriaComision === categoryId &&
          Number(item.MontoMinimoVenta) <= (categoryBases.get(categoryId) ?? 0) &&
          item.FechaInicioVigencia <= detail.fecha &&
          (item.FechaFinVigencia === null || item.FechaFinVigencia >= detail.fecha),
        )
        .sort((a, b) => Number(b.MontoMinimoVenta) - Number(a.MontoMinimoVenta))[0];
      if (!rule) continue;
      const rate = Number(rule.Porcentaje);
      if (detail.cantidad <= 0 || detail.base <= 0) continue;
      targets.set(detail.Id, {
        amount: money(detail.base * rate / 100),
        base: detail.base,
        categoryBase: categoryBases.get(categoryId) ?? null,
        quantity: detail.cantidad,
        name: detail.Nombre,
        categoryId,
        categoryName: detail.InventarioItem.CategoriaComision?.Nombre ?? null,
        ruleId: null,
        categoryRuleId: rule.Id,
        type: 'PORCENTAJE_VENTA',
        rate,
      });
      continue;
    }

    const rule = productRules.find((candidate) =>
      candidate.IdInventarioItem === detail.IdInventarioItem &&
      productQuantities.get(detail.IdInventarioItem)! >= candidate.CantidadMinima &&
      productQuantities.get(detail.IdInventarioItem)! <= (candidate.CantidadMaxima ?? Number.POSITIVE_INFINITY),
    );
    if (!rule) continue;
    if (detail.cantidad <= 0 || detail.base <= 0) continue;
    const type = rule.TipoCalculo;
    const rate = type === 'MONTO_POR_UNIDAD'
      ? Number(rule.MontoPorUnidad ?? 0)
      : Number(rule.Porcentaje);
    targets.set(detail.Id, {
      amount: money(type === 'MONTO_POR_UNIDAD' ? detail.cantidad * rate : detail.base * rate / 100),
      base: detail.base,
      categoryBase: null,
      quantity: detail.cantidad,
      name: detail.Nombre,
      categoryId: null,
      categoryName: null,
      ruleId: rule.Id,
      categoryRuleId: null,
      type,
      rate,
    });
  }

  const ledger = await tx.comisionDevengada.findMany({
    where: { IdEmpleado: sale.IdEmpleadoVendedor, Anio: date.getUTCFullYear(), Mes: date.getUTCMonth() + 1 },
    orderBy: { Id: 'asc' },
    select: {
      Id: true,
      IdDetalleVenta: true,
      MontoMovimiento: true,
      BaseCalculoSnapshot: true,
      BaseCategoriaSnapshot: true,
      CantidadSnapshot: true,
      NombreProductoSnapshot: true,
      IdConfiguracionSnapshot: true,
      IdReglaSnapshot: true,
      IdCategoriaSnapshot: true,
      IdReglaCategoriaSnapshot: true,
      CategoriaSnapshot: true,
      TipoCalculoSnapshot: true,
      ValorAplicadoSnapshot: true,
      IdVenta: true,
      FechaVentaEfectiva: true,
    },
  });
  const current = new Map<number, number>();
  const latestLedger = new Map<number, number>();
  const latestSnapshot = new Map<number, (typeof ledger)[number]>();
  for (const entry of ledger) {
    current.set(entry.IdDetalleVenta, (current.get(entry.IdDetalleVenta) ?? 0) + Number(entry.MontoMovimiento));
    latestLedger.set(entry.IdDetalleVenta, entry.Id);
    latestSnapshot.set(entry.IdDetalleVenta, entry);
  }
  for (const detailId of new Set([...current.keys(), ...targets.keys()])) {
    const target = targets.get(detailId);
    const targetAmount = target?.amount ?? 0;
    const delta = money(targetAmount - (current.get(detailId) ?? 0));
    if (delta === 0) continue;
    const source = details.find((detail) => detail.Id === detailId);
    if (!source) continue;
    if (!current.has(detailId) && (!allowNewAccrual || source.ventaId !== idVenta)) continue;
    const snapshot = target ?? latestSnapshot.get(detailId);
    if (!snapshot) continue;

    if (delta < 0) {
      const commissionPayrolls = await tx.planillaDetalleComisionFuente.findMany({
        where: {
          IdDetalleVenta: detailId,
          PlanillaDetalleComision: {
            Anulado: false,
            PlanillaMensual: { Anulado: false, Estado: 'CERRADA' },
          },
        },
        select: {
          PlanillaDetalleComision: {
            select: {
              PlanillaMensual: {
                select: {
                  Estado: true,
                  Pagos: {
                    where: { Anulado: false, Monto: { gt: 0 } },
                    select: { Id: true },
                  },
                },
              },
            },
          },
        },
      });
      const isPaid = commissionPayrolls.some(
        (item) => item.PlanillaDetalleComision.PlanillaMensual.Pagos.length > 0,
      );
      const closedUnpaid = commissionPayrolls.some(
        (item) => item.PlanillaDetalleComision.PlanillaMensual.Pagos.length === 0,
      );
      if (isPaid || closedUnpaid) {
        const existingRequests = await tx.solicitudReversionComision.findMany({
          where: {
            IdDetalleVenta: detailId,
            Estado: { notIn: ['RECHAZADA', 'ANULADA'] },
          },
          select: { MontoSolicitado: true },
        });
        const alreadyRequested = existingRequests.reduce(
          (sum, request) => sum + Number(request.MontoSolicitado),
          0,
        );
        const amountToRequest = money(Math.max(0, Math.abs(delta) - alreadyRequested));
        if (amountToRequest === 0) continue;
        const reversalSource = idDevolucionComercial
          ? `devolucion:${idDevolucionComercial}`
          : `venta:${idVenta}`;
        const operationKey = hash(`${reversalSource}:${detailId}:${targetAmount.toFixed(2)}:${amountToRequest.toFixed(2)}:${latestLedger.get(detailId) ?? 0}`);
        const priorRequest = await tx.solicitudReversionComision.findUnique({
          where: { ClaveOperacion: operationKey },
          select: { Id: true },
        });
        if (!priorRequest) {
          await tx.solicitudReversionComision.create({
            data: {
              IdEmpleado: sale.IdEmpleadoVendedor,
              IdVenta: source.ventaId,
              IdDetalleVenta: detailId,
              IdDevolucionComercial: idDevolucionComercial ?? null,
              IdUsuarioSolicitante: idUsuarioSolicitante ?? sale.IdUsuario,
              Estado: isPaid ? 'PENDIENTE_REVISION' : 'APROBADA',
              MontoSolicitado: new Prisma.Decimal(amountToRequest),
              Motivo: `Devolución o anulación de venta #${source.ventaId}`,
              ClaveOperacion: operationKey,
            },
          });
        }
        continue;
      }
    }

    await tx.comisionDevengada.create({
      data: {
        IdEmpleado: sale.IdEmpleadoVendedor,
        IdVenta: source.ventaId,
        IdDetalleVenta: detailId,
        Mes: date.getUTCMonth() + 1,
        Anio: date.getUTCFullYear(),
        TipoMovimiento: current.has(detailId) ? 'AJUSTE' : 'DEVENGO',
        MontoMovimiento: new Prisma.Decimal(delta),
        BaseCalculoSnapshot: new Prisma.Decimal(Number('amount' in snapshot ? snapshot.base : snapshot.BaseCalculoSnapshot)),
        BaseCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryBase : snapshot.BaseCategoriaSnapshot,
        CantidadSnapshot: 'amount' in snapshot ? snapshot.quantity : snapshot.CantidadSnapshot,
        NombreProductoSnapshot: 'amount' in snapshot ? snapshot.name : snapshot.NombreProductoSnapshot,
        IdConfiguracionSnapshot: 'amount' in snapshot ? configuration.Id : snapshot.IdConfiguracionSnapshot,
        IdReglaSnapshot: 'amount' in snapshot ? snapshot.ruleId : snapshot.IdReglaSnapshot,
        IdCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryId : snapshot.IdCategoriaSnapshot,
        IdReglaCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryRuleId : snapshot.IdReglaCategoriaSnapshot,
        CategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryName : snapshot.CategoriaSnapshot,
        TipoCalculoSnapshot: 'amount' in snapshot ? snapshot.type : snapshot.TipoCalculoSnapshot,
        ValorAplicadoSnapshot: new Prisma.Decimal(Number('amount' in snapshot ? snapshot.rate : snapshot.ValorAplicadoSnapshot)),
        FechaVentaEfectiva: source.fecha,
        ClaveOperacion: hash(`${detailId}:${targetAmount.toFixed(2)}:${latestLedger.get(detailId) ?? 0}`),
      },
    });

    if (delta > 0 && source.ventaId === idVenta) {
      let availableCommission = delta;
      const approvedReversals = await tx.solicitudReversionComision.findMany({
        where: {
          IdEmpleado: sale.IdEmpleadoVendedor,
          Estado: 'APROBADA',
          FechaSolicitud: { lt: source.fecha },
        },
        orderBy: [{ FechaSolicitud: 'asc' }, { Id: 'asc' }],
        select: { Id: true, MontoSolicitado: true, MontoAplicado: true },
      });
      for (const reversal of approvedReversals) {
        if (availableCommission <= 0) break;
        const outstanding = money(Number(reversal.MontoSolicitado) - Number(reversal.MontoAplicado));
        const applied = money(Math.min(outstanding, availableCommission));
        if (applied <= 0) continue;
        const nextApplied = money(Number(reversal.MontoAplicado) + applied);
        await tx.comisionDevengada.create({
          data: {
            IdEmpleado: sale.IdEmpleadoVendedor,
            IdVenta: source.ventaId,
            IdDetalleVenta: detailId,
            Mes: date.getUTCMonth() + 1,
            Anio: date.getUTCFullYear(),
            TipoMovimiento: 'AJUSTE',
            MontoMovimiento: new Prisma.Decimal(-applied),
            BaseCalculoSnapshot: new Prisma.Decimal(Number('amount' in snapshot ? snapshot.base : snapshot.BaseCalculoSnapshot)),
            BaseCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryBase : snapshot.BaseCategoriaSnapshot,
            CantidadSnapshot: 'amount' in snapshot ? snapshot.quantity : snapshot.CantidadSnapshot,
            NombreProductoSnapshot: 'amount' in snapshot ? snapshot.name : snapshot.NombreProductoSnapshot,
            IdConfiguracionSnapshot: 'amount' in snapshot ? configuration.Id : snapshot.IdConfiguracionSnapshot,
            IdReglaSnapshot: 'amount' in snapshot ? snapshot.ruleId : snapshot.IdReglaSnapshot,
            IdCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryId : snapshot.IdCategoriaSnapshot,
            IdReglaCategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryRuleId : snapshot.IdReglaCategoriaSnapshot,
            CategoriaSnapshot: 'amount' in snapshot ? snapshot.categoryName : snapshot.CategoriaSnapshot,
            TipoCalculoSnapshot: 'amount' in snapshot ? snapshot.type : snapshot.TipoCalculoSnapshot,
            ValorAplicadoSnapshot: new Prisma.Decimal(Number('amount' in snapshot ? snapshot.rate : snapshot.ValorAplicadoSnapshot)),
            FechaVentaEfectiva: source.fecha,
            ClaveOperacion: hash(`reversal:${reversal.Id}:${detailId}:${nextApplied.toFixed(2)}`),
          },
        });
        await tx.solicitudReversionComision.update({
          where: { Id: reversal.Id },
          data: {
            MontoAplicado: new Prisma.Decimal(nextApplied),
            Estado: nextApplied >= Number(reversal.MontoSolicitado) ? 'APLICADA' : 'APROBADA',
            FechaAplicacion: nextApplied >= Number(reversal.MontoSolicitado) ? new Date() : null,
          },
        });
        availableCommission = money(availableCommission - applied);
      }
    }
  }
}

export async function listCommissionAccruals(input: { mes: number; anio: number; idEmpleado?: number }) {
  const rows = await prisma.comisionDevengada.findMany({
    where: {
      Mes: input.mes,
      Anio: input.anio,
      ...(input.idEmpleado ? { IdEmpleado: input.idEmpleado } : {}),
    },
    include: {
      Empleado: { include: { Entidad: { select: { NombreCompleto: true } } } },
      Venta: { select: { NumeroVenta: true, CondicionPago: true, EstadoPago: true } },
    },
    orderBy: [{ FechaVentaEfectiva: 'asc' }, { Id: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.Id,
    idEmpleado: row.IdEmpleado,
    empleado: row.Empleado.Entidad.NombreCompleto,
    idVenta: row.IdVenta,
    numeroVenta: row.Venta.NumeroVenta,
    condicionPago: row.Venta.CondicionPago,
    estadoCobro: row.Venta.EstadoPago,
    producto: row.NombreProductoSnapshot,
    categoria: row.CategoriaSnapshot,
    fechaVenta: row.FechaVentaEfectiva,
    cantidad: row.CantidadSnapshot,
    baseCalculo: Number(row.BaseCalculoSnapshot),
    baseCategoria: row.BaseCategoriaSnapshot === null ? null : Number(row.BaseCategoriaSnapshot),
    regla: row.IdReglaCategoriaSnapshot ?? row.IdReglaSnapshot,
    tipoMovimiento: row.TipoMovimiento,
    monto: Number(row.MontoMovimiento),
    tipoCalculo: row.TipoCalculoSnapshot,
    valorAplicado: Number(row.ValorAplicadoSnapshot),
  }));
}

export async function listCommissionReversalRequests() {
  return prisma.solicitudReversionComision.findMany({
    include: {
      Empleado: { include: { Entidad: { select: { NombreCompleto: true } } } },
      Venta: { select: { NumeroVenta: true } },
      DetalleVenta: { select: { Nombre: true } },
      DevolucionComercial: { select: { Id: true, FechaAutorizacion: true } },
      Solicitante: { select: { Id: true, Nombre: true } },
      Revisor: { select: { Id: true, Nombre: true } },
    },
    orderBy: [{ Estado: 'asc' }, { FechaSolicitud: 'desc' }],
  });
}

export async function reviewCommissionReversalRequest(
  id: number,
  idUsuarioRevisor: number,
  decision: 'APROBAR' | 'RECHAZAR',
  observaciones: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.solicitudReversionComision.findUnique({
      where: { Id: id },
      select: { Id: true, IdUsuarioSolicitante: true, Estado: true },
    });
    if (!request) throw new Error('Solicitud de reversión no existe');
    if (request.Estado !== 'PENDIENTE_REVISION') {
      throw new Error('La solicitud ya fue revisada');
    }
    if (decision === 'APROBAR' && request.IdUsuarioSolicitante === idUsuarioRevisor) {
      throw new Error('No puede aprobar su propia solicitud de reversión');
    }
    return tx.solicitudReversionComision.update({
      where: { Id: id },
      data: {
        Estado: decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
        IdUsuarioRevisor: idUsuarioRevisor,
        FechaRevision: new Date(),
        ObservacionesRevision: observaciones.trim(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelCommissionReversalRequest(
  id: number,
  idUsuario: number,
  observaciones: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.solicitudReversionComision.findUnique({
      where: { Id: id },
      select: { Id: true, IdUsuarioSolicitante: true, Estado: true },
    });
    if (!request) throw new Error('Solicitud de reversión no existe');
    if (request.Estado !== 'PENDIENTE_REVISION') {
      throw new Error('Solo se pueden anular solicitudes pendientes');
    }
    if (request.IdUsuarioSolicitante !== idUsuario) {
      throw new Error('Solo quien solicitó la reversión puede anularla');
    }
    return tx.solicitudReversionComision.update({
      where: { Id: id },
      data: {
        Estado: 'ANULADA',
        IdUsuarioCancelador: idUsuario,
        FechaAnulacion: new Date(),
        ObservacionesAnulacion: observaciones.trim(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
