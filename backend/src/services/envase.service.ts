import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import {
  getEnvaseBucketQuantity,
  recordEnvaseBucketCount,
  registerEnvaseBucketChange,
  registerInventoryMovement,
  transferEnvaseBucket,
} from './inventory-movement.service';

type RegistrarPrestamoInput = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idRutaSesion?: number;
  idUsuario: number;
  cantidad: number;
  estadoEnvase?: 'VACIO' | 'LLENO';
  rutaFirma?: string;
  observaciones?: string;
  claveSolicitud?: string;
};

type RegistrarDevolucionInput = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idRutaSesion?: number;
  idUsuario: number;
  cantidad: number;
  estadoEnvase?: 'VACIO' | 'LLENO' | 'DANADO';
  rutaFirma?: string;
  observaciones?: string;
  claveSolicitud?: string;
};

type RegistrarPerdidaEnvaseInput = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idRutaSesion?: number;
  idUsuario: number;
  cantidad: number;
  observaciones?: string;
  claveSolicitud?: string;
};

type RegistrarBajaEnvaseInput = {
  idInventarioItem: number;
  idRutaSesion?: number;
  idUsuario: number;
  cantidad: number;
  estadoEnvase: 'VACIO' | 'LLENO' | 'DANADO';
  ubicacionEnvase: 'PLANTA' | 'RUTA' | 'CUARENTENA';
  observaciones?: string;
  claveSolicitud?: string;
};

type ListMovimientosInput = {
  idCliente?: number;
  idInventarioItem?: number;
  idVenta?: number;
  tipoMovimiento?: 'PRESTAMO' | 'DEVOLUCION' | 'DEVOLUCION_DANADA' | 'PERDIDA' | 'BAJA';
  anulado?: boolean;
};

type ListSaldosInput = {
  idCliente?: number;
  soloConSaldo?: boolean;
};

function toMovimientoDto(movimiento: {
  Id: number;
  IdInventarioItem: number;
  IdCliente: number | null;
  IdVenta: number | null;
  IdUsuario: number;
  TipoMovimiento: string;
  EstadoEnvase: string | null;
  UbicacionEnvase: string | null;
  IdRutaSesion: number | null;
  Cantidad: number;
  SaldoAnterior: number;
  SaldoNuevo: number;
  RutaFirma: string | null;
  Observaciones: string | null;
  FechaMovimiento: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItem?: { Id: number; Nombre: string };
  Cliente?: { Id: number; Entidad: { NombreCompleto: string } } | null;
  Usuario?: { Id: number; Nombre: string };
}) {
  return {
    id: movimiento.Id,
    idInventarioItem: movimiento.IdInventarioItem,
    idCliente: movimiento.IdCliente,
    idVenta: movimiento.IdVenta,
    idUsuario: movimiento.IdUsuario,
    tipoMovimiento: movimiento.TipoMovimiento,
    estadoEnvase: movimiento.EstadoEnvase,
    ubicacionEnvase: movimiento.UbicacionEnvase,
    idRutaSesion: movimiento.IdRutaSesion,
    cantidad: movimiento.Cantidad,
    saldoAnterior: movimiento.SaldoAnterior,
    saldoNuevo: movimiento.SaldoNuevo,
    rutaFirma: movimiento.RutaFirma,
    observaciones: movimiento.Observaciones,
    fechaMovimiento: movimiento.FechaMovimiento,
    idUsuarioModificador: movimiento.IdUsuarioModificador,
    fechaModificacion: movimiento.FechaModificacion,
    anulado: movimiento.Anulado,
    idUsuarioAnulador: movimiento.IdUsuarioAnulador,
    fechaAnulacion: movimiento.FechaAnulacion,
    inventarioItem: movimiento.InventarioItem
      ? { id: movimiento.InventarioItem.Id, nombre: movimiento.InventarioItem.Nombre }
      : undefined,
    cliente: movimiento.Cliente
      ? { id: movimiento.Cliente.Id, nombre: movimiento.Cliente.Entidad.NombreCompleto }
      : undefined,
    usuario: movimiento.Usuario ? { id: movimiento.Usuario.Id, nombre: movimiento.Usuario.Nombre } : undefined,
  };
}

