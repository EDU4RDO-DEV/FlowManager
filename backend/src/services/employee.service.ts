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
  idUsuarioVinculado?: number;
  idConfiguracionComision?: number;
  idTipoTrabajador: number;
  puestoTrabajo: string;
  descripcionPuesto?: string;
  fechaContratacion: string;
  fechaSalida?: string;
  sueldoBase: number;
  entidad: EntidadInput;
};

type UpdateEmployeeInput = {
  idUsuario?: number;
  idUsuarioVinculado?: number | null;
  idUsuarioModificador?: number;
  idConfiguracionComision?: number | null;
  idTipoTrabajador?: number | null;
  puestoTrabajo?: string;
  descripcionPuesto?: string | null;
  fechaContratacion?: string;
  fechaSalida?: string | null;
  sueldoBase?: number;
  fechaInicioVigenciaSueldo?: string;
  entidad?: Partial<EntidadInput>;
};

function toEmployeeDto(empleado: {
  Id: number;
  IdEntidad: number;
  IdUsuario: number;
  IdUsuarioVinculado: number | null;
  IdConfiguracionComision: number | null;
  IdTipoTrabajador: number | null;
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
  TipoTrabajador?: {
    Id: number;
    Clave: string;
    Nombre: string;
  } | null;
  HistorialSueldos?: Array<{
    Id: number;
    SueldoBase: unknown;
    FechaInicioVigencia: Date;
    FechaFinVigencia: Date | null;
  }>;
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
    idUsuarioVinculado: empleado.IdUsuarioVinculado,
    idConfiguracionComision: empleado.IdConfiguracionComision,
    idTipoTrabajador: empleado.IdTipoTrabajador,
    tipoTrabajador: empleado.TipoTrabajador
      ? {
          id: empleado.TipoTrabajador.Id,
          clave: empleado.TipoTrabajador.Clave,
          nombre: empleado.TipoTrabajador.Nombre,
        }
      : null,
    historialSueldos: empleado.HistorialSueldos?.map((vigencia) => ({
      id: vigencia.Id,
      sueldoBase: Number(vigencia.SueldoBase),
      fechaInicioVigencia: vigencia.FechaInicioVigencia,
      fechaFinVigencia: vigencia.FechaFinVigencia,
    })) ?? [],
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

async function getActiveUsuario(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true, IdEntidad: true },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }

  return usuario;
}

