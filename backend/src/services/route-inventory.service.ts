import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import {
  ensurePlantEnvaseBucketQuantity,
  getEnvaseBucketQuantity,
  registerInventoryMovement,
  transferEnvaseBucket,
} from './inventory-movement.service';
import { expireProformaReservations } from './proforma-reservation.service';

type RouteLineInput = {
  idInventarioItem: number;
  cantidad: number;
  estadoEnvase?: 'VACIO' | 'LLENO';
};

type RouteReturnLineInput = {
  idInventarioItem: number;
  cantidadRecibida: number;
  cantidadDanada: number;
  cantidadEnvaseVacio: number;
  cantidadEnvaseLleno: number;
  estadoEnvaseDanado?: 'VACIO' | 'LLENO';
  observaciones?: string;
  ubicacionDanada?: string;
};

type RouteInventoryClient = Prisma.TransactionClient;

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
}

export async function loadRouteInventory(tx: RouteInventoryClient, idRutaSesion: number) {
  await expireProformaReservations(tx, idRutaSesion);

  const session = await tx.rutaSesion.findFirst({
    where: { Id: idRutaSesion, Anulado: false },
    select: {
      Id: true,
      Estado: true,
      DespachoRuta: {
        where: { Anulado: false },
        orderBy: { FechaRegistro: 'asc' },
        include: { Detalles: true },
      },
      DevolucionRuta: {
        orderBy: { FechaRegistro: 'desc' },
        include: {
          Detalles: true,
          UsuarioAnulador: { select: { Id: true, Nombre: true } },
        },
      },
      AjustesRuta: true,
      Venta: {
        where: { Anulado: false, TipoRegistro: 'VENTA' },
        select: {
          DetalleVenta: {
            where: { Anulado: false },
            select: { IdInventarioItem: true, Cantidad: true },
          },
        },
      },
      MovimientosEnvaseCliente: {
        where: {
          Anulado: false,
          TipoMovimiento: { in: ['PRESTAMO', 'DEVOLUCION', 'DEVOLUCION_DANADA', 'BAJA'] },
        },
        select: {
          IdInventarioItem: true,
          TipoMovimiento: true,
          Cantidad: true,
          IdDetalleVentaEnvase: true,
        },
      },
      TransferenciasOrigen: {
        where: { Anulado: false, EstadoConfirmacion: { in: ['PENDIENTE', 'CONFIRMADA'] } },
        select: { Detalles: true },
      },
      TransferenciasDestino: {
        where: { Anulado: false, EstadoConfirmacion: 'CONFIRMADA' },
        select: { Detalles: true },
      },
    },
  });

  if (!session) {
    throw new Error('RutaSesion no existe');
  }

  const reservations = await tx.reservaProforma.findMany({
    where: {
      Estado: 'ACTIVA',
      Venta: {
        is: {
          IdRutaSesion: idRutaSesion,
          Anulado: false,
          TipoRegistro: 'PROFORMA',
        },
      },
    },
    select: {
      Detalles: {
        select: {
          CantidadReservada: true,
          DetalleVenta: {
            select: { IdInventarioItem: true },
          },
        },
      },
    },
  });

  const commercialReturns = await tx.devolucionComercialDetalle.findMany({
    where: {
      DevolucionComercial: {
        is: {
          Venta: {
            is: {
              IdRutaSesion: idRutaSesion,
              Anulado: false,
              TipoRegistro: 'VENTA',
            },
          },
        },
      },
    },
    select: {
      Cantidad: true,
      CondicionFisica: true,
      DetalleVenta: { select: { IdInventarioItem: true } },
    },
  });

  const reservedByItem = new Map<number, number>();
  for (const reservation of reservations) {
    for (const detail of reservation.Detalles) {
      const idInventarioItem = detail.DetalleVenta.IdInventarioItem;
      reservedByItem.set(
        idInventarioItem,
        roundQuantity((reservedByItem.get(idInventarioItem) ?? 0) + detail.CantidadReservada),
      );
    }
  }

  const soldByItem = new Map<number, number>();
  for (const sale of session.Venta) {
    for (const detail of sale.DetalleVenta) {
      soldByItem.set(
        detail.IdInventarioItem,
        roundQuantity((soldByItem.get(detail.IdInventarioItem) ?? 0) + detail.Cantidad),
      );
    }
  }

  const commercialReturnByItem = new Map<number, { cantidad: number; noVendible: number }>();
  for (const detail of commercialReturns) {
    const idInventarioItem = detail.DetalleVenta.IdInventarioItem;
    const existing = commercialReturnByItem.get(idInventarioItem) ?? { cantidad: 0, noVendible: 0 };
    existing.cantidad = roundQuantity(existing.cantidad + detail.Cantidad);
    if (detail.CondicionFisica !== 'VENDIBLE') {
      existing.noVendible = roundQuantity(existing.noVendible + detail.Cantidad);
    }
    commercialReturnByItem.set(idInventarioItem, existing);
  }

  const returnedByItem = new Map<number, { cantidad: number; danada: number }>();
  // Varias devoluciones activas por sesión (T-F2-DIST reabastecimiento tras devolución):
  // se agregan todas, no solo la más reciente, para no perder reconciliaciones previas.
  const activeReturns = session.DevolucionRuta.filter((routeReturn) => !routeReturn.Anulado);
  const mostRecentReturn = activeReturns[0] ?? null;
  for (const routeReturn of activeReturns) {
    for (const detail of routeReturn.Detalles) {
      const existing = returnedByItem.get(detail.IdInventarioItem) ?? { cantidad: 0, danada: 0 };
      returnedByItem.set(detail.IdInventarioItem, {
        cantidad: roundQuantity(existing.cantidad + detail.CantidadRecibida),
        danada: roundQuantity(existing.danada + detail.CantidadDanada),
      });
    }
  }

  const adjustedByItem = new Map<number, number>();
  for (const adjustment of session.AjustesRuta) {
    adjustedByItem.set(
      adjustment.IdInventarioItem,
      roundQuantity((adjustedByItem.get(adjustment.IdInventarioItem) ?? 0) + adjustment.Cantidad),
    );
  }

  const envaseLoanedByItem = new Map<number, number>();
  const envaseReturnedByItem = new Map<number, number>();
  const envaseRetiredByItem = new Map<number, number>();
  for (const movement of session.MovimientosEnvaseCliente) {
    if (
      movement.TipoMovimiento === 'PRESTAMO' &&
      movement.IdDetalleVentaEnvase !== null &&
      movement.IdDetalleVentaEnvase !== undefined
    ) {
      continue;
    }
    const target = movement.TipoMovimiento === 'PRESTAMO'
      ? envaseLoanedByItem
      : movement.TipoMovimiento === 'BAJA'
        ? envaseRetiredByItem
        : envaseReturnedByItem;
    target.set(
      movement.IdInventarioItem,
      roundQuantity((target.get(movement.IdInventarioItem) ?? 0) + movement.Cantidad),
    );
  }

  const activeDispatch = session.DespachoRuta.length > 0
    ? session.DespachoRuta[session.DespachoRuta.length - 1]
    : null;

  // Varios despachos activos (reabastecimiento, T-F2-DIST-02) se agregan por
  // item + estado de envase; de lo contrario cada despacho duplicaría el cálculo
  // de "disponible" al compararse contra el total vendido/devuelto de la sesión completa.
  type DispatchLine = {
    idInventarioItem: number;
    nombre: string;
    unidadMedida: string | null;
    estadoEnvase: string | null;
    cantidad: number;
  };
  const dispatchByKey = new Map<string, DispatchLine>();
  for (const dispatch of session.DespachoRuta) {
    for (const detail of dispatch.Detalles) {
      const key = `${detail.IdInventarioItem}|${detail.EstadoEnvase ?? ''}`;
      const existing = dispatchByKey.get(key);
      dispatchByKey.set(key, {
        idInventarioItem: detail.IdInventarioItem,
        nombre: detail.NombreSnapshot,
        unidadMedida: detail.UnidadMedidaSnapshot,
        estadoEnvase: detail.EstadoEnvase,
        cantidad: roundQuantity((existing?.cantidad ?? 0) + detail.Cantidad),
      });
    }
  }

  const transferOutByKey = new Map<string, number>();
  for (const transfer of session.TransferenciasOrigen) {
    for (const detail of transfer.Detalles) {
      const key = `${detail.IdInventarioItem}|${detail.EstadoEnvase ?? ''}`;
      transferOutByKey.set(key, roundQuantity((transferOutByKey.get(key) ?? 0) + detail.Cantidad));
    }
  }

  const transferInByKey = new Map<string, number>();
  for (const transfer of session.TransferenciasDestino) {
    for (const detail of transfer.Detalles) {
      const key = `${detail.IdInventarioItem}|${detail.EstadoEnvase ?? ''}`;
      transferInByKey.set(key, roundQuantity((transferInByKey.get(key) ?? 0) + detail.Cantidad));
    }
  }

  const lines = Array.from(dispatchByKey.entries()).map(([key, detail]) => {
    const sold = soldByItem.get(detail.idInventarioItem) ?? 0;
    const commercialReturn = commercialReturnByItem.get(detail.idInventarioItem);
    const commercialReturned = commercialReturn?.cantidad ?? 0;
    const commercialNonSellable = commercialReturn?.noVendible ?? 0;
    const returned = returnedByItem.get(detail.idInventarioItem)?.cantidad ?? 0;
    const damaged = returnedByItem.get(detail.idInventarioItem)?.danada ?? 0;
    const adjusted = adjustedByItem.get(detail.idInventarioItem) ?? 0;
    const reserved = reservedByItem.get(detail.idInventarioItem) ?? 0;
    const envasePrestado = envaseLoanedByItem.get(detail.idInventarioItem) ?? 0;
    const envaseDevuelto = envaseReturnedByItem.get(detail.idInventarioItem) ?? 0;
    const envaseBaja = envaseRetiredByItem.get(detail.idInventarioItem) ?? 0;
    const transferidoSaliente = transferOutByKey.get(key) ?? 0;
    const transferidoRecibido = transferInByKey.get(key) ?? 0;
    const pendingReconciliation = roundQuantity(
      detail.cantidad
        - sold
        + commercialReturned
        - returned
        - adjusted
        - envasePrestado
        + envaseDevuelto
        - envaseBaja
        - transferidoSaliente
        + transferidoRecibido,
    );

    return {
      idInventarioItem: detail.idInventarioItem,
      nombre: detail.nombre,
      unidadMedida: detail.unidadMedida,
      despachado: detail.cantidad,
      estadoEnvaseDespachado: detail.estadoEnvase,
      vendido: sold,
      devolucionComercial: commercialReturned,
      noVendibleComercial: commercialNonSellable,
      devuelto: returned,
      danado: damaged,
      ajustado: adjusted,
      reservado: reserved,
      envasePrestado,
      envaseDevuelto,
      envaseBaja,
      transferidoSaliente,
      transferidoRecibido,
      pendienteConciliacion: pendingReconciliation,
      disponible: roundQuantity(pendingReconciliation - reserved - commercialNonSellable),
    };
  });

  return {
    session,
    despacho: activeDispatch,
    devolucion: mostRecentReturn,
    lines,
  };
}

