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
