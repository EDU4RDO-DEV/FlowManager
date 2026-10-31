import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { loadRouteInventory } from './route-inventory.service';
import { getEnvaseBucketQuantity, transferEnvaseBucket } from './inventory-movement.service';
import {
  assertRouteSessionAccess,
  getRouteSessionVisibilityWhere,
  type OperationalActor,
} from './operational-scope.service';

// D-DIST-04 (pendiente de ratificación): transferencia de inventario entre dos RutaSesion
// EN_CURSO (Escenario "transferencia parcial, ambos continúan operando"). Mientras
// EstadoConfirmacion = PENDIENTE la cantidad se descuenta del disponible de origen y NO
// se suma al destino, evitando doble conteo. Toda la operación corre dentro de una
// transacción SERIALIZABLE (runSerializableTransaction) para que dos transferencias
// concurrentes desde el mismo vehículo nunca puedan sobreasignar existencias: la segunda
// transacción reintenta tras un error de serialización y vuelve a leer el disponible ya
// descontado por la primera.

type TransferLineInput = {
  idInventarioItem: number;
  cantidad: number;
  estadoEnvase?: 'VACIO' | 'LLENO';
};

type CreateVehicleTransferInput = {
  idRutaSesionOrigen: number;
  idRutaSesionDestino: number;
  motivo: string;
  detalle: TransferLineInput[];
};

function toTransferDto(transfer: {
  Id: number;
  IdRutaSesionOrigen: number;
  IdRutaSesionDestino: number;
  IdUsuario: number;
  Motivo: string;
  EstadoConfirmacion: string;
  IdUsuarioConfirma: number | null;
  FechaConfirmacion: Date | null;
  FechaRegistro: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  MotivoAnulacion: string | null;
  Detalles: {
    Id: number;
    IdInventarioItem: number;
    NombreSnapshot: string;
    UnidadMedidaSnapshot: string | null;
    Cantidad: number;
    EstadoEnvase: string | null;
  }[];
}) {
  return {
    id: transfer.Id,
    idRutaSesionOrigen: transfer.IdRutaSesionOrigen,
    idRutaSesionDestino: transfer.IdRutaSesionDestino,
    idUsuario: transfer.IdUsuario,
    motivo: transfer.Motivo,
    estadoConfirmacion: transfer.EstadoConfirmacion,
    idUsuarioConfirma: transfer.IdUsuarioConfirma,
    fechaConfirmacion: transfer.FechaConfirmacion,
    fechaRegistro: transfer.FechaRegistro,
    anulado: transfer.Anulado,
    idUsuarioAnulador: transfer.IdUsuarioAnulador,
    fechaAnulacion: transfer.FechaAnulacion,
    motivoAnulacion: transfer.MotivoAnulacion,
    detalle: transfer.Detalles.map((detail) => ({
      idInventarioItem: detail.IdInventarioItem,
      nombre: detail.NombreSnapshot,
      unidadMedida: detail.UnidadMedidaSnapshot,
      cantidad: detail.Cantidad,
      estadoEnvase: detail.EstadoEnvase,
    })),
  };
}
export { toTransferDto };

async function assertSessionTransferable(
  tx: Parameters<typeof loadRouteInventory>[0],
  idRutaSesion: number,
  role: 'origen' | 'destino',
) {
  const session = await tx.rutaSesion.findFirst({
    where: { Id: idRutaSesion, Anulado: false },
    select: { Id: true, Estado: true },
  });
  if (!session) {
    throw new Error(`RutaSesion ${role} no existe`);
  }
  if (session.Estado !== 'EN_CURSO') {
    throw new Error(`La sesión de ${role} debe estar EN_CURSO para transferir inventario`);
  }
  return session;
}