async function validateEntidadNotLinkedToOtherEmployee(idEntidad: number, exceptEmployeeId?: number) {
  const existing = await prisma.empleado.findFirst({
    where: {
      IdEntidad: idEntidad,
      Anulado: false,
      ...(exceptEmployeeId !== undefined ? { NOT: { Id: exceptEmployeeId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('La entidad ya está vinculada a otro empleado');
  }
}

// Empleado.IdUsuarioVinculado es la única fuente de verdad de la relación laboral.
async function validateUsuarioVinculadoDisponible(idUsuarioVinculado: number, exceptEmployeeId?: number) {
  const existing = await prisma.empleado.findFirst({
    where: {
      IdUsuarioVinculado: idUsuarioVinculado,
      Anulado: false,
      ...(exceptEmployeeId !== undefined ? { NOT: { Id: exceptEmployeeId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('El usuario ya está vinculado a otro empleado');
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

async function validateTipoTrabajadorExists(id: number) {
  const tipo = await prisma.tipoTrabajador.findFirst({
    where: { Id: id, Activo: true },
    select: { Id: true },
  });

  if (!tipo) {
    throw new Error('Tipo de trabajador no existe');
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
      TipoTrabajador: {
        select: { Id: true, Clave: true, Nombre: true },
      },
      HistorialSueldos: {
        orderBy: { FechaInicioVigencia: 'desc' },
      },
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

type ListEmployeesAvailableForUserLinkInput = {
  includeUserId?: number;
};

export async function listEmployeesAvailableForUserLink(
  input: ListEmployeesAvailableForUserLinkInput = {},
) {
  if (input.includeUserId !== undefined) {
    await validateUsuarioExists(input.includeUserId);
  }

  const employees = await prisma.empleado.findMany({
    where: {
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    orderBy: { Id: 'desc' },
    include: {
      TipoTrabajador: {
        select: { Id: true, Clave: true, Nombre: true },
      },
      HistorialSueldos: {
        orderBy: { FechaInicioVigencia: 'desc' },
      },
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

  // Disponible si no tiene usuario vinculado o si ya es el usuario actual (edición).
  return employees
    .filter((employee) => {
      if (employee.IdUsuarioVinculado === null) {
        return true;
      }

      return input.includeUserId !== undefined && employee.IdUsuarioVinculado === input.includeUserId;
    })
    .map(toEmployeeDto);
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
      TipoTrabajador: {
        select: { Id: true, Clave: true, Nombre: true },
      },
      HistorialSueldos: {
        orderBy: { FechaInicioVigencia: 'desc' },
      },
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
      TipoTrabajador: {
        select: { Id: true, Clave: true, Nombre: true },
      },
      HistorialSueldos: {
        orderBy: { FechaInicioVigencia: 'desc' },
      },
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
  await validateTipoTrabajadorExists(input.idTipoTrabajador);

  if (input.idConfiguracionComision !== undefined) {
    await validateConfiguracionComisionExists(input.idConfiguracionComision);
  }

  const fechaNacimiento = parseOptionalDate(input.entidad.fechaNacimiento, 'fechaNacimiento');
  const fechaContratacion = parseDate(input.fechaContratacion, 'fechaContratacion');
  const fechaSalida = parseOptionalDate(input.fechaSalida, 'fechaSalida');

  const created = await prisma.$transaction(async (tx) => {
    let entidadId: number;

    if (input.idUsuarioVinculado !== undefined) {
      await validateUsuarioVinculadoDisponible(input.idUsuarioVinculado);
      const usuarioVinculado = await getActiveUsuario(input.idUsuarioVinculado);

      if (usuarioVinculado.IdEntidad) {
        await validateEntidadNotLinkedToOtherEmployee(usuarioVinculado.IdEntidad);
        entidadId = usuarioVinculado.IdEntidad;

        await tx.entidad.update({
          where: { Id: entidadId },
          data: {
            NombreCompleto: input.entidad.nombreCompleto,
            Sexo: input.entidad.sexo,
            FechaNacimiento: fechaNacimiento,
            Telefono1: input.entidad.telefono1,
            Telefono2: input.entidad.telefono2,
            CorreoElectronico: input.entidad.correoElectronico,
            RutaImagen: input.entidad.rutaImagen,
            Nit: input.entidad.nit,
            Dpi: input.entidad.dpi,
            FechaModificacion: new Date(),
          },
        });
      } else {
        const entidadNueva = await tx.entidad.create({
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

        entidadId = entidadNueva.Id;

        await tx.usuario.update({
          where: { Id: usuarioVinculado.Id },
          data: {
            IdEntidad: entidadId,
            FechaModificacion: new Date(),
          },
        });
      }
    } else {
      const entidadNueva = await tx.entidad.create({
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

      entidadId = entidadNueva.Id;
    }

    const employee = await tx.empleado.create({
      data: {
        IdEntidad: entidadId,
        IdUsuario: input.idUsuario,
        IdUsuarioVinculado: input.idUsuarioVinculado,
        IdConfiguracionComision: input.idConfiguracionComision,
        IdTipoTrabajador: input.idTipoTrabajador,
        PuestoTrabajo: input.puestoTrabajo,
        DescripcionPuesto: input.descripcionPuesto,
        FechaContratacion: fechaContratacion,
        FechaSalida: fechaSalida,
        SueldoBase: input.sueldoBase,
        Anulado: false,
      },
      include: {
        TipoTrabajador: {
          select: { Id: true, Clave: true, Nombre: true },
        },
        HistorialSueldos: {
          orderBy: { FechaInicioVigencia: 'desc' },
        },
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

    await tx.empleadoSueldoVigencia.create({
      data: {
        IdEmpleado: employee.Id,
        SueldoBase: input.sueldoBase,
        FechaInicioVigencia: fechaContratacion,
        IdUsuarioRegistro: input.idUsuario,
      },
    });

    return employee;
  });

  return toEmployeeDto(created);
}

export async function updateEmployee(id: number, input: UpdateEmployeeInput) {
  const existing = await prisma.empleado.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdEntidad: true,
      SueldoBase: true,
      HistorialSueldos: {
        orderBy: { FechaInicioVigencia: 'desc' },
        take: 1,
        select: { FechaInicioVigencia: true, SueldoBase: true },
      },
    },
  });

  if (!existing) {
    throw new Error('Empleado no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idUsuarioVinculado !== undefined && input.idUsuarioVinculado !== null) {
    await validateUsuarioExists(input.idUsuarioVinculado);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idConfiguracionComision !== undefined && input.idConfiguracionComision !== null) {
    await validateConfiguracionComisionExists(input.idConfiguracionComision);
  }

  if (input.idTipoTrabajador !== undefined && input.idTipoTrabajador !== null) {
    await validateTipoTrabajadorExists(input.idTipoTrabajador);
  }

  const sueldoCambio = input.sueldoBase !== undefined &&
    Number(input.sueldoBase) !== Number(existing.SueldoBase);
  if (sueldoCambio && !input.fechaInicioVigenciaSueldo) {
    throw new Error('fechaInicioVigenciaSueldo es obligatoria al cambiar el sueldo');
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
  const fechaInicioVigenciaSueldo = input.fechaInicioVigenciaSueldo
    ? parseDate(input.fechaInicioVigenciaSueldo, 'fechaInicioVigenciaSueldo')
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    let entidadIdObjetivo = existing.IdEntidad;

    if (input.idUsuarioVinculado !== undefined && input.idUsuarioVinculado !== null) {
      await validateUsuarioVinculadoDisponible(input.idUsuarioVinculado, id);
      const usuarioVinculado = await getActiveUsuario(input.idUsuarioVinculado);
      if (!usuarioVinculado.IdEntidad) {
        throw new Error('Usuario vinculado no tiene entidad');
      }

      await validateEntidadNotLinkedToOtherEmployee(usuarioVinculado.IdEntidad, id);
      entidadIdObjetivo = usuarioVinculado.IdEntidad;
    }

    if (input.entidad) {
      await tx.entidad.update({
        where: { Id: entidadIdObjetivo },
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

    const employee = await tx.empleado.update({
      where: { Id: id },
      data: {
        ...(entidadIdObjetivo !== existing.IdEntidad ? { IdEntidad: entidadIdObjetivo } : {}),
        ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
        ...(input.idUsuarioVinculado !== undefined
          ? { IdUsuarioVinculado: input.idUsuarioVinculado }
          : {}),
        ...(input.idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: input.idUsuarioModificador }
          : {}),
        ...(input.idConfiguracionComision !== undefined
          ? { IdConfiguracionComision: input.idConfiguracionComision }
          : {}),
        ...(input.idTipoTrabajador !== undefined
          ? { IdTipoTrabajador: input.idTipoTrabajador }
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
        TipoTrabajador: {
          select: { Id: true, Clave: true, Nombre: true },
        },
        HistorialSueldos: {
          orderBy: { FechaInicioVigencia: 'desc' },
        },
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

    if (sueldoCambio && fechaInicioVigenciaSueldo && input.sueldoBase !== undefined) {
      const vigenciaActual = existing.HistorialSueldos[0];
      if (vigenciaActual && vigenciaActual.FechaInicioVigencia >= fechaInicioVigenciaSueldo) {
        throw new Error('La vigencia del nuevo sueldo debe ser posterior a la vigencia actual');
      }

      if (vigenciaActual) {
        const fechaFinAnterior = new Date(fechaInicioVigenciaSueldo);
        fechaFinAnterior.setUTCDate(fechaFinAnterior.getUTCDate() - 1);
        await tx.empleadoSueldoVigencia.updateMany({
          where: {
            IdEmpleado: id,
            FechaFinVigencia: null,
            FechaInicioVigencia: vigenciaActual.FechaInicioVigencia,
          },
          data: { FechaFinVigencia: fechaFinAnterior },
        });
      }

      await tx.empleadoSueldoVigencia.create({
        data: {
          IdEmpleado: id,
          SueldoBase: input.sueldoBase,
          FechaInicioVigencia: fechaInicioVigenciaSueldo,
          IdUsuarioRegistro: input.idUsuarioModificador ?? input.idUsuario ?? null,
        },
      });
    }

    return employee;
  });

  return toEmployeeDto(updated);
}

export async function listWorkerTypes() {
  return prisma.tipoTrabajador.findMany({
    where: { Activo: true },
    select: { Id: true, Clave: true, Nombre: true },
    orderBy: { Id: 'asc' },
  });
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
