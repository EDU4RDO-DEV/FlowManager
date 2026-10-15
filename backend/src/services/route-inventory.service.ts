import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { registerInventoryMovement } from './inventory-movement.service';
import { expireProformaReservations } from './proforma-reservation.service';

type RouteLineInput = {
  idInventarioItem: number;
  cantidad: number;
};

type RouteReturnLineInput = {
  idInventarioItem: number;
  cantidadRecibida: number;
  cantidadDanada: number;
  observaciones?: string;
  ubicacionDanada?: string;
};

type RouteInventoryClient = Prisma.TransactionClient;

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
}

async function loadRouteInventory(tx: RouteInventoryClient, idRutaSesion: number) {
  await expireProformaReservations(tx, idRutaSesion);

  const session = await tx.rutaSesion.findFirst({
    where: { Id: idRutaSesion, Anulado: false },
    select: {
      Id: true,
      Estado: true,
      DespachoRuta: {
        include: { Detalles: true },
      },
      DevolucionRuta: {
        include: { Detalles: true },
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
  for (const detail of session.DevolucionRuta?.Detalles ?? []) {
    returnedByItem.set(detail.IdInventarioItem, {
      cantidad: detail.CantidadRecibida,
      danada: detail.CantidadDanada,
    });
  }

  const adjustedByItem = new Map<number, number>();
  for (const adjustment of session.AjustesRuta) {
    adjustedByItem.set(
      adjustment.IdInventarioItem,
      roundQuantity((adjustedByItem.get(adjustment.IdInventarioItem) ?? 0) + adjustment.Cantidad),
    );
  }

  const lines = (session.DespachoRuta?.Detalles ?? []).map((detail) => {
    const sold = soldByItem.get(detail.IdInventarioItem) ?? 0;
    const commercialReturn = commercialReturnByItem.get(detail.IdInventarioItem);
    const commercialReturned = commercialReturn?.cantidad ?? 0;
    const commercialNonSellable = commercialReturn?.noVendible ?? 0;
    const returned = returnedByItem.get(detail.IdInventarioItem)?.cantidad ?? 0;
    const damaged = returnedByItem.get(detail.IdInventarioItem)?.danada ?? 0;
    const adjusted = adjustedByItem.get(detail.IdInventarioItem) ?? 0;
    const reserved = reservedByItem.get(detail.IdInventarioItem) ?? 0;
    const pendingReconciliation = roundQuantity(detail.Cantidad - sold + commercialReturned - returned - adjusted);

    return {
      idInventarioItem: detail.IdInventarioItem,
      nombre: detail.NombreSnapshot,
      unidadMedida: detail.UnidadMedidaSnapshot,
      despachado: detail.Cantidad,
      vendido: sold,
      devolucionComercial: commercialReturned,
      noVendibleComercial: commercialNonSellable,
      devuelto: returned,
      danado: damaged,
      ajustado: adjusted,
      reservado: reserved,
      pendienteConciliacion: pendingReconciliation,
      disponible: roundQuantity(pendingReconciliation - reserved - commercialNonSellable),
    };
  });

  return {
    session,
    despacho: session.DespachoRuta,
    devolucion: session.DevolucionRuta,
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
  if (inventory.devolucion) {
    throw new Error('No se pueden registrar ventas después de confirmar la devolución');
  }
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
        Venta: {
          where: { Anulado: false, TipoRegistro: 'VENTA' },
          select: { Id: true },
        },
      },
    });

    if (!session) {
      throw new Error('RutaSesion no existe');
    }
    if (session.Estado !== 'EN_CURSO') {
      throw new Error('La sesión de ruta debe estar EN_CURSO para despachar');
    }
    if (session.Venta.length > 0) {
      throw new Error('No se puede despachar una sesión que ya tiene ventas registradas');
    }
    if (await tx.despachoRuta.findUnique({ where: { IdRutaSesion: idRutaSesion }, select: { Id: true } })) {
      throw new Error('La sesión ya tiene un despacho confirmado');
    }

    const products = await tx.inventarioItem.findMany({
      where: {
        Id: { in: input.detalle.map((item) => item.idInventarioItem) },
        Anulado: false,
      },
      select: { Id: true, Nombre: true, UnidadMedida: true, Existencia: true },
    });
    const productsById = new Map(products.map((product) => [product.Id, product]));

    for (const detail of input.detalle) {
      const product = productsById.get(detail.idInventarioItem);
      if (!product) {
        throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
      }
      if (product.Existencia < detail.cantidad) {
        throw new Error(
          `Stock insuficiente para ${product.Nombre}. Existencia actual ${product.Existencia}, requerida ${detail.cantidad}`,
        );
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
    }

    return dispatch;
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
    if (inventory.devolucion) {
      throw new Error('La sesión ya tiene una devolución registrada');
    }

    const receivableByItem = new Map(
      inventory.lines.map((line) => [
        line.idInventarioItem,
        roundQuantity(line.pendienteConciliacion - line.reservado),
      ]),
    );
    const productIds = input.detalle.map((detail) => detail.idInventarioItem);
    const products = await tx.inventarioItem.findMany({
      where: { Id: { in: productIds }, Anulado: false },
      select: { Id: true },
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

export async function transferVerifiedRouteReturnToPlant(
  tx: RouteInventoryClient,
  idRutaSesion: number,
  idUsuario: number,
) {
  const routeReturn = await tx.devolucionRuta.findUnique({
    where: { IdRutaSesion: idRutaSesion },
    select: {
      Id: true,
      Detalles: {
        select: {
          IdInventarioItem: true,
          CantidadRecibida: true,
          CantidadDanada: true,
        },
      },
    },
  });
  if (!routeReturn) {
    return;
  }

  const sellableByItem = new Map<number, number>();
  for (const detail of routeReturn.Detalles) {
    const sellableQuantity = roundQuantity(detail.CantidadRecibida - detail.CantidadDanada);
    if (sellableQuantity > 0) {
      sellableByItem.set(
        detail.IdInventarioItem,
        roundQuantity((sellableByItem.get(detail.IdInventarioItem) ?? 0) + sellableQuantity),
      );
    }
  }

  if (sellableByItem.size === 0) {
    return;
  }

  const products = await tx.inventarioItem.findMany({
    where: { Id: { in: [...sellableByItem.keys()] }, Anulado: false },
    select: { Id: true, Nombre: true, Existencia: true },
  });
  const productsById = new Map(products.map((product) => [product.Id, product]));

  for (const [idInventarioItem, sellableQuantity] of sellableByItem) {
    const product = productsById.get(idInventarioItem);
    if (!product) {
      throw new Error(`InventarioItem ${idInventarioItem} no existe o está anulado`);
    }

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
      existenciaAnterior: product.Existencia,
      cantidad: sellableQuantity,
      nuevaExistencia: newExistence,
    });
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
