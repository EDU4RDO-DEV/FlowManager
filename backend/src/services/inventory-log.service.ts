import { prisma } from '../config/prisma';

type ListInventoryLogInput = {
  page?: number;
  limit?: number;
  busqueda?: string;
  tipoMovimiento?: boolean;
  anulado?: boolean;
  idInventarioItem?: number;
};

function buildInventoryLogWhere(input: ListInventoryLogInput, forcedAnulado?: boolean) {
  return {
    ...(forcedAnulado !== undefined
      ? { Anulado: forcedAnulado }
      : input.anulado !== undefined
        ? { Anulado: input.anulado }
        : { Anulado: false }),
    ...(input.tipoMovimiento !== undefined ? { TipoMovimiento: input.tipoMovimiento } : {}),
    ...(input.idInventarioItem !== undefined ? { IdInventarioItem: input.idInventarioItem } : {}),
    ...(input.busqueda
      ? {
          OR: [
            {
              Nombre: {
                contains: input.busqueda,
              },
            },
            {
              InventarioItem: {
                Nombre: {
                  contains: input.busqueda,
                },
              },
            },
            {
              Documento: {
                contains: input.busqueda,
              },
            },
          ],
        }
      : {}),
  };
}

function toInventoryLogDto(movement: {
  Id: number;
  IdInventarioItem: number;
  IdUsuario: number;
  TipoDocumento: string | null;
  Documento: string | null;
  Nombre: string;
  TipoMovimiento: boolean;
  ExistenciaAnterior: number;
  Cantidad: number;
  NuevaExistencia: number;
  FechaRegistro: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItem: {
    Id: number;
    Nombre: string;
    Categoria: string;
    Anulado: boolean;
  };
  Usuario: {
    Id: number;
    Nombre: string;
    Correo: string;
  };
}) {
  return {
    id: movement.Id,
    idInventarioItem: movement.IdInventarioItem,
    idUsuario: movement.IdUsuario,
    tipoDocumento: movement.TipoDocumento,
    documento: movement.Documento,
    nombre: movement.Nombre,
    tipoMovimiento: movement.TipoMovimiento,
    existenciaAnterior: movement.ExistenciaAnterior,
    cantidad: movement.Cantidad,
    nuevaExistencia: movement.NuevaExistencia,
    fechaRegistro: movement.FechaRegistro,
    anulado: movement.Anulado,
    idUsuarioAnulador: movement.IdUsuarioAnulador,
    fechaAnulacion: movement.FechaAnulacion,
    inventarioItem: {
      id: movement.InventarioItem.Id,
      nombre: movement.InventarioItem.Nombre,
      categoria: movement.InventarioItem.Categoria,
      anulado: movement.InventarioItem.Anulado,
    },
    usuario: {
      id: movement.Usuario.Id,
      nombre: movement.Usuario.Nombre,
      correo: movement.Usuario.Correo,
    },
  };
}

export async function listInventoryLog(input: ListInventoryLogInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = buildInventoryLogWhere(input);

  const [total, movements] = await Promise.all([
    prisma.bitacoraInventario.count({ where }),
    prisma.bitacoraInventario.findMany({
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
            Anulado: true,
          },
        },
        Usuario: {
          select: {
            Id: true,
            Nombre: true,
            Correo: true,
          },
        },
      },
    }),
  ]);

  return {
    items: movements.map(toInventoryLogDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function listAnulatedInventoryLog(
  input: Pick<ListInventoryLogInput, 'busqueda' | 'tipoMovimiento' | 'idInventarioItem'> = {},
) {
  const where = buildInventoryLogWhere(
    {
      ...input,
      anulado: true,
    },
    true,
  );

  const movements = await prisma.bitacoraInventario.findMany({
    where,
    orderBy: { FechaAnulacion: 'desc' },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Anulado: true,
        },
      },
      Usuario: {
        select: {
          Id: true,
          Nombre: true,
          Correo: true,
        },
      },
    },
  });

  return movements.map(toInventoryLogDto);
}