async function moveConfirmedTransferEnvaseBuckets(
  tx: Parameters<typeof loadRouteInventory>[0],
  idUsuario: number,
  transfer: {
    Id: number;
    IdRutaSesionOrigen: number;
    IdRutaSesionDestino: number;
    Detalles: { IdInventarioItem: number; Cantidad: number; EstadoEnvase: string | null }[];
  },
) {
  const products = await tx.inventarioItem.findMany({
    where: { Id: { in: transfer.Detalles.map((detail) => detail.IdInventarioItem) }, Anulado: false },
    select: { Id: true, Nombre: true, EsEnvaseRetornable: true },
  });
  const productsById = new Map(products.map((product) => [product.Id, product]));

  for (const detail of transfer.Detalles) {
    const product = productsById.get(detail.IdInventarioItem);
    if (product?.EsEnvaseRetornable && (detail.EstadoEnvase === 'VACIO' || detail.EstadoEnvase === 'LLENO')) {
      await transferEnvaseBucket(tx, {
        idInventarioItem: detail.IdInventarioItem,
        idUsuario,
        origen: { ubicacion: 'RUTA', estado: detail.EstadoEnvase, idRutaSesion: transfer.IdRutaSesionOrigen },
        destino: { ubicacion: 'RUTA', estado: detail.EstadoEnvase, idRutaSesion: transfer.IdRutaSesionDestino },
        cantidad: detail.Cantidad,
        nombre: `Transferencia #${transfer.Id} - ${product.Nombre}`,
        tipoDocumento: 'TRV',
        documento: transfer.Id.toString(),
      });
    }
  }
}

// Reutilizable por route-handoff.service.ts: el relevo (D-DIST-02/03, custodia compartida)
// crea una transferencia ya CONFIRMADA dentro de la MISMA transacción que crea la sesión
// entrante, sin pasar por el flujo PENDIENTE → confirmar.
export async function createVehicleTransferWithinTx(
  tx: Parameters<typeof loadRouteInventory>[0],
  idUsuario: number,
  input: CreateVehicleTransferInput,
  options: { estadoConfirmacionInicial?: 'PENDIENTE' | 'CONFIRMADA'; idUsuarioConfirma?: number } = {},
) {
  if (input.idRutaSesionOrigen === input.idRutaSesionDestino) {
    throw new Error('La sesión de origen y destino deben ser diferentes');
  }
  if (input.detalle.length === 0) {
    throw new Error('detalle debe incluir al menos un producto');
  }

  await assertSessionTransferable(tx, input.idRutaSesionOrigen, 'origen');
  await assertSessionTransferable(tx, input.idRutaSesionDestino, 'destino');

  const inventory = await loadRouteInventory(tx, input.idRutaSesionOrigen);
  const disponibleByItem = new Map(
    inventory.lines.map((line) => [line.idInventarioItem, line.disponible]),
  );

  const products = await tx.inventarioItem.findMany({
    where: { Id: { in: input.detalle.map((item) => item.idInventarioItem) }, Anulado: false },
    select: { Id: true, Nombre: true, UnidadMedida: true, EsEnvaseRetornable: true },
  });
  const productsById = new Map(products.map((product) => [product.Id, product]));
  const solicitadoByItem = new Map<number, number>();
  const solicitadoPorEstado = new Map<string, number>();
  const detailKeys = new Set<string>();

  for (const line of input.detalle) {
    if (line.cantidad <= 0) {
      throw new Error('La cantidad a transferir debe ser mayor a cero');
    }
    const product = productsById.get(line.idInventarioItem);
    if (!product) {
      throw new Error(`InventarioItem ${line.idInventarioItem} no existe o está anulado`);
    }
    if (product.EsEnvaseRetornable && !line.estadoEnvase) {
      throw new Error(`Indica el estado del envase para ${product.Nombre}`);
    }
    if (!product.EsEnvaseRetornable && line.estadoEnvase) {
      throw new Error(`${product.Nombre} no está configurado como envase retornable`);
    }
    const key = `${line.idInventarioItem}|${product.EsEnvaseRetornable ? line.estadoEnvase : ''}`;
    if (detailKeys.has(key)) {
      throw new Error(`No repitas el producto ${product.Nombre} con el mismo estado de envase`);
    }
    detailKeys.add(key);
    solicitadoByItem.set(
      line.idInventarioItem,
      (solicitadoByItem.get(line.idInventarioItem) ?? 0) + line.cantidad,
    );
    if (product.EsEnvaseRetornable && line.estadoEnvase) {
      const stateKey = `${line.idInventarioItem}|${line.estadoEnvase}`;
      solicitadoPorEstado.set(
        stateKey,
        (solicitadoPorEstado.get(stateKey) ?? 0) + line.cantidad,
      );
    }
  }

  for (const [idInventarioItem, cantidadSolicitada] of solicitadoByItem) {
    const disponible = disponibleByItem.get(idInventarioItem) ?? 0;
    if (cantidadSolicitada > disponible + 0.009) {
      const product = productsById.get(idInventarioItem)!;
      throw new Error(
        `Existencia insuficiente en el vehículo de origen para ${product.Nombre}. Disponible ${disponible}, solicitado ${cantidadSolicitada}`,
      );
    }
  }

  for (const [stateKey, cantidadSolicitada] of solicitadoPorEstado) {
    const [idItemText, state] = stateKey.split('|');
    const idInventarioItem = Number(idItemText);
    const routeBucket = await getEnvaseBucketQuantity(tx, idInventarioItem, {
      ubicacion: 'RUTA',
      estado: state as 'VACIO' | 'LLENO',
      idRutaSesion: input.idRutaSesionOrigen,
    });
    const returnedFromState = inventory.session.DevolucionRuta
      .filter((routeReturn) => !routeReturn.Anulado)
      .flatMap((routeReturn) => routeReturn.Detalles)
      .filter((detail) => detail.IdInventarioItem === idInventarioItem)
      .reduce((total, detail) => {
        const receivedInState = state === 'VACIO'
          ? detail.CantidadEnvaseVacio
          : detail.CantidadEnvaseLleno;
        const damagedInState = detail.EstadoEnvaseDanado === state
          ? detail.CantidadDanada
          : 0;
        return total + receivedInState + damagedInState;
      }, 0);
    const pendingTransfersFromState = inventory.session.TransferenciasOrigen
      .filter((transfer) => transfer.EstadoConfirmacion === 'PENDIENTE')
      .flatMap((transfer) => transfer.Detalles)
      .filter((detail) =>
        detail.IdInventarioItem === idInventarioItem && detail.EstadoEnvase === state,
      )
      .reduce((total, detail) => total + detail.Cantidad, 0);
    const stateAvailable = Math.max(0, routeBucket - returnedFromState - pendingTransfersFromState);
    if (cantidadSolicitada > stateAvailable + 0.009) {
      const product = productsById.get(idInventarioItem)!;
      throw new Error(
        `Existencia insuficiente de envase ${state} en el vehículo de origen para ${product.Nombre}. Disponible ${stateAvailable}, solicitado ${cantidadSolicitada}`,
      );
    }
  }

  const estadoConfirmacionInicial = options.estadoConfirmacionInicial ?? 'PENDIENTE';
  const transfer = await tx.transferenciaVehiculo.create({
    data: {
      IdRutaSesionOrigen: input.idRutaSesionOrigen,
      IdRutaSesionDestino: input.idRutaSesionDestino,
      IdUsuario: idUsuario,
      Motivo: input.motivo,
      EstadoConfirmacion: estadoConfirmacionInicial,
      ...(estadoConfirmacionInicial === 'CONFIRMADA'
        ? { IdUsuarioConfirma: options.idUsuarioConfirma ?? idUsuario, FechaConfirmacion: new Date() }
        : {}),
      Detalles: {
        create: input.detalle.map((line) => {
          const product = productsById.get(line.idInventarioItem)!;
          return {
            IdInventarioItem: product.Id,
            NombreSnapshot: product.Nombre,
            UnidadMedidaSnapshot: product.UnidadMedida,
            Cantidad: line.cantidad,
            EstadoEnvase: product.EsEnvaseRetornable ? line.estadoEnvase : null,
          };
        }),
      },
    },
    include: { Detalles: true },
  });

  if (estadoConfirmacionInicial === 'CONFIRMADA') {
    await moveConfirmedTransferEnvaseBuckets(tx, options.idUsuarioConfirma ?? idUsuario, transfer);
  }

  return transfer;
}

