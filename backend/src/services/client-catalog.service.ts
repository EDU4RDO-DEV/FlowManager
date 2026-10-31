import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../config/prisma';

type CatalogDb = PrismaClient | Prisma.TransactionClient;

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

async function validateUsuarioExists(idUsuario: number, db: CatalogDb = prisma) {
  const usuario = await db.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateClienteExists(idCliente: number, db: CatalogDb = prisma) {
  const cliente = await db.cliente.findFirst({
    where: { Id: idCliente, Anulado: false },
    select: { Id: true },
  });

  if (!cliente) {
    throw new Error('Cliente no existe');
  }
}

async function validateTipoCreditoActivo(idTipoCredito: number, db: CatalogDb = prisma) {
  const tipo = await db.tipoCredito.findFirst({
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
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

function previousCalendarDate(value: Date): Date {
  const previous = new Date(value);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous;
}

function overlappingConditionsWhere(
  idCliente: number,
  fechaInicioVigencia: Date,
  fechaFinVigencia: Date | null,
  exceptId?: number,
) {
  return {
    IdCliente: idCliente,
    HabilitadoCredito: true,
    Anulado: false,
    ...(exceptId !== undefined ? { NOT: { Id: exceptId } } : {}),
    ...(fechaFinVigencia ? { FechaInicioVigencia: { lte: fechaFinVigencia } } : {}),
    OR: [{ FechaFinVigencia: null }, { FechaFinVigencia: { gte: fechaInicioVigencia } }],
  };
}

async function assertNoOverlappingEnabledCondition(
  db: CatalogDb,
  idCliente: number,
  fechaInicioVigencia: Date,
  fechaFinVigencia: Date | null,
  exceptId?: number,
) {
  const overlaps = await db.clienteCondicionCredito.findMany({
    where: overlappingConditionsWhere(idCliente, fechaInicioVigencia, fechaFinVigencia, exceptId),
    select: { Id: true },
  });

  if (overlaps.length > 0) {
    throw new Error('El período de vigencia se superpone con otra condición habilitada');
  }
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
  const fechaInicioVigencia = parseDateOnly(input.fechaInicioVigencia, 'fechaInicioVigencia');
  const fechaFinVigencia =
    input.fechaFinVigencia !== undefined ? parseDateOnly(input.fechaFinVigencia, 'fechaFinVigencia') : null;

  if (fechaFinVigencia && fechaFinVigencia < fechaInicioVigencia) {
    throw new Error('fechaFinVigencia no puede ser anterior a fechaInicioVigencia');
  }

  return prisma.$transaction(
    async (tx) => {
      await validateUsuarioExists(input.idUsuario, tx);
      await validateClienteExists(input.idCliente, tx);
      await validateTipoCreditoActivo(input.idTipoCredito, tx);

      if (input.habilitadoCredito ?? true) {
        const overlaps = await tx.clienteCondicionCredito.findMany({
          where: overlappingConditionsWhere(input.idCliente, fechaInicioVigencia, fechaFinVigencia),
          select: { Id: true, FechaInicioVigencia: true },
        });

        if (overlaps.length > 1 || (overlaps.length === 1 && overlaps[0].FechaInicioVigencia >= fechaInicioVigencia)) {
          throw new Error('El período de vigencia se superpone con otra condición habilitada');
        }

        if (overlaps.length === 1) {
          await tx.clienteCondicionCredito.update({
            where: { Id: overlaps[0].Id },
            data: {
              FechaFinVigencia: previousCalendarDate(fechaInicioVigencia),
              IdUsuarioModificador: input.idUsuario,
              FechaModificacion: new Date(),
            },
          });
        }
      }

      const created = await tx.clienteCondicionCredito.create({
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateClienteCondicionCredito(id: number, input: UpdateClienteCondicionCreditoInput) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.clienteCondicionCredito.findFirst({
        where: { Id: id, Anulado: false },
        select: {
          Id: true,
          IdCliente: true,
          IdTipoCredito: true,
          HabilitadoCredito: true,
          FechaInicioVigencia: true,
          FechaFinVigencia: true,
        },
      });

      if (!existing) {
        throw new Error('Condición de crédito no existe');
      }

      const hasAppliedReceivables = await tx.cuentaPorCobrar.findFirst({
        where: { IdClienteCondicionCreditoAplicada: id },
        select: { Id: true },
      });

      if (input.idUsuarioModificador !== undefined) {
        await validateUsuarioExists(input.idUsuarioModificador, tx);
      }

      if (input.idTipoCredito !== undefined && input.idTipoCredito !== existing.IdTipoCredito) {
        throw new Error('El tipo de crédito no se modifica en una condición existente; asigne una nueva condición');
      }
      if (
        hasAppliedReceivables &&
        (
          input.fechaInicioVigencia !== undefined ||
          input.fechaFinVigencia !== undefined ||
          input.observaciones !== undefined
        )
      ) {
        throw new Error('No se puede modificar la vigencia o las observaciones de una condición aplicada a cuentas históricas');
      }

      const fechaInicioVigencia =
        input.fechaInicioVigencia !== undefined
          ? parseDateOnly(input.fechaInicioVigencia, 'fechaInicioVigencia')
          : existing.FechaInicioVigencia;
      const fechaFinVigencia =
        input.fechaFinVigencia !== undefined
          ? input.fechaFinVigencia === null
            ? null
            : parseDateOnly(input.fechaFinVigencia, 'fechaFinVigencia')
          : existing.FechaFinVigencia;
      const habilitadoCredito = input.habilitadoCredito ?? existing.HabilitadoCredito;

      if (fechaFinVigencia && fechaFinVigencia < fechaInicioVigencia) {
        throw new Error('fechaFinVigencia no puede ser anterior a fechaInicioVigencia');
      }

      if (habilitadoCredito) {
        await assertNoOverlappingEnabledCondition(
          tx,
          existing.IdCliente,
          fechaInicioVigencia,
          fechaFinVigencia,
          id,
        );
      }

      const updated = await tx.clienteCondicionCredito.update({
        where: { Id: id },
        data: {
          ...(input.habilitadoCredito !== undefined ? { HabilitadoCredito: input.habilitadoCredito } : {}),
          ...(input.fechaInicioVigencia !== undefined ? { FechaInicioVigencia: fechaInicioVigencia } : {}),
          ...(input.fechaFinVigencia !== undefined ? { FechaFinVigencia: fechaFinVigencia } : {}),
          ...(input.observaciones !== undefined ? { Observaciones: input.observaciones } : {}),
          ...(input.idUsuarioModificador !== undefined
            ? { IdUsuarioModificador: input.idUsuarioModificador }
            : {}),
          FechaModificacion: new Date(),
        },
        include: { TipoCredito: { select: { Id: true, Nombre: true } } },
      });

      return toCondicionCreditoDto(updated);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deleteClienteCondicionCredito(id: number, idUsuarioAnulador?: number) {
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.clienteCondicionCredito.findFirst({
        where: { Id: id, Anulado: false },
        select: { Id: true },
      });
      if (!existing) {
        throw new Error('Condición de crédito no existe');
      }

      if (idUsuarioAnulador !== undefined) {
        await validateUsuarioExists(idUsuarioAnulador, tx);
      }

      await tx.clienteCondicionCredito.update({
        where: { Id: id },
        data: {
          Anulado: true,
          ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
          FechaAnulacion: new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function restoreClienteCondicionCredito(id: number, idUsuarioModificador?: number) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.clienteCondicionCredito.findFirst({
        where: { Id: id, Anulado: true },
        select: {
          Id: true,
          IdCliente: true,
          IdTipoCredito: true,
          HabilitadoCredito: true,
          FechaInicioVigencia: true,
          FechaFinVigencia: true,
        },
      });

      if (!existing) {
        throw new Error('Condición de crédito anulada no existe');
      }

      if (idUsuarioModificador !== undefined) {
        await validateUsuarioExists(idUsuarioModificador, tx);
      }

      if (existing.HabilitadoCredito) {
        await validateTipoCreditoActivo(existing.IdTipoCredito, tx);
        await assertNoOverlappingEnabledCondition(
          tx,
          existing.IdCliente,
          existing.FechaInicioVigencia,
          existing.FechaFinVigencia,
          id,
        );
      }

      const restored = await tx.clienteCondicionCredito.update({
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
