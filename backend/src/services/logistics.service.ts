import { prisma } from '../config/prisma';

type VehiculoEstado = 'DISPONIBLE' | 'EN_RUTA' | 'MANTENIMIENTO' | 'NO_DISPONIBLE';
type RutaSesionEstado = 'PROGRAMADA' | 'EN_CURSO' | 'CERRADA';
type GastoEstadoPago = 'PENDIENTE' | 'PAGADO';

type CreateVehiculoInput = {
  idUsuario: number;
  placa: string;
  marca: string;
  modelo: string;
  color?: string;
  estado: VehiculoEstado;
};

type UpdateVehiculoInput = {
  placa?: string;
  marca?: string;
  modelo?: string;
  color?: string | null;
  estado?: VehiculoEstado;
  idUsuarioModificador?: number;
};

type CreateRutaInput = {
  nombre: string;
  descripcion?: string;
};

type UpdateRutaInput = {
  nombre?: string;
  descripcion?: string | null;
};

type CreateRutaSesionInput = {
  idRuta: number;
  idVehiculo: number;
  idUsuarioChofer: number;
  idUsuarioVendedor: number;
  fechaSesion: string;
  kmInicial?: number;
  kmFinal?: number;
  estado: RutaSesionEstado;
};

type UpdateRutaSesionInput = {
  idRuta?: number;
  idVehiculo?: number;
  idUsuarioChofer?: number;
  idUsuarioVendedor?: number;
  fechaSesion?: string;
  kmInicial?: number | null;
  kmFinal?: number | null;
  estado?: RutaSesionEstado;
  idUsuarioModificador?: number;
};

type CreateGastoVehiculoInput = {
  idRutaSesion: number;
  idUsuario: number;
  idProveedor?: number;
  descripcion: string;
  monto: number;
  metodoPago: string;
  numeroVale?: number;
  rutaImagen?: string;
  estadoPago: GastoEstadoPago;
  fechaPago?: string;
  referenciaPago?: string;
};

type UpdateGastoVehiculoInput = {
  idRutaSesion?: number;
  idUsuario?: number;
  idProveedor?: number | null;
  descripcion?: string;
  monto?: number;
  metodoPago?: string;
  numeroVale?: number | null;
  rutaImagen?: string | null;
  estadoPago?: GastoEstadoPago;
  fechaPago?: string;
  referenciaPago?: string | null;
  idUsuarioModificador?: number;
};

function toVehiculoDto(vehiculo: {
  Id: number;
  IdUsuario: number;
  Placa: string;
  Marca: string;
  Modelo: string;
  Color: string | null;
  Estado: string;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
}) {
  return {
    id: vehiculo.Id,
    idUsuario: vehiculo.IdUsuario,
    placa: vehiculo.Placa,
    marca: vehiculo.Marca,
    modelo: vehiculo.Modelo,
    color: vehiculo.Color,
    estado: vehiculo.Estado,
    fechaRegistro: vehiculo.FechaRegistro,
    idUsuarioModificador: vehiculo.IdUsuarioModificador,
    fechaModificacion: vehiculo.FechaModificacion,
    anulado: vehiculo.Anulado,
    idUsuarioAnulador: vehiculo.IdUsuarioAnulador,
    fechaAnulacion: vehiculo.FechaAnulacion,
  };
}

function toRutaDto(ruta: {
  Id: number;
  Nombre: string;
  Descripcion: string | null;
  FechaRegistro: Date | null;
  Anulado: boolean;
}) {
  return {
    id: ruta.Id,
    nombre: ruta.Nombre,
    descripcion: ruta.Descripcion,
    fechaRegistro: ruta.FechaRegistro,
    anulado: ruta.Anulado,
  };
}

