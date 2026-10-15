import { prisma } from '../config/prisma';

type CreateComisionConfigInput = {
  idUsuario: number;
  nombre: string;
  esGeneral?: boolean;
  fechaInicioVigencia?: string;
};

type UpdateComisionConfigInput = {
  nombre?: string;
  esGeneral?: boolean;
  idUsuarioModificador?: number;
};

type CategoryCommissionScheduleInput = {
  idUsuario: number;
  fechaInicioVigencia: string;
  categorias: Array<{
    idCategoriaComision: number;
    reglas: Array<{ montoMinimoVenta: number; porcentaje: number }>;
  }>;
};

type CreateReglaComisionInput = {
  idInventarioItem: number;
  cantidadMinima: number;
  cantidadMaxima?: number;
  tipoCalculo: 'PORCENTAJE_VENTA' | 'MONTO_POR_UNIDAD';
  porcentaje: number;
  montoPorUnidad?: number;
};

type UpdateReglaComisionInput = {
  idInventarioItem?: number;
  cantidadMinima?: number;
  cantidadMaxima?: number | null;
  tipoCalculo?: 'PORCENTAJE_VENTA' | 'MONTO_POR_UNIDAD';
  porcentaje?: number;
  montoPorUnidad?: number | null;
  idUsuarioModificador?: number;
};

function toComisionConfigDto(config: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  EsGeneral: boolean;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  ReglaComision?: Array<{
    Id: number;
    Anulado: boolean;
  }>;
}) {
  return {
    id: config.Id,
    idUsuario: config.IdUsuario,
    nombre: config.Nombre,
    esGeneral: config.EsGeneral,
    fechaRegistro: config.FechaRegistro,
    idUsuarioModificador: config.IdUsuarioModificador,
    fechaModificacion: config.FechaModificacion,
    anulado: config.Anulado,
    idUsuarioAnulador: config.IdUsuarioAnulador,
    fechaAnulacion: config.FechaAnulacion,
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
  TipoCalculo: string;
  Porcentaje: unknown;
  MontoPorUnidad: unknown;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
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
    tipoCalculo: regla.TipoCalculo,
    porcentaje: Number(regla.Porcentaje),
    montoPorUnidad: regla.MontoPorUnidad === null ? null : Number(regla.MontoPorUnidad),
    fechaRegistro: regla.FechaRegistro,
    idUsuarioModificador: regla.IdUsuarioModificador,
    fechaModificacion: regla.FechaModificacion,
    anulado: regla.Anulado,
    idUsuarioAnulador: regla.IdUsuarioAnulador,
    fechaAnulacion: regla.FechaAnulacion,
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
      ReglasPorCategoria: {
        where: { Anulado: false },
        include: {
          CategoriaComision: {
            select: { Id: true, Clave: true, Nombre: true },
          },
        },
        orderBy: [
          { IdCategoriaComision: 'asc' },
          { FechaInicioVigencia: 'desc' },
          { MontoMinimoVenta: 'asc' },
        ],
          },
    },
  });

  if (!config) {
    throw new Error('Configuracion de comision no existe');
  }

  return {
    ...toComisionConfigDto(config),
    reglas: config.ReglaComision.map(toReglaComisionDto),
    reglasPorCategoria: config.ReglasPorCategoria.map((rule) => ({
      id: rule.Id,
      idCategoriaComision: rule.IdCategoriaComision,
      categoria: {
        id: rule.CategoriaComision.Id,
        clave: rule.CategoriaComision.Clave,
        nombre: rule.CategoriaComision.Nombre,
      },
      montoMinimoVenta: Number(rule.MontoMinimoVenta),
      porcentaje: Number(rule.Porcentaje),
      fechaInicioVigencia: rule.FechaInicioVigencia,
      fechaFinVigencia: rule.FechaFinVigencia,
    })),
  };
}

function dateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('fechaInicioVigencia inválida');
  }
  return date;
}

const DEFAULT_CATEGORY_RATES = {
  GARRAFONES: [{ montoMinimoVenta: 0, porcentaje: 3 }],
  OTROS: [
    { montoMinimoVenta: 0, porcentaje: 3.09 },
    { montoMinimoVenta: 30000, porcentaje: 3.1 },
    ...Array.from({ length: 12 }, (_, index) => ({
      montoMinimoVenta: 35000 + index * 5000,
      porcentaje: 3.11 + index * 0.01,
    })),
  ],
};

