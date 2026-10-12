import { prisma } from '../config/prisma';

type CreateTalonarioInput = {
  idUsuario: number;
  nombre: string;
  correlativoInicial: number;
  correlativoFinal: number;
  ultimoUtilizado?: number;
};

type UpdateTalonarioInput = {
  nombre?: string;
  correlativoInicial?: number;
  correlativoFinal?: number;
  ultimoUtilizado?: number;
  idUsuarioModificador?: number;
};

function toTalonarioDto(talonario: {
  Id: number;
  IdUsuario: number;
  Nombre: string;
  CorrelativoInicial: number;
  CorrelativoFinal: number;
  UltimoUtilizado: number | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  const siguienteCorrelativo = (talonario.UltimoUtilizado ?? talonario.CorrelativoInicial - 1) + 1;

  return {
    id: talonario.Id,
    idUsuario: talonario.IdUsuario,
    nombre: talonario.Nombre,
    correlativoInicial: talonario.CorrelativoInicial,
    correlativoFinal: talonario.CorrelativoFinal,
    ultimoUtilizado: talonario.UltimoUtilizado,
    siguienteCorrelativo:
      siguienteCorrelativo <= talonario.CorrelativoFinal ? siguienteCorrelativo : null,
    disponible: siguienteCorrelativo <= talonario.CorrelativoFinal,
    fechaRegistro: talonario.FechaRegistro,
    idUsuarioModificador: talonario.IdUsuarioModificador,
    fechaModificacion: talonario.FechaModificacion,
    anulado: talonario.Anulado,
    idUsuarioAnulador: talonario.IdUsuarioAnulador,
    fechaAnulacion: talonario.FechaAnulacion,
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

function validateRange(correlativoInicial: number, correlativoFinal: number, ultimoUtilizado?: number | null) {
  if (correlativoInicial >= correlativoFinal) {
    throw new Error('correlativoInicial debe ser menor que correlativoFinal');
  }

  if (ultimoUtilizado !== undefined && ultimoUtilizado !== null) {
    if (ultimoUtilizado < correlativoInicial - 1 || ultimoUtilizado > correlativoFinal) {
      throw new Error('ultimoUtilizado debe estar dentro del rango del talonario');
    }
  }
}

export async function listTalonarios() {
  const rows = await prisma.talonario.findMany({
    where: {
      Anulado: false,
    },
    orderBy: { Id: 'desc' },
  });

  return rows.map(toTalonarioDto);
}

export async function listAnulatedTalonarios() {
  const rows = await prisma.talonario.findMany({
    where: {
      Anulado: true,
    },
    orderBy: { FechaAnulacion: 'desc' },
  });

  return rows.map(toTalonarioDto);
}

export async function getTalonarioById(id: number) {
  const row = await prisma.talonario.findFirst({
    where: { Id: id },
  });

  if (!row) {
    throw new Error('Talonario no existe');
  }

  return toTalonarioDto(row);
}

export async function createTalonario(input: CreateTalonarioInput) {
  await validateUsuarioExists(input.idUsuario);
  validateRange(input.correlativoInicial, input.correlativoFinal, input.ultimoUtilizado);

  const duplicateName = await prisma.talonario.findFirst({
    where: {
      Nombre: input.nombre,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (duplicateName) {
    throw new Error('Ya existe un talonario activo con ese nombre');
  }

  const created = await prisma.talonario.create({
    data: {
      IdUsuario: input.idUsuario,
      Nombre: input.nombre,
      CorrelativoInicial: input.correlativoInicial,
      CorrelativoFinal: input.correlativoFinal,
      UltimoUtilizado: input.ultimoUtilizado ?? null,
      Anulado: false,
    },
  });

  return toTalonarioDto(created);
}

export async function updateTalonario(id: number, input: UpdateTalonarioInput) {
  const current = await prisma.talonario.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
  });

  if (!current) {
    throw new Error('Talonario no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const nextInitial = input.correlativoInicial ?? current.CorrelativoInicial;
  const nextFinal = input.correlativoFinal ?? current.CorrelativoFinal;
  const nextUltimoUtilizado = input.ultimoUtilizado ?? current.UltimoUtilizado;
  validateRange(nextInitial, nextFinal, nextUltimoUtilizado);

  if (
    input.ultimoUtilizado !== undefined &&
    current.UltimoUtilizado !== null &&
    input.ultimoUtilizado < current.UltimoUtilizado
  ) {
    throw new Error('No se permite retroceder el correlativo utilizado');
  }

  if (input.ultimoUtilizado !== undefined) {
    const latestAssignedSale = await prisma.venta.findFirst({
      where: {
        IdTalonario: id,
        NumeroProForma: { not: null },
      },
      orderBy: { NumeroProForma: 'desc' },
      select: { NumeroProForma: true },
    });

    if (
      latestAssignedSale &&
      latestAssignedSale.NumeroProForma !== null &&
      input.ultimoUtilizado < latestAssignedSale.NumeroProForma
    ) {
      throw new Error('ultimoUtilizado no puede ser menor que un correlativo ya asignado');
    }
  }

  if (input.nombre !== undefined && input.nombre !== current.Nombre) {
    const duplicateName = await prisma.talonario.findFirst({
      where: {
        Id: { not: id },
        Nombre: input.nombre,
        Anulado: false,
      },
      select: { Id: true },
    });

    if (duplicateName) {
      throw new Error('Ya existe un talonario activo con ese nombre');
    }
  }

  const updatedCount = await prisma.talonario.updateMany({
    where: {
      Id: id,
      Anulado: false,
      UltimoUtilizado: current.UltimoUtilizado,
    },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.correlativoInicial !== undefined
        ? { CorrelativoInicial: input.correlativoInicial }
        : {}),
      ...(input.correlativoFinal !== undefined
        ? { CorrelativoFinal: input.correlativoFinal }
        : {}),
      ...(input.ultimoUtilizado !== undefined
        ? { UltimoUtilizado: input.ultimoUtilizado }
        : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });

  if (updatedCount.count !== 1) {
    throw new Error('Talonario modificado concurrentemente; vuelva a cargarlo');
  }

  const updated = await prisma.talonario.findFirst({
    where: { Id: id, Anulado: false },
  });

  if (!updated) {
    throw new Error('Talonario no existe');
  }

  return toTalonarioDto(updated);
}

export async function anulateTalonario(id: number, idUsuarioAnulador?: number) {
  const current = await prisma.talonario.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!current) {
    throw new Error('Talonario no existe o ya está anulado');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.talonario.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreTalonario(id: number, idUsuarioModificador?: number) {
  const current = await prisma.talonario.findFirst({
    where: {
      Id: id,
      Anulado: true,
    },
  });

  if (!current) {
    throw new Error('Talonario anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const duplicateName = await prisma.talonario.findFirst({
    where: {
      Id: { not: id },
      Nombre: current.Nombre,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (duplicateName) {
    throw new Error('Ya existe un talonario activo con ese nombre');
  }

  const restored = await prisma.talonario.update({
    where: { Id: id },
    data: {
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
      FechaModificacion: new Date(),
    },
  });

  return toTalonarioDto(restored);
}
