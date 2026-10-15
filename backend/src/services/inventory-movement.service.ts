import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';

type RegisterInventoryMovementInput = {
  idInventarioItem: number;
  idUsuario: number;
  tipoDocumento?: string | null;
  documento?: string | null;
  nombre: string;
  tipoMovimiento: boolean;
  existenciaAnterior: number;
  cantidad: number;
  nuevaExistencia: number;
};

type InventoryMovementReference = {
  tipoDocumento: string;
  documento: string;
};

export type EnvaseLocation = 'PLANTA' | 'RUTA' | 'CUARENTENA';
export type EnvaseState = 'VACIO' | 'LLENO' | 'DANADO' | 'PENDIENTE_CONTEO';

export type EnvaseBucket = {
  ubicacion: EnvaseLocation;
  estado: EnvaseState;
  idRutaSesion?: number;
};

type RegisterEnvaseBucketChangeInput = {
  idInventarioItem: number;
  idUsuario: number;
  bucket: EnvaseBucket;
  cantidad: number;
  entrada: boolean;
  nombre: string;
  tipoDocumento: string;
  documento: string;
  idRutaSesion?: number;
  idMovimientoEnvase?: number;
  idDetalleVenta?: number;
  claveMovimiento?: string;
};

export async function getEnvaseBucketQuantity(
  tx: Prisma.TransactionClient,
  idInventarioItem: number,
  bucket: EnvaseBucket,
): Promise<number> {
  const latest = await tx.bitacoraInventario.findFirst({
    where: {
      IdInventarioItem: idInventarioItem,
      UbicacionEnvase: bucket.ubicacion,
      EstadoEnvase: bucket.estado,
      IdRutaSesion: bucket.ubicacion === 'RUTA' ? bucket.idRutaSesion : null,
      Anulado: false,
    },
    orderBy: [{ Id: 'desc' }],
    select: { NuevaExistencia: true },
  });

  return latest?.NuevaExistencia ?? 0;
}

export async function registerEnvaseBucketChange(
  tx: Prisma.TransactionClient,
  input: RegisterEnvaseBucketChangeInput,
): Promise<number> {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error('La cantidad del movimiento de envase debe ser mayor a 0');
  }
  if (input.bucket.ubicacion === 'RUTA' && !input.bucket.idRutaSesion) {
    throw new Error('La ubicación RUTA requiere una sesión de ruta');
  }
  if (input.bucket.ubicacion !== 'RUTA' && input.bucket.idRutaSesion) {
    throw new Error('Solo la ubicación RUTA puede asociarse a una sesión');
  }

  const existenciaAnterior = await getEnvaseBucketQuantity(
    tx,
    input.idInventarioItem,
    input.bucket,
  );
  const nuevaExistencia = Number(
    (existenciaAnterior + (input.entrada ? input.cantidad : -input.cantidad)).toFixed(2),
  );
  if (nuevaExistencia < -0.009) {
    throw new Error(
      `Existencia insuficiente del envase ${input.idInventarioItem} en ${input.bucket.ubicacion}/${input.bucket.estado}`,
    );
  }

  await tx.bitacoraInventario.create({
    data: {
      IdInventarioItem: input.idInventarioItem,
      IdUsuario: input.idUsuario,
      ClaveMovimiento: input.claveMovimiento ?? randomUUID(),
      UbicacionEnvase: input.bucket.ubicacion,
      EstadoEnvase: input.bucket.estado,
      IdRutaSesion: input.bucket.ubicacion === 'RUTA' ? input.bucket.idRutaSesion : null,
      IdMovimientoEnvase: input.idMovimientoEnvase,
      IdDetalleVenta: input.idDetalleVenta,
      TipoDocumento: input.tipoDocumento,
      Documento: input.documento,
      Nombre: input.nombre,
      TipoMovimiento: input.entrada,
      ExistenciaAnterior: existenciaAnterior,
      Cantidad: input.cantidad,
      NuevaExistencia: Math.max(0, nuevaExistencia),
      Anulado: false,
    },
  });

  return Math.max(0, nuevaExistencia);
}

