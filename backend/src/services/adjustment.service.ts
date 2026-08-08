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
  idInventarioItem: number;
  tipoAjuste: 'ENTRADA' | 'SALIDA';
  cantidadAjustada: number;
  observacion: string;
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

async function validateInventarioItemExists(idInventarioItem: number) {
  const item = await prisma.inventarioItem.findFirst({
    where: { Id: idInventarioItem, Anulado: false },
    select: { Id: true, Existencia: true },
  });

  if (!item) {
    throw new Error('Item de inventario no existe');
  }

  return item.Existencia;
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
  const existenciaActual = await validateInventarioItemExists(input.idInventarioItem);

  // Validar que ajuste negativo no deje stock negativo
  if (input.tipoAjuste === 'SALIDA') {
    if (existenciaActual < input.cantidadAjustada) {
      throw new Error(
        `Stock insuficiente. Existencia actual: ${existenciaActual}, Cantidad a descontar: ${input.cantidadAjustada}`,
      );
    }
  }

  const numeroAjuste = await getNextNumeroAjuste();

  // Calcular nueva existencia
  const nuevaExistencia =
    input.tipoAjuste === 'ENTRADA'
      ? existenciaActual + input.cantidadAjustada
      : existenciaActual - input.cantidadAjustada;

  // Transacción atómica: Ajuste + Stock + Bitácora
  const result = await prisma.$transaction(async (tx) => {
    // 1. Crear el ajuste
    const ajuste = await tx.ajusteInventario.create({
      data: {
        IdInventarioItem: input.idInventarioItem,
        IdUsuario: input.idUsuario,
        TipoAjuste: input.tipoAjuste,
        NumeroAjuste: numeroAjuste,
        CantidadAjustada: input.cantidadAjustada,
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

    // 2. Actualizar existencia del item
    await tx.inventarioItem.update({
      where: { Id: input.idInventarioItem },
      data: {
        Existencia: nuevaExistencia,
      },
    });

    // 3. Registrar en bitácora
    await registerInventoryMovement(tx, {
      idInventarioItem: input.idInventarioItem,
      idUsuario: input.idUsuario,
      tipoDocumento: 'AJ',
      documento: ajuste.Id.toString(),
      nombre: `Ajuste ${input.tipoAjuste.toLowerCase()} #${numeroAjuste}`,
      tipoMovimiento: input.tipoAjuste === 'ENTRADA',
      existenciaAnterior: existenciaActual,
      cantidad: input.cantidadAjustada,
      nuevaExistencia: nuevaExistencia,
    });

    return ajuste;
  });

  return toAdjustmentDto(result);
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
