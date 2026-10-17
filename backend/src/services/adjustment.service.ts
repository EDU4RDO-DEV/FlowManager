import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import {
  getEnvaseBucketQuantity,
  registerEnvaseBucketChange,
  registerInventoryMovement,
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
};

type AdjustmentOperationStatus = 'ACTIVO' | 'ANULADO' | 'PARCIAL';

type AdjustmentOperationRow = Prisma.AjusteInventarioGetPayload<{
  include: {
    InventarioItem: {
      select: {
        Id: true;
        Nombre: true;
        Categoria: true;
        Existencia: true;
        Anulado: true;
      };
    };
    Usuario: {
      select: {
        Id: true;
        Nombre: true;
      };
    };
  };
}>;

function getOperationSummary(
  rows: AdjustmentOperationRow[],
  typeRows: AdjustmentOperationRow[] = rows,
) {
  const types = Array.from(new Set(typeRows.map((row) => row.TipoAjuste)));
  const statuses = new Set(rows.map((row) => row.Anulado));
  const dates = rows
    .map((row) => row.FechaRegistro)
    .filter((date): date is Date => date !== null);
  const cancellationDates = rows
    .map((row) => row.FechaAnulacion)
    .filter((date): date is Date => date !== null);

  let estado: AdjustmentOperationStatus = 'PARCIAL';
  if (statuses.size === 1) {
    estado = statuses.has(true) ? 'ANULADO' : 'ACTIVO';
  }

  return {
    numeroAjuste: rows[0].NumeroAjuste,
    nombreAjuste: rows[0].NombreAjuste,
    observacion: rows[0].Observacion,
    fechaRegistro: dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null,
    fechaAnulacion: cancellationDates.length
      ? new Date(Math.max(...cancellationDates.map((date) => date.getTime())))
      : null,
    idUsuario: rows[0].IdUsuario,
    responsable: rows[0].Usuario.Nombre,
    tiposAjuste: types,
    tipoAjuste: types.length > 1 ? 'MIXTO' : (types[0] ?? 'MIXTO'),
    estado,
    totalProductos: rows.length,
  };
}

