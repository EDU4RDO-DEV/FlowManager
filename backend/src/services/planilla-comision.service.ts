import { prisma } from '../config/prisma';

type CreateComisionConfigInput = {
  idUsuario: number;
  nombre: string;
};

type UpdateComisionConfigInput = {
  nombre?: string;
  idUsuarioModificador?: number;
};

type CreateReglaComisionInput = {
  idInventarioItem: number;
  cantidadMinima: number;
  cantidadMaxima?: number;
  porcentaje: number;
};

type UpdateReglaComisionInput = {
  idInventarioItem?: number;
  cantidadMinima?: number;
  cantidadMaxima?: number | null;
  porcentaje?: number;
  idUsuarioModificador?: number;
};

function toComisionConfigDto(config: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  FechaRegistro: Date | null;
  Anulado: boolean;
  ReglaComision?: Array<{
    Id: number;
    Anulado: boolean;
  }>;
}) {
  return {
    id: config.Id,
    idUsuario: config.IdUsuario,
    nombre: config.Nombre,
    fechaRegistro: config.FechaRegistro,
    anulado: config.Anulado,
    totalReglasActivas: config.ReglaComision
      ? config.ReglaComision.filter((regla) => !regla.Anulado).length
      : undefined,
  };
}

function toReglaComisionDto(regla: {
  Id: number;
  IdConfiguracionComision: number;
  IdInventarioItem: number;
  CantidadMinima: number;
  CantidadMaxima: number | null;
  Porcentaje: unknown;
  Anulado: boolean;
  InventarioItem?: {
    Id: number;
    Nombre: string;
  };
}) {
  return {
    id: regla.Id,
    idConfiguracionComision: regla.IdConfiguracionComision,
    idInventarioItem: regla.IdInventarioItem,
    cantidadMinima: regla.CantidadMinima,
    cantidadMaxima: regla.CantidadMaxima,
    porcentaje: Number(regla.Porcentaje),
    anulado: regla.Anulado,
    inventarioItem: regla.InventarioItem
      ? {
          id: regla.InventarioItem.Id,
          nombre: regla.InventarioItem.Nombre,
        }
      : undefined,
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

async function validateConfiguracionExists(idConfiguracionComision: number) {
  const config = await prisma.configuracionComision.findFirst({
    where: { Id: idConfiguracionComision, Anulado: false },
    select: { Id: true },
  });

  if (!config) {
    throw new Error('Configuracion de comision no existe');
  }
}

async function validateConfiguracionAnuladaExists(idConfiguracionComision: number) {
  const config = await prisma.configuracionComision.findFirst({
    where: { Id: idConfiguracionComision, Anulado: true },
    select: { Id: true },
  });

  if (!config) {
    throw new Error('Configuracion de comision anulada no existe');
  }
}

async function validateInventarioItemExists(idInventarioItem: number) {
  const item = await prisma.inventarioItem.findFirst({
    where: { Id: idInventarioItem, Anulado: false },
    select: { Id: true },
  });

  if (!item) {
    throw new Error('InventarioItem no existe');
  }
}

async function validateConfiguracionNameAvailable(nombre: string, exceptId?: number) {
  const config = await prisma.configuracionComision.findFirst({
    where: {
      Nombre: nombre,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (config) {
    throw new Error('Ya existe una configuracion de comision con ese nombre');
  }
}

function rangesOverlap(
  minA: number,
  maxA: number | null,
  minB: number,
  maxB: number | null,
) {
  const aMax = maxA ?? Number.POSITIVE_INFINITY;
  const bMax = maxB ?? Number.POSITIVE_INFINITY;
  return minA <= bMax && minB <= aMax;
}

async function validateReglaRangeAvailable(input: {
  idConfiguracionComision: number;
  idInventarioItem: number;
  cantidadMinima: number;
  cantidadMaxima: number | null;
  exceptId?: number;
}) {
  const existingRules = await prisma.reglaComision.findMany({
    where: {
      IdConfiguracionComision: input.idConfiguracionComision,
      IdInventarioItem: input.idInventarioItem,
      Anulado: false,
      ...(input.exceptId !== undefined ? { NOT: { Id: input.exceptId } } : {}),
    },
    select: {
      Id: true,
      CantidadMinima: true,
      CantidadMaxima: true,
    },
  });

  const hasOverlap = existingRules.some((rule) =>
    rangesOverlap(
      input.cantidadMinima,
      input.cantidadMaxima,
      rule.CantidadMinima,
      rule.CantidadMaxima,
    ),
  );

  if (hasOverlap) {
    throw new Error('La regla se solapa con otra regla activa para el mismo producto');
  }
}

export async function listComisionConfigs(anulado?: boolean) {
  const configs = await prisma.configuracionComision.findMany({
    where: {
      ...(anulado !== undefined ? { Anulado: anulado } : {}),
    },
    include: {
      ReglaComision: {
        select: {
          Id: true,
          Anulado: true,
        },
      },
    },
    orderBy: { Id: 'desc' },
  });

  return configs.map(toComisionConfigDto);
}

export async function listAnulatedComisionConfigs() {
  const configs = await prisma.configuracionComision.findMany({
    where: { Anulado: true },
    include: {
      ReglaComision: {
        select: {
          Id: true,
          Anulado: true,
        },
      },
    },
    orderBy: { Id: 'desc' },
  });

  return configs.map(toComisionConfigDto);
}

export async function getComisionConfigById(id: number) {
  const config = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      ReglaComision: {
        where: { Anulado: false },
        include: {
          InventarioItem: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
        orderBy: [{ IdInventarioItem: 'asc' }, { CantidadMinima: 'asc' }],
      },
    },
  });

  if (!config) {
    throw new Error('Configuracion de comision no existe');
  }

  return {
    ...toComisionConfigDto(config),
    reglas: config.ReglaComision.map(toReglaComisionDto),
  };
}

export async function createComisionConfig(input: CreateComisionConfigInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateConfiguracionNameAvailable(input.nombre);

  const created = await prisma.configuracionComision.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre,
      Anulado: false,
    },
  });

  return toComisionConfigDto(created);
}