function toSaldoDto(saldo: {
  Id: number;
  IdCliente: number;
  IdInventarioItem: number;
  CantidadPrestada: number;
  FechaActualizacion: Date | null;
  Cliente?: { Id: number; Entidad: { NombreCompleto: string } };
  InventarioItem?: { Id: number; Nombre: string };
}) {
  return {
    id: saldo.Id,
    idCliente: saldo.IdCliente,
    idInventarioItem: saldo.IdInventarioItem,
    cantidadPrestada: saldo.CantidadPrestada,
    fechaActualizacion: saldo.FechaActualizacion,
    cliente: saldo.Cliente ? { id: saldo.Cliente.Id, nombre: saldo.Cliente.Entidad.NombreCompleto } : undefined,
    inventarioItem: saldo.InventarioItem
      ? { id: saldo.InventarioItem.Id, nombre: saldo.InventarioItem.Nombre }
      : undefined,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({ where: { Id: idUsuario, Anulado: false }, select: { Id: true } });
  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateClienteActivo(idCliente: number) {
  const cliente = await prisma.cliente.findFirst({
    where: { Id: idCliente, Anulado: false, Entidad: { Anulado: false } },
    select: { Id: true },
  });
  if (!cliente) {
    throw new Error('Cliente no existe');
  }
}

function validateObservaciones(observaciones: string | undefined, operation: string) {
  if (!observaciones?.trim()) {
    throw new Error(`El motivo de ${operation} es obligatorio`);
  }
}

function fingerprintRequest(tipo: string, payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify({ tipo, ...payload })).digest('hex');
}

async function findIdempotentMovement(
  claveSolicitud: string,
  idUsuario: number,
  huellaSolicitud: string,
) {
  const movement = await prisma.movimientoEnvase.findUnique({
    where: { ClaveSolicitud: claveSolicitud },
    include: {
      InventarioItem: { select: { Id: true, Nombre: true } },
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
    },
  });
  if (!movement) return null;
  if (movement.IdUsuario !== idUsuario || movement.HuellaSolicitud !== huellaSolicitud) {
    throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
  }
  return movement;
}

async function getEnvaseItem(tx: Prisma.TransactionClient, idInventarioItem: number) {
  const item = await tx.inventarioItem.findFirst({
    where: { Id: idInventarioItem, Anulado: false },
    select: { Id: true, Nombre: true, EsEnvaseRetornable: true, Existencia: true },
  });

  if (!item) {
    throw new Error('InventarioItem no existe');
  }

  if (!item.EsEnvaseRetornable) {
    throw new Error('El InventarioItem indicado no es un envase retornable');
  }

  return item;
}

async function validateVentaDeCliente(idVenta: number, idCliente: number) {
  const venta = await prisma.venta.findFirst({
    where: { Id: idVenta, Anulado: false },
    select: { Id: true, IdCliente: true },
  });

  if (!venta) {
    throw new Error('Venta no existe');
  }

  if (venta.IdCliente !== idCliente) {
    throw new Error('La venta indicada no pertenece al cliente');
  }
}

// ===== Consultas =====

export async function listMovimientosEnvase(filters: ListMovimientosInput) {
  const movimientos = await prisma.movimientoEnvase.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : { Anulado: false }),
      ...(filters.idCliente !== undefined ? { IdCliente: filters.idCliente } : {}),
      ...(filters.idInventarioItem !== undefined ? { IdInventarioItem: filters.idInventarioItem } : {}),
      ...(filters.idVenta !== undefined ? { IdVenta: filters.idVenta } : {}),
      ...(filters.tipoMovimiento !== undefined ? { TipoMovimiento: filters.tipoMovimiento } : {}),
    },
    include: {
      InventarioItem: { select: { Id: true, Nombre: true } },
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
    },
    orderBy: { Id: 'desc' },
  });

  return movimientos.map(toMovimientoDto);
}

export async function getMovimientoEnvaseById(id: number) {
  const movimiento = await prisma.movimientoEnvase.findFirst({
    where: { Id: id },
    include: {
      InventarioItem: { select: { Id: true, Nombre: true } },
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
    },
  });

  if (!movimiento) {
    throw new Error('Movimiento de envase no existe');
  }

  return toMovimientoDto(movimiento);
}

export async function listEnvaseClienteSaldos(filters: ListSaldosInput) {
  const saldos = await prisma.envaseClienteSaldo.findMany({
    where: {
      ...(filters.idCliente !== undefined ? { IdCliente: filters.idCliente } : {}),
      ...(filters.soloConSaldo ? { CantidadPrestada: { gt: 0 } } : {}),
    },
    include: {
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
    orderBy: [{ IdCliente: 'asc' }, { IdInventarioItem: 'asc' }],
  });

  return saldos.map(toSaldoDto);
}

export async function listEnvasePhysicalBalances() {
  const movements = await prisma.bitacoraInventario.findMany({
    where: {
      Anulado: false,
      UbicacionEnvase: { not: null },
      EstadoEnvase: { not: null },
      InventarioItem: { EsEnvaseRetornable: true, Anulado: false },
    },
    orderBy: { Id: 'desc' },
    select: {
      Id: true,
      IdInventarioItem: true,
      UbicacionEnvase: true,
      EstadoEnvase: true,
      IdRutaSesion: true,
      NuevaExistencia: true,
      InventarioItem: { select: { Nombre: true, Existencia: true } },
    },
  });
  const balances = new Map<string, {
    idInventarioItem: number;
    nombre: string;
    existenciaCatalogo: number;
    ubicacion: string;
    estado: string;
    idRutaSesion: number | null;
    cantidad: number;
  }>();

  for (const movement of movements) {
    const key = [
      movement.IdInventarioItem,
      movement.UbicacionEnvase,
      movement.EstadoEnvase,
      movement.IdRutaSesion ?? '',
    ].join(':');
    if (balances.has(key)) continue;
    balances.set(key, {
      idInventarioItem: movement.IdInventarioItem,
      nombre: movement.InventarioItem.Nombre,
      existenciaCatalogo: movement.InventarioItem.Existencia,
      ubicacion: movement.UbicacionEnvase!,
      estado: movement.EstadoEnvase!,
      idRutaSesion: movement.IdRutaSesion,
      cantidad: movement.NuevaExistencia,
    });
  }

  return [...balances.values()].filter((balance) => balance.cantidad !== 0);
}

export async function reconcileEnvasePhysicalStock(input: {
  idInventarioItem: number;
  idUsuario: number;
  cantidadVacia: number;
  cantidadLlena: number;
  cantidadDanada: number;
  observaciones: string;
}) {
  await validateUsuarioExists(input.idUsuario);
  validateObservaciones(input.observaciones, 'clasificación física');
  const quantities = [input.cantidadVacia, input.cantidadLlena, input.cantidadDanada];
  if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 0)) {
    throw new Error('Las cantidades de envases deben ser enteros no negativos');
  }

  return runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    const pending = await getEnvaseBucketQuantity(tx, item.Id, {
      ubicacion: 'PLANTA',
      estado: 'PENDIENTE_CONTEO',
    });
    const classified = quantities.reduce((sum, quantity) => sum + quantity, 0);
    if (pending <= 0) {
      throw new Error('No hay saldo pendiente de conteo para este envase');
    }
    if (classified !== pending) {
      throw new Error(`La clasificación debe sumar exactamente el saldo pendiente (${pending})`);
    }
    if (input.cantidadDanada > item.Existencia) {
      throw new Error('El saldo de inventario disponible no cubre la cantidad dañada');
    }

    for (const [quantity, state, location] of [
      [input.cantidadVacia, 'VACIO', 'PLANTA'],
      [input.cantidadLlena, 'LLENO', 'PLANTA'],
      [input.cantidadDanada, 'DANADO', 'CUARENTENA'],
    ] as const) {
      if (quantity === 0) continue;
      await transferEnvaseBucket(tx, {
        idInventarioItem: item.Id,
        idUsuario: input.idUsuario,
        origen: { ubicacion: 'PLANTA', estado: 'PENDIENTE_CONTEO' },
        destino: { ubicacion: location, estado: state },
        cantidad: quantity,
        nombre: `Clasificación física de envases: ${input.observaciones}`,
        tipoDocumento: 'ENVCL',
        documento: input.idInventarioItem.toString(),
      });
    }

    if (input.cantidadDanada > 0) {
      const nuevaExistencia = Number((item.Existencia - input.cantidadDanada).toFixed(2));
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario: input.idUsuario,
        tipoDocumento: 'ENVCL',
        documento: input.idInventarioItem.toString(),
        nombre: `Segregación de envases dañados - ${item.Nombre}`,
        tipoMovimiento: false,
        existenciaAnterior: item.Existencia,
        cantidad: input.cantidadDanada,
        nuevaExistencia,
      });
    }
  });
}