function toRutaSesionDto(sesion: {
  Id: number;
  IdRuta: number;
  IdVehiculo: number;
  IdUsuarioChofer: number;
  IdUsuarioVendedor: number;
  FechaSesion: Date;
  KmInicial: number | null;
  KmFinal: number | null;
  Estado: string;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Ruta?: {
    Id: number;
    Nombre: string;
  };
  Vehiculo?: {
    Id: number;
    Placa: string;
    Marca: string;
    Modelo: string;
  };
  Usuario_RutaSesion_IdUsuarioChoferToUsuario?: {
    Id: number;
    Nombre: string;
    Correo: string;
  };
  Usuario_RutaSesion_IdUsuarioVendedorToUsuario?: {
    Id: number;
    Nombre: string;
    Correo: string;
  };
}) {
  return {
    id: sesion.Id,
    idRuta: sesion.IdRuta,
    idVehiculo: sesion.IdVehiculo,
    idUsuarioChofer: sesion.IdUsuarioChofer,
    idUsuarioVendedor: sesion.IdUsuarioVendedor,
    fechaSesion: sesion.FechaSesion,
    kmInicial: sesion.KmInicial,
    kmFinal: sesion.KmFinal,
    estado: sesion.Estado,
    fechaRegistro: sesion.FechaRegistro,
    idUsuarioModificador: sesion.IdUsuarioModificador,
    fechaModificacion: sesion.FechaModificacion,
    anulado: sesion.Anulado,
    idUsuarioAnulador: sesion.IdUsuarioAnulador,
    fechaAnulacion: sesion.FechaAnulacion,
    ruta: sesion.Ruta
      ? {
          id: sesion.Ruta.Id,
          nombre: sesion.Ruta.Nombre,
        }
      : undefined,
    vehiculo: sesion.Vehiculo
      ? {
          id: sesion.Vehiculo.Id,
          placa: sesion.Vehiculo.Placa,
          marca: sesion.Vehiculo.Marca,
          modelo: sesion.Vehiculo.Modelo,
        }
      : undefined,
    chofer: sesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario
      ? {
          id: sesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Id,
          nombre: sesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Nombre,
          correo: sesion.Usuario_RutaSesion_IdUsuarioChoferToUsuario.Correo,
        }
      : undefined,
    vendedor: sesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario
      ? {
          id: sesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Id,
          nombre: sesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Nombre,
          correo: sesion.Usuario_RutaSesion_IdUsuarioVendedorToUsuario.Correo,
        }
      : undefined,
  };
}

function toGastoVehiculoDto(gasto: {
  Id: number;
  IdRutaSesion: number;
  IdUsuario: number;
  IdProveedor: number | null;
  Descripcion: string;
  Monto: unknown;
  MetodoPago: string;
  NumeroVale: number | null;
  RutaImagen: string | null;
  EstadoPago: string;
  FechaPago: Date | null;
  ReferenciaPago: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  RutaSesion?: {
    Id: number;
    FechaSesion: Date;
    IdRuta: number;
    Ruta: {
      Id: number;
      Nombre: string;
    };
  };
  Proveedor?: {
    Id: number;
    Entidad: {
      NombreCompleto: string;
    };
  } | null;
}) {
  return {
    id: gasto.Id,
    idRutaSesion: gasto.IdRutaSesion,
    idUsuario: gasto.IdUsuario,
    idProveedor: gasto.IdProveedor,
    descripcion: gasto.Descripcion,
    monto: Number(gasto.Monto),
    metodoPago: gasto.MetodoPago,
    numeroVale: gasto.NumeroVale,
    rutaImagen: gasto.RutaImagen,
    estadoPago: gasto.EstadoPago,
    fechaPago: gasto.FechaPago,
    referenciaPago: gasto.ReferenciaPago,
    fechaRegistro: gasto.FechaRegistro,
    idUsuarioModificador: gasto.IdUsuarioModificador,
    fechaModificacion: gasto.FechaModificacion,
    anulado: gasto.Anulado,
    idUsuarioAnulador: gasto.IdUsuarioAnulador,
    fechaAnulacion: gasto.FechaAnulacion,
    rutaSesion: gasto.RutaSesion
      ? {
          id: gasto.RutaSesion.Id,
          fechaSesion: gasto.RutaSesion.FechaSesion,
          idRuta: gasto.RutaSesion.IdRuta,
          ruta: {
            id: gasto.RutaSesion.Ruta.Id,
            nombre: gasto.RutaSesion.Ruta.Nombre,
          },
        }
      : undefined,
    proveedor: gasto.Proveedor
      ? {
          id: gasto.Proveedor.Id,
          nombre: gasto.Proveedor.Entidad.NombreCompleto,
        }
      : null,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const user = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }
}