export async function getRouteAvailableQuantities(tx: RouteInventoryClient, idRutaSesion: number) {
  const inventory = await loadRouteInventory(tx, idRutaSesion);
  if (inventory.session.Estado !== 'EN_CURSO') {
    throw new Error('La sesión de ruta debe estar EN_CURSO para vender desde el vehículo');
  }
  if (!inventory.despacho) {
    throw new Error('No existe un despacho confirmado para la sesión de ruta');
  }
  // D-DIST-06: una devolución (incluso parcial/intermedia) ya no bloquea ventas por sí
  // sola. El cálculo agregado de "disponible" (que ya descuenta lo devuelto) es la única
  // fuente de verdad: si el producto fue reabastecido con un nuevo despacho tras la
  // devolución, su disponible vuelve a ser positivo y la venta debe permitirse.
  return new Map(inventory.lines.map((line) => [line.idInventarioItem, line.disponible]));
}

export async function assertRouteCanClose(tx: RouteInventoryClient, idRutaSesion: number) {
  const inventory = await loadRouteInventory(tx, idRutaSesion);
  const pending = inventory.lines.filter((line) => Math.abs(line.pendienteConciliacion) > 0.009);
  if (pending.length > 0) {
    throw new Error('La ruta tiene productos pendientes de devolución, ajuste autorizado o proformas sin confirmar');
  }
}