type RecordEnvasePhysicalCountInput = {
  idInventarioItem: number;
  idUsuario: number;
  ubicacionEnvase: 'PLANTA' | 'RUTA' | 'CUARENTENA';
  idRutaSesion?: number;
  cantidadVacia: number;
  cantidadLlena: number;
  cantidadDanada: number;
  observaciones: string;
  autorizarRegularizacion: boolean;
  claveMovimiento?: string;
};

async function recordEnvasePhysicalCount(input: RecordEnvasePhysicalCountInput) {
  await validateUsuarioExists(input.idUsuario);
  validateObservaciones(input.observaciones, 'conteo físico');
  const counts = [input.cantidadVacia, input.cantidadLlena, input.cantidadDanada];
  if (counts.some((quantity) => !Number.isInteger(quantity) || quantity < 0)) {
    throw new Error('Las cantidades contadas deben ser enteros no negativos');
  }
  if ((input.ubicacionEnvase === 'RUTA') !== (input.idRutaSesion !== undefined)) {
    throw new Error('La ubicación RUTA requiere una sesión de ruta y las otras ubicaciones no la permiten');
  }
  if (
    (input.ubicacionEnvase === 'PLANTA' && input.cantidadDanada !== 0) ||
    (input.ubicacionEnvase === 'CUARENTENA' &&
      (input.cantidadVacia !== 0 || input.cantidadLlena !== 0))
  ) {
    throw new Error('Los envases dañados deben contarse en CUARENTENA o en la ruta donde se encuentren');
  }

  const claveMovimiento = input.claveMovimiento ?? randomUUID();
  return runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    if (input.idRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: input.idRutaSesion, Anulado: false, Estado: 'EN_CURSO' },
        select: { Id: true },
      });
      if (!route) throw new Error('La sesión de ruta debe estar EN_CURSO');
      const dispatch = await tx.despachoRuta.findUnique({
        where: { IdRutaSesion: input.idRutaSesion },
        select: { Id: true, Detalles: { where: { IdInventarioItem: item.Id }, select: { Id: true } } },
      });
      if (!dispatch?.Detalles.length) {
        throw new Error('El envase debe formar parte del despacho confirmado de la ruta');
      }
    }

    if (input.ubicacionEnvase === 'PLANTA') {
      const pending = await getEnvaseBucketQuantity(tx, item.Id, {
        ubicacion: 'PLANTA',
        estado: 'PENDIENTE_CONTEO',
      });
      if (pending > 0) {
        throw new Error('Clasifica primero el saldo legado PENDIENTE_CONTEO antes de registrar un nuevo conteo');
      }
    }

    const states = input.ubicacionEnvase === 'CUARENTENA'
      ? [{ estado: 'DANADO' as const, cantidad: input.cantidadDanada }]
      : [
          { estado: 'VACIO' as const, cantidad: input.cantidadVacia },
          { estado: 'LLENO' as const, cantidad: input.cantidadLlena },
          ...(input.ubicacionEnvase === 'RUTA'
            ? [{ estado: 'DANADO' as const, cantidad: input.cantidadDanada }]
            : []),
        ];
    const existingCount = await tx.bitacoraInventario.findMany({
      where: { ClaveMovimiento: claveMovimiento },
      select: {
        IdInventarioItem: true,
        IdUsuario: true,
        UbicacionEnvase: true,
        EstadoEnvase: true,
        IdRutaSesion: true,
        NuevaExistencia: true,
        Nombre: true,
      },
    });
    if (existingCount.length > 0) {
      const sameCount =
        existingCount.length === states.length &&
        states.every((state) =>
          existingCount.some(
            (row) =>
              row.IdInventarioItem === item.Id &&
              row.IdUsuario === input.idUsuario &&
              row.UbicacionEnvase === input.ubicacionEnvase &&
              row.EstadoEnvase === state.estado &&
              row.IdRutaSesion === (input.idRutaSesion ?? null) &&
              row.NuevaExistencia === state.cantidad &&
              row.Nombre === `Conteo físico ${input.ubicacionEnvase}/${state.estado}: ${input.observaciones}`,
          ),
        );
      if (!sameCount) {
        throw new Error('La clave de idempotencia ya fue utilizada con datos diferentes');
      }
      return;
    }

    const priorBalances = new Map<string, number>();
    for (const state of states) {
      priorBalances.set(
        state.estado,
        await getEnvaseBucketQuantity(tx, item.Id, {
          ubicacion: input.ubicacionEnvase,
          estado: state.estado,
          ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
        }),
      );
    }

    const hasDifference = states.some(
      (state) => priorBalances.get(state.estado) !== state.cantidad,
    );
    if (hasDifference && !input.autorizarRegularizacion) {
      throw new Error('El conteo difiere del saldo registrado; requiere regularización autorizada');
    }
    if (hasDifference && input.ubicacionEnvase === 'RUTA') {
      throw new Error('Las diferencias de ruta deben regularizarse desde la liquidación de la ruta');
    }

    const deltaExistencia =
      input.ubicacionEnvase === 'PLANTA'
        ? input.cantidadVacia -
            (priorBalances.get('VACIO') ?? 0) +
          input.cantidadLlena -
            (priorBalances.get('LLENO') ?? 0)
        : 0;
    const nuevaExistencia = Number((item.Existencia + deltaExistencia).toFixed(2));
    if (nuevaExistencia < 0) {
      throw new Error('La regularización dejaría negativa la existencia disponible de planta');
    }

    const tipoDocumento = hasDifference ? 'ENVRG' : 'ENVCT';
    for (const state of states) {
      await recordEnvaseBucketCount(tx, {
        idInventarioItem: item.Id,
        idUsuario: input.idUsuario,
        bucket: {
          ubicacion: input.ubicacionEnvase,
          estado: state.estado,
          ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
        },
        cantidadContada: state.cantidad,
        observaciones: input.observaciones,
        tipoDocumento,
        documento: item.Id.toString(),
        claveMovimiento,
      });
    }

    if (deltaExistencia !== 0) {
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario: input.idUsuario,
        tipoDocumento: 'ENVRG',
        documento: item.Id.toString(),
        nombre: `Regularización autorizada por conteo físico - ${item.Nombre}: ${input.observaciones}`,
        tipoMovimiento: deltaExistencia > 0,
        existenciaAnterior: item.Existencia,
        cantidad: Math.abs(deltaExistencia),
        nuevaExistencia,
      });
    }
  });
}