async function validateRutaExists(idRuta: number, allowAnulated = false) {
  const ruta = await prisma.ruta.findFirst({
    where: {
      Id: idRuta,
      ...(allowAnulated ? {} : { Anulado: false }),
    },
    select: { Id: true },
  });

  if (!ruta) {
    throw new Error('Ruta no existe');
  }
}

async function validateVehiculoExists(idVehiculo: number, allowAnulated = false) {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      Id: idVehiculo,
      ...(allowAnulated ? {} : { Anulado: false }),
    },
    select: { Id: true, Estado: true },
  });

  if (!vehiculo) {
    throw new Error('Vehiculo no existe');
  }

  return vehiculo;
}

async function validateProveedorExists(idProveedor: number) {
  const provider = await prisma.proveedor.findFirst({
    where: { Id: idProveedor, Anulado: false },
    select: { Id: true },
  });

  if (!provider) {
    throw new Error('Proveedor no existe');
  }
}

async function validateEmpleadoVinculado(idUsuario: number, roleName: 'Chofer' | 'Vendedor') {
  await validateUsuarioExists(idUsuario);

  // Empleado.IdUsuarioVinculado es la única fuente de verdad de la relación laboral.
  const empleado = await prisma.empleado.findFirst({
    where: {
      Anulado: false,
      IdUsuarioVinculado: idUsuario,
    },
    select: { Id: true },
  });

  if (!empleado) {
    throw new Error(`${roleName} no tiene empleado activo vinculado`);
  }
}

function normalizePlate(placa: string) {
  return placa.trim().toUpperCase();
}

function parseDateOnlyUtc(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Fecha de sesión inválida');
  }

  return parsed;
}

