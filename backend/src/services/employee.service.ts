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

type CreateEmployeeInput = {
  idUsuario: number;
  idConfiguracionComision?: number;
  puestoTrabajo: string;
  descripcionPuesto?: string;
  fechaContratacion: string;
  fechaSalida?: string;
  sueldoBase: number;
  entidad: EntidadInput;
};

type UpdateEmployeeInput = {
  idUsuario?: number;
  idUsuarioModificador?: number;
  idConfiguracionComision?: number | null;
  puestoTrabajo?: string;
  descripcionPuesto?: string | null;
  fechaContratacion?: string;
  fechaSalida?: string | null;
  sueldoBase?: number;
  entidad?: Partial<EntidadInput>;
};

function toEmployeeDto(empleado: {
  Id: number;
  IdEntidad: number;
  IdUsuario: number;
  IdConfiguracionComision: number | null;
  PuestoTrabajo: string;
  DescripcionPuesto: string | null;
  FechaContratacion: Date;
  FechaSalida: Date | null;
  SueldoBase: unknown;
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
    id: empleado.Id,
    idEntidad: empleado.IdEntidad,
    idUsuario: empleado.IdUsuario,
    idConfiguracionComision: empleado.IdConfiguracionComision,
    puestoTrabajo: empleado.PuestoTrabajo,
    descripcionPuesto: empleado.DescripcionPuesto,
    fechaContratacion: empleado.FechaContratacion,
    fechaSalida: empleado.FechaSalida,
    sueldoBase: Number(empleado.SueldoBase),
    fechaRegistro: empleado.FechaRegistro,
    idUsuarioModificador: empleado.IdUsuarioModificador,
    fechaModificacion: empleado.FechaModificacion,
    anulado: empleado.Anulado,
    idUsuarioAnulador: empleado.IdUsuarioAnulador,
    fechaAnulacion: empleado.FechaAnulacion,
    entidad: {
      id: empleado.Entidad.Id,
      nombreCompleto: empleado.Entidad.NombreCompleto,
      sexo: empleado.Entidad.Sexo,
      fechaNacimiento: empleado.Entidad.FechaNacimiento,
      telefono1: empleado.Entidad.Telefono1,
      telefono2: empleado.Entidad.Telefono2,
      correoElectronico: empleado.Entidad.CorreoElectronico,
      rutaImagen: empleado.Entidad.RutaImagen,
      nit: empleado.Entidad.Nit,
      dpi: empleado.Entidad.Dpi,
      anulado: empleado.Entidad.Anulado,
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

async function validateConfiguracionComisionExists(id: number) {
  const configuracion = await prisma.configuracionComision.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!configuracion) {
    throw new Error('Configuracion de comision no existe');
  }
}

function parseDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, fieldName: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseDate(value, fieldName);
}

export async function listEmployees() {
  const employees = await prisma.empleado.findMany({
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

  return employees.map(toEmployeeDto);
}

export async function listAnulatedEmployees() {
  const employees = await prisma.empleado.findMany({
    where: {
      Anulado: true,
      Entidad: {
        Anulado: false,
      },
    },
    orderBy: { FechaAnulacion: 'desc' },
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

  return employees.map(toEmployeeDto);
}

export async function getEmployeeById(id: number) {
  const employee = await prisma.empleado.findFirst({
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

  if (!employee) {
    throw new Error('Empleado no existe');
  }

  return toEmployeeDto(employee);
}

export async function createEmployee(input: CreateEmployeeInput) {
  await validateUsuarioExists(input.idUsuario);

  if (input.idConfiguracionComision !== undefined) {
    await validateConfiguracionComisionExists(input.idConfiguracionComision);
  }

  const fechaNacimiento = parseOptionalDate(input.entidad.fechaNacimiento, 'fechaNacimiento');
  const fechaContratacion = parseDate(input.fechaContratacion, 'fechaContratacion');
  const fechaSalida = parseOptionalDate(input.fechaSalida, 'fechaSalida');

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

    return tx.empleado.create({
      data: {
        IdEntidad: entidad.Id,
        IdUsuario: input.idUsuario,
        IdConfiguracionComision: input.idConfiguracionComision,
        PuestoTrabajo: input.puestoTrabajo,
        DescripcionPuesto: input.descripcionPuesto,
        FechaContratacion: fechaContratacion,
        FechaSalida: fechaSalida,
        SueldoBase: input.sueldoBase,
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

  return toEmployeeDto(created);
}

export async function updateEmployee(id: number, input: UpdateEmployeeInput) {
  const existing = await prisma.empleado.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, IdEntidad: true },
  });

  if (!existing) {
    throw new Error('Empleado no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idConfiguracionComision !== undefined && input.idConfiguracionComision !== null) {
    await validateConfiguracionComisionExists(input.idConfiguracionComision);
  }

  const fechaNacimiento =
    input.entidad?.fechaNacimiento !== undefined
      ? parseOptionalDate(input.entidad.fechaNacimiento, 'fechaNacimiento')
      : undefined;

  const fechaContratacion =
    input.fechaContratacion !== undefined
      ? parseDate(input.fechaContratacion, 'fechaContratacion')
      : undefined;

  const fechaSalida =
    input.fechaSalida !== undefined && input.fechaSalida !== null
      ? parseDate(input.fechaSalida, 'fechaSalida')
      : input.fechaSalida === null
        ? null
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

    return tx.empleado.update({
      where: { Id: id },
      data: {
        ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
        ...(input.idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: input.idUsuarioModificador }
          : {}),
        ...(input.idConfiguracionComision !== undefined
          ? { IdConfiguracionComision: input.idConfiguracionComision }
          : {}),
        ...(input.puestoTrabajo !== undefined ? { PuestoTrabajo: input.puestoTrabajo } : {}),
        ...(input.descripcionPuesto !== undefined
          ? { DescripcionPuesto: input.descripcionPuesto }
          : {}),
        ...(fechaContratacion !== undefined ? { FechaContratacion: fechaContratacion } : {}),
        ...(fechaSalida !== undefined ? { FechaSalida: fechaSalida } : {}),
        ...(input.sueldoBase !== undefined ? { SueldoBase: input.sueldoBase } : {}),
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

  return toEmployeeDto(updated);
}

export async function deleteEmployee(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.empleado.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Empleado no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.empleado.update({
    where: { Id: id },
    data: {
      Anulado: true,
      ...(idUsuarioAnulador !== undefined ? { IdUsuarioAnulador: idUsuarioAnulador } : {}),
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreEmployee(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.empleado.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Empleado anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.empleado.update({
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

  return toEmployeeDto(restored);
}
