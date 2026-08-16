import { prisma } from '../config/prisma';
import {
  anulateInventoryMovementByReference,
  registerInventoryMovement,
  restoreInventoryMovementByReference,
} from './inventory-movement.service';

type ListAdjustmentsInput = {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoAjuste?: string;
  anulado?: boolean;
  idInventarioItem?: number;
};

type CreateAdjustmentInput = {
  idUsuario: number;
  nombreAjuste: string;
  observacion: string;
  items: Array<{
    idInventarioItem: number;
    tipoAjuste: 'ENTRADA' | 'SALIDA';
    cantidadAjustada: number;
  }>;
};

function toAdjustmentDto(adjustment: {
  Id: number;
  IdInventarioItem: number;
  IdUsuario: number;
  TipoAjuste: string;
  NumeroAjuste: number;
  CantidadAjustada: number;
  Observacion: string | null;
  FechaRegistro: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItem: {
    Id: number;
    Nombre: string;
    Categoria: string;
    Existencia: number;
    Anulado: boolean;
  };
}) {
  return {
    id: adjustment.Id,
    idInventarioItem: adjustment.IdInventarioItem,
    idUsuario: adjustment.IdUsuario,
    tipoAjuste: adjustment.TipoAjuste,
    numeroAjuste: adjustment.NumeroAjuste,
    cantidadAjustada: adjustment.CantidadAjustada,
    observacion: adjustment.Observacion,
    fechaRegistro: adjustment.FechaRegistro,
    anulado: adjustment.Anulado,
    idUsuarioAnulador: adjustment.IdUsuarioAnulador,
    fechaAnulacion: adjustment.FechaAnulacion,
    inventarioItem: {
      id: adjustment.InventarioItem.Id,
      nombre: adjustment.InventarioItem.Nombre,
      categoria: adjustment.InventarioItem.Categoria,
      existencia: adjustment.InventarioItem.Existencia,
      anulado: adjustment.InventarioItem.Anulado,
    },
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

async function getNextNumeroAjuste(): Promise<number> {
  const lastAdjustment = await prisma.ajusteInventario.findFirst({
    orderBy: { NumeroAjuste: 'desc' },
    select: { NumeroAjuste: true },
  });

  return (lastAdjustment?.NumeroAjuste ?? 0) + 1;
}

export async function listAdjustments(input: ListAdjustmentsInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.tipoAjuste !== undefined ? { TipoAjuste: input.tipoAjuste } : {}),
    ...(input.idInventarioItem !== undefined ? { IdInventarioItem: input.idInventarioItem } : {}),
    ...(input.busqueda
      ? {
          InventarioItem: {
            Nombre: {
              contains: input.busqueda,
            },
          },
        }
      : {}),
  };

  const [total, adjustments] = await Promise.all([
    prisma.ajusteInventario.count({ where }),
    prisma.ajusteInventario.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: {
        InventarioItem: {
          select: {
            Id: true,
            Nombre: true,
            Categoria: true,
            Existencia: true,
            Anulado: true,
          },
        },
      },
    }),
  ]);

  return {
    items: adjustments.map(toAdjustmentDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function listAnulatedAdjustments() {
  const adjustments = await prisma.ajusteInventario.findMany({
    where: {
      Anulado: true,
    },
    orderBy: { FechaAnulacion: 'desc' },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          Anulado: true,
        },
      },
    },
  });

  return adjustments.map(toAdjustmentDto);
}

export async function getAdjustmentById(id: number) {
  const adjustment = await prisma.ajusteInventario.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          Anulado: true,
        },
      },
    },
  });

  if (!adjustment) {
    throw new Error('Ajuste de inventario no existe');
  }

  return toAdjustmentDto(adjustment);
}

export async function createAdjustment(input: CreateAdjustmentInput) {
  await validateUsuarioExists(input.idUsuario);

  if (input.items.length === 0) {
    throw new Error('Debes agregar al menos un item al ajuste');
  }

  const productIds = Array.from(new Set(input.items.map((item) => item.idInventarioItem)));
  const itemsInventario = await prisma.inventarioItem.findMany({
    where: {
      Id: { in: productIds },
      Anulado: false,
    },
    select: {
      Id: true,
      Existencia: true,
    },
  });

  if (itemsInventario.length !== productIds.length) {
    throw new Error('Item de inventario no existe');
  }

  const stockMap = new Map(itemsInventario.map((item) => [item.Id, item.Existencia]));

  for (const item of input.items) {
    const current = stockMap.get(item.idInventarioItem);
    if (current === undefined) {
      throw new Error('Item de inventario no existe');
    }

    const next =
      item.tipoAjuste === 'ENTRADA' ? current + item.cantidadAjustada : current - item.cantidadAjustada;

    if (next < 0) {
      throw new Error(
        `Stock insuficiente. Existencia actual: ${current}, Cantidad a descontar: ${item.cantidadAjustada}`,
      );
    }

    stockMap.set(item.idInventarioItem, next);
  }

  const numeroAjuste = await getNextNumeroAjuste();

  const observacionCompuesta = `${input.nombreAjuste}: ${input.observacion}`;

  // Transacción atómica: Ajuste + Stock + Bitácora
  const result = await prisma.$transaction(async (tx) => {
    const createdAdjustments = [] as Awaited<ReturnType<typeof tx.ajusteInventario.create>>[];
    const txStockMap = new Map(itemsInventario.map((item) => [item.Id, item.Existencia]));

    for (const item of input.items) {
      const existenciaAnterior = txStockMap.get(item.idInventarioItem);
      if (existenciaAnterior === undefined) {
        throw new Error('Item de inventario no existe');
      }

      const nuevaExistencia =
        item.tipoAjuste === 'ENTRADA'
          ? existenciaAnterior + item.cantidadAjustada
          : existenciaAnterior - item.cantidadAjustada;

      const ajuste = await tx.ajusteInventario.create({
        data: {
          IdInventarioItem: item.idInventarioItem,
          IdUsuario: input.idUsuario,
          TipoAjuste: item.tipoAjuste,
          NumeroAjuste: numeroAjuste,
          CantidadAjustada: item.cantidadAjustada,
          Observacion: observacionCompuesta,
          Anulado: false,
        },
        include: {
          InventarioItem: {
            select: {
              Id: true,
              Nombre: true,
              Categoria: true,
              Existencia: true,
              Anulado: true,
            },
          },
        },
      });

      await tx.inventarioItem.update({
        where: { Id: item.idInventarioItem },
        data: {
          Existencia: nuevaExistencia,
        },
      });

      await registerInventoryMovement(tx, {
        idInventarioItem: item.idInventarioItem,
        idUsuario: input.idUsuario,
        tipoDocumento: 'AJ',
        documento: ajuste.Id.toString(),
        nombre: `${input.nombreAjuste} #${numeroAjuste}`,
        tipoMovimiento: item.tipoAjuste === 'ENTRADA',
        existenciaAnterior,
        cantidad: item.cantidadAjustada,
        nuevaExistencia,
      });

      txStockMap.set(item.idInventarioItem, nuevaExistencia);
      createdAdjustments.push(ajuste);
    }

    return createdAdjustments;
  });

  return {
    numeroAjuste,
    nombreAjuste: input.nombreAjuste,
    totalItems: result.length,
    items: result.map(toAdjustmentDto),
  };
}