async function assertUniqueVehiclePlate(placa: string, currentId?: number) {
  const existing = await prisma.vehiculo.findFirst({
    where: {
      Placa: placa,
      Anulado: false,
      ...(currentId !== undefined ? { Id: { not: currentId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe un vehiculo activo con esa placa');
  }
}

async function assertUniqueRouteName(nombre: string, currentId?: number) {
  const existing = await prisma.ruta.findFirst({
    where: {
      Nombre: nombre,
      Anulado: false,
      ...(currentId !== undefined ? { Id: { not: currentId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Ya existe una ruta activa con ese nombre');
  }
}

async function assertVehicleAvailableForSession(params: {
  idVehiculo: number;
  fechaSesion: Date;
  idRutaSesionActual?: number;
  targetEstado: RutaSesionEstado;
}) {
  if (params.targetEstado === 'CERRADA') {
    return;
  }

  const activeConflict = await prisma.rutaSesion.findFirst({
    where: {
      IdVehiculo: params.idVehiculo,
      FechaSesion: params.fechaSesion,
      Anulado: false,
      Estado: {
        in: ['PROGRAMADA', 'EN_CURSO'],
      },
      ...(params.idRutaSesionActual !== undefined
        ? { Id: { not: params.idRutaSesionActual } }
        : {}),
    },
    select: { Id: true },
  });

  if (activeConflict) {
    throw new Error('Vehiculo no disponible para la fecha seleccionada');
  }

  const vehiculo = await validateVehiculoExists(params.idVehiculo);
  if (vehiculo.Estado === 'MANTENIMIENTO' || vehiculo.Estado === 'NO_DISPONIBLE') {
    throw new Error('Vehiculo no disponible por estado actual');
  }
}

async function syncVehicleStateBySessions(idVehiculo: number) {
  const hasActiveInRouteSession = await prisma.rutaSesion.findFirst({
    where: {
      IdVehiculo: idVehiculo,
      Anulado: false,
      Estado: 'EN_CURSO',
    },
    select: { Id: true },
  });

  await prisma.vehiculo.update({
    where: { Id: idVehiculo },
    data: {
      Estado: hasActiveInRouteSession ? 'EN_RUTA' : 'DISPONIBLE',
      FechaModificacion: new Date(),
    },
  });
}

function ensureSessionKilometers(input: {
  estado: RutaSesionEstado;
  kmInicial?: number | null;
  kmFinal?: number | null;
}) {
  if (input.estado === 'EN_CURSO' && (input.kmInicial ?? null) === null) {
    throw new Error('kmInicial es requerido cuando la sesión está EN_CURSO');
  }

  if (input.estado === 'CERRADA') {
    if ((input.kmInicial ?? null) === null) {
      throw new Error('kmInicial es requerido cuando la sesión está CERRADA');
    }

    if ((input.kmFinal ?? null) === null) {
      throw new Error('kmFinal es requerido cuando la sesión está CERRADA');
    }
  }

  if ((input.kmInicial ?? null) !== null && (input.kmFinal ?? null) !== null && input.kmFinal! < input.kmInicial!) {
    throw new Error('kmFinal no puede ser menor que kmInicial');
  }
}

export async function listVehiculos(filters: {
  anulado?: boolean;
  estado?: VehiculoEstado;
  disponible?: boolean;
}) {
  const rows = await prisma.vehiculo.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.estado !== undefined ? { Estado: filters.estado } : {}),
      ...(filters.disponible !== undefined
        ? {
            Estado: filters.disponible
              ? 'DISPONIBLE'
              : { in: ['EN_RUTA', 'MANTENIMIENTO', 'NO_DISPONIBLE'] },
          }
        : {}),
    },
    orderBy: { Id: 'desc' },
  });

  return rows.map(toVehiculoDto);
}

export async function getVehiculoById(id: number) {
  const row = await prisma.vehiculo.findFirst({
    where: { Id: id, Anulado: false },
  });

  if (!row) {
    throw new Error('Vehiculo no existe');
  }

  return toVehiculoDto(row);
}

export async function createVehiculo(input: CreateVehiculoInput) {
  await validateUsuarioExists(input.idUsuario);
  const placa = normalizePlate(input.placa);
  await assertUniqueVehiclePlate(placa);

  const created = await prisma.vehiculo.create({
    data: {
      IdUsuario: input.idUsuario,
      Placa: placa,
      Marca: input.marca.trim(),
      Modelo: input.modelo.trim(),
      Color: input.color?.trim(),
      Estado: input.estado,
      Anulado: false,
    },
  });

  return toVehiculoDto(created);
}

export async function updateVehiculo(id: number, input: UpdateVehiculoInput) {
  const existing = await prisma.vehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Vehiculo no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.placa !== undefined) {
    await assertUniqueVehiclePlate(normalizePlate(input.placa), id);
  }

  const updated = await prisma.vehiculo.update({
    where: { Id: id },
    data: {
      ...(input.placa !== undefined ? { Placa: normalizePlate(input.placa) } : {}),
      ...(input.marca !== undefined ? { Marca: input.marca.trim() } : {}),
      ...(input.modelo !== undefined ? { Modelo: input.modelo.trim() } : {}),
      ...(input.color !== undefined ? { Color: input.color === null ? null : input.color.trim() } : {}),
      ...(input.estado !== undefined ? { Estado: input.estado } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
  });

  return toVehiculoDto(updated);
}

export async function deleteVehiculo(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.vehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Vehiculo no existe');
  }

  const runningSession = await prisma.rutaSesion.findFirst({
    where: {
      IdVehiculo: id,
      Anulado: false,
      Estado: {
        in: ['PROGRAMADA', 'EN_CURSO'],
      },
    },
    select: { Id: true },
  });

  if (runningSession) {
    throw new Error('Vehiculo tiene sesiones activas y no puede anularse');
  }

  await prisma.vehiculo.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreVehiculo(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.vehiculo.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, Placa: true },
  });

  if (!existing) {
    throw new Error('Vehiculo anulado no existe');
  }

  await assertUniqueVehiclePlate(existing.Placa, id);

  const restored = await prisma.vehiculo.update({
    where: { Id: id },
    data: {
      Anulado: false,
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });

  return toVehiculoDto(restored);
}

export async function listRutas(filters: { anulado?: boolean }) {
  const rows = await prisma.ruta.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
    },
    orderBy: { Id: 'desc' },
  });

  return rows.map(toRutaDto);
}

export async function getRutaById(id: number) {
  const row = await prisma.ruta.findFirst({
    where: { Id: id, Anulado: false },
  });

  if (!row) {
    throw new Error('Ruta no existe');
  }

  return toRutaDto(row);
}

export async function createRuta(input: CreateRutaInput) {
  const normalizedName = input.nombre.trim();
  await assertUniqueRouteName(normalizedName);

  const created = await prisma.ruta.create({
    data: {
      Nombre: normalizedName,
      Descripcion: input.descripcion?.trim(),
      Anulado: false,
    },
  });

  return toRutaDto(created);
}

export async function updateRuta(id: number, input: UpdateRutaInput) {
  const existing = await prisma.ruta.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Ruta no existe');
  }

  if (input.nombre !== undefined) {
    await assertUniqueRouteName(input.nombre.trim(), id);
  }

  const updated = await prisma.ruta.update({
    where: { Id: id },
    data: {
      ...(input.nombre !== undefined ? { Nombre: input.nombre.trim() } : {}),
      ...(input.descripcion !== undefined
        ? { Descripcion: input.descripcion === null ? null : input.descripcion.trim() }
        : {}),
    },
  });

  return toRutaDto(updated);
}

export async function deleteRuta(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.ruta.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Ruta no existe');
  }

  const activeSession = await prisma.rutaSesion.findFirst({
    where: {
      IdRuta: id,
      Anulado: false,
      Estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
    },
    select: { Id: true },
  });

  if (activeSession) {
    throw new Error('Ruta tiene sesiones activas y no puede anularse');
  }

  await prisma.ruta.update({
    where: { Id: id },
    data: {
      Anulado: true,
    },
  });
}