export async function registerEnvasePhysicalCount(
  input: Omit<RecordEnvasePhysicalCountInput, 'autorizarRegularizacion'>,
) {
  return recordEnvasePhysicalCount({ ...input, autorizarRegularizacion: false });
}

export async function regularizeEnvasePhysicalCount(
  input: Omit<RecordEnvasePhysicalCountInput, 'autorizarRegularizacion'>,
) {
  return recordEnvasePhysicalCount({ ...input, autorizarRegularizacion: true });
}

// ===== Préstamo =====

export async function registrarPrestamoEnvase(input: RegistrarPrestamoInput) {
  const claveSolicitud = input.claveSolicitud ?? randomUUID();
  const huellaSolicitud = fingerprintRequest('PRESTAMO', {
    idInventarioItem: input.idInventarioItem,
    idCliente: input.idCliente,
    idVenta: input.idVenta ?? null,
    idRutaSesion: input.idRutaSesion ?? null,
    idUsuario: input.idUsuario,
    cantidad: input.cantidad,
    estadoEnvase: input.estadoEnvase ?? 'VACIO',
    rutaFirma: input.rutaFirma ?? null,
    observaciones: input.observaciones ?? null,
  });
  const previousRequest = await findIdempotentMovement(
    claveSolicitud,
    input.idUsuario,
    huellaSolicitud,
  );
  if (previousRequest) return toMovimientoDto(previousRequest);

  await validateUsuarioExists(input.idUsuario);
  await validateClienteActivo(input.idCliente);

  if (input.cantidad <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }
  if (!Number.isInteger(input.cantidad)) {
    throw new Error('La cantidad de envases debe ser entera');
  }

  if (input.idVenta !== undefined) {
    await validateVentaDeCliente(input.idVenta, input.idCliente);
  }

  let result;
  try {
    result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    const estadoEnvase = input.estadoEnvase ?? 'VACIO';
    const ubicacionEnvase = input.idRutaSesion ? 'RUTA' : 'PLANTA';
    if (input.idRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: input.idRutaSesion, Anulado: false, Estado: 'EN_CURSO' },
        select: { Id: true },
      });
      if (!route) throw new Error('La sesión de ruta debe estar EN_CURSO');
    }
    if (ubicacionEnvase === 'PLANTA' && item.Existencia < input.cantidad) {
      throw new Error(`Stock insuficiente de ${item.Nombre}. Existencia actual ${item.Existencia}`);
    }
    const bucket = {
      ubicacion: ubicacionEnvase as 'PLANTA' | 'RUTA',
      estado: estadoEnvase,
      ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
    };
    const physicalQuantity = await getEnvaseBucketQuantity(tx, item.Id, bucket);
    if (physicalQuantity < input.cantidad) {
      throw new Error(`Stock físico verificado insuficiente de ${item.Nombre} (${estadoEnvase})`);
    }

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: input.idCliente, IdInventarioItem: input.idInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoAnterior = saldoExistente?.CantidadPrestada ?? 0;
    const saldoNuevo = Number((saldoAnterior + input.cantidad).toFixed(2));

    if (saldoExistente) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldoExistente.Id },
        data: { CantidadPrestada: saldoNuevo, FechaActualizacion: new Date() },
      });
    } else {
      await tx.envaseClienteSaldo.create({
        data: {
          IdCliente: input.idCliente,
          IdInventarioItem: input.idInventarioItem,
          CantidadPrestada: saldoNuevo,
        },
      });
    }

    const created = await tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: input.idInventarioItem,
        IdCliente: input.idCliente,
        IdVenta: input.idVenta,
        IdUsuario: input.idUsuario,
        ClaveSolicitud: claveSolicitud,
        HuellaSolicitud: huellaSolicitud,
        TipoMovimiento: 'PRESTAMO',
        EstadoEnvase: estadoEnvase,
        UbicacionEnvase: ubicacionEnvase,
        IdRutaSesion: input.idRutaSesion,
        Cantidad: input.cantidad,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        RutaFirma: input.rutaFirma,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });

    await registerEnvaseBucketChange(tx, {
      idInventarioItem: item.Id,
      idUsuario: input.idUsuario,
      bucket,
      cantidad: input.cantidad,
      entrada: false,
      nombre: `Préstamo de envase a cliente #${input.idCliente} - ${item.Nombre}`,
      tipoDocumento: 'ENVPR',
      documento: created.Id.toString(),
      idRutaSesion: input.idRutaSesion,
      idMovimientoEnvase: created.Id,
    });

    if (!input.idRutaSesion) {
      const nuevaExistencia = Number((item.Existencia - input.cantidad).toFixed(2));
      await tx.inventarioItem.update({
        where: { Id: input.idInventarioItem },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: input.idInventarioItem,
        idUsuario: input.idUsuario,
        tipoDocumento: 'ENVPR',
        documento: created.Id.toString(),
        nombre: `Préstamo de envase a cliente #${input.idCliente} - ${item.Nombre}`,
        tipoMovimiento: false,
        existenciaAnterior: item.Existencia,
        cantidad: input.cantidad,
        nuevaExistencia,
      });
    }

    return created;
    });
  } catch (error) {
    const replay = await findIdempotentMovement(claveSolicitud, input.idUsuario, huellaSolicitud);
    if (replay) return toMovimientoDto(replay);
    throw error;
  }

  return toMovimientoDto(result);
}