async function seedDefaultCategoryRates(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  idConfiguracionComision: number,
  idUsuario: number,
  fechaInicioVigencia: Date,
) {
  const categories = await tx.categoriaComision.findMany({
    where: { Clave: { in: Object.keys(DEFAULT_CATEGORY_RATES) }, Activa: true },
    select: { Id: true, Clave: true },
  });
  const categoryIds = new Map(categories.map((category) => [category.Clave, category.Id]));
  if (categoryIds.size !== Object.keys(DEFAULT_CATEGORY_RATES).length) {
    throw new Error('Faltan las categorías de comisión iniciales.');
  }

  const rows = Object.entries(DEFAULT_CATEGORY_RATES).flatMap(([key, rates]) => {
    const idCategoriaComision = categoryIds.get(key);
    if (!idCategoriaComision) {
      throw new Error('Faltan las categorías de comisión iniciales.');
    }
    return rates.map((rate) => ({
      IdConfiguracionComision: idConfiguracionComision,
      IdCategoriaComision: idCategoriaComision,
      MontoMinimoVenta: rate.montoMinimoVenta,
      Porcentaje: Number(rate.porcentaje.toFixed(2)),
      FechaInicioVigencia: fechaInicioVigencia,
      IdUsuarioRegistro: idUsuario,
      Anulado: false,
    }));
  });
  await tx.reglaComisionCategoria.createMany({ data: rows });
}

export async function createComisionConfig(input: CreateComisionConfigInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateConfiguracionNameAvailable(input.nombre);

  if (input.esGeneral) {
    const existingGeneral = await prisma.configuracionComision.findFirst({
      where: { EsGeneral: true, Anulado: false },
      select: { Id: true },
    });
    if (existingGeneral) {
      throw new Error('Ya existe una configuración general de comisión activa.');
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const config = await tx.configuracionComision.create({
      data: {
        IdUsuario: input.idUsuario,
        Nombre: input.nombre,
        EsGeneral: input.esGeneral ?? false,
        Anulado: false,
      },
    });
    if (input.esGeneral) {
      const effectiveDate = input.fechaInicioVigencia
        ? dateOnly(input.fechaInicioVigencia)
        : new Date(new Date().toISOString().slice(0, 10));
      await seedDefaultCategoryRates(tx, config.Id, input.idUsuario, effectiveDate);
    }
    return config;
  });

  return toComisionConfigDto(created);
}

