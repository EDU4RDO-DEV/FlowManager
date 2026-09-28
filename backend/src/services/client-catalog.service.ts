import { prisma } from '../config/prisma';

type CreateTipoClienteInput = {
  idUsuario: number;
  nombre: string;
  descripcion?: string;
};

type UpdateTipoClienteInput = {
  nombre?: string;
  descripcion?: string | null;
  idUsuarioModificador?: number;
};

type CreateClienteCondicionCreditoInput = {
  idUsuario: number;
  idCliente: number;
  idTipoCredito: number;
  habilitadoCredito?: boolean;
  fechaInicioVigencia: string;
  fechaFinVigencia?: string;
  observaciones?: string;
};

type UpdateClienteCondicionCreditoInput = {
  idTipoCredito?: number;
  habilitadoCredito?: boolean;
  fechaInicioVigencia?: string;
  fechaFinVigencia?: string | null;
  observaciones?: string | null;
  idUsuarioModificador?: number;
};

function toTipoClienteDto(tipo: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  Descripcion: string | null;
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
    descripcion: tipo.Descripcion,
    fechaRegistro: tipo.FechaRegistro,
    idUsuarioModificador: tipo.IdUsuarioModificador,
    fechaModificacion: tipo.FechaModificacion,
    anulado: tipo.Anulado,
    idUsuarioAnulador: tipo.IdUsuarioAnulador,
    fechaAnulacion: tipo.FechaAnulacion,
  };
}