export async function restoreRuta(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.ruta.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, Nombre: true },
  });

  if (!existing) {
    throw new Error('Ruta anulada no existe');
  }

  await assertUniqueRouteName(existing.Nombre, id);

  const restored = await prisma.ruta.update({
    where: { Id: id },
    data: {
      Anulado: false,
    },
  });

  return toRutaDto(restored);
}

export async function listRutaSesiones(filters: {
  idRuta?: number;
  idVehiculo?: number;
  anulado?: boolean;
  estado?: RutaSesionEstado;
}) {
  const rows = await prisma.rutaSesion.findMany({
    where: {
      ...(filters.idRuta !== undefined ? { IdRuta: filters.idRuta } : {}),
      ...(filters.idVehiculo !== undefined ? { IdVehiculo: filters.idVehiculo } : {}),
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.estado !== undefined ? { Estado: filters.estado } : {}),
    },
    include: {
      Ruta: {
        select: { Id: true, Nombre: true },
      },
      Vehiculo: {
        select: { Id: true, Placa: true, Marca: true, Modelo: true },
      },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
    },
    orderBy: [{ FechaSesion: 'desc' }, { Id: 'desc' }],
  });

  return rows.map(toRutaSesionDto);
}

export async function getRutaSesionById(id: number) {
  const row = await prisma.rutaSesion.findFirst({
    where: {
      Id: id,
      Anulado: false,
    },
    include: {
      Ruta: {
        select: { Id: true, Nombre: true },
      },
      Vehiculo: {
        select: { Id: true, Placa: true, Marca: true, Modelo: true },
      },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
    },
  });

  if (!row) {
    throw new Error('RutaSesion no existe');
  }

  return toRutaSesionDto(row);
}