function parseAdjustmentNumberSearch(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const number = value.trim().replace(/^AJU[-\s]*/i, '');
  if (!/^\d+$/.test(number)) return undefined;

  const parsed = Number(number);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function getOperationRows(numeroAjuste: number): Promise<AdjustmentOperationRow[]> {
  return prisma.ajusteInventario.findMany({
    where: { NumeroAjuste: numeroAjuste },
    orderBy: { Id: 'asc' },
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
      Usuario: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
  });
}

export async function listAdjustmentOperations(input: ListAdjustmentsInput) {
  const { page, limit, skip } = resolvePagination(input);
  const numberSearch = parseAdjustmentNumberSearch(input.busqueda);
  const where: Prisma.AjusteInventarioWhereInput = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : {}),
    ...(input.tipoAjuste !== undefined ? { TipoAjuste: input.tipoAjuste } : {}),
    ...(input.idInventarioItem !== undefined ? { IdInventarioItem: input.idInventarioItem } : {}),
    ...(input.busqueda
      ? {
          OR: [
            { InventarioItem: { Nombre: { contains: input.busqueda } } },
            { NombreAjuste: { contains: input.busqueda } },
            { Observacion: { contains: input.busqueda } },
            ...(numberSearch !== undefined ? [{ NumeroAjuste: numberSearch }] : []),
          ],
        }
      : {}),
  };

  const [pageGroups, matchingGroups, summaryGroups] = await Promise.all([
    prisma.ajusteInventario.groupBy({
      by: ['NumeroAjuste'],
      where,
      orderBy: { NumeroAjuste: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ajusteInventario.groupBy({
      by: ['NumeroAjuste'],
      where,
    }),
    prisma.ajusteInventario.groupBy({
      by: ['NumeroAjuste', 'TipoAjuste', 'Anulado'],
    }),
  ]);

  const numbers = pageGroups.map((group) => group.NumeroAjuste);
  const pageRows = numbers.length
    ? await prisma.ajusteInventario.findMany({
        where: { NumeroAjuste: { in: numbers } },
        orderBy: { Id: 'asc' },
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
          Usuario: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      })
    : [];
  const pageRowsByNumber = new Map<number, AdjustmentOperationRow[]>();
  for (const row of pageRows) {
    const group = pageRowsByNumber.get(row.NumeroAjuste) ?? [];
    group.push(row);
    pageRowsByNumber.set(row.NumeroAjuste, group);
  }

  const summaryByNumber = new Map<number, { activeTypes: Set<string>; hasActive: boolean; hasAnulated: boolean }>();
  for (const group of summaryGroups) {
    const summary = summaryByNumber.get(group.NumeroAjuste) ?? {
      activeTypes: new Set<string>(),
      hasActive: false,
      hasAnulated: false,
    };
    if (group.Anulado) {
      summary.hasAnulated = true;
    } else {
      summary.hasActive = true;
      summary.activeTypes.add(group.TipoAjuste);
    }
    summaryByNumber.set(group.NumeroAjuste, summary);
  }

  let active = 0;
  let entradas = 0;
  let salidas = 0;
  let anulados = 0;
  let mixtos = 0;
  for (const summary of summaryByNumber.values()) {
    if (summary.hasActive) {
      active += 1;
      if (summary.activeTypes.has('ENTRADA')) entradas += 1;
      if (summary.activeTypes.has('SALIDA')) salidas += 1;
      if (summary.activeTypes.size > 1) mixtos += 1;
    }
    if (summary.hasAnulated) anulados += 1;
  }

  return {
    items: numbers.flatMap((number) => {
      const rows = pageRowsByNumber.get(number) ?? [];
      if (!rows.length) return [];
      const selectedRows = input.anulado === undefined
        ? rows
        : rows.filter((row) => row.Anulado === input.anulado);
      return [getOperationSummary(rows, selectedRows)];
    }),
    pagination: buildPaginationMeta(page, limit, matchingGroups.length),
    summary: {
      total: summaryByNumber.size,
      active,
      entradas,
      salidas,
      mixtos,
      anulados,
    },
  };
}

export async function getAdjustmentOperation(numeroAjuste: number) {
  const rows = await getOperationRows(numeroAjuste);
  if (!rows.length) {
    throw new Error('Ajuste de inventario no existe');
  }

  const movementRows = await prisma.bitacoraInventario.findMany({
    where: {
      TipoDocumento: 'AJ',
      Documento: { in: rows.map((row) => row.Id.toString()) },
      UbicacionEnvase: null,
      EstadoEnvase: null,
      IdMovimientoEnvase: null,
      IdDetalleVenta: null,
    },
    select: {
      Documento: true,
      ExistenciaAnterior: true,
      NuevaExistencia: true,
    },
    orderBy: { Id: 'asc' },
  });
  const movementsByDocument = new Map(
    movementRows
      .filter((movement) => movement.Documento !== null)
      .map((movement) => [movement.Documento as string, movement]),
  );

  return {
    ...getOperationSummary(rows),
    items: rows.map((row) => {
      const movement = movementsByDocument.get(row.Id.toString());
      return {
        ...toAdjustmentDto(row),
        existenciaAnterior: movement?.ExistenciaAnterior ?? null,
        existenciaResultante: movement?.NuevaExistencia ?? null,
      };
    }),
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
        EsEnvaseRetornable: true,
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
    const returnableItemIds = new Set(
      itemsInventario.filter((item) => item.EsEnvaseRetornable).map((item) => item.Id),
    );

    for (const item of input.items) {
      const existenciaAnterior = txStockMap.get(item.idInventarioItem);
      if (existenciaAnterior === undefined) {
        throw new Error('Item de inventario no existe');
      }

      const nuevaExistencia =
        item.tipoAjuste === 'ENTRADA'
          ? existenciaAnterior + item.cantidadAjustada
          : existenciaAnterior - item.cantidadAjustada;

      if (nuevaExistencia < 0) {
        throw new Error(
          `Stock insuficiente para el ajuste de salida. Existencia actual ${existenciaAnterior}, requerida ${item.cantidadAjustada}`,
        );
      }
      if (returnableItemIds.has(item.idInventarioItem)) {
        if (!Number.isInteger(item.cantidadAjustada)) {
          throw new Error('La cantidad de un ajuste de envases retornables debe ser entera');
        }
        if (item.tipoAjuste === 'SALIDA') {
          const pending = await getEnvaseBucketQuantity(tx, item.idInventarioItem, {
            ubicacion: 'PLANTA',
            estado: 'PENDIENTE_CONTEO',
          });
          if (pending < item.cantidadAjustada) {
            throw new Error('Los ajustes de salida de envases sólo pueden descontar unidades pendientes de conteo');
          }
        }
      }

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
      if (returnableItemIds.has(item.idInventarioItem)) {
        await registerEnvaseBucketChange(tx, {
          idInventarioItem: item.idInventarioItem,
          idUsuario: input.idUsuario,
          bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
          cantidad: item.cantidadAjustada,
          entrada: item.tipoAjuste === 'ENTRADA',
          nombre: `Ajuste de envase pendiente de clasificación #${ajuste.Id}`,
          tipoDocumento: 'AJ',
          documento: ajuste.Id.toString(),
        });
      }

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
      select: { Id: true, Nombre: true, Existencia: true, EsEnvaseRetornable: true },
    });

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }
    if (item.EsEnvaseRetornable) {
      if (!Number.isInteger(existing.CantidadAjustada)) {
        throw new Error('La cantidad del ajuste histórico de envases no es entera; requiere conciliación manual');
      }
      if (existing.TipoAjuste === 'ENTRADA') {
        const pending = await getEnvaseBucketQuantity(tx, item.Id, {
          ubicacion: 'PLANTA',
          estado: 'PENDIENTE_CONTEO',
        });
        if (pending < existing.CantidadAjustada) {
          throw new Error('No se puede anular el ajuste: reconcilia o verifica primero el estado de los envases');
        }
      }
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
    if (item.EsEnvaseRetornable) {
      await registerEnvaseBucketChange(tx, {
        idInventarioItem: item.Id,
        idUsuario: idUsuarioAnulador ?? existing.IdUsuario,
        bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
        cantidad: existing.CantidadAjustada,
        entrada: existing.TipoAjuste !== 'ENTRADA',
        nombre: `Reversión de ajuste de envase #${existing.Id}`,
        tipoDocumento: 'AJAN',
        documento: existing.Id.toString(),
      });
    }
  });
}