export async function getRouteInventory(idRutaSesion: number) {
  return prisma.$transaction(async (tx) => {
    const result = await loadRouteInventory(tx, idRutaSesion);
    return {
      idRutaSesion,
      estado: result.session.Estado,
      despacho: result.despacho
        ? {
            id: result.despacho.Id,
            observaciones: result.despacho.Observaciones,
            fechaRegistro: result.despacho.FechaRegistro,
          }
        : null,
      devolucion: result.devolucion
        ? {
            id: result.devolucion.Id,
            observaciones: result.devolucion.Observaciones,
            fechaRegistro: result.devolucion.FechaRegistro,
          }
        : null,
      devolucionesAnuladas: result.session.DevolucionRuta
        .filter((routeReturn) => routeReturn.Anulado)
        .map((routeReturn) => ({
          id: routeReturn.Id,
          fechaRegistro: routeReturn.FechaRegistro,
          fechaAnulacion: routeReturn.FechaAnulacion,
          motivoAnulacion: routeReturn.MotivoAnulacion,
          usuarioAnulador: routeReturn.UsuarioAnulador
            ? { id: routeReturn.UsuarioAnulador.Id, nombre: routeReturn.UsuarioAnulador.Nombre }
            : null,
        })),
      productos: result.lines,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createRouteDispatch(
  idRutaSesion: number,
  idUsuario: number,
  input: { observaciones?: string; detalle: RouteLineInput[] },
) {
  return runSerializableTransaction(async (tx) => {
    const session = await tx.rutaSesion.findFirst({
      where: { Id: idRutaSesion, Anulado: false },
      select: {
        Id: true,
        Estado: true,
      },
    });

    if (!session) {
      throw new Error('RutaSesion no existe');
    }
    if (session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión de ruta debe estar EN_CURSO para despachar');
    }
    // D-DIST-06 (aprobado): se permiten varios despachos por sesión (reabastecimiento),
    // incluso después de una o más devoluciones. El cálculo agregado de loadRouteInventory
    // suma todos los despachos y todas las devoluciones de la sesión, por lo que un nuevo
    // despacho nunca duplica existencias ya reconciliadas.

    const products = await tx.inventarioItem.findMany({
      where: {
        Id: { in: input.detalle.map((item) => item.idInventarioItem) },
        Anulado: false,
      },
      select: {
        Id: true,
        Nombre: true,
        UnidadMedida: true,
        Existencia: true,
        EsVendible: true,
        EsEnvaseRetornable: true,
      },
    });
    const productsById = new Map(products.map((product) => [product.Id, product]));

    for (const detail of input.detalle) {
      const product = productsById.get(detail.idInventarioItem);
      if (!product) {
        throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
      }
      if (!product.EsVendible) {
        throw new Error(`No se puede despachar ${product.Nombre}: el artículo no está habilitado para la venta`);
      }
      if ((!product.EsEnvaseRetornable || detail.estadoEnvase === 'LLENO') && product.Existencia < detail.cantidad) {
        throw new Error(
          `Stock insuficiente para ${product.Nombre}. Existencia actual ${product.Existencia}, requerida ${detail.cantidad}`,
        );
      }
      if (product.EsEnvaseRetornable) {
        if (!detail.estadoEnvase || !Number.isInteger(detail.cantidad)) {
          throw new Error(`Indica el estado y una cantidad entera para el envase ${product.Nombre}`);
        }
        await ensurePlantEnvaseBucketQuantity(tx, {
          idInventarioItem: product.Id,
          idUsuario,
          estado: detail.estadoEnvase,
          cantidad: detail.cantidad,
          nombre: `Despacho ruta #${idRutaSesion} - ${product.Nombre}`,
          tipoDocumento: 'DES',
          documento: idRutaSesion.toString(),
        });
      } else if (detail.estadoEnvase) {
        throw new Error(`${product.Nombre} no está configurado como envase retornable`);
      }
    }

    const dispatch = await tx.despachoRuta.create({
      data: {
        IdRutaSesion: idRutaSesion,
        IdUsuario: idUsuario,
        Observaciones: input.observaciones,
        Detalles: {
          create: input.detalle.map((detail) => {
            const product = productsById.get(detail.idInventarioItem);
            if (!product) {
              throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
            }
            return {
              IdInventarioItem: product.Id,
              NombreSnapshot: product.Nombre,
              UnidadMedidaSnapshot: product.UnidadMedida,
              Cantidad: detail.cantidad,
              EstadoEnvase: product.EsEnvaseRetornable ? detail.estadoEnvase : null,
            };
          }),
        },
      },
      include: { Detalles: true },
    });

    for (const detail of input.detalle) {
      const product = productsById.get(detail.idInventarioItem);
      if (!product) {
        throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
      }
      if (!product.EsEnvaseRetornable || detail.estadoEnvase === 'LLENO') {
        const remaining = roundQuantity(product.Existencia - detail.cantidad);
        await tx.inventarioItem.update({
          where: { Id: product.Id },
          data: { Existencia: remaining },
        });
        await registerInventoryMovement(tx, {
          idInventarioItem: product.Id,
          idUsuario,
          tipoDocumento: 'DES',
          documento: dispatch.Id.toString(),
          nombre: `Despacho ruta #${idRutaSesion} - ${product.Nombre}`,
          tipoMovimiento: false,
          existenciaAnterior: product.Existencia,
          cantidad: detail.cantidad,
          nuevaExistencia: remaining,
        });
        product.Existencia = remaining;
      }
      if (product.EsEnvaseRetornable) {
        await transferEnvaseBucket(tx, {
          idInventarioItem: product.Id,
          idUsuario,
          origen: { ubicacion: 'PLANTA', estado: detail.estadoEnvase! },
          destino: { ubicacion: 'RUTA', estado: detail.estadoEnvase!, idRutaSesion },
          cantidad: detail.cantidad,
          nombre: `Despacho ruta #${idRutaSesion} - ${product.Nombre}`,
          tipoDocumento: 'DES',
          documento: dispatch.Id.toString(),
        });
      }
    }

    return dispatch;
  });
}

export async function cancelRouteDispatch(
  idRutaSesion: number,
  idUsuario: number,
  motivo: string,
  idDespacho?: number,
) {
  return runSerializableTransaction(async (tx) => {
    await expireProformaReservations(tx, idRutaSesion);
    const session = await tx.rutaSesion.findFirst({
      where: { Id: idRutaSesion, Anulado: false },
      select: {
        Id: true,
        Estado: true,
        Venta: {
          where: { Anulado: false, TipoRegistro: 'VENTA' },
          select: { Id: true },
          take: 1,
        },
        DevolucionRuta: { where: { Anulado: false }, select: { Id: true }, take: 1 },
        AjustesRuta: { select: { Id: true }, take: 1 },
        MovimientosEnvaseCliente: {
          where: {
            Anulado: false,
            TipoMovimiento: { in: ['PRESTAMO', 'DEVOLUCION', 'DEVOLUCION_DANADA', 'BAJA'] },
          },
          select: { Id: true },
          take: 1,
        },
        TransferenciasOrigen: {
          where: { Anulado: false, EstadoConfirmacion: { in: ['PENDIENTE', 'CONFIRMADA'] } },
          select: { Id: true },
          take: 1,
        },
        TransferenciasDestino: {
          where: { Anulado: false, EstadoConfirmacion: 'CONFIRMADA' },
          select: { Id: true },
          take: 1,
        },
      },
    });
    if (!session) {
      throw new Error('RutaSesion no existe');
    }
    if (session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión debe estar EN_CURSO para anular el despacho');
    }
    if (
      session.Venta.length > 0 ||
      session.DevolucionRuta.length > 0 ||
      session.AjustesRuta.length > 0 ||
      session.MovimientosEnvaseCliente.length > 0 ||
      session.TransferenciasOrigen.length > 0 ||
      session.TransferenciasDestino.length > 0
    ) {
      throw new Error('No se puede anular el despacho después de registrar ventas, devoluciones, ajustes, movimientos de envases o transferencias');
    }

    const activeReservations = await tx.reservaProforma.count({
      where: {
        Estado: 'ACTIVA',
        Venta: {
          is: {
            IdRutaSesion: idRutaSesion,
            Anulado: false,
            TipoRegistro: 'PROFORMA',
          },
        },
      },
    });
    if (activeReservations > 0) {
      throw new Error('No se puede anular el despacho mientras existan proformas reservadas');
    }

    const activeDispatches = await tx.despachoRuta.findMany({
      where: { IdRutaSesion: idRutaSesion, Anulado: false },
      include: { Detalles: true },
      orderBy: { FechaRegistro: 'asc' },
    });
    if (activeDispatches.length === 0) {
      throw new Error('La sesión no tiene un despacho activo para anular');
    }
    let dispatch = activeDispatches[0];
    if (idDespacho !== undefined) {
      const match = activeDispatches.find((item) => item.Id === idDespacho);
      if (!match) {
        throw new Error('El despacho indicado no existe o está anulado');
      }
      dispatch = match;
    } else if (activeDispatches.length > 1) {
      throw new Error('La sesión tiene varios despachos activos; especifique idDespacho a anular');
    }

    const products = await tx.inventarioItem.findMany({
      where: {
        Id: { in: dispatch.Detalles.map((detail) => detail.IdInventarioItem) },
        Anulado: false,
      },
      select: {
        Id: true,
        Nombre: true,
        Existencia: true,
        EsEnvaseRetornable: true,
      },
    });
    const productsById = new Map(products.map((product) => [product.Id, product]));

    for (const detail of dispatch.Detalles) {
      const product = productsById.get(detail.IdInventarioItem);
      if (!product) {
        throw new Error(`InventarioItem ${detail.IdInventarioItem} no existe o está anulado`);
      }
      if (!product.EsEnvaseRetornable || detail.EstadoEnvase === 'LLENO') {
        const remaining = roundQuantity(product.Existencia + detail.Cantidad);
        await tx.inventarioItem.update({
          where: { Id: product.Id },
          data: { Existencia: remaining },
        });
        await registerInventoryMovement(tx, {
          idInventarioItem: product.Id,
          idUsuario,
          tipoDocumento: 'ANU',
          documento: dispatch.Id.toString(),
          nombre: `Anulación despacho ruta #${idRutaSesion} - ${product.Nombre}`,
          tipoMovimiento: true,
          existenciaAnterior: product.Existencia,
          cantidad: detail.Cantidad,
          nuevaExistencia: remaining,
        });
        product.Existencia = remaining;
      }
      if (product.EsEnvaseRetornable) {
        if (detail.EstadoEnvase !== 'VACIO' && detail.EstadoEnvase !== 'LLENO') {
          throw new Error(`No se puede restaurar el estado del envase de ${product.Nombre}`);
        }
        await transferEnvaseBucket(tx, {
          idInventarioItem: product.Id,
          idUsuario,
          origen: { ubicacion: 'RUTA', estado: detail.EstadoEnvase, idRutaSesion },
          destino: { ubicacion: 'PLANTA', estado: detail.EstadoEnvase },
          cantidad: detail.Cantidad,
          nombre: `Anulación despacho ruta #${idRutaSesion} - ${product.Nombre}`,
          tipoDocumento: 'ANU',
          documento: dispatch.Id.toString(),
        });
      }
    }

    await tx.despachoRuta.update({
      where: { Id: dispatch.Id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuario,
        FechaAnulacion: new Date(),
        MotivoAnulacion: motivo,
      },
    });
    return { idDespacho: dispatch.Id, anulada: true };
  });
}

export async function createRouteReturn(
  idRutaSesion: number,
  idUsuario: number,
  input: { observaciones?: string; detalle: RouteReturnLineInput[] },
) {
  return runSerializableTransaction(async (tx) => {
    const inventory = await loadRouteInventory(tx, idRutaSesion);
    if (inventory.session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión de ruta debe estar EN_CURSO para registrar devoluciones');
    }
    if (!inventory.despacho) {
      throw new Error('La sesión no tiene un despacho confirmado');
    }
    // D-DIST-06 (aprobado): se permiten varias devoluciones por sesión (p. ej. un conteo
    // físico intermedio seguido de reabastecimiento y venta, con la devolución final del
    // día). El saldo pendiente ya refleja todas las devoluciones previas, por lo que una
    // nueva devolución nunca puede exceder lo que realmente quede físicamente pendiente.

    const receivableByItem = new Map(
      inventory.lines.map((line) => [
        line.idInventarioItem,
        roundQuantity(line.pendienteConciliacion - line.reservado),
      ]),
    );
    const productIds = input.detalle.map((detail) => detail.idInventarioItem);
    const products = await tx.inventarioItem.findMany({
      where: { Id: { in: productIds }, Anulado: false },
      select: { Id: true, EsEnvaseRetornable: true },
    });
    const productsById = new Map(products.map((product) => [product.Id, product]));

    for (const detail of input.detalle) {
      const receivable = receivableByItem.get(detail.idInventarioItem);
      if (receivable === undefined) {
        throw new Error(`El producto ${detail.idInventarioItem} no forma parte del despacho`);
      }
      if (detail.cantidadDanada > detail.cantidadRecibida) {
        throw new Error('La cantidad dañada no puede superar la cantidad recibida');
      }
      if (detail.cantidadDanada > 0 && !detail.ubicacionDanada?.trim()) {
        throw new Error('La ubicación del producto dañado es obligatoria');
      }
      if (detail.cantidadRecibida > receivable + 0.009) {
        throw new Error(`Devolución superior al saldo físico pendiente del producto ${detail.idInventarioItem}`);
      }
      if (!productsById.has(detail.idInventarioItem)) {
        throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
      }
      const product = productsById.get(detail.idInventarioItem);
      if (product?.EsEnvaseRetornable) {
        if (
          !Number.isInteger(detail.cantidadRecibida) ||
          !Number.isInteger(detail.cantidadDanada) ||
          !Number.isInteger(detail.cantidadEnvaseVacio) ||
          !Number.isInteger(detail.cantidadEnvaseLleno) ||
          detail.cantidadEnvaseVacio + detail.cantidadEnvaseLleno + detail.cantidadDanada !== detail.cantidadRecibida
        ) {
          throw new Error('Las cantidades vacías, llenas y dañadas deben coincidir con la devolución de envases');
        }
        if (detail.cantidadDanada > 0 && !detail.estadoEnvaseDanado) {
          throw new Error('Indica si los envases dañados estaban vacíos o llenos antes de dañarse');
        }
      } else if (
        detail.cantidadEnvaseVacio > 0 ||
        detail.cantidadEnvaseLleno > 0 ||
        detail.estadoEnvaseDanado
      ) {
        throw new Error('La clasificación vacío/lleno solo aplica a envases retornables');
      }
    }

    const returnRecord = await tx.devolucionRuta.create({
      data: {
        IdRutaSesion: idRutaSesion,
        IdUsuario: idUsuario,
        Observaciones: input.observaciones,
        Detalles: {
          create: input.detalle.map((detail) => ({
            IdInventarioItem: detail.idInventarioItem,
            CantidadRecibida: detail.cantidadRecibida,
            CantidadDanada: detail.cantidadDanada,
            CantidadEnvaseVacio: detail.cantidadEnvaseVacio,
            CantidadEnvaseLleno: detail.cantidadEnvaseLleno,
            EstadoEnvaseDanado: detail.estadoEnvaseDanado ?? null,
            Observaciones: detail.observaciones,
            UbicacionDanada: detail.cantidadDanada > 0 ? detail.ubicacionDanada?.trim() : null,
          })),
        },
      },
      include: { Detalles: true },
    });

    return returnRecord;
  });
}

export async function cancelRouteReturn(
  idRutaSesion: number,
  idUsuario: number,
  motivo: string,
  idDevolucion?: number,
) {
  return runSerializableTransaction(async (tx) => {
    const session = await tx.rutaSesion.findFirst({
      where: { Id: idRutaSesion, Anulado: false },
      select: {
        Id: true,
        Estado: true,
        AjustesRuta: { select: { Id: true }, take: 1 },
      },
    });
    if (!session) {
      throw new Error('RutaSesion no existe');
    }
    if (session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión debe estar EN_CURSO para anular la devolución');
    }
    if (session.AjustesRuta.length > 0) {
      throw new Error('No se puede anular la devolución después de autorizar diferencias');
    }

    const activeReturns = await tx.devolucionRuta.findMany({
      where: { IdRutaSesion: idRutaSesion, Anulado: false },
      select: { Id: true },
      orderBy: { FechaRegistro: 'asc' },
    });
    if (activeReturns.length === 0) {
      throw new Error('La sesión no tiene una devolución activa para anular');
    }
    let routeReturn = activeReturns[0];
    if (idDevolucion !== undefined) {
      const match = activeReturns.find((item) => item.Id === idDevolucion);
      if (!match) {
        throw new Error('La devolución indicada no existe o está anulado');
      }
      routeReturn = match;
    } else if (activeReturns.length > 1) {
      throw new Error('La sesión tiene varias devoluciones activas; especifique idDevolucion a anular');
    }

    await tx.devolucionRuta.update({
      where: { Id: routeReturn.Id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuario,
        FechaAnulacion: new Date(),
        MotivoAnulacion: motivo,
      },
    });

    return { idDevolucion: routeReturn.Id, anulada: true };
  });
}

export async function transferVerifiedRouteReturnToPlant(
  tx: RouteInventoryClient,
  idRutaSesion: number,
  idUsuario: number,
) {
  // D-DIST-06: una sesión puede acumular varias devoluciones activas (reabastecimiento
  // intermedio). Al cerrar la sesión se trasladan a planta TODAS las devoluciones activas
  // pendientes de traslado, no solo la primera, para no perder existencia física recibida.
  const activeReturns = await tx.devolucionRuta.findMany({
    where: { IdRutaSesion: idRutaSesion, Anulado: false },
    orderBy: { FechaRegistro: 'asc' },
    select: {
      Id: true,
      Detalles: {
        select: {
          IdInventarioItem: true,
          CantidadRecibida: true,
          CantidadDanada: true,
          CantidadEnvaseVacio: true,
          CantidadEnvaseLleno: true,
          EstadoEnvaseDanado: true,
        },
      },
    },
  });
  if (activeReturns.length === 0) {
    return;
  }

  const allItemIds = activeReturns.flatMap((routeReturn) => routeReturn.Detalles.map((detail) => detail.IdInventarioItem));
  if (allItemIds.length === 0) {
    return;
  }

  const products = await tx.inventarioItem.findMany({
    where: { Id: { in: allItemIds }, Anulado: false },
    select: { Id: true, Nombre: true, Existencia: true, EsEnvaseRetornable: true },
  });
  const productsById = new Map(products.map((product) => [product.Id, product]));

  for (const routeReturn of activeReturns) {
    for (const line of routeReturn.Detalles) {
      const idInventarioItem = line.IdInventarioItem;
      const product = productsById.get(idInventarioItem);
      if (!product) {
        throw new Error(`InventarioItem ${idInventarioItem} no existe o está anulado`);
      }

      const sellableQuantity = product.EsEnvaseRetornable
        ? line.CantidadEnvaseLleno
        : roundQuantity(line.CantidadRecibida - line.CantidadDanada);
      if (sellableQuantity > 0) {
        const existenciaAnterior = product.Existencia;
        const newExistence = roundQuantity(product.Existencia + sellableQuantity);
        await tx.inventarioItem.update({
          where: { Id: idInventarioItem },
          data: { Existencia: newExistence },
        });
        await registerInventoryMovement(tx, {
          idInventarioItem,
          idUsuario,
          tipoDocumento: 'DEV',
          documento: routeReturn.Id.toString(),
          nombre: `Traslado de devolución ruta #${idRutaSesion} a planta - ${product.Nombre}`,
          tipoMovimiento: true,
          existenciaAnterior,
          cantidad: sellableQuantity,
          nuevaExistencia: newExistence,
        });
        product.Existencia = newExistence;
      }

      if (product.EsEnvaseRetornable) {
        if (line.CantidadEnvaseVacio + line.CantidadEnvaseLleno + line.CantidadDanada !== line.CantidadRecibida) {
          throw new Error(`Falta clasificar la devolución física del envase ${product.Nombre}`);
        }
        if (line.CantidadEnvaseVacio > 0) {
          await transferEnvaseBucket(tx, {
            idInventarioItem,
            idUsuario,
            origen: { ubicacion: 'RUTA', estado: 'VACIO', idRutaSesion },
            destino: { ubicacion: 'PLANTA', estado: 'VACIO' },
            cantidad: line.CantidadEnvaseVacio,
            nombre: `Devolución ruta #${idRutaSesion} a planta - ${product.Nombre}`,
            tipoDocumento: 'DEV',
            documento: routeReturn.Id.toString(),
          });
        }
        if (line.CantidadEnvaseLleno > 0) {
          await transferEnvaseBucket(tx, {
            idInventarioItem,
            idUsuario,
            origen: { ubicacion: 'RUTA', estado: 'LLENO', idRutaSesion },
            destino: { ubicacion: 'PLANTA', estado: 'LLENO' },
            cantidad: line.CantidadEnvaseLleno,
            nombre: `Devolución ruta #${idRutaSesion} a planta - ${product.Nombre}`,
            tipoDocumento: 'DEV',
            documento: routeReturn.Id.toString(),
          });
        }
        if (line.CantidadDanada > 0) {
          const alreadyDamaged = await getEnvaseBucketQuantity(tx, idInventarioItem, {
            ubicacion: 'RUTA',
            estado: 'DANADO',
            idRutaSesion,
          });
          const damagedFromCustomerReturns = Math.min(alreadyDamaged, line.CantidadDanada);
          if (damagedFromCustomerReturns > 0) {
            await transferEnvaseBucket(tx, {
              idInventarioItem,
              idUsuario,
              origen: { ubicacion: 'RUTA', estado: 'DANADO', idRutaSesion },
              destino: { ubicacion: 'CUARENTENA', estado: 'DANADO' },
              cantidad: damagedFromCustomerReturns,
              nombre: `Envase dañado segregado al cierre ruta #${idRutaSesion} - ${product.Nombre}`,
              tipoDocumento: 'DEV',
              documento: routeReturn.Id.toString(),
            });
          }
          const damagedFromRouteStock = line.CantidadDanada - damagedFromCustomerReturns;
          if (damagedFromRouteStock > 0) {
            const damagedState = line.EstadoEnvaseDanado;
            if (!damagedState) {
              throw new Error(`Falta estado de origen de los envases dañados de ${product.Nombre}`);
            }
            await transferEnvaseBucket(tx, {
              idInventarioItem,
              idUsuario,
              origen: { ubicacion: 'RUTA', estado: damagedState as 'VACIO' | 'LLENO', idRutaSesion },
              destino: { ubicacion: 'CUARENTENA', estado: 'DANADO' },
              cantidad: damagedFromRouteStock,
              nombre: `Envase dañado segregado al cierre ruta #${idRutaSesion} - ${product.Nombre}`,
              tipoDocumento: 'DEV',
              documento: routeReturn.Id.toString(),
            });
          }
        }
      }
    }
  }
}

export async function createRouteAdjustment(
  idRutaSesion: number,
  idUsuario: number,
  input: { idInventarioItem: number; clasificacion: 'FALTANTE' | 'DANADO' | 'OTRO'; cantidad: number; motivo: string },
) {
  return runSerializableTransaction(async (tx) => {
    const inventory = await loadRouteInventory(tx, idRutaSesion);
    if (inventory.session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión de ruta debe estar EN_CURSO para autorizar diferencias');
    }
    if (!inventory.devolucion) {
      throw new Error('Registre primero la devolución física antes de autorizar diferencias');
    }

    const line = inventory.lines.find((item) => item.idInventarioItem === input.idInventarioItem);
    if (!line) {
      throw new Error(`El producto ${input.idInventarioItem} no forma parte del despacho`);
    }
    const pendingPhysical = roundQuantity(line.pendienteConciliacion - line.reservado);
    if (input.cantidad > pendingPhysical + 0.009) {
      throw new Error('El ajuste supera la diferencia pendiente de la ruta');
    }
    if (Math.abs(input.cantidad - pendingPhysical) > 0.009) {
      throw new Error('El ajuste debe cubrir exactamente la diferencia pendiente del producto');
    }

    return tx.ajusteRuta.create({
      data: {
        IdRutaSesion: idRutaSesion,
        IdInventarioItem: input.idInventarioItem,
        IdUsuario: idUsuario,
        Clasificacion: input.clasificacion,
        Cantidad: input.cantidad,
        Motivo: input.motivo,
      },
    });
  });
}

export async function getRouteSettlement(idRutaSesion: number) {
  const inventory = await getRouteInventory(idRutaSesion);
  return {
    ...inventory,
    diferenciasPendientes: inventory.productos.filter(
      (line) => line.pendienteConciliacion - line.reservado > 0.009,
    ),
    conciliada: inventory.productos.every(
      (line) => Math.abs(line.pendienteConciliacion) <= 0.009 && line.reservado <= 0.009,
    ),
  };
}