export async function createRutaSesion(input: CreateRutaSesionInput) {
  const fechaSesion = parseDateOnlyUtc(input.fechaSesion);

  await validateRutaExists(input.idRuta);
  await validateEmpleadoVinculado(input.idUsuarioChofer, 'Chofer');
  await validateEmpleadoVinculado(input.idUsuarioVendedor, 'Vendedor');

  ensureSessionKilometers({
    estado: input.estado,
    kmInicial: input.kmInicial,
    kmFinal: input.kmFinal,
  });

  await assertVehicleAvailableForSession({
    idVehiculo: input.idVehiculo,
    fechaSesion,
    targetEstado: input.estado,
  });

  const created = await prisma.rutaSesion.create({
    data: {
      IdRuta: input.idRuta,
      IdVehiculo: input.idVehiculo,
      IdUsuarioChofer: input.idUsuarioChofer,
      IdUsuarioVendedor: input.idUsuarioVendedor,
      FechaSesion: fechaSesion,
      KmInicial: input.kmInicial,
      KmFinal: input.kmFinal,
      Estado: input.estado,
      Anulado: false,
    },
    include: {
      Ruta: {
        select: { Id: true, Nombre: true },
      },
      Vehiculo: {
        select: { Id: true, Placa: true, Marca: true, Modelo: true },
      },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
    },
  });

  await syncVehicleStateBySessions(input.idVehiculo);
  return toRutaSesionDto(created);
}

export async function updateRutaSesion(id: number, input: UpdateRutaSesionInput) {
  const existing = await prisma.rutaSesion.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdRuta: true,
      IdVehiculo: true,
      IdUsuarioChofer: true,
      IdUsuarioVendedor: true,
      FechaSesion: true,
      KmInicial: true,
      KmFinal: true,
      Estado: true,
    },
  });

  if (!existing) {
    throw new Error('RutaSesion no existe');
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const nextRuta = input.idRuta ?? existing.IdRuta;
  const nextVehiculo = input.idVehiculo ?? existing.IdVehiculo;
  const nextChofer = input.idUsuarioChofer ?? existing.IdUsuarioChofer;
  const nextVendedor = input.idUsuarioVendedor ?? existing.IdUsuarioVendedor;
  const nextFecha = input.fechaSesion ? parseDateOnlyUtc(input.fechaSesion) : existing.FechaSesion;
  const nextEstado = input.estado ?? (existing.Estado as RutaSesionEstado);
  const nextKmInicial = input.kmInicial === undefined ? existing.KmInicial : input.kmInicial;
  const nextKmFinal = input.kmFinal === undefined ? existing.KmFinal : input.kmFinal;

  await validateRutaExists(nextRuta);
  await validateEmpleadoVinculado(nextChofer, 'Chofer');
  await validateEmpleadoVinculado(nextVendedor, 'Vendedor');

  ensureSessionKilometers({
    estado: nextEstado,
    kmInicial: nextKmInicial,
    kmFinal: nextKmFinal,
  });

  await assertVehicleAvailableForSession({
    idVehiculo: nextVehiculo,
    fechaSesion: nextFecha,
    idRutaSesionActual: id,
    targetEstado: nextEstado,
  });

  const updated = await prisma.rutaSesion.update({
    where: { Id: id },
    data: {
      IdRuta: nextRuta,
      IdVehiculo: nextVehiculo,
      IdUsuarioChofer: nextChofer,
      IdUsuarioVendedor: nextVendedor,
      FechaSesion: nextFecha,
      KmInicial: nextKmInicial,
      KmFinal: nextKmFinal,
      Estado: nextEstado,
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
    },
    include: {
      Ruta: {
        select: { Id: true, Nombre: true },
      },
      Vehiculo: {
        select: { Id: true, Placa: true, Marca: true, Modelo: true },
      },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
    },
  });

  if (existing.IdVehiculo !== nextVehiculo) {
    await syncVehicleStateBySessions(existing.IdVehiculo);
  }
  await syncVehicleStateBySessions(nextVehiculo);

  return toRutaSesionDto(updated);
}

