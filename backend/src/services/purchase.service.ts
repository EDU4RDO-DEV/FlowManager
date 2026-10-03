import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { registerInventoryMovement } from './inventory-movement.service';

type ListPurchasesInput = {
  page?: number;
  limit?: number;
  busqueda?: string;
  idProveedor?: number;
  esGasto?: boolean;
  anulado?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
};

type CreatePurchaseItemInput = {
  idInventarioItem: number;
  cantidad: number;
  costoUnitario: number;
};

type CreateExpenseItemInput = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

type CreatePurchaseInput = {
  idUsuario: number;
  idProveedor: number;
  numeroFactura: string;
  esGasto: boolean;
  observaciones?: string;
  fechaFactura: string;
  detalleCompra?: CreatePurchaseItemInput[];
  detalleGasto?: CreateExpenseItemInput[];
};

type UpdatePurchaseExpenseInput = {
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
  idUsuarioModificador?: number;
};

function toNumber(value: unknown): number {
  return Number(value);
}

function toDate(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('fechaFactura inválida');
  }

  return date;
}

function getSubtotal(cantidad: number, precioUnitario: number): number {
  return Number((cantidad * precioUnitario).toFixed(2));
}

function formatDocumentoId(id: number): string {
  return id.toString();
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

async function validateProveedorExists(idProveedor: number) {
  const proveedor = await prisma.proveedor.findFirst({
    where: {
      Id: idProveedor,
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    select: { Id: true },
  });

  if (!proveedor) {
    throw new Error('Proveedor no existe');
  }
}

async function validateNumeroFacturaDisponible(idProveedor: number, numeroFactura: string) {
  const existing = await prisma.compra.findFirst({
    where: {
      IdProveedor: idProveedor,
      NumeroFactura: numeroFactura,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe una compra activa con ese numeroFactura para este proveedor');
  }
}

async function getNextNumeroCompra(): Promise<number> {
  const lastPurchase = await prisma.compra.findFirst({
    orderBy: { NumeroCompra: 'desc' },
    select: { NumeroCompra: true },
  });

  return (lastPurchase?.NumeroCompra ?? 0) + 1;
}

function toPurchaseDto(purchase: {
  Id: number;
  IdProveedor: number;
  IdUsuario: number;
  NumeroCompra: number;
  NumeroFactura: string;
  EsGasto: boolean;
  Observaciones: string | null;
  FechaFactura: Date;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Proveedor: {
    Id: number;
    Nombre?: string;
    Anulado: boolean;
    Entidad?: {
      NombreCompleto: string;
    };
  };
  Usuario: {
    Id: number;
    Nombre: string;
    Correo: string;
  };
  DetalleCompra: Array<{
    Id: number;
    IdCompra: number;
    IdInventarioItem: number;
    Cantidad: number;
    CostoUnitario: unknown;
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
  }>;
  DetalleGasto: Array<{
    Id: number;
    IdCompra: number;
    Descripcion: string;
    Cantidad: unknown;
    PrecioUnitario: unknown;
    FechaRegistro: Date | null;
    IdUsuarioModificador: number | null;
    FechaModificacion: Date | null;
    Anulado: boolean;
    IdUsuarioAnulador: number | null;
    FechaAnulacion: Date | null;
  }>;
}) {
  const detalleCompra = purchase.DetalleCompra.map((detail) => ({
    id: detail.Id,
    idCompra: detail.IdCompra,
    idInventarioItem: detail.IdInventarioItem,
    cantidad: detail.Cantidad,
    costoUnitario: toNumber(detail.CostoUnitario),
    subtotal: getSubtotal(detail.Cantidad, toNumber(detail.CostoUnitario)),
    fechaRegistro: detail.FechaRegistro,
    anulado: detail.Anulado,
    idUsuarioAnulador: detail.IdUsuarioAnulador,
    fechaAnulacion: detail.FechaAnulacion,
    inventarioItem: {
      id: detail.InventarioItem.Id,
      nombre: detail.InventarioItem.Nombre,
      categoria: detail.InventarioItem.Categoria,
      existencia: detail.InventarioItem.Existencia,
      anulado: detail.InventarioItem.Anulado,
    },
  }));

  const detalleGasto = purchase.DetalleGasto.map((detail) => ({
    id: detail.Id,
    idCompra: detail.IdCompra,
    descripcion: detail.Descripcion,
    cantidad: toNumber(detail.Cantidad),
    precioUnitario: toNumber(detail.PrecioUnitario),
    subtotal: getSubtotal(toNumber(detail.Cantidad), toNumber(detail.PrecioUnitario)),
    fechaRegistro: detail.FechaRegistro,
    idUsuarioModificador: detail.IdUsuarioModificador,
    fechaModificacion: detail.FechaModificacion,
    anulado: detail.Anulado,
    idUsuarioAnulador: detail.IdUsuarioAnulador,
    fechaAnulacion: detail.FechaAnulacion,
  }));

  const totalDetalleCompra = detalleCompra.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDetalleGasto = detalleGasto.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: purchase.Id,
    idProveedor: purchase.IdProveedor,
    idUsuario: purchase.IdUsuario,
    numeroCompra: purchase.NumeroCompra,
    numeroFactura: purchase.NumeroFactura,
    esGasto: purchase.EsGasto,
    observaciones: purchase.Observaciones,
    fechaFactura: purchase.FechaFactura,
    fechaRegistro: purchase.FechaRegistro,
    idUsuarioModificador: purchase.IdUsuarioModificador,
    fechaModificacion: purchase.FechaModificacion,
    anulado: purchase.Anulado,
    idUsuarioAnulador: purchase.IdUsuarioAnulador,
    fechaAnulacion: purchase.FechaAnulacion,
    proveedor: {
      id: purchase.Proveedor.Id,
      nombre: purchase.Proveedor.Entidad?.NombreCompleto ?? purchase.Proveedor.Nombre ?? '',
      anulado: purchase.Proveedor.Anulado,
    },
    usuario: {
      id: purchase.Usuario.Id,
      nombre: purchase.Usuario.Nombre,
      correo: purchase.Usuario.Correo,
    },
    detalleCompra,
    detalleGasto,
    totalDetalleCompra: Number(totalDetalleCompra.toFixed(2)),
    totalDetalleGasto: Number(totalDetalleGasto.toFixed(2)),
    totalGeneral: Number((totalDetalleCompra + totalDetalleGasto).toFixed(2)),
  };
}

export async function listPurchases(input: ListPurchasesInput) {
  const { page, limit, skip } = resolvePagination(input);

  const where = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.idProveedor !== undefined ? { IdProveedor: input.idProveedor } : {}),
    ...(input.esGasto !== undefined ? { EsGasto: input.esGasto } : {}),
    ...(input.fechaDesde || input.fechaHasta
      ? {
          FechaFactura: {
            ...(input.fechaDesde ? { gte: toDate(input.fechaDesde) } : {}),
            ...(input.fechaHasta ? { lte: toDate(input.fechaHasta) } : {}),
          },
        }
      : {}),
    ...(input.busqueda
      ? {
          OR: [
            {
              NumeroFactura: {
                contains: input.busqueda,
              },
            },
            {
              Proveedor: {
                Entidad: {
                  NombreCompleto: {
                    contains: input.busqueda,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, purchases] = await Promise.all([
    prisma.compra.count({ where }),
    prisma.compra.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: {
        Proveedor: {
          select: {
            Id: true,
            Anulado: true,
            Entidad: {
              select: {
                NombreCompleto: true,
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
        DetalleCompra: {
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
        },
        DetalleGasto: true,
      },
    }),
  ]);

  return {
    items: purchases.map(toPurchaseDto),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getPurchaseById(id: number) {
  const purchase = await prisma.compra.findFirst({
    where: { Id: id },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Anulado: true,
          Entidad: {
            select: {
              NombreCompleto: true,
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
      DetalleCompra: {
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
      },
      DetalleGasto: true,
    },
  });

  if (!purchase) {
    throw new Error('Compra no existe');
  }

  return toPurchaseDto(purchase);
}

export async function createPurchase(input: CreatePurchaseInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateProveedorExists(input.idProveedor);
  await validateNumeroFacturaDisponible(input.idProveedor, input.numeroFactura);

  const detailItems = input.esGasto ? input.detalleGasto ?? [] : input.detalleCompra ?? [];
  if (detailItems.length === 0) {
    throw new Error('Debe enviar al menos un detalle para registrar la compra');
  }

  const numeroCompra = await getNextNumeroCompra();

  const created = await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.create({
      data: {
        IdProveedor: input.idProveedor,
        IdUsuario: input.idUsuario,
        NumeroCompra: numeroCompra,
        NumeroFactura: input.numeroFactura,
        EsGasto: input.esGasto,
        Observaciones: input.observaciones,
        FechaFactura: toDate(input.fechaFactura),
        Anulado: false,
      },
      select: {
        Id: true,
      },
    });

    if (input.esGasto) {
      const expenses = input.detalleGasto ?? [];
      for (const expense of expenses) {
        await tx.detalleGasto.create({
          data: {
            IdCompra: compra.Id,
            Descripcion: expense.descripcion,
            Cantidad: expense.cantidad,
            PrecioUnitario: expense.precioUnitario,
            Anulado: false,
          },
        });
      }
    } else {
      const details = input.detalleCompra ?? [];
      for (const detail of details) {
        const item = await tx.inventarioItem.findFirst({
          where: {
            Id: detail.idInventarioItem,
            Anulado: false,
          },
          select: {
            Id: true,
            Nombre: true,
            Existencia: true,
            CostoPromedio: true,
          },
        });

        if (!item) {
          throw new Error(`InventarioItem ${detail.idInventarioItem} no existe o está anulado`);
        }

        await tx.detalleCompra.create({
          data: {
            IdCompra: compra.Id,
            IdInventarioItem: detail.idInventarioItem,
            Cantidad: detail.cantidad,
            CostoUnitario: detail.costoUnitario,
            Anulado: false,
          },
        });

        const existenciaAnterior = item.Existencia;
        const nuevaExistencia = existenciaAnterior + detail.cantidad;

        const costoAnterior = Number(item.CostoPromedio);
        const nuevoCostoPromedio =
          nuevaExistencia > 0
            ? (costoAnterior * existenciaAnterior + detail.costoUnitario * detail.cantidad) / nuevaExistencia
            : costoAnterior;

        await tx.inventarioItem.update({
          where: { Id: item.Id },
          data: {
            Existencia: nuevaExistencia,
            CostoPromedio: nuevoCostoPromedio,
          },
        });

        await registerInventoryMovement(tx, {
          idInventarioItem: item.Id,
          idUsuario: input.idUsuario,
          tipoDocumento: 'COM',
          documento: formatDocumentoId(compra.Id),
          nombre: `Entrada compra #${numeroCompra} - ${item.Nombre}`,
          tipoMovimiento: true,
          existenciaAnterior,
          cantidad: detail.cantidad,
          nuevaExistencia,
        });
      }
    }

    return tx.compra.findFirst({
      where: { Id: compra.Id },
      include: {
        Proveedor: {
          select: {
            Id: true,
            Anulado: true,
            Entidad: {
              select: {
                NombreCompleto: true,
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
        DetalleCompra: {
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
        },
        DetalleGasto: true,
      },
    });
  });

  if (!created) {
    throw new Error('No se pudo registrar la compra');
  }

  return toPurchaseDto(created);
}

export async function anulatePurchase(id: number, idUsuarioAnulador?: number) {
  const purchase = await prisma.compra.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    include: {
      DetalleCompra: {
        where: { Anulado: false },
        select: {
          Id: true,
          IdInventarioItem: true,
          Cantidad: true,
        },
      },
      DetalleGasto: {
        where: { Anulado: false },
        select: {
          Id: true,
        },
      },
    },
  });

  if (!purchase) {
    throw new Error('Compra no existe o ya está anulada');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.$transaction(async (tx) => {
    const fechaAnulacion = new Date();

    if (!purchase.EsGasto) {
      for (const detail of purchase.DetalleCompra) {
        const item = await tx.inventarioItem.findFirst({
          where: {
            Id: detail.IdInventarioItem,
            Anulado: false,
          },
          select: {
            Id: true,
            Nombre: true,
            Existencia: true,
          },
        });

        if (!item) {
          throw new Error(`InventarioItem ${detail.IdInventarioItem} no existe o está anulado`);
        }

        if (item.Existencia < detail.Cantidad) {
          throw new Error(
            `No se puede anular compra: stock insuficiente en ${item.Nombre}. Existencia actual ${item.Existencia}, cantidad a revertir ${detail.Cantidad}`,
          );
        }

        const existenciaAnterior = item.Existencia;
        const nuevaExistencia = existenciaAnterior - detail.Cantidad;

        await tx.inventarioItem.update({
          where: { Id: item.Id },
          data: {
            Existencia: nuevaExistencia,
          },
        });

        await registerInventoryMovement(tx, {
          idInventarioItem: item.Id,
          idUsuario: idUsuarioAnulador ?? purchase.IdUsuario,
          tipoDocumento: 'COMAN',
          documento: formatDocumentoId(purchase.Id),
          nombre: `Salida por anulación compra #${purchase.NumeroCompra} - ${item.Nombre}`,
          tipoMovimiento: false,
          existenciaAnterior,
          cantidad: detail.Cantidad,
          nuevaExistencia,
        });
      }

      await tx.detalleCompra.updateMany({
        where: { IdCompra: purchase.Id, Anulado: false },
        data: {
          Anulado: true,
          IdUsuarioAnulador: idUsuarioAnulador,
          FechaAnulacion: fechaAnulacion,
        },
      });
    }

    if (purchase.EsGasto && purchase.DetalleGasto.length > 0) {
      await tx.detalleGasto.updateMany({
        where: { IdCompra: purchase.Id, Anulado: false },
        data: {
          Anulado: true,
          IdUsuarioAnulador: idUsuarioAnulador,
          FechaAnulacion: fechaAnulacion,
        },
      });
    }

    await tx.compra.update({
      where: { Id: purchase.Id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: fechaAnulacion,
      },
    });
  });
}

export async function restorePurchase(id: number, idUsuarioModificador?: number) {
  const purchase = await prisma.compra.findFirst({
    where: {
      Id: id,
      Anulado: true,
    },
    include: {
      DetalleCompra: {
        where: { Anulado: true },
        select: {
          Id: true,
          IdInventarioItem: true,
          Cantidad: true,
        },
      },
      DetalleGasto: {
        where: { Anulado: true },
        select: {
          Id: true,
        },
      },
    },
  });

  if (!purchase) {
    throw new Error('Compra anulada no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.$transaction(async (tx) => {
    const fechaModificacion = new Date();

    if (!purchase.EsGasto) {
      for (const detail of purchase.DetalleCompra) {
        const item = await tx.inventarioItem.findFirst({
          where: {
            Id: detail.IdInventarioItem,
            Anulado: false,
          },
          select: {
            Id: true,
            Nombre: true,
            Existencia: true,
          },
        });

        if (!item) {
          throw new Error(`InventarioItem ${detail.IdInventarioItem} no existe o está anulado`);
        }

        const existenciaAnterior = item.Existencia;
        const nuevaExistencia = existenciaAnterior + detail.Cantidad;

        await tx.inventarioItem.update({
          where: { Id: item.Id },
          data: {
            Existencia: nuevaExistencia,
          },
        });

        await registerInventoryMovement(tx, {
          idInventarioItem: item.Id,
          idUsuario: idUsuarioModificador ?? purchase.IdUsuario,
          tipoDocumento: 'COMRES',
          documento: formatDocumentoId(purchase.Id),
          nombre: `Entrada por restauración compra #${purchase.NumeroCompra} - ${item.Nombre}`,
          tipoMovimiento: true,
          existenciaAnterior,
          cantidad: detail.Cantidad,
          nuevaExistencia,
        });
      }

      await tx.detalleCompra.updateMany({
        where: { IdCompra: purchase.Id, Anulado: true },
        data: {
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        },
      });
    }

    if (purchase.EsGasto && purchase.DetalleGasto.length > 0) {
      await tx.detalleGasto.updateMany({
        where: { IdCompra: purchase.Id, Anulado: true },
        data: {
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        },
      });
    }

    await tx.compra.update({
      where: { Id: purchase.Id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: fechaModificacion,
      },
    });

    return tx.compra.findFirst({
      where: { Id: purchase.Id },
      include: {
        Proveedor: {
          select: {
            Id: true,
            Anulado: true,
            Entidad: {
              select: {
                NombreCompleto: true,
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
        DetalleCompra: {
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
        },
        DetalleGasto: true,
      },
    });
  });

  if (!restored) {
    throw new Error('No se pudo restaurar la compra');
  }

  return toPurchaseDto(restored);
}

export async function listPurchaseExpenses(idCompra: number) {
  const purchase = await prisma.compra.findFirst({
    where: { Id: idCompra, Anulado: false },
    select: {
      Id: true,
    },
  });

  if (!purchase) {
    throw new Error('Compra no existe');
  }

  const expenses = await prisma.detalleGasto.findMany({
    where: {
      IdCompra: idCompra,
      Anulado: false,
    },
    orderBy: { Id: 'desc' },
  });

  return expenses.map((expense) => ({
    id: expense.Id,
    idCompra: expense.IdCompra,
    descripcion: expense.Descripcion,
    cantidad: toNumber(expense.Cantidad),
    precioUnitario: toNumber(expense.PrecioUnitario),
    subtotal: getSubtotal(toNumber(expense.Cantidad), toNumber(expense.PrecioUnitario)),
    fechaRegistro: expense.FechaRegistro,
    idUsuarioModificador: expense.IdUsuarioModificador,
    fechaModificacion: expense.FechaModificacion,
    anulado: expense.Anulado,
    idUsuarioAnulador: expense.IdUsuarioAnulador,
    fechaAnulacion: expense.FechaAnulacion,
  }));
}

export async function createPurchaseExpense(idCompra: number, input: CreateExpenseItemInput) {
  const purchase = await prisma.compra.findFirst({
    where: {
      Id: idCompra,
      Anulado: false,
    },
    select: {
      Id: true,
      EsGasto: true,
    },
  });

  if (!purchase) {
    throw new Error('Compra no existe');
  }

  if (!purchase.EsGasto) {
    throw new Error('Solo se pueden asociar gastos en compras marcadas como gasto');
  }

  const created = await prisma.detalleGasto.create({
    data: {
      IdCompra: idCompra,
      Descripcion: input.descripcion,
      Cantidad: input.cantidad,
      PrecioUnitario: input.precioUnitario,
      Anulado: false,
    },
  });

  return {
    id: created.Id,
    idCompra: created.IdCompra,
    descripcion: created.Descripcion,
    cantidad: toNumber(created.Cantidad),
    precioUnitario: toNumber(created.PrecioUnitario),
    subtotal: getSubtotal(toNumber(created.Cantidad), toNumber(created.PrecioUnitario)),
    fechaRegistro: created.FechaRegistro,
    idUsuarioModificador: created.IdUsuarioModificador,
    fechaModificacion: created.FechaModificacion,
    anulado: created.Anulado,
    idUsuarioAnulador: created.IdUsuarioAnulador,
    fechaAnulacion: created.FechaAnulacion,
  };
}

export async function updatePurchaseExpense(
  idCompra: number,
  idGasto: number,
  input: UpdatePurchaseExpenseInput,
) {
  const expense = await prisma.detalleGasto.findFirst({
    where: {
      Id: idGasto,
      IdCompra: idCompra,
      Anulado: false,
    },
    select: {
      Id: true,
    },
  });

  if (!expense) {
    throw new Error('Detalle de gasto no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const updated = await prisma.detalleGasto.update({
    where: { Id: idGasto },
    data: {
      ...(input.descripcion !== undefined ? { Descripcion: input.descripcion } : {}),
      ...(input.cantidad !== undefined ? { Cantidad: input.cantidad } : {}),
      ...(input.precioUnitario !== undefined
        ? { PrecioUnitario: input.precioUnitario }
        : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });

  return {
    id: updated.Id,
    idCompra: updated.IdCompra,
    descripcion: updated.Descripcion,
    cantidad: toNumber(updated.Cantidad),
    precioUnitario: toNumber(updated.PrecioUnitario),
    subtotal: getSubtotal(toNumber(updated.Cantidad), toNumber(updated.PrecioUnitario)),
    fechaRegistro: updated.FechaRegistro,
    idUsuarioModificador: updated.IdUsuarioModificador,
    fechaModificacion: updated.FechaModificacion,
    anulado: updated.Anulado,
    idUsuarioAnulador: updated.IdUsuarioAnulador,
    fechaAnulacion: updated.FechaAnulacion,
  };
}

export async function deletePurchaseExpense(
  idCompra: number,
  idGasto: number,
  idUsuarioAnulador?: number,
) {
  const expense = await prisma.detalleGasto.findFirst({
    where: {
      Id: idGasto,
      IdCompra: idCompra,
      Anulado: false,
    },
    select: {
      Id: true,
    },
  });

  if (!expense) {
    throw new Error('Detalle de gasto no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.detalleGasto.update({
    where: { Id: idGasto },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restorePurchaseExpense(
  idCompra: number,
  idGasto: number,
  idUsuarioModificador?: number,
) {
  const expense = await prisma.detalleGasto.findFirst({
    where: {
      Id: idGasto,
      IdCompra: idCompra,
      Anulado: true,
    },
    select: {
      Id: true,
    },
  });

  if (!expense) {
    throw new Error('Detalle de gasto anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const updated = await prisma.detalleGasto.update({
    where: { Id: idGasto },
    data: {
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });

  return {
    id: updated.Id,
    idCompra: updated.IdCompra,
    descripcion: updated.Descripcion,
    cantidad: toNumber(updated.Cantidad),
    precioUnitario: toNumber(updated.PrecioUnitario),
    subtotal: getSubtotal(toNumber(updated.Cantidad), toNumber(updated.PrecioUnitario)),
    fechaRegistro: updated.FechaRegistro,
    idUsuarioModificador: updated.IdUsuarioModificador,
    fechaModificacion: updated.FechaModificacion,
    anulado: updated.Anulado,
    idUsuarioAnulador: updated.IdUsuarioAnulador,
    fechaAnulacion: updated.FechaAnulacion,
  };
}