export async function deleteAdjustment(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.ajusteInventario.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdInventarioItem: true,
      TipoAjuste: true,
      CantidadAjustada: true,
    },
  });

  if (!existing) {
    throw new Error('Ajuste de inventario no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  // Obtener existencia actual
  const item = await prisma.inventarioItem.findUnique({
    where: { Id: existing.IdInventarioItem },
    select: { Existencia: true },
  });

  if (!item) {
    throw new Error('Item de inventario no encontrado');
  }

  // Calcular reversión: si el ajuste fue entrada, la anulación resta; si fue salida, la anulación suma
  const nuevaExistencia =
    existing.TipoAjuste === 'ENTRADA'
      ? item.Existencia - existing.CantidadAjustada
      : item.Existencia + existing.CantidadAjustada;

  // Validar que reversión no deje stock negativo
  if (nuevaExistencia < 0) {
    throw new Error(
      `No se puede anular: la reversión dejaría stock negativo (Stock actual: ${item.Existencia}, Reversión: ${existing.TipoAjuste === 'ENTRADA' ? '-' : '+'}${existing.CantidadAjustada})`,
    );
  }

  // Transacción atómica: Anular ajuste + Revertir stock + Anular bitácora correspondiente
  await prisma.$transaction(async (tx) => {
    // 1. Anular el ajuste
    await tx.ajusteInventario.update({
      where: { Id: id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });

    // 2. Revertir existencia del item
    await tx.inventarioItem.update({
      where: { Id: existing.IdInventarioItem },
      data: {
        Existencia: nuevaExistencia,
      },
    });

    // 3. Anular el movimiento en bitácora correspondiente
    await anulateInventoryMovementByReference(
      tx,
      {
        tipoDocumento: 'AJ',
        documento: existing.Id.toString(),
      },
      idUsuarioAnulador,
    );
  });
}

export async function restoreAdjustment(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.ajusteInventario.findFirst({
    where: { Id: id, Anulado: true },
    select: {
      Id: true,
      IdInventarioItem: true,
      IdUsuario: true,
      TipoAjuste: true,
      CantidadAjustada: true,
      NumeroAjuste: true,
    },
  });

  if (!existing) {
    throw new Error('Ajuste anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  // Obtener existencia actual
  const item = await prisma.inventarioItem.findUnique({
    where: { Id: existing.IdInventarioItem },
    select: { Existencia: true },
  });

  if (!item) {
    throw new Error('Item de inventario no encontrado');
  }

  // Calcular nueva existencia al restaurar
  const nuevaExistencia =
    existing.TipoAjuste === 'ENTRADA'
      ? item.Existencia + existing.CantidadAjustada
      : item.Existencia - existing.CantidadAjustada;

  // Validar que restauración no deje stock negativo
  if (nuevaExistencia < 0) {
    throw new Error(
      `No se puede restaurar: dejaría stock negativo (Stock actual: ${item.Existencia}, Ajuste: ${existing.TipoAjuste === 'ENTRADA' ? '+' : '-'}${existing.CantidadAjustada})`,
    );
  }

  // Transacción atómica: Restaurar ajuste + Aplicar stock + Restaurar bitácora
  const result = await prisma.$transaction(async (tx) => {
    // 1. Restaurar el ajuste
    const restored = await tx.ajusteInventario.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
      },
      include: {
        InventarioItem: {
          select: {
            Id: true,
            Nombre: true,
            Categoria: true,
            Existencia: true,
            Anulado: true,
          },
        },
      },
    });

    // 2. Aplicar existencia del item
    await tx.inventarioItem.update({
      where: { Id: existing.IdInventarioItem },
      data: {
        Existencia: nuevaExistencia,
      },
    });

    // 3. Restaurar el movimiento en bitácora
    await restoreInventoryMovementByReference(tx, {
      tipoDocumento: 'AJ',
      documento: existing.Id.toString(),
    });

    return restored;
  });

  return toAdjustmentDto(result);
}