// ===== Devolución =====

export async function registrarDevolucionEnvase(input: RegistrarDevolucionInput) {
  const claveSolicitud = input.claveSolicitud ?? randomUUID();
  const huellaSolicitud = fingerprintRequest('DEVOLUCION', {
    idInventarioItem: input.idInventarioItem,
    idCliente: input.idCliente,
    idVenta: input.idVenta ?? null,
    idRutaSesion: input.idRutaSesion ?? null,
    idUsuario: input.idUsuario,
    cantidad: input.cantidad,
    estadoEnvase: input.estadoEnvase ?? 'VACIO',
    rutaFirma: input.rutaFirma ?? null,
    observaciones: input.observaciones ?? null,
  });
  const previousRequest = await findIdempotentMovement(
    claveSolicitud,
    input.idUsuario,
    huellaSolicitud,
  );
  if (previousRequest) return toMovimientoDto(previousRequest);

  await validateUsuarioExists(input.idUsuario);
  await validateClienteActivo(input.idCliente);

  if (input.cantidad <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }
  if (!Number.isInteger(input.cantidad)) {
    throw new Error('La cantidad de envases debe ser entera');
  }

  if (input.idVenta !== undefined) {
    await validateVentaDeCliente(input.idVenta, input.idCliente);
  }

  let result;
  try {
    result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    const estadoEnvase = input.estadoEnvase ?? 'VACIO';
    const ubicacionEnvase =
      estadoEnvase === 'DANADO'
        ? (input.idRutaSesion ? 'RUTA' : 'CUARENTENA')
        : (input.idRutaSesion ? 'RUTA' : 'PLANTA');
    if (input.idRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: input.idRutaSesion, Anulado: false, Estado: 'EN_CURSO' },
        select: { Id: true },
      });
      if (!route) throw new Error('La sesión de ruta debe estar EN_CURSO');
    }

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: input.idCliente, IdInventarioItem: input.idInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoAnterior = saldoExistente?.CantidadPrestada ?? 0;

    if (input.cantidad > saldoAnterior) {
      throw new Error('La cantidad devuelta no puede ser mayor al saldo prestado');
    }

    const saldoNuevo = Number((saldoAnterior - input.cantidad).toFixed(2));
    await tx.envaseClienteSaldo.update({
      where: { Id: saldoExistente!.Id },
      data: { CantidadPrestada: saldoNuevo, FechaActualizacion: new Date() },
    });

    const created = await tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: input.idInventarioItem,
        IdCliente: input.idCliente,
        IdVenta: input.idVenta,
        IdRutaSesion: input.idRutaSesion,
        IdUsuario: input.idUsuario,
        ClaveSolicitud: claveSolicitud,
        HuellaSolicitud: huellaSolicitud,
        TipoMovimiento: estadoEnvase === 'DANADO' ? 'DEVOLUCION_DANADA' : 'DEVOLUCION',
        EstadoEnvase: estadoEnvase,
        UbicacionEnvase: ubicacionEnvase,
        Cantidad: input.cantidad,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        RutaFirma: input.rutaFirma,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });

    const bucket = {
      ubicacion: ubicacionEnvase as 'PLANTA' | 'RUTA' | 'CUARENTENA',
      estado: estadoEnvase,
      ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
    };
    await registerEnvaseBucketChange(tx, {
      idInventarioItem: item.Id,
      idUsuario: input.idUsuario,
      bucket,
      cantidad: input.cantidad,
      entrada: true,
      nombre: `Devolución de envase de cliente #${input.idCliente} - ${item.Nombre}`,
      tipoDocumento: estadoEnvase === 'DANADO' ? 'ENVDAN' : 'ENVDEV',
      documento: created.Id.toString(),
      idRutaSesion: input.idRutaSesion,
      idMovimientoEnvase: created.Id,
    });

    if (!input.idRutaSesion && estadoEnvase !== 'DANADO') {
      const nuevaExistencia = Number((item.Existencia + input.cantidad).toFixed(2));
      await tx.inventarioItem.update({
        where: { Id: input.idInventarioItem },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: input.idInventarioItem,
        idUsuario: input.idUsuario,
        tipoDocumento: 'ENVDEV',
        documento: created.Id.toString(),
        nombre: `Devolución de envase de cliente #${input.idCliente} - ${item.Nombre}`,
        tipoMovimiento: true,
        existenciaAnterior: item.Existencia,
        cantidad: input.cantidad,
        nuevaExistencia,
      });
    }

    return created;
    });
  } catch (error) {
    const replay = await findIdempotentMovement(claveSolicitud, input.idUsuario, huellaSolicitud);
    if (replay) return toMovimientoDto(replay);
    throw error;
  }

  return toMovimientoDto(result);
}

