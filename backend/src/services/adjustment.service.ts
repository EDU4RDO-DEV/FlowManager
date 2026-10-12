import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { registerInventoryMovement } from './inventory-movement.service';

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
  NombreAjuste: string | null;
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
    nombreAjuste: adjustment.NombreAjuste,
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

async function getNextNumeroAjuste(tx: Prisma.TransactionClient): Promise<number> {
  const lastAdjustment = await tx.ajusteInventario.findFirst({
    orderBy: { NumeroAjuste: 'desc' },
    select: { NumeroAjuste: true },
  });

  return (lastAdjustment?.NumeroAjuste ?? 0) + 1;
}

export async function listAdjustments(input: ListAdjustmentsInput) {
  const { page, limit, skip } = resolvePagination(input);

  const where = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.tipoAjuste !== undefined ? { TipoAjuste: input.tipoAjuste } : {}),
    ...(input.idInventarioItem !== undefined ? { IdInventarioItem: input.idInventarioItem } : {}),
    ...(input.busqueda
      ? {
          OR: [
            {
              InventarioItem: {
                Nombre: {
                  contains: input.busqueda,
                },
              },
            },
            {
              NombreAjuste: {
                contains: input.busqueda,
              },
            },
          ],
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
    pagination: buildPaginationMeta(page, limit, total),
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

  const result = await runSerializableTransaction(async (tx) => {
    const numeroAjuste = await getNextNumeroAjuste(tx);
    const productIds = Array.from(new Set(input.items.map((item) => item.idInventarioItem)));
    const itemsInventario = await tx.inventarioItem.findMany({
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

    const createdAdjustments = [] as Array<
      Awaited<ReturnType<typeof tx.ajusteInventario.create>> & {
        InventarioItem: {
          Id: number;
          Nombre: string;
          Categoria: string;
          Existencia: number;
          Anulado: boolean;
        };
      }
    >;
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
          NombreAjuste: input.nombreAjuste,
          Observacion: input.observacion,
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

    return { numeroAjuste, items: createdAdjustments };
  });

  return {
    numeroAjuste: result.numeroAjuste,
    nombreAjuste: input.nombreAjuste,
    totalItems: result.items.length,
    items: result.items.map(toAdjustmentDto),
  };
}

export async function deleteAdjustment(id: number, idUsuarioAnulador?: number) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await runSerializableTransaction(async (tx) => {
    const existing = await tx.ajusteInventario.findFirst({
      where: { Id: id, Anulado: false },
      select: {
        Id: true,
        IdInventarioItem: true,
        IdUsuario: true,
        TipoAjuste: true,
        CantidadAjustada: true,
      },
    });

    if (!existing) {
      throw new Error('Ajuste de inventario no existe');
    }

    const item = await tx.inventarioItem.findUnique({
      where: { Id: existing.IdInventarioItem },
      select: { Id: true, Nombre: true, Existencia: true },
    });

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    const nuevaExistencia =
      existing.TipoAjuste === 'ENTRADA'
        ? item.Existencia - existing.CantidadAjustada
        : item.Existencia + existing.CantidadAjustada;

    if (nuevaExistencia < 0) {
      throw new Error(
        `No se puede anular: la reversión dejaría stock negativo (Stock actual: ${item.Existencia}, Reversión: ${existing.TipoAjuste === 'ENTRADA' ? '-' : '+'}${existing.CantidadAjustada})`,
      );
    }

    await tx.ajusteInventario.update({
      where: { Id: id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });

    await tx.inventarioItem.update({
      where: { Id: existing.IdInventarioItem },
      data: {
        Existencia: nuevaExistencia,
      },
    });

    await registerInventoryMovement(tx, {
      idInventarioItem: existing.IdInventarioItem,
      idUsuario: idUsuarioAnulador ?? existing.IdUsuario,
      tipoDocumento: 'AJAN',
      documento: existing.Id.toString(),
      nombre: `Reversión por anulación de ajuste #${existing.Id} - ${item.Nombre}`,
      tipoMovimiento: existing.TipoAjuste !== 'ENTRADA',
      existenciaAnterior: item.Existencia,
      cantidad: existing.CantidadAjustada,
      nuevaExistencia,
    });
  });
}

export async function restoreAdjustment(id: number, idUsuarioModificador?: number) {
  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const result = await runSerializableTransaction(async (tx) => {
    const existing = await tx.ajusteInventario.findFirst({
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

    const item = await tx.inventarioItem.findUnique({
      where: { Id: existing.IdInventarioItem },
      select: { Id: true, Nombre: true, Existencia: true },
    });

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }

    const nuevaExistencia =
      existing.TipoAjuste === 'ENTRADA'
        ? item.Existencia + existing.CantidadAjustada
        : item.Existencia - existing.CantidadAjustada;

    if (nuevaExistencia < 0) {
      throw new Error(
        `No se puede restaurar: dejaría stock negativo (Stock actual: ${item.Existencia}, Ajuste: ${existing.TipoAjuste === 'ENTRADA' ? '+' : '-'}${existing.CantidadAjustada})`,
      );
    }

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

    await tx.inventarioItem.update({
      where: { Id: existing.IdInventarioItem },
      data: {
        Existencia: nuevaExistencia,
      },
    });

    await registerInventoryMovement(tx, {
      idInventarioItem: existing.IdInventarioItem,
      idUsuario: idUsuarioModificador ?? existing.IdUsuario,
      tipoDocumento: 'AJRE',
      documento: existing.Id.toString(),
      nombre: `Reversión por restauración de ajuste #${existing.Id} - ${item.Nombre}`,
      tipoMovimiento: existing.TipoAjuste === 'ENTRADA',
      existenciaAnterior: item.Existencia,
      cantidad: existing.CantidadAjustada,
      nuevaExistencia,
    });

    return restored;
  });

  return toAdjustmentDto(result);
}