export async function createVehicleTransfer(
  idUsuario: number,
  input: CreateVehicleTransferInput,
  actor?: OperationalActor,
) {
  return runSerializableTransaction(async (tx) => {
    if (actor) {
      await assertRouteSessionAccess(tx, input.idRutaSesionOrigen, actor);
      await assertRouteSessionAccess(tx, input.idRutaSesionDestino, actor);
    }
    const transfer = await createVehicleTransferWithinTx(tx, idUsuario, input);
    return toTransferDto(transfer);
  });
}

async function getActiveTransferOrThrow(
  tx: Parameters<typeof loadRouteInventory>[0],
  idTransferencia: number,
) {
  const transfer = await tx.transferenciaVehiculo.findFirst({
    where: { Id: idTransferencia, Anulado: false },
    include: { Detalles: true },
  });
  if (!transfer) {
    throw new Error('Transferencia no existe o está anulada');
  }
  return transfer;
}

export async function confirmVehicleTransfer(
  idTransferencia: number,
  idUsuario: number,
  actor?: OperationalActor,
) {
  return runSerializableTransaction(async (tx) => {
    const transfer = await getActiveTransferOrThrow(tx, idTransferencia);
    if (transfer.EstadoConfirmacion !== 'PENDIENTE') {
      throw new Error('Solo una transferencia PENDIENTE puede confirmarse');
    }
    if (actor) await assertRouteSessionAccess(tx, transfer.IdRutaSesionDestino, actor);
    await assertSessionTransferable(tx, transfer.IdRutaSesionDestino, 'destino');
    await assertSessionTransferable(tx, transfer.IdRutaSesionOrigen, 'origen');

    await moveConfirmedTransferEnvaseBuckets(tx, idUsuario, transfer);

    const confirmed = await tx.transferenciaVehiculo.update({
      where: { Id: transfer.Id },
      data: {
        EstadoConfirmacion: 'CONFIRMADA',
        IdUsuarioConfirma: idUsuario,
        FechaConfirmacion: new Date(),
      },
      include: { Detalles: true },
    });
    return toTransferDto(confirmed);
  });
}