export async function registrarPerdidaEnvase(input: RegistrarPerdidaEnvaseInput) {
  const claveSolicitud = input.claveSolicitud ?? randomUUID();
  const huellaSolicitud = fingerprintRequest('PERDIDA', {
    idInventarioItem: input.idInventarioItem,
    idCliente: input.idCliente,
    idVenta: input.idVenta ?? null,
    idRutaSesion: input.idRutaSesion ?? null,
    idUsuario: input.idUsuario,
    cantidad: input.cantidad,
    observaciones: input.observaciones ?? null,
  });
  const previousRequest = await findIdempotentMovement(
    claveSolicitud,
    input.idUsuario,
    huellaSolicitud,
  );
  if (previousRequest) return toMovimientoDto(previousRequest);

  await validateUsuarioExists(input.idUsuario);
  validateObservaciones(input.observaciones, 'pérdida');
  await validateClienteActivo(input.idCliente);
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad de envases perdidos debe ser un entero mayor a 0');
  }
  if (input.idVenta !== undefined) {
    await validateVentaDeCliente(input.idVenta, input.idCliente);
  }

  let result;
  try {
    result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    if (input.idRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: input.idRutaSesion, Anulado: false },
        select: { Id: true },
      });
      if (!route) throw new Error('RutaSesion no existe');
    }
    const saldo = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: input.idCliente, IdInventarioItem: item.Id },
      select: { Id: true, CantidadPrestada: true },
    });
    const saldoAnterior = saldo?.CantidadPrestada ?? 0;
    if (input.cantidad > saldoAnterior) {
      throw new Error('La pérdida no puede superar el saldo de envases prestados al cliente');
    }
    const saldoNuevo = Number((saldoAnterior - input.cantidad).toFixed(2));
    if (saldo) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldo.Id },
        data: { CantidadPrestada: saldoNuevo, FechaActualizacion: new Date() },
      });
    }

    return tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: item.Id,
        IdCliente: input.idCliente,
        IdVenta: input.idVenta,
        IdRutaSesion: input.idRutaSesion,
        IdUsuario: input.idUsuario,
        ClaveSolicitud: claveSolicitud,
        HuellaSolicitud: huellaSolicitud,
        TipoMovimiento: 'PERDIDA',
        Cantidad: input.cantidad,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });
    });
  } catch (error) {
    const replay = await findIdempotentMovement(claveSolicitud, input.idUsuario, huellaSolicitud);
    if (replay) return toMovimientoDto(replay);
    throw error;
  }
  return toMovimientoDto(result);
}