export async function updateComisionConfig(id: number, input: UpdateComisionConfigInput) {
  const existing = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Configuracion de comision no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.nombre !== undefined) {
    await validateConfiguracionNameAvailable(input.nombre, id);
  }

  const updated = await prisma.configuracionComision.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
    },
  });

  return toComisionConfigDto(updated);
}

export async function deleteComisionConfig(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Configuracion de comision no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.$transaction(async (tx) => {
    await tx.configuracionComision.update({
      where: { Id: id },
      data: {
        Anulado: true,
      },
    });

    await tx.reglaComision.updateMany({
      where: {
        IdConfiguracionComision: id,
        Anulado: false,
      },
      data: {
        Anulado: true,
      },
    });
  });
}

export async function restoreComisionConfig(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, Nombre: true },
  });

  if (!existing) {
    throw new Error('Configuracion de comision anulada no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await validateConfiguracionNameAvailable(existing.Nombre, id);

  const restored = await prisma.configuracionComision.update({
    where: { Id: id },
    data: {
      Anulado: false,
    },
  });

  return toComisionConfigDto(restored);
}

export async function listReglasByComisionConfig(
  idConfiguracionComision: number,
  anulado = false,
) {
  await validateConfiguracionExists(idConfiguracionComision);

  const reglas = await prisma.reglaComision.findMany({
    where: {
      IdConfiguracionComision: idConfiguracionComision,
      Anulado: anulado,
    },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
    orderBy: [{ IdInventarioItem: 'asc' }, { CantidadMinima: 'asc' }],
  });

  return reglas.map(toReglaComisionDto);
}

export async function createReglaComision(
  idConfiguracionComision: number,
  input: CreateReglaComisionInput,
) {
  await validateConfiguracionExists(idConfiguracionComision);
  await validateInventarioItemExists(input.idInventarioItem);

  const cantidadMaxima = input.cantidadMaxima ?? null;

  if (cantidadMaxima !== null && cantidadMaxima < input.cantidadMinima) {
    throw new Error('cantidadMaxima debe ser mayor o igual a cantidadMinima');
  }

  await validateReglaRangeAvailable({
    idConfiguracionComision,
    idInventarioItem: input.idInventarioItem,
    cantidadMinima: input.cantidadMinima,
    cantidadMaxima,
  });

  const created = await prisma.reglaComision.create({
    data: {
      IdConfiguracionComision: idConfiguracionComision,
      IdInventarioItem: input.idInventarioItem,
      CantidadMinima: input.cantidadMinima,
      CantidadMaxima: cantidadMaxima,
      Porcentaje: input.porcentaje,
      Anulado: false,
    },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
  });

  return toReglaComisionDto(created);
}

export async function updateReglaComision(
  idConfiguracionComision: number,
  idRegla: number,
  input: UpdateReglaComisionInput,
) {
  await validateConfiguracionExists(idConfiguracionComision);

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const existing = await prisma.reglaComision.findFirst({
    where: {
      Id: idRegla,
      IdConfiguracionComision: idConfiguracionComision,
      Anulado: false,
    },
    select: {
      Id: true,
      IdInventarioItem: true,
      CantidadMinima: true,
      CantidadMaxima: true,
      Porcentaje: true,
    },
  });

  if (!existing) {
    throw new Error('Regla de comision no existe');
  }

  const nextIdInventarioItem = input.idInventarioItem ?? existing.IdInventarioItem;
  const nextCantidadMinima = input.cantidadMinima ?? existing.CantidadMinima;
  const nextCantidadMaxima =
    input.cantidadMaxima !== undefined ? input.cantidadMaxima : existing.CantidadMaxima;

  if (input.idInventarioItem !== undefined) {
    await validateInventarioItemExists(input.idInventarioItem);
  }

  if (nextCantidadMaxima !== null && nextCantidadMaxima < nextCantidadMinima) {
    throw new Error('cantidadMaxima debe ser mayor o igual a cantidadMinima');
  }

  await validateReglaRangeAvailable({
    idConfiguracionComision,
    idInventarioItem: nextIdInventarioItem,
    cantidadMinima: nextCantidadMinima,
    cantidadMaxima: nextCantidadMaxima,
    exceptId: idRegla,
  });

  const updated = await prisma.reglaComision.update({
    where: { Id: idRegla },
    data: {
      ...(input.idInventarioItem !== undefined
        ? { IdInventarioItem: input.idInventarioItem }
        : {}),
      ...(input.cantidadMinima !== undefined
        ? { CantidadMinima: input.cantidadMinima }
        : {}),
      ...(input.cantidadMaxima !== undefined ? { CantidadMaxima: input.cantidadMaxima } : {}),
      ...(input.porcentaje !== undefined ? { Porcentaje: input.porcentaje } : {}),
    },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
  });

  return toReglaComisionDto(updated);
}

export async function deleteReglaComision(
  idConfiguracionComision: number,
  idRegla: number,
  idUsuarioAnulador?: number,
) {
  await validateConfiguracionExists(idConfiguracionComision);

  const existing = await prisma.reglaComision.findFirst({
    where: {
      Id: idRegla,
      IdConfiguracionComision: idConfiguracionComision,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Regla de comision no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.reglaComision.update({
    where: { Id: idRegla },
    data: {
      Anulado: true,
    },
  });
}

export async function restoreReglaComision(
  idConfiguracionComision: number,
  idRegla: number,
  idUsuarioModificador?: number,
) {
  await validateConfiguracionExists(idConfiguracionComision);

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const existing = await prisma.reglaComision.findFirst({
    where: {
      Id: idRegla,
      IdConfiguracionComision: idConfiguracionComision,
      Anulado: true,
    },
    select: {
      Id: true,
      IdInventarioItem: true,
      CantidadMinima: true,
      CantidadMaxima: true,
    },
  });

  if (!existing) {
    throw new Error('Regla de comision anulada no existe');
  }

  await validateReglaRangeAvailable({
    idConfiguracionComision,
    idInventarioItem: existing.IdInventarioItem,
    cantidadMinima: existing.CantidadMinima,
    cantidadMaxima: existing.CantidadMaxima,
  });

  const restored = await prisma.reglaComision.update({
    where: { Id: idRegla },
    data: {
      Anulado: false,
    },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
  });

  return toReglaComisionDto(restored);
}

export async function validateComisionConfigCanBeUsed(idConfiguracionComision: number) {
  await validateConfiguracionExists(idConfiguracionComision);

  const totalReglasActivas = await prisma.reglaComision.count({
    where: {
      IdConfiguracionComision: idConfiguracionComision,
      Anulado: false,
    },
  });

  if (totalReglasActivas === 0) {
    throw new Error('La configuracion no tiene reglas activas');
  }
}

export async function validateComisionConfigExistsIncludingAnulated(
  idConfiguracionComision: number,
) {
  await validateConfiguracionAnuladaExists(idConfiguracionComision);
}
