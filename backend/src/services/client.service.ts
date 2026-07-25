import { prisma } from '../config/prisma';

type EntidadInput = {
  nombreCompleto: string;
  sexo?: string;
  fechaNacimiento?: string;
  telefono1?: string;
  telefono2?: string;
  correoElectronico?: string;
  rutaImagen?: string;
  nit?: string;
  dpi?: string;
};

type CreateClientInput = {
  idUsuario: number;
  entidad: EntidadInput;
};

type UpdateClientInput = {
  idUsuario?: number;
  idUsuarioModificador?: number;
  entidad?: Partial<EntidadInput>;
};

function toClientDto(cliente: {
  Id: number;
  IdEntidad: number;
  IdUsuario: number;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Entidad: {
    Id: number;
    NombreCompleto: string;
    Sexo: string | null;
    FechaNacimiento: Date | null;
    Telefono1: string | null;
    Telefono2: string | null;
    CorreoElectronico: string | null;
    RutaImagen: string | null;
    Nit: string | null;
    Dpi: string | null;
    Anulado: boolean;
  };
}) {
  return {
    id: cliente.Id,
    idEntidad: cliente.IdEntidad,
    idUsuario: cliente.IdUsuario,
    fechaRegistro: cliente.FechaRegistro,
    idUsuarioModificador: cliente.IdUsuarioModificador,
    fechaModificacion: cliente.FechaModificacion,
    anulado: cliente.Anulado,
    idUsuarioAnulador: cliente.IdUsuarioAnulador,
    fechaAnulacion: cliente.FechaAnulacion,
    entidad: {
      id: cliente.Entidad.Id,
      nombreCompleto: cliente.Entidad.NombreCompleto,
      sexo: cliente.Entidad.Sexo,
      fechaNacimiento: cliente.Entidad.FechaNacimiento,
      telefono1: cliente.Entidad.Telefono1,
      telefono2: cliente.Entidad.Telefono2,
      correoElectronico: cliente.Entidad.CorreoElectronico,
      rutaImagen: cliente.Entidad.RutaImagen,
      nit: cliente.Entidad.Nit,
      dpi: cliente.Entidad.Dpi,
      anulado: cliente.Entidad.Anulado,
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

function parseFechaNacimiento(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('fechaNacimiento inválida');
  }

  return parsed;
}

export async function listClients() {
  const clients = await prisma.cliente.findMany({
    where: {
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    orderBy: { Id: 'desc' },
    include: {
      Entidad: {
        select: {
          Id: true,
          NombreCompleto: true,
          Sexo: true,
          FechaNacimiento: true,
          Telefono1: true,
          Telefono2: true,
          CorreoElectronico: true,
          RutaImagen: true,
          Nit: true,
          Dpi: true,
          Anulado: true,
        },
      },
    },
  });

  return clients.map(toClientDto);
}

export async function getClientById(id: number) {
  const client = await prisma.cliente.findFirst({
    where: {
      Id: id,
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    include: {
      Entidad: {
        select: {
          Id: true,
          NombreCompleto: true,
          Sexo: true,
          FechaNacimiento: true,
          Telefono1: true,
          Telefono2: true,
          CorreoElectronico: true,
          RutaImagen: true,
          Nit: true,
          Dpi: true,
          Anulado: true,
        },
      },
    },
  });

  if (!client) {
    throw new Error('Cliente no existe');
  }

  return toClientDto(client);
}

export async function createClient(input: CreateClientInput) {
  await validateUsuarioExists(input.idUsuario);
  const fechaNacimiento = parseFechaNacimiento(input.entidad.fechaNacimiento);

  const created = await prisma.$transaction(async (tx) => {
    const entidad = await tx.entidad.create({
      data: {
        IdUsuario: input.idUsuario,
        NombreCompleto: input.entidad.nombreCompleto,
        Sexo: input.entidad.sexo,
        FechaNacimiento: fechaNacimiento,
        Telefono1: input.entidad.telefono1,
        Telefono2: input.entidad.telefono2,
        CorreoElectronico: input.entidad.correoElectronico,
        RutaImagen: input.entidad.rutaImagen,
        Nit: input.entidad.nit,
        Dpi: input.entidad.dpi,
        Anulado: false,
      },
      select: { Id: true },
    });

    return tx.cliente.create({
      data: {
        IdEntidad: entidad.Id,
        IdUsuario: input.idUsuario,
        Anulado: false,
      },
      include: {
        Entidad: {
          select: {
            Id: true,
            NombreCompleto: true,
            Sexo: true,
            FechaNacimiento: true,
            Telefono1: true,
            Telefono2: true,
            CorreoElectronico: true,
            RutaImagen: true,
            Nit: true,
            Dpi: true,
            Anulado: true,
          },
        },
      },
    });
  });

  return toClientDto(created);
}

export async function updateClient(id: number, input: UpdateClientInput) {
  const existing = await prisma.cliente.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, IdEntidad: true },
  });

  if (!existing) {
    throw new Error('Cliente no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const fechaNacimiento =
    input.entidad?.fechaNacimiento !== undefined
      ? parseFechaNacimiento(input.entidad.fechaNacimiento)
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.entidad) {
      await tx.entidad.update({
        where: { Id: existing.IdEntidad },
        data: {
          ...(input.entidad.nombreCompleto !== undefined
            ? { NombreCompleto: input.entidad.nombreCompleto }
            : {}),
          ...(input.entidad.sexo !== undefined ? { Sexo: input.entidad.sexo } : {}),
          ...(input.entidad.fechaNacimiento !== undefined
            ? { FechaNacimiento: fechaNacimiento }
            : {}),
          ...(input.entidad.telefono1 !== undefined
            ? { Telefono1: input.entidad.telefono1 }
            : {}),
          ...(input.entidad.telefono2 !== undefined
            ? { Telefono2: input.entidad.telefono2 }
            : {}),
          ...(input.entidad.correoElectronico !== undefined
            ? { CorreoElectronico: input.entidad.correoElectronico }
            : {}),
          ...(input.entidad.rutaImagen !== undefined
            ? { RutaImagen: input.entidad.rutaImagen }
            : {}),
          ...(input.entidad.nit !== undefined ? { Nit: input.entidad.nit } : {}),
          ...(input.entidad.dpi !== undefined ? { Dpi: input.entidad.dpi } : {}),
          FechaModificacion: new Date(),
        },
      });
    }

    return tx.cliente.update({
      where: { Id: id },
      data: {
        ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
        ...(input.idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: input.idUsuarioModificador }
          : {}),
        FechaModificacion: new Date(),
      },
      include: {
        Entidad: {
          select: {
            Id: true,
            NombreCompleto: true,
            Sexo: true,
            FechaNacimiento: true,
            Telefono1: true,
            Telefono2: true,
            CorreoElectronico: true,
            RutaImagen: true,
            Nit: true,
            Dpi: true,
            Anulado: true,
          },
        },
      },
    });
  });

  return toClientDto(updated);
}

export async function deleteClient(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.cliente.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Cliente no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.cliente.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}