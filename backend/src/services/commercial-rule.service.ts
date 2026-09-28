import { prisma } from '../config/prisma';

type CreateTipoCreditoInput = {
  idUsuario: number;
  nombre: string;
  plazoDias?: number;
  incrementoPorcentual?: number;
  requiereCamion?: boolean;
  condiciones?: string;
  activo?: boolean;
};

type UpdateTipoCreditoInput = {
  nombre?: string;
  plazoDias?: number | null;
  incrementoPorcentual?: number | null;
  requiereCamion?: boolean;
  condiciones?: string | null;
  activo?: boolean;
  idUsuarioModificador?: number;
};

type CreateReglaPrecioClienteInput = {
  idUsuario: number;
  idTipoCliente: number;
  idInventarioItem: number;
  precio: number;
  fechaInicio?: string;
  fechaFin?: string;
};

type UpdateReglaPrecioClienteInput = {
  precio?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  idUsuarioModificador?: number;
};

type CreateReglaBonificacionInput = {
  idUsuario: number;
  nombre?: string;
  idInventarioItemCompra: number;
  cantidadMinima: number;
  cantidadMaxima?: number;
  idInventarioItemBonificado: number;
  cantidadBonificada: number;
  prioridad?: number;
  fechaInicio?: string;
  fechaFin?: string;
};

type UpdateReglaBonificacionInput = {
  nombre?: string | null;
  cantidadMinima?: number;
  cantidadMaxima?: number | null;
  cantidadBonificada?: number;
  prioridad?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  idUsuarioModificador?: number;
};

function toTipoCreditoDto(tipo: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  PlazoDias: number | null;
  IncrementoPorcentual: unknown;
  RequiereCamion: boolean;
  Condiciones: string | null;
  Activo: boolean;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  return {
    id: tipo.Id,
    idUsuario: tipo.IdUsuario,
    nombre: tipo.Nombre,
    plazoDias: tipo.PlazoDias,
    incrementoPorcentual: tipo.IncrementoPorcentual === null ? null : Number(tipo.IncrementoPorcentual),
    requiereCamion: tipo.RequiereCamion,
    condiciones: tipo.Condiciones,
    activo: tipo.Activo,
    fechaRegistro: tipo.FechaRegistro,
    idUsuarioModificador: tipo.IdUsuarioModificador,
    fechaModificacion: tipo.FechaModificacion,
    anulado: tipo.Anulado,
    idUsuarioAnulador: tipo.IdUsuarioAnulador,
    fechaAnulacion: tipo.FechaAnulacion,
  };
}

function toReglaPrecioClienteDto(regla: {
  Id: number;
  IdTipoCliente: number;
  IdInventarioItem: number;
  IdUsuario: number;
  Precio: unknown;
  FechaInicio: Date | null;
  FechaFin: Date | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  TipoCliente?: { Id: number; Nombre: string };
  InventarioItem?: { Id: number; Nombre: string };
}) {
  return {
    id: regla.Id,
    idTipoCliente: regla.IdTipoCliente,
    idInventarioItem: regla.IdInventarioItem,
    idUsuario: regla.IdUsuario,
    precio: Number(regla.Precio),
    fechaInicio: regla.FechaInicio,
    fechaFin: regla.FechaFin,
    fechaRegistro: regla.FechaRegistro,
    idUsuarioModificador: regla.IdUsuarioModificador,
    fechaModificacion: regla.FechaModificacion,
    anulado: regla.Anulado,
    idUsuarioAnulador: regla.IdUsuarioAnulador,
    fechaAnulacion: regla.FechaAnulacion,
    tipoCliente: regla.TipoCliente ? { id: regla.TipoCliente.Id, nombre: regla.TipoCliente.Nombre } : undefined,
    inventarioItem: regla.InventarioItem
      ? { id: regla.InventarioItem.Id, nombre: regla.InventarioItem.Nombre }
      : undefined,
  };
}