export async function rejectVehicleTransfer(
  idTransferencia: number,
  idUsuario: number,
  motivo: string,
  actor?: OperationalActor,
) {
  return runSerializableTransaction(async (tx) => {
    const transfer = await getActiveTransferOrThrow(tx, idTransferencia);
    if (transfer.EstadoConfirmacion !== 'PENDIENTE') {
      throw new Error('Solo una transferencia PENDIENTE puede rechazarse');
    }
    if (actor) await assertRouteSessionAccess(tx, transfer.IdRutaSesionDestino, actor);

    const rejected = await tx.transferenciaVehiculo.update({
      where: { Id: transfer.Id },
      data: {
        EstadoConfirmacion: 'RECHAZADA',
        IdUsuarioConfirma: idUsuario,
        FechaConfirmacion: new Date(),
        MotivoAnulacion: motivo,
      },
      include: { Detalles: true },
    });
    return toTransferDto(rejected);
  });
}

export async function cancelVehicleTransfer(
  idTransferencia: number,
  idUsuario: number,
  motivo: string,
  actor?: OperationalActor,
) {
  return runSerializableTransaction(async (tx) => {
    const transfer = await getActiveTransferOrThrow(tx, idTransferencia);
    if (transfer.EstadoConfirmacion !== 'PENDIENTE') {
      throw new Error('Solo una transferencia PENDIENTE puede anularse; una transferencia CONFIRMADA requiere una contra-transferencia');
    }
    if (actor) await assertRouteSessionAccess(tx, transfer.IdRutaSesionOrigen, actor);

    const cancelled = await tx.transferenciaVehiculo.update({
      where: { Id: transfer.Id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuario,
        FechaAnulacion: new Date(),
        MotivoAnulacion: motivo,
      },
      include: { Detalles: true },
    });
    return toTransferDto(cancelled);
  });
}

export async function listVehicleTransfers(filters: {
  idRutaSesion?: number;
  estadoConfirmacion?: string;
}, actor?: OperationalActor) {
  const visibilityWhere = actor ? getRouteSessionVisibilityWhere(actor) : undefined;
  const visibleSessionIds = visibilityWhere
    ? (await prisma.rutaSesion.findMany({
        where: { Anulado: false, ...visibilityWhere },
        select: { Id: true },
      })).map((session) => session.Id)
    : undefined;
  if (visibleSessionIds?.length === 0) return [];

  const rows = await prisma.transferenciaVehiculo.findMany({
    where: {
      Anulado: false,
      ...(filters.estadoConfirmacion !== undefined
        ? { EstadoConfirmacion: filters.estadoConfirmacion }
        : {}),
      ...(filters.idRutaSesion !== undefined
        ? {
            OR: [
              { IdRutaSesionOrigen: filters.idRutaSesion },
              { IdRutaSesionDestino: filters.idRutaSesion },
            ],
          }
        : {}),
      ...(visibleSessionIds
        ? {
            AND: [{
              OR: [
                { IdRutaSesionOrigen: { in: visibleSessionIds } },
                { IdRutaSesionDestino: { in: visibleSessionIds } },
              ],
            }],
          }
        : {}),
    },
    include: { Detalles: true },
    orderBy: { FechaRegistro: 'desc' },
  });
  return rows.map(toTransferDto);
}