export async function recordEnvaseBucketCount(
  tx: Prisma.TransactionClient,
  input: {
    idInventarioItem: number;
    idUsuario: number;
    bucket: EnvaseBucket;
    cantidadContada: number;
    observaciones: string;
    tipoDocumento: string;
    documento: string;
    claveMovimiento: string;
  },
) {
  if (!Number.isInteger(input.cantidadContada) || input.cantidadContada < 0) {
    throw new Error('La cantidad contada debe ser un entero no negativo');
  }
  if (input.bucket.ubicacion === 'RUTA' && !input.bucket.idRutaSesion) {
    throw new Error('La ubicación RUTA requiere una sesión de ruta');
  }
  if (input.bucket.ubicacion !== 'RUTA' && input.bucket.idRutaSesion) {
    throw new Error('Solo la ubicación RUTA puede asociarse a una sesión');
  }

  const existenciaAnterior = await getEnvaseBucketQuantity(
    tx,
    input.idInventarioItem,
    input.bucket,
  );
  const diferencia = input.cantidadContada - existenciaAnterior;

  await tx.bitacoraInventario.create({
    data: {
      IdInventarioItem: input.idInventarioItem,
      IdUsuario: input.idUsuario,
      ClaveMovimiento: input.claveMovimiento,
      UbicacionEnvase: input.bucket.ubicacion,
      EstadoEnvase: input.bucket.estado,
      IdRutaSesion: input.bucket.ubicacion === 'RUTA' ? input.bucket.idRutaSesion : null,
      TipoDocumento: input.tipoDocumento,
      Documento: input.documento,
      Nombre: `Conteo físico ${input.bucket.ubicacion}/${input.bucket.estado}: ${input.observaciones}`,
      TipoMovimiento: diferencia >= 0,
      ExistenciaAnterior: existenciaAnterior,
      Cantidad: Math.abs(diferencia),
      NuevaExistencia: input.cantidadContada,
      FechaRegistro: new Date(),
      Anulado: false,
    },
  });

  return { existenciaAnterior, diferencia };
}

export async function transferEnvaseBucket(
  tx: Prisma.TransactionClient,
  input: {
    idInventarioItem: number;
    idUsuario: number;
    origen: EnvaseBucket;
    destino: EnvaseBucket;
    cantidad: number;
    nombre: string;
    tipoDocumento: string;
    documento: string;
    idMovimientoEnvase?: number;
    idDetalleVenta?: number;
  },
) {
  const claveMovimiento = randomUUID();
  await registerEnvaseBucketChange(tx, {
    idInventarioItem: input.idInventarioItem,
    idUsuario: input.idUsuario,
    bucket: input.origen,
    cantidad: input.cantidad,
    entrada: false,
    nombre: input.nombre,
    tipoDocumento: input.tipoDocumento,
    documento: input.documento,
    idRutaSesion: input.origen.ubicacion === 'RUTA' ? input.origen.idRutaSesion : undefined,
    idMovimientoEnvase: input.idMovimientoEnvase,
    idDetalleVenta: input.idDetalleVenta,
    claveMovimiento,
  });
  await registerEnvaseBucketChange(tx, {
    idInventarioItem: input.idInventarioItem,
    idUsuario: input.idUsuario,
    bucket: input.destino,
    cantidad: input.cantidad,
    entrada: true,
    nombre: input.nombre,
    tipoDocumento: input.tipoDocumento,
    documento: input.documento,
    idRutaSesion: input.destino.ubicacion === 'RUTA' ? input.destino.idRutaSesion : undefined,
    idMovimientoEnvase: input.idMovimientoEnvase,
    idDetalleVenta: input.idDetalleVenta,
    claveMovimiento,
  });
}

export async function registerInventoryMovement(
  tx: Prisma.TransactionClient,
  input: RegisterInventoryMovementInput,
) {
  await tx.bitacoraInventario.create({
    data: {
      IdInventarioItem: input.idInventarioItem,
      IdUsuario: input.idUsuario,
      TipoDocumento: input.tipoDocumento ?? null,
      Documento: input.documento ?? null,
      Nombre: input.nombre,
      TipoMovimiento: input.tipoMovimiento,
      ExistenciaAnterior: input.existenciaAnterior,
      Cantidad: input.cantidad,
      NuevaExistencia: input.nuevaExistencia,
      Anulado: false,
    },
  });
}

export async function anulateInventoryMovementByReference(
  tx: Prisma.TransactionClient,
  reference: InventoryMovementReference,
  idUsuarioAnulador?: number,
) {
  await tx.bitacoraInventario.updateMany({
    where: {
      TipoDocumento: reference.tipoDocumento,
      Documento: reference.documento,
      Anulado: false,
    },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreInventoryMovementByReference(
  tx: Prisma.TransactionClient,
  reference: InventoryMovementReference,
) {
  await tx.bitacoraInventario.updateMany({
    where: {
      TipoDocumento: reference.tipoDocumento,
      Documento: reference.documento,
      Anulado: true,
    },
    data: {
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });
}