function toReglaBonificacionDto(regla: {
  Id: number;
  IdUsuario: number;
  Nombre: string | null;
  IdInventarioItemCompra: number;
  CantidadMinima: number;
  CantidadMaxima: number | null;
  IdInventarioItemBonificado: number;
  CantidadBonificada: number;
  Prioridad: number;
  FechaInicio: Date | null;
  FechaFin: Date | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItemCompra?: { Id: number; Nombre: string };
  InventarioItemBonificado?: { Id: number; Nombre: string };
}) {
  return {
    id: regla.Id,
    idUsuario: regla.IdUsuario,
    nombre: regla.Nombre,
    idInventarioItemCompra: regla.IdInventarioItemCompra,
    cantidadMinima: regla.CantidadMinima,
    cantidadMaxima: regla.CantidadMaxima,
    idInventarioItemBonificado: regla.IdInventarioItemBonificado,
    cantidadBonificada: regla.CantidadBonificada,
    prioridad: regla.Prioridad,
    fechaInicio: regla.FechaInicio,
    fechaFin: regla.FechaFin,
    fechaRegistro: regla.FechaRegistro,
    idUsuarioModificador: regla.IdUsuarioModificador,
    fechaModificacion: regla.FechaModificacion,
    anulado: regla.Anulado,
    idUsuarioAnulador: regla.IdUsuarioAnulador,
    fechaAnulacion: regla.FechaAnulacion,
    inventarioItemCompra: regla.InventarioItemCompra
      ? { id: regla.InventarioItemCompra.Id, nombre: regla.InventarioItemCompra.Nombre }
      : undefined,
    inventarioItemBonificado: regla.InventarioItemBonificado
      ? { id: regla.InventarioItemBonificado.Id, nombre: regla.InventarioItemBonificado.Nombre }
      : undefined,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({ where: { Id: idUsuario, Anulado: false }, select: { Id: true } });
  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateTipoClienteExists(idTipoCliente: number) {
  const tipo = await prisma.tipoCliente.findFirst({ where: { Id: idTipoCliente, Anulado: false }, select: { Id: true } });
  if (!tipo) {
    throw new Error('Tipo de cliente no existe');
  }
}

async function validateInventarioItemExists(idInventarioItem: number) {
  const item = await prisma.inventarioItem.findFirst({ where: { Id: idInventarioItem, Anulado: false }, select: { Id: true } });
  if (!item) {
    throw new Error('InventarioItem no existe');
  }
}

async function validateNombreTipoCreditoDisponible(nombre: string, exceptId?: number) {
  const existing = await prisma.tipoCredito.findFirst({
    where: {
      Nombre: nombre,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe un tipo de crédito con ese nombre');
  }
}

function parseDateOnlyOptional(value: string | undefined, fieldName: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

function assertVigenciaValida(fechaInicio: Date | null | undefined, fechaFin: Date | null | undefined) {
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    throw new Error('fechaFin no puede ser anterior a fechaInicio');
  }
}

// ===== TipoCredito =====

export async function listTiposCredito(filters: { activo?: boolean } = {}) {
  const tipos = await prisma.tipoCredito.findMany({
    where: {
      Anulado: false,
      ...(filters.activo !== undefined ? { Activo: filters.activo } : {}),
    },
    orderBy: { Nombre: 'asc' },
  });

  return tipos.map(toTipoCreditoDto);
}

export async function listAnulatedTiposCredito() {
  const tipos = await prisma.tipoCredito.findMany({
    where: { Anulado: true },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return tipos.map(toTipoCreditoDto);
}

export async function getTipoCreditoById(id: number) {
  const tipo = await prisma.tipoCredito.findFirst({ where: { Id: id, Anulado: false } });
  if (!tipo) {
    throw new Error('Tipo de crédito no existe');
  }
  return toTipoCreditoDto(tipo);
}

export async function createTipoCredito(input: CreateTipoCreditoInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateNombreTipoCreditoDisponible(input.nombre);

  const created = await prisma.tipoCredito.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre,
      PlazoDias: input.plazoDias ?? null,
      IncrementoPorcentual: input.incrementoPorcentual ?? null,
      RequiereCamion: input.requiereCamion ?? false,
      Condiciones: input.condiciones ?? null,
      Activo: input.activo ?? true,
      Anulado: false,
    },
  });

  return toTipoCreditoDto(created);
}

export async function updateTipoCredito(id: number, input: UpdateTipoCreditoInput) {
  const existing = await prisma.tipoCredito.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Tipo de crédito no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.nombre !== undefined) {
    await validateNombreTipoCreditoDisponible(input.nombre, id);
  }

  const updated = await prisma.tipoCredito.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.plazoDias !== undefined ? { PlazoDias: input.plazoDias } : {}),
      ...(input.incrementoPorcentual !== undefined ? { IncrementoPorcentual: input.incrementoPorcentual } : {}),
      ...(input.requiereCamion !== undefined ? { RequiereCamion: input.requiereCamion } : {}),
      ...(input.condiciones !== undefined ? { Condiciones: input.condiciones } : {}),
      ...(input.activo !== undefined ? { Activo: input.activo } : {}),
      ...(input.idUsuarioModificador !== undefined ? { IdUsuarioModificador: input.idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
  });

  return toTipoCreditoDto(updated);
}

export async function deleteTipoCredito(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.tipoCredito.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Tipo de crédito no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.tipoCredito.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreTipoCredito(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.tipoCredito.findFirst({ where: { Id: id, Anulado: true }, select: { Id: true, Nombre: true } });
  if (!existing) {
    throw new Error('Tipo de crédito anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await validateNombreTipoCreditoDisponible(existing.Nombre, id);

  const restored = await prisma.tipoCredito.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });

  return toTipoCreditoDto(restored);
}

// ===== ReglaPrecioCliente =====

export async function listReglasPrecioCliente(filters: { idTipoCliente?: number } = {}) {
  const reglas = await prisma.reglaPrecioCliente.findMany({
    where: {
      Anulado: false,
      ...(filters.idTipoCliente !== undefined ? { IdTipoCliente: filters.idTipoCliente } : {}),
    },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
    orderBy: { Id: 'desc' },
  });

  return reglas.map(toReglaPrecioClienteDto);
}

export async function listAnulatedReglasPrecioCliente() {
  const reglas = await prisma.reglaPrecioCliente.findMany({
    where: { Anulado: true },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return reglas.map(toReglaPrecioClienteDto);
}

export async function getReglaPrecioClienteById(id: number) {
  const regla = await prisma.reglaPrecioCliente.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
  });

  if (!regla) {
    throw new Error('Regla de precio no existe');
  }

  return toReglaPrecioClienteDto(regla);
}

export async function createReglaPrecioCliente(input: CreateReglaPrecioClienteInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateTipoClienteExists(input.idTipoCliente);
  await validateInventarioItemExists(input.idInventarioItem);

  const fechaInicio = parseDateOnlyOptional(input.fechaInicio, 'fechaInicio') ?? null;
  const fechaFin = parseDateOnlyOptional(input.fechaFin, 'fechaFin') ?? null;
  assertVigenciaValida(fechaInicio, fechaFin);

  const created = await prisma.reglaPrecioCliente.create({
    data: {
      IdTipoCliente: input.idTipoCliente,
      IdInventarioItem: input.idInventarioItem,
      IdUsuario: input.idUsuario,
      Precio: input.precio,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin,
      Anulado: false,
    },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaPrecioClienteDto(created);
}

export async function updateReglaPrecioCliente(id: number, input: UpdateReglaPrecioClienteInput) {
  const existing = await prisma.reglaPrecioCliente.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, FechaInicio: true, FechaFin: true },
  });

  if (!existing) {
    throw new Error('Regla de precio no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const fechaInicio =
    input.fechaInicio !== undefined
      ? parseDateOnlyOptional(input.fechaInicio ?? undefined, 'fechaInicio') ?? null
      : existing.FechaInicio;
  const fechaFin =
    input.fechaFin !== undefined
      ? parseDateOnlyOptional(input.fechaFin ?? undefined, 'fechaFin') ?? null
      : existing.FechaFin;

  assertVigenciaValida(fechaInicio, fechaFin);

  const updated = await prisma.reglaPrecioCliente.update({
    where: { Id: id },
    data: {
      ...(input.precio !== undefined ? { Precio: input.precio } : {}),
      ...(input.fechaInicio !== undefined ? { FechaInicio: fechaInicio } : {}),
      ...(input.fechaFin !== undefined ? { FechaFin: fechaFin } : {}),
      ...(input.idUsuarioModificador !== undefined ? { IdUsuarioModificador: input.idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaPrecioClienteDto(updated);
}

export async function deleteReglaPrecioCliente(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.reglaPrecioCliente.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Regla de precio no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.reglaPrecioCliente.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreReglaPrecioCliente(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.reglaPrecioCliente.findFirst({ where: { Id: id, Anulado: true }, select: { Id: true } });
  if (!existing) {
    throw new Error('Regla de precio anulada no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.reglaPrecioCliente.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
    include: {
      TipoCliente: { select: { Id: true, Nombre: true } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaPrecioClienteDto(restored);
}

// ===== ReglaBonificacion =====

function assertRangoValido(cantidadMinima: number, cantidadMaxima: number | null | undefined) {
  if (cantidadMaxima !== null && cantidadMaxima !== undefined && cantidadMaxima < cantidadMinima) {
    throw new Error('cantidadMaxima no puede ser menor a cantidadMinima');
  }
}

export async function listReglasBonificacion(filters: { idInventarioItemCompra?: number } = {}) {
  const reglas = await prisma.reglaBonificacion.findMany({
    where: {
      Anulado: false,
      ...(filters.idInventarioItemCompra !== undefined
        ? { IdInventarioItemCompra: filters.idInventarioItemCompra }
        : {}),
    },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
    orderBy: [{ Prioridad: 'asc' }, { Id: 'desc' }],
  });

  return reglas.map(toReglaBonificacionDto);
}

export async function listAnulatedReglasBonificacion() {
  const reglas = await prisma.reglaBonificacion.findMany({
    where: { Anulado: true },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return reglas.map(toReglaBonificacionDto);
}

export async function getReglaBonificacionById(id: number) {
  const regla = await prisma.reglaBonificacion.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
  });

  if (!regla) {
    throw new Error('Regla de bonificación no existe');
  }

  return toReglaBonificacionDto(regla);
}

export async function createReglaBonificacion(input: CreateReglaBonificacionInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateInventarioItemExists(input.idInventarioItemCompra);
  await validateInventarioItemExists(input.idInventarioItemBonificado);
  assertRangoValido(input.cantidadMinima, input.cantidadMaxima ?? null);

  const fechaInicio = parseDateOnlyOptional(input.fechaInicio, 'fechaInicio') ?? null;
  const fechaFin = parseDateOnlyOptional(input.fechaFin, 'fechaFin') ?? null;
  assertVigenciaValida(fechaInicio, fechaFin);

  const created = await prisma.reglaBonificacion.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre ?? null,
      IdInventarioItemCompra: input.idInventarioItemCompra,
      CantidadMinima: input.cantidadMinima,
      CantidadMaxima: input.cantidadMaxima ?? null,
      IdInventarioItemBonificado: input.idInventarioItemBonificado,
      CantidadBonificada: input.cantidadBonificada,
      Prioridad: input.prioridad ?? 1,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin,
      Anulado: false,
    },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaBonificacionDto(created);
}

export async function updateReglaBonificacion(id: number, input: UpdateReglaBonificacionInput) {
  const existing = await prisma.reglaBonificacion.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, CantidadMinima: true, CantidadMaxima: true, FechaInicio: true, FechaFin: true },
  });

  if (!existing) {
    throw new Error('Regla de bonificación no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const cantidadMinima = input.cantidadMinima ?? existing.CantidadMinima;
  const cantidadMaxima = input.cantidadMaxima !== undefined ? input.cantidadMaxima : existing.CantidadMaxima;
  assertRangoValido(cantidadMinima, cantidadMaxima);

  const fechaInicio =
    input.fechaInicio !== undefined
      ? parseDateOnlyOptional(input.fechaInicio ?? undefined, 'fechaInicio') ?? null
      : existing.FechaInicio;
  const fechaFin =
    input.fechaFin !== undefined
      ? parseDateOnlyOptional(input.fechaFin ?? undefined, 'fechaFin') ?? null
      : existing.FechaFin;

  assertVigenciaValida(fechaInicio, fechaFin);

  const updated = await prisma.reglaBonificacion.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.cantidadMinima !== undefined ? { CantidadMinima: input.cantidadMinima } : {}),
      ...(input.cantidadMaxima !== undefined ? { CantidadMaxima: input.cantidadMaxima } : {}),
      ...(input.cantidadBonificada !== undefined ? { CantidadBonificada: input.cantidadBonificada } : {}),
      ...(input.prioridad !== undefined ? { Prioridad: input.prioridad } : {}),
      ...(input.fechaInicio !== undefined ? { FechaInicio: fechaInicio } : {}),
      ...(input.fechaFin !== undefined ? { FechaFin: fechaFin } : {}),
      ...(input.idUsuarioModificador !== undefined ? { IdUsuarioModificador: input.idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaBonificacionDto(updated);
}

export async function deleteReglaBonificacion(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.reglaBonificacion.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Regla de bonificación no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.reglaBonificacion.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreReglaBonificacion(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.reglaBonificacion.findFirst({ where: { Id: id, Anulado: true }, select: { Id: true } });
  if (!existing) {
    throw new Error('Regla de bonificación anulada no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.reglaBonificacion.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
    include: {
      InventarioItemCompra: { select: { Id: true, Nombre: true } },
      InventarioItemBonificado: { select: { Id: true, Nombre: true } },
    },
  });

  return toReglaBonificacionDto(restored);
}