export async function updateComisionConfig(id: number, input: UpdateComisionConfigInput) {
  const existing = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, EsGeneral: true },
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
  if (input.esGeneral && !existing.EsGeneral) {
    const existingGeneral = await prisma.configuracionComision.findFirst({
      where: { EsGeneral: true, Anulado: false, NOT: { Id: id } },
      select: { Id: true },
    });
    if (existingGeneral) {
      throw new Error('Ya existe una configuración general de comisión activa.');
    }
  }

  const updated = await prisma.configuracionComision.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.esGeneral !== undefined ? { EsGeneral: input.esGeneral } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
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
        ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
        FechaAnulacion: new Date(),
      },
    });

    await tx.reglaComision.updateMany({
      where: {
        IdConfiguracionComision: id,
        Anulado: false,
      },
      data: {
        Anulado: true,
        ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
        FechaAnulacion: new Date(),
      },
    });
    await tx.reglaComisionCategoria.updateMany({
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
      ...(idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
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

export async function listCommissionCategories() {
  return prisma.categoriaComision.findMany({
    where: { Activa: true },
    select: { Id: true, Clave: true, Nombre: true },
    orderBy: { Id: 'asc' },
  });
}

export async function setCategoryCommissionSchedule(
  idConfiguracionComision: number,
  input: CategoryCommissionScheduleInput,
) {
  await validateConfiguracionExists(idConfiguracionComision);
  await validateUsuarioExists(input.idUsuario);
  const effectiveDate = dateOnly(input.fechaInicioVigencia);
  const categories = await listCommissionCategories();
  const categoryIds = new Set(categories.map((category) => category.Id));
  if (
    input.categorias.length !== categoryIds.size ||
    new Set(input.categorias.map((category) => category.idCategoriaComision)).size !== categoryIds.size ||
    input.categorias.some((category) => !categoryIds.has(category.idCategoriaComision))
  ) {
    throw new Error('Debe configurar exactamente una escala para cada categoría de comisión activa.');
  }

  for (const category of input.categorias) {
    if (
      category.reglas.length === 0 ||
      category.reglas[0].montoMinimoVenta !== 0 ||
      category.reglas.some((rule, index) =>
        rule.montoMinimoVenta < 0 ||
        rule.porcentaje <= 0 ||
        rule.porcentaje > 100 ||
        (index > 0 && rule.montoMinimoVenta <= category.reglas[index - 1].montoMinimoVenta),
      )
    ) {
      throw new Error('Cada escala debe comenzar en Q0 y tener umbrales crecientes y porcentajes válidos.');
    }
  }

  const categoryIdList = input.categorias.map((category) => category.idCategoriaComision);
  const futureRules = await prisma.reglaComisionCategoria.findFirst({
    where: {
      IdConfiguracionComision: idConfiguracionComision,
      IdCategoriaComision: { in: categoryIdList },
      Anulado: false,
      FechaInicioVigencia: { gte: effectiveDate },
    },
    select: { Id: true },
  });
  if (futureRules) {
    throw new Error('Ya existe una escala con vigencia igual o posterior a la fecha indicada.');
  }

  const previousDate = new Date(effectiveDate);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  await prisma.$transaction(async (tx) => {
    await tx.reglaComisionCategoria.updateMany({
      where: {
        IdConfiguracionComision: idConfiguracionComision,
        IdCategoriaComision: { in: categoryIdList },
        Anulado: false,
        FechaInicioVigencia: { lt: effectiveDate },
        OR: [
          { FechaFinVigencia: null },
          { FechaFinVigencia: { gte: effectiveDate } },
        ],
      },
      data: { FechaFinVigencia: previousDate },
    });

    await tx.reglaComisionCategoria.createMany({
      data: input.categorias.flatMap((category) =>
        category.reglas.map((rule) => ({
          IdConfiguracionComision: idConfiguracionComision,
          IdCategoriaComision: category.idCategoriaComision,
          MontoMinimoVenta: rule.montoMinimoVenta,
          Porcentaje: rule.porcentaje,
          FechaInicioVigencia: effectiveDate,
          IdUsuarioRegistro: input.idUsuario,
          Anulado: false,
        })),
      ),
    });
  });

  return getComisionConfigById(idConfiguracionComision);
}

export async function createReglaComision(
  idConfiguracionComision: number,
  input: CreateReglaComisionInput,
) {
  await validateConfiguracionExists(idConfiguracionComision);
  await validateInventarioItemExists(input.idInventarioItem);

  const cantidadMaxima = input.cantidadMaxima ?? null;
  const montoPorUnidad = input.montoPorUnidad ?? null;

  if (cantidadMaxima !== null && cantidadMaxima < input.cantidadMinima) {
    throw new Error('cantidadMaxima debe ser mayor o igual a cantidadMinima');
  }

  if (input.tipoCalculo === 'PORCENTAJE_VENTA' && input.porcentaje <= 0) {
    throw new Error('porcentaje debe ser mayor a 0 para PORCENTAJE_VENTA');
  }

  if (
    input.tipoCalculo === 'MONTO_POR_UNIDAD' &&
    (montoPorUnidad === null || montoPorUnidad <= 0)
  ) {
    throw new Error('montoPorUnidad debe ser mayor a 0 para MONTO_POR_UNIDAD');
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
      TipoCalculo: input.tipoCalculo,
      Porcentaje: input.tipoCalculo === 'PORCENTAJE_VENTA' ? input.porcentaje : 0,
      MontoPorUnidad: input.tipoCalculo === 'MONTO_POR_UNIDAD' ? montoPorUnidad : null,
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
      TipoCalculo: true,
      Porcentaje: true,
      MontoPorUnidad: true,
    },
  });

  if (!existing) {
    throw new Error('Regla de comision no existe');
  }

  const nextIdInventarioItem = input.idInventarioItem ?? existing.IdInventarioItem;
  const nextCantidadMinima = input.cantidadMinima ?? existing.CantidadMinima;
  const nextCantidadMaxima =
    input.cantidadMaxima !== undefined ? input.cantidadMaxima : existing.CantidadMaxima;
  const nextTipoCalculo = input.tipoCalculo ?? existing.TipoCalculo;
  const nextPorcentaje = input.porcentaje ?? Number(existing.Porcentaje);
  const nextMontoPorUnidad =
    input.montoPorUnidad !== undefined
      ? input.montoPorUnidad
      : existing.MontoPorUnidad === null
        ? null
        : Number(existing.MontoPorUnidad);

  if (input.idInventarioItem !== undefined) {
    await validateInventarioItemExists(input.idInventarioItem);
  }

  if (nextCantidadMaxima !== null && nextCantidadMaxima < nextCantidadMinima) {
    throw new Error('cantidadMaxima debe ser mayor o igual a cantidadMinima');
  }

  if (nextTipoCalculo === 'PORCENTAJE_VENTA' && nextPorcentaje <= 0) {
    throw new Error('porcentaje debe ser mayor a 0 para PORCENTAJE_VENTA');
  }

  if (
    nextTipoCalculo === 'MONTO_POR_UNIDAD' &&
    (nextMontoPorUnidad === null || nextMontoPorUnidad <= 0)
  ) {
    throw new Error('montoPorUnidad debe ser mayor a 0 para MONTO_POR_UNIDAD');
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
      ...(input.tipoCalculo !== undefined ? { TipoCalculo: input.tipoCalculo } : {}),
      ...(input.porcentaje !== undefined ? { Porcentaje: input.porcentaje } : {}),
      ...(input.montoPorUnidad !== undefined ? { MontoPorUnidad: input.montoPorUnidad } : {}),
      ...(nextTipoCalculo === 'PORCENTAJE_VENTA' ? { MontoPorUnidad: null } : {}),
      ...(nextTipoCalculo === 'MONTO_POR_UNIDAD' ? { Porcentaje: 0 } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
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
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
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
      ...(idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
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