export async function registrarBajaEnvase(input: RegistrarBajaEnvaseInput) {
  const claveSolicitud = input.claveSolicitud ?? randomUUID();
  const huellaSolicitud = fingerprintRequest('BAJA', {
    idInventarioItem: input.idInventarioItem,
    idRutaSesion: input.idRutaSesion ?? null,
    idUsuario: input.idUsuario,
    cantidad: input.cantidad,
    estadoEnvase: input.estadoEnvase,
    ubicacionEnvase: input.ubicacionEnvase,
    observaciones: input.observaciones ?? null,
  });
  const previousRequest = await findIdempotentMovement(
    claveSolicitud,
    input.idUsuario,
    huellaSolicitud,
  );
  if (previousRequest) return toMovimientoDto(previousRequest);

  await validateUsuarioExists(input.idUsuario);
  validateObservaciones(input.observaciones, 'baja');
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad de envases dados de baja debe ser un entero mayor a 0');
  }
  if ((input.ubicacionEnvase === 'RUTA') !== (input.idRutaSesion !== undefined)) {
    throw new Error('La baja en ruta requiere una sesión de ruta y las otras ubicaciones no la permiten');
  }
  if (
    (input.estadoEnvase === 'DANADO' && !['CUARENTENA', 'RUTA'].includes(input.ubicacionEnvase)) ||
    (input.estadoEnvase !== 'DANADO' && input.ubicacionEnvase === 'CUARENTENA')
  ) {
    throw new Error('La ubicación y el estado del envase no son compatibles');
  }

  let result;
  try {
    result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);
    if (input.idRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: input.idRutaSesion, Anulado: false, Estado: 'EN_CURSO' },
        select: { Id: true },
      });
      if (!route) throw new Error('La sesión de ruta debe estar EN_CURSO');
    }
    const bucket = {
      ubicacion: input.ubicacionEnvase,
      estado: input.estadoEnvase,
      ...(input.idRutaSesion ? { idRutaSesion: input.idRutaSesion } : {}),
    };
    const physicalAvailable = await getEnvaseBucketQuantity(tx, item.Id, bucket);
    if (physicalAvailable < input.cantidad) {
      throw new Error('No hay suficientes envases físicos en el estado y ubicación indicados para dar de baja');
    }
    const adjustsPlantStock = input.ubicacionEnvase === 'PLANTA' && input.estadoEnvase !== 'DANADO';
    if (adjustsPlantStock && item.Existencia < input.cantidad) {
      throw new Error(`Stock insuficiente de ${item.Nombre} para registrar la baja`);
    }
    const created = await tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: item.Id,
        IdCliente: null,
        IdRutaSesion: input.idRutaSesion,
        IdUsuario: input.idUsuario,
        ClaveSolicitud: claveSolicitud,
        HuellaSolicitud: huellaSolicitud,
        TipoMovimiento: 'BAJA',
        EstadoEnvase: input.estadoEnvase,
        UbicacionEnvase: input.ubicacionEnvase,
        Cantidad: input.cantidad,
        SaldoAnterior: 0,
        SaldoNuevo: 0,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });
    await registerEnvaseBucketChange(tx, {
      idInventarioItem: item.Id,
      idUsuario: input.idUsuario,
      bucket,
      cantidad: input.cantidad,
      entrada: false,
      nombre: `Baja de envase - ${item.Nombre}`,
      tipoDocumento: 'ENVBA',
      documento: created.Id.toString(),
      idRutaSesion: input.idRutaSesion,
      idMovimientoEnvase: created.Id,
    });
    if (adjustsPlantStock) {
      const nuevaExistencia = Number((item.Existencia - input.cantidad).toFixed(2));
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario: input.idUsuario,
        tipoDocumento: 'ENVBA',
        documento: created.Id.toString(),
        nombre: `Baja de envase - ${item.Nombre}`,
        tipoMovimiento: false,
        existenciaAnterior: item.Existencia,
        cantidad: input.cantidad,
        nuevaExistencia,
      });
    }
    return created;
    });
  } catch (error) {
    const replay = await findIdempotentMovement(claveSolicitud, input.idUsuario, huellaSolicitud);
    if (replay) return toMovimientoDto(replay);
    throw error;
  }
  return toMovimientoDto(result);
}

// ===== Anulación / restauración de movimientos =====

type EnvaseMovementForCorrection = {
  Id: number;
  IdCliente: number | null;
  IdInventarioItem: number;
  TipoMovimiento: string;
  EstadoEnvase: string | null;
  UbicacionEnvase: string | null;
  IdRutaSesion: number | null;
  Cantidad: number;
  IdUsuario: number;
};