function toCondicionCreditoDto(condicion: {
  Id: number;
  IdCliente: number;
  IdTipoCredito: number;
  IdUsuario: number;
  HabilitadoCredito: boolean;
  FechaInicioVigencia: Date;
  FechaFinVigencia: Date | null;
  Observaciones: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  TipoCredito?: { Id: number; Nombre: string };
}) {
  return {
    id: condicion.Id,
    idCliente: condicion.IdCliente,
    idTipoCredito: condicion.IdTipoCredito,
    idUsuario: condicion.IdUsuario,
    habilitadoCredito: condicion.HabilitadoCredito,
    fechaInicioVigencia: condicion.FechaInicioVigencia,
    fechaFinVigencia: condicion.FechaFinVigencia,
    observaciones: condicion.Observaciones,
    fechaRegistro: condicion.FechaRegistro,
    idUsuarioModificador: condicion.IdUsuarioModificador,
    fechaModificacion: condicion.FechaModificacion,
    anulado: condicion.Anulado,
    idUsuarioAnulador: condicion.IdUsuarioAnulador,
    fechaAnulacion: condicion.FechaAnulacion,
    tipoCredito: condicion.TipoCredito
      ? { id: condicion.TipoCredito.Id, nombre: condicion.TipoCredito.Nombre }
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

async function validateClienteExists(idCliente: number) {
  const cliente = await prisma.cliente.findFirst({
    where: { Id: idCliente, Anulado: false },
    select: { Id: true },
  });

  if (!cliente) {
    throw new Error('Cliente no existe');
  }
}

async function validateTipoCreditoActivo(idTipoCredito: number) {
  const tipo = await prisma.tipoCredito.findFirst({
    where: { Id: idTipoCredito, Anulado: false, Activo: true },
    select: { Id: true },
  });

  if (!tipo) {
    throw new Error('Tipo de crédito no existe o no está activo');
  }
}

async function validateNombreTipoClienteDisponible(nombre: string, exceptId?: number) {
  const existing = await prisma.tipoCliente.findFirst({
    where: {
      Nombre: nombre,
      Anulado: false,
      ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe un tipo de cliente con ese nombre');
  }
}

function parseDateOnly(value: string, fieldName: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

// ===== TipoCliente =====

export async function listTiposCliente() {
  const tipos = await prisma.tipoCliente.findMany({
    where: { Anulado: false },
    orderBy: { Nombre: 'asc' },
  });

  return tipos.map(toTipoClienteDto);
}

export async function listAnulatedTiposCliente() {
  const tipos = await prisma.tipoCliente.findMany({
    where: { Anulado: true },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return tipos.map(toTipoClienteDto);
}

export async function getTipoClienteById(id: number) {
  const tipo = await prisma.tipoCliente.findFirst({ where: { Id: id, Anulado: false } });

  if (!tipo) {
    throw new Error('Tipo de cliente no existe');
  }

  return toTipoClienteDto(tipo);
}

export async function createTipoCliente(input: CreateTipoClienteInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateNombreTipoClienteDisponible(input.nombre);

  const created = await prisma.tipoCliente.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre,
      Descripcion: input.descripcion ?? null,
      Anulado: false,
    },
  });

  return toTipoClienteDto(created);
}

export async function updateTipoCliente(id: number, input: UpdateTipoClienteInput) {
  const existing = await prisma.tipoCliente.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Tipo de cliente no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.nombre !== undefined) {
    await validateNombreTipoClienteDisponible(input.nombre, id);
  }

  const updated = await prisma.tipoCliente.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.descripcion !== undefined ? { Descripcion: input.descripcion } : {}),
      ...(input.idUsuarioModificador !== undefined ? { IdUsuarioModificador: input.idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
  });

  return toTipoClienteDto(updated);
}

export async function deleteTipoCliente(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.tipoCliente.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Tipo de cliente no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.tipoCliente.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreTipoCliente(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.tipoCliente.findFirst({ where: { Id: id, Anulado: true }, select: { Id: true, Nombre: true } });
  if (!existing) {
    throw new Error('Tipo de cliente anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await validateNombreTipoClienteDisponible(existing.Nombre, id);

  const restored = await prisma.tipoCliente.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });

  return toTipoClienteDto(restored);
}

// ===== ClienteCondicionCredito =====

export async function listClienteCondicionesCredito(filters: { idCliente?: number }) {
  const condiciones = await prisma.clienteCondicionCredito.findMany({
    where: {
      Anulado: false,
      ...(filters.idCliente !== undefined ? { IdCliente: filters.idCliente } : {}),
    },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
    orderBy: [{ IdCliente: 'asc' }, { FechaInicioVigencia: 'desc' }],
  });

  return condiciones.map(toCondicionCreditoDto);
}

export async function listAnulatedClienteCondicionesCredito() {
  const condiciones = await prisma.clienteCondicionCredito.findMany({
    where: { Anulado: true },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return condiciones.map(toCondicionCreditoDto);
}

export async function getClienteCondicionCreditoById(id: number) {
  const condicion = await prisma.clienteCondicionCredito.findFirst({
    where: { Id: id, Anulado: false },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
  });

  if (!condicion) {
    throw new Error('Condición de crédito no existe');
  }

  return toCondicionCreditoDto(condicion);
}

export async function createClienteCondicionCredito(input: CreateClienteCondicionCreditoInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateClienteExists(input.idCliente);
  await validateTipoCreditoActivo(input.idTipoCredito);

  const fechaInicioVigencia = parseDateOnly(input.fechaInicioVigencia, 'fechaInicioVigencia');
  const fechaFinVigencia =
    input.fechaFinVigencia !== undefined ? parseDateOnly(input.fechaFinVigencia, 'fechaFinVigencia') : null;

  if (fechaFinVigencia && fechaFinVigencia < fechaInicioVigencia) {
    throw new Error('fechaFinVigencia no puede ser anterior a fechaInicioVigencia');
  }

  if (!fechaFinVigencia) {
    const openEnded = await prisma.clienteCondicionCredito.findFirst({
      where: { IdCliente: input.idCliente, Anulado: false, FechaFinVigencia: null },
      select: { Id: true },
    });

    if (openEnded) {
      throw new Error('El cliente ya tiene una condición de crédito vigente sin fecha de fin');
    }
  }

  const created = await prisma.clienteCondicionCredito.create({
    data: {
      IdCliente: input.idCliente,
      IdTipoCredito: input.idTipoCredito,
      IdUsuario: input.idUsuario,
      HabilitadoCredito: input.habilitadoCredito ?? true,
      FechaInicioVigencia: fechaInicioVigencia,
      FechaFinVigencia: fechaFinVigencia,
      Observaciones: input.observaciones ?? null,
      Anulado: false,
    },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
  });

  return toCondicionCreditoDto(created);
}

export async function updateClienteCondicionCredito(id: number, input: UpdateClienteCondicionCreditoInput) {
  const existing = await prisma.clienteCondicionCredito.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, IdCliente: true, FechaInicioVigencia: true },
  });

  if (!existing) {
    throw new Error('Condición de crédito no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idTipoCredito !== undefined) {
    await validateTipoCreditoActivo(input.idTipoCredito);
  }

  const fechaInicioVigencia =
    input.fechaInicioVigencia !== undefined
      ? parseDateOnly(input.fechaInicioVigencia, 'fechaInicioVigencia')
      : existing.FechaInicioVigencia;

  const fechaFinVigencia =
    input.fechaFinVigencia !== undefined && input.fechaFinVigencia !== null
      ? parseDateOnly(input.fechaFinVigencia, 'fechaFinVigencia')
      : input.fechaFinVigencia === null
        ? null
        : undefined;

  if (fechaFinVigencia && fechaFinVigencia < fechaInicioVigencia) {
    throw new Error('fechaFinVigencia no puede ser anterior a fechaInicioVigencia');
  }

  if (fechaFinVigencia === null) {
    const openEnded = await prisma.clienteCondicionCredito.findFirst({
      where: {
        IdCliente: existing.IdCliente,
        Anulado: false,
        FechaFinVigencia: null,
        NOT: { Id: id },
      },
      select: { Id: true },
    });

    if (openEnded) {
      throw new Error('El cliente ya tiene una condición de crédito vigente sin fecha de fin');
    }
  }

  const updated = await prisma.clienteCondicionCredito.update({
    where: { Id: id },
    data: {
      ...(input.idTipoCredito !== undefined ? { IdTipoCredito: input.idTipoCredito } : {}),
      ...(input.habilitadoCredito !== undefined ? { HabilitadoCredito: input.habilitadoCredito } : {}),
      ...(input.fechaInicioVigencia !== undefined ? { FechaInicioVigencia: fechaInicioVigencia } : {}),
      ...(fechaFinVigencia !== undefined ? { FechaFinVigencia: fechaFinVigencia } : {}),
      ...(input.observaciones !== undefined ? { Observaciones: input.observaciones } : {}),
      ...(input.idUsuarioModificador !== undefined ? { IdUsuarioModificador: input.idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
  });

  return toCondicionCreditoDto(updated);
}

export async function deleteClienteCondicionCredito(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.clienteCondicionCredito.findFirst({ where: { Id: id, Anulado: false }, select: { Id: true } });
  if (!existing) {
    throw new Error('Condición de crédito no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.clienteCondicionCredito.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreClienteCondicionCredito(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.clienteCondicionCredito.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, IdCliente: true, FechaFinVigencia: true },
  });

  if (!existing) {
    throw new Error('Condición de crédito anulada no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  if (!existing.FechaFinVigencia) {
    const openEnded = await prisma.clienteCondicionCredito.findFirst({
      where: { IdCliente: existing.IdCliente, Anulado: false, FechaFinVigencia: null },
      select: { Id: true },
    });

    if (openEnded) {
      throw new Error('El cliente ya tiene una condición de crédito vigente sin fecha de fin');
    }
  }

  const restored = await prisma.clienteCondicionCredito.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
    include: { TipoCredito: { select: { Id: true, Nombre: true } } },
  });

  return toCondicionCreditoDto(restored);
}