export async function deleteRutaSesion(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.rutaSesion.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, IdVehiculo: true },
  });

  if (!existing) {
    throw new Error('RutaSesion no existe');
  }

  await prisma.rutaSesion.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
      Estado: 'CERRADA',
    },
  });

  await syncVehicleStateBySessions(existing.IdVehiculo);
}

export async function restoreRutaSesion(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.rutaSesion.findFirst({
    where: { Id: id, Anulado: true },
    select: {
      Id: true,
      IdRuta: true,
      IdVehiculo: true,
      IdUsuarioChofer: true,
      IdUsuarioVendedor: true,
      FechaSesion: true,
      KmInicial: true,
      KmFinal: true,
    },
  });

  if (!existing) {
    throw new Error('RutaSesion anulada no existe');
  }

  await validateRutaExists(existing.IdRuta);
  await validateEmpleadoVinculado(existing.IdUsuarioChofer, 'Chofer');
  await validateEmpleadoVinculado(existing.IdUsuarioVendedor, 'Vendedor');

  const defaultState: RutaSesionEstado = existing.KmFinal !== null ? 'CERRADA' : 'PROGRAMADA';

  ensureSessionKilometers({
    estado: defaultState,
    kmInicial: existing.KmInicial,
    kmFinal: existing.KmFinal,
  });

  await assertVehicleAvailableForSession({
    idVehiculo: existing.IdVehiculo,
    fechaSesion: existing.FechaSesion,
    idRutaSesionActual: existing.Id,
    targetEstado: defaultState,
  });

  const restored = await prisma.rutaSesion.update({
    where: { Id: id },
    data: {
      Anulado: false,
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Estado: defaultState,
    },
    include: {
      Ruta: {
        select: { Id: true, Nombre: true },
      },
      Vehiculo: {
        select: { Id: true, Placa: true, Marca: true, Modelo: true },
      },
      Usuario_RutaSesion_IdUsuarioChoferToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
      Usuario_RutaSesion_IdUsuarioVendedorToUsuario: {
        select: { Id: true, Nombre: true, Correo: true },
      },
    },
  });

  await syncVehicleStateBySessions(existing.IdVehiculo);
  return toRutaSesionDto(restored);
}