async function applyMovementCorrection(
  tx: Prisma.TransactionClient,
  movement: EnvaseMovementForCorrection,
  idUsuario: number,
  reverse: boolean,
) {
  const originalBalanceDelta =
    movement.TipoMovimiento === 'PRESTAMO'
      ? movement.Cantidad
      : ['DEVOLUCION', 'DEVOLUCION_DANADA', 'PERDIDA'].includes(movement.TipoMovimiento)
        ? -movement.Cantidad
        : 0;
  if (movement.IdCliente !== null && originalBalanceDelta !== 0) {
    const saldo = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: movement.IdCliente, IdInventarioItem: movement.IdInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });
    const balanceDelta = originalBalanceDelta * (reverse ? -1 : 1);
    const nextBalance = Number(((saldo?.CantidadPrestada ?? 0) + balanceDelta).toFixed(2));
    if (nextBalance < 0) {
      throw new Error('No es posible corregir: el saldo del cliente quedaría negativo');
    }
    if (saldo) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldo.Id },
        data: { CantidadPrestada: nextBalance, FechaActualizacion: new Date() },
      });
    } else if (nextBalance > 0) {
      await tx.envaseClienteSaldo.create({
        data: {
          IdCliente: movement.IdCliente,
          IdInventarioItem: movement.IdInventarioItem,
          CantidadPrestada: nextBalance,
        },
      });
    }
  }

  let originalPhysicalDelta = 0;
  if (movement.TipoMovimiento === 'PRESTAMO' || movement.TipoMovimiento === 'BAJA') {
    originalPhysicalDelta = -movement.Cantidad;
  } else if (movement.TipoMovimiento === 'DEVOLUCION' || movement.TipoMovimiento === 'DEVOLUCION_DANADA') {
    originalPhysicalDelta = movement.Cantidad;
  }

  const item = await tx.inventarioItem.findFirst({
    where: { Id: movement.IdInventarioItem },
    select: { Existencia: true },
  });
  if (item) {
    const isPlantStock = movement.UbicacionEnvase === 'PLANTA' || movement.UbicacionEnvase === null;
    const isDamagedQuarantine =
      movement.UbicacionEnvase === 'CUARENTENA' || movement.EstadoEnvase === 'DANADO';
    let originalScalarDelta = 0;
    if (isPlantStock && !isDamagedQuarantine) {
      if (movement.TipoMovimiento === 'PRESTAMO' || movement.TipoMovimiento === 'BAJA') {
        originalScalarDelta = -movement.Cantidad;
      } else if (movement.TipoMovimiento === 'DEVOLUCION') {
        originalScalarDelta = movement.Cantidad;
      }
    }
    const scalarDelta = originalScalarDelta * (reverse ? -1 : 1);
    if (scalarDelta !== 0) {
      const newExistence = Number((item.Existencia + scalarDelta).toFixed(2));
      if (newExistence < 0) {
        throw new Error('No es posible corregir: la existencia disponible quedaría negativa');
      }
      await tx.inventarioItem.update({
        where: { Id: movement.IdInventarioItem },
        data: { Existencia: newExistence },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: movement.IdInventarioItem,
        idUsuario,
        tipoDocumento: reverse ? 'ENVAN' : 'ENVRE',
        documento: movement.Id.toString(),
        nombre: `${reverse ? 'Anulación' : 'Restauración'} movimiento de envase #${movement.Id}`,
        tipoMovimiento: scalarDelta > 0,
        existenciaAnterior: item.Existencia,
        cantidad: movement.Cantidad,
        nuevaExistencia: newExistence,
      });
    }
  }

  if (movement.EstadoEnvase && movement.UbicacionEnvase && originalPhysicalDelta !== 0) {
    if (movement.IdRutaSesion) {
      const route = await tx.rutaSesion.findFirst({
        where: { Id: movement.IdRutaSesion, Anulado: false },
        select: { Estado: true },
      });
      if (!route || route.Estado === 'CERRADA') {
        throw new Error('No se pueden corregir movimientos de una ruta cerrada');
      }
    }
    const physicalDelta = originalPhysicalDelta * (reverse ? -1 : 1);
    await registerEnvaseBucketChange(tx, {
      idInventarioItem: movement.IdInventarioItem,
      idUsuario,
      bucket: {
        ubicacion: movement.UbicacionEnvase as 'PLANTA' | 'RUTA' | 'CUARENTENA',
        estado: movement.EstadoEnvase as 'VACIO' | 'LLENO' | 'DANADO' | 'PENDIENTE_CONTEO',
        ...(movement.IdRutaSesion ? { idRutaSesion: movement.IdRutaSesion } : {}),
      },
      cantidad: movement.Cantidad,
      entrada: physicalDelta > 0,
      nombre: `${reverse ? 'Anulación' : 'Restauración'} movimiento de envase #${movement.Id}`,
      tipoDocumento: reverse ? 'ENVAN' : 'ENVRE',
      documento: movement.Id.toString(),
      idRutaSesion: movement.IdRutaSesion ?? undefined,
      idMovimientoEnvase: movement.Id,
    });
  }
}

export async function anulateMovimientoEnvase(id: number, idUsuarioAnulador?: number) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await runSerializableTransaction(async (tx) => {
    await anulateEnvaseMovementInTransaction(tx, id, idUsuarioAnulador);
  });
}

export async function anulateEnvaseMovementInTransaction(
  tx: Prisma.TransactionClient,
  id: number,
  idUsuarioAnulador?: number,
) {
  const movimiento = await tx.movimientoEnvase.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdCliente: true,
      IdInventarioItem: true,
      TipoMovimiento: true,
      EstadoEnvase: true,
      UbicacionEnvase: true,
      IdRutaSesion: true,
      Cantidad: true,
      IdUsuario: true,
    },
  });

  if (!movimiento) {
    throw new Error('Movimiento de envase no existe');
  }

  await applyMovementCorrection(tx, movimiento, idUsuarioAnulador ?? movimiento.IdUsuario, true);

  await tx.movimientoEnvase.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreMovimientoEnvase(id: number, idUsuarioModificador?: number) {
  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await runSerializableTransaction(async (tx) => {
    const movimiento = await tx.movimientoEnvase.findFirst({
      where: { Id: id, Anulado: true },
      select: {
        Id: true,
        IdCliente: true,
        IdInventarioItem: true,
        TipoMovimiento: true,
        EstadoEnvase: true,
        UbicacionEnvase: true,
        IdRutaSesion: true,
        Cantidad: true,
        IdUsuario: true,
      },
    });

    if (!movimiento) {
      throw new Error('Movimiento de envase anulado no existe');
    }

    await applyMovementCorrection(tx, movimiento, idUsuarioModificador ?? movimiento.IdUsuario, false);

    await tx.movimientoEnvase.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
    });
  });

  return getMovimientoEnvaseById(id);
}