export async function deleteAdjustmentOperation(
  numeroAjuste: number,
  idUsuarioAnulador?: number,
) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await runSerializableTransaction(async (tx) => {
    const adjustments = await tx.ajusteInventario.findMany({
      where: { NumeroAjuste: numeroAjuste, Anulado: false },
      select: {
        Id: true,
        IdInventarioItem: true,
        IdUsuario: true,
        TipoAjuste: true,
        CantidadAjustada: true,
      },
      orderBy: { Id: 'asc' },
    });

    if (!adjustments.length) {
      throw new Error('Ajuste de inventario no existe');
    }

    for (const adjustment of adjustments) {
      const item = await tx.inventarioItem.findUnique({
        where: { Id: adjustment.IdInventarioItem },
        select: { Id: true, Nombre: true, Existencia: true, EsEnvaseRetornable: true },
      });
      if (!item) {
        throw new Error('Item de inventario no encontrado');
      }
      if (item.EsEnvaseRetornable) {
        if (!Number.isInteger(adjustment.CantidadAjustada)) {
          throw new Error('La cantidad del ajuste histórico de envases no es entera; requiere conciliación manual');
        }
        if (adjustment.TipoAjuste === 'ENTRADA') {
          const pending = await getEnvaseBucketQuantity(tx, item.Id, {
            ubicacion: 'PLANTA',
            estado: 'PENDIENTE_CONTEO',
          });
          if (pending < adjustment.CantidadAjustada) {
            throw new Error('No se puede anular el ajuste: reconcilia o verifica primero el estado de los envases');
          }
        }
      }

      const nuevaExistencia =
        adjustment.TipoAjuste === 'ENTRADA'
          ? item.Existencia - adjustment.CantidadAjustada
          : item.Existencia + adjustment.CantidadAjustada;
      if (nuevaExistencia < 0) {
        throw new Error(
          `No se puede anular: la reversión dejaría stock negativo (Stock actual: ${item.Existencia}, Reversión: ${adjustment.TipoAjuste === 'ENTRADA' ? '-' : '+'}${adjustment.CantidadAjustada})`,
        );
      }

      await tx.ajusteInventario.update({
        where: { Id: adjustment.Id },
        data: {
          Anulado: true,
          IdUsuarioAnulador: idUsuarioAnulador,
          FechaAnulacion: new Date(),
        },
      });
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario: idUsuarioAnulador ?? adjustment.IdUsuario,
        tipoDocumento: 'AJAN',
        documento: adjustment.Id.toString(),
        nombre: `Reversión por anulación de ajuste #${numeroAjuste} - ${item.Nombre}`,
        tipoMovimiento: adjustment.TipoAjuste !== 'ENTRADA',
        existenciaAnterior: item.Existencia,
        cantidad: adjustment.CantidadAjustada,
        nuevaExistencia,
      });
      if (item.EsEnvaseRetornable) {
        await registerEnvaseBucketChange(tx, {
          idInventarioItem: item.Id,
          idUsuario: idUsuarioAnulador ?? adjustment.IdUsuario,
          bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
          cantidad: adjustment.CantidadAjustada,
          entrada: adjustment.TipoAjuste !== 'ENTRADA',
          nombre: `Reversión de ajuste de envase #${adjustment.Id}`,
          tipoDocumento: 'AJAN',
          documento: adjustment.Id.toString(),
        });
      }
    }
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
      select: { Id: true, Nombre: true, Existencia: true, EsEnvaseRetornable: true },
    });

    if (!item) {
      throw new Error('Item de inventario no encontrado');
    }
    if (item.EsEnvaseRetornable) {
      if (!Number.isInteger(existing.CantidadAjustada)) {
        throw new Error('La cantidad del ajuste histórico de envases no es entera; requiere conciliación manual');
      }
      if (existing.TipoAjuste === 'SALIDA') {
        const pending = await getEnvaseBucketQuantity(tx, item.Id, {
          ubicacion: 'PLANTA',
          estado: 'PENDIENTE_CONTEO',
        });
        if (pending < existing.CantidadAjustada) {
          throw new Error('No se puede restaurar el ajuste: no hay suficientes envases pendientes de conteo');
        }
      }
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
    if (item.EsEnvaseRetornable) {
      await registerEnvaseBucketChange(tx, {
        idInventarioItem: item.Id,
        idUsuario: idUsuarioModificador ?? existing.IdUsuario,
        bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
        cantidad: existing.CantidadAjustada,
        entrada: existing.TipoAjuste === 'ENTRADA',
        nombre: `Restauración de ajuste de envase #${existing.Id}`,
        tipoDocumento: 'AJ',
        documento: existing.Id.toString(),
      });
    }

    return restored;
  });

  return toAdjustmentDto(result);
}