export async function listGastosVehiculo(filters: {
  idRutaSesion?: number;
  idRuta?: number;
  anulado?: boolean;
  estadoPago?: GastoEstadoPago;
}) {
  const rows = await prisma.gastoVehiculo.findMany({
    where: {
      ...(filters.idRutaSesion !== undefined ? { IdRutaSesion: filters.idRutaSesion } : {}),
      ...(filters.idRuta !== undefined
        ? {
            RutaSesion: {
              IdRuta: filters.idRuta,
            },
          }
        : {}),
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.estadoPago !== undefined ? { EstadoPago: filters.estadoPago } : {}),
    },
    include: {
      RutaSesion: {
        select: {
          Id: true,
          FechaSesion: true,
          IdRuta: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Proveedor: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
    orderBy: [{ FechaRegistro: 'desc' }, { Id: 'desc' }],
  });

  return rows.map(toGastoVehiculoDto);
}

export async function getGastoVehiculoById(id: number) {
  const row = await prisma.gastoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      RutaSesion: {
        select: {
          Id: true,
          FechaSesion: true,
          IdRuta: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Proveedor: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
  });

  if (!row) {
    throw new Error('GastoVehiculo no existe');
  }

  return toGastoVehiculoDto(row);
}

export async function createGastoVehiculo(input: CreateGastoVehiculoInput) {
  await validateUsuarioExists(input.idUsuario);

  const sesion = await prisma.rutaSesion.findFirst({
    where: { Id: input.idRutaSesion, Anulado: false },
    select: { Id: true },
  });

  if (!sesion) {
    throw new Error('RutaSesion no existe');
  }

  if (input.idProveedor !== undefined) {
    await validateProveedorExists(input.idProveedor);
  }

  const created = await prisma.gastoVehiculo.create({
    data: {
      IdRutaSesion: input.idRutaSesion,
      IdUsuario: input.idUsuario,
      IdProveedor: input.idProveedor,
      Descripcion: input.descripcion.trim(),
      Monto: input.monto,
      MetodoPago: input.metodoPago.trim(),
      NumeroVale: input.numeroVale,
      RutaImagen: input.rutaImagen?.trim(),
      EstadoPago: input.estadoPago,
      FechaPago:
        input.estadoPago === 'PAGADO'
          ? input.fechaPago
            ? new Date(input.fechaPago)
            : new Date()
          : null,
      ReferenciaPago: input.referenciaPago?.trim(),
      Anulado: false,
    },
    include: {
      RutaSesion: {
        select: {
          Id: true,
          FechaSesion: true,
          IdRuta: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Proveedor: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
  });

  return toGastoVehiculoDto(created);
}

export async function updateGastoVehiculo(id: number, input: UpdateGastoVehiculoInput) {
  const existing = await prisma.gastoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('GastoVehiculo no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idRutaSesion !== undefined) {
    const sesion = await prisma.rutaSesion.findFirst({
      where: { Id: input.idRutaSesion, Anulado: false },
      select: { Id: true },
    });

    if (!sesion) {
      throw new Error('RutaSesion no existe');
    }
  }

  if (input.idProveedor !== undefined && input.idProveedor !== null) {
    await validateProveedorExists(input.idProveedor);
  }

  const updated = await prisma.gastoVehiculo.update({
    where: { Id: id },
    data: {
      ...(input.idRutaSesion !== undefined ? { IdRutaSesion: input.idRutaSesion } : {}),
      ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
      ...(input.idProveedor !== undefined ? { IdProveedor: input.idProveedor } : {}),
      ...(input.descripcion !== undefined ? { Descripcion: input.descripcion.trim() } : {}),
      ...(input.monto !== undefined ? { Monto: input.monto } : {}),
      ...(input.metodoPago !== undefined ? { MetodoPago: input.metodoPago.trim() } : {}),
      ...(input.numeroVale !== undefined ? { NumeroVale: input.numeroVale } : {}),
      ...(input.rutaImagen !== undefined
        ? { RutaImagen: input.rutaImagen === null ? null : input.rutaImagen.trim() }
        : {}),
      ...(input.estadoPago !== undefined ? { EstadoPago: input.estadoPago } : {}),
      ...(input.fechaPago !== undefined ? { FechaPago: new Date(input.fechaPago) } : {}),
      ...(input.referenciaPago !== undefined
        ? {
            ReferenciaPago:
              input.referenciaPago === null ? null : input.referenciaPago.trim(),
          }
        : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      ...(input.estadoPago === 'PAGADO' && input.fechaPago === undefined
        ? { FechaPago: new Date() }
        : {}),
      FechaModificacion: new Date(),
    },
    include: {
      RutaSesion: {
        select: {
          Id: true,
          FechaSesion: true,
          IdRuta: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Proveedor: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
  });

  return toGastoVehiculoDto(updated);
}

export async function deleteGastoVehiculo(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.gastoVehiculo.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('GastoVehiculo no existe');
  }

  await prisma.gastoVehiculo.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreGastoVehiculo(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.gastoVehiculo.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true, IdRutaSesion: true, IdProveedor: true },
  });

  if (!existing) {
    throw new Error('GastoVehiculo anulado no existe');
  }

  const sesion = await prisma.rutaSesion.findFirst({
    where: {
      Id: existing.IdRutaSesion,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!sesion) {
    throw new Error('RutaSesion no existe');
  }

  if (existing.IdProveedor) {
    await validateProveedorExists(existing.IdProveedor);
  }

  const restored = await prisma.gastoVehiculo.update({
    where: { Id: id },
    data: {
      Anulado: false,
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
    include: {
      RutaSesion: {
        select: {
          Id: true,
          FechaSesion: true,
          IdRuta: true,
          Ruta: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
        },
      },
      Proveedor: {
        select: {
          Id: true,
          Entidad: {
            select: {
              NombreCompleto: true,
            },
          },
        },
      },
    },
  });

  return toGastoVehiculoDto(restored);
}