export async function restoreAdjustmentOperation(
  numeroAjuste: number,
  idUsuarioModificador?: number,
) {
  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await runSerializableTransaction(async (tx) => {
    const adjustments = await tx.ajusteInventario.findMany({
      where: { NumeroAjuste: numeroAjuste, Anulado: true },
      select: {
        Id: true,
        IdInventarioItem: true,
        IdUsuario: true,
        TipoAjuste: true,
        CantidadAjustada: true,
      },
      orderBy: { Id: 'asc' },
    });

    if (!adjustments.length) {
      throw new Error('Ajuste anulado no existe');
    }

    for (const adjustment of adjustments) {
      const item = await tx.inventarioItem.findUnique({
        where: { Id: adjustment.IdInventarioItem },
        select: { Id: true, Nombre: true, Existencia: true, EsEnvaseRetornable: true },
      });
      if (!item) {
        throw new Error('Item de inventario no encontrado');
      }
      if (item.EsEnvaseRetornable) {
        if (!Number.isInteger(adjustment.CantidadAjustada)) {
          throw new Error('La cantidad del ajuste histórico de envases no es entera; requiere conciliación manual');
        }
        if (adjustment.TipoAjuste === 'SALIDA') {
          const pending = await getEnvaseBucketQuantity(tx, item.Id, {
            ubicacion: 'PLANTA',
            estado: 'PENDIENTE_CONTEO',
          });
          if (pending < adjustment.CantidadAjustada) {
            throw new Error('No se puede restaurar el ajuste: no hay suficientes envases pendientes de conteo');
          }
        }
      }

      const nuevaExistencia =
        adjustment.TipoAjuste === 'ENTRADA'
          ? item.Existencia + adjustment.CantidadAjustada
          : item.Existencia - adjustment.CantidadAjustada;
      if (nuevaExistencia < 0) {
        throw new Error(
          `No se puede restaurar: dejaría stock negativo (Stock actual: ${item.Existencia}, Ajuste: ${adjustment.TipoAjuste === 'ENTRADA' ? '+' : '-'}${adjustment.CantidadAjustada})`,
        );
      }

      await tx.ajusteInventario.update({
        where: { Id: adjustment.Id },
        data: {
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        },
      });
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario: idUsuarioModificador ?? adjustment.IdUsuario,
        tipoDocumento: 'AJRE',
        documento: adjustment.Id.toString(),
        nombre: `Reversión por restauración de ajuste #${numeroAjuste} - ${item.Nombre}`,
        tipoMovimiento: adjustment.TipoAjuste === 'ENTRADA',
        existenciaAnterior: item.Existencia,
        cantidad: adjustment.CantidadAjustada,
        nuevaExistencia,
      });
      if (item.EsEnvaseRetornable) {
        await registerEnvaseBucketChange(tx, {
          idInventarioItem: item.Id,
          idUsuario: idUsuarioModificador ?? adjustment.IdUsuario,
          bucket: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
          cantidad: adjustment.CantidadAjustada,
          entrada: adjustment.TipoAjuste === 'ENTRADA',
          nombre: `Restauración de ajuste de envase #${adjustment.Id}`,
          tipoDocumento: 'AJ',
          documento: adjustment.Id.toString(),
        });
      }
    }
  });
}
