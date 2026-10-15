import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';

type CommercialReturnLineInput = {
  idDetalleVenta: number;
  cantidad: number;
  motivo: string;
  condicionFisica: 'VENDIBLE' | 'DANADO' | 'NO_VENDIBLE';
  ubicacionNoVendible?: string;
};

type CommercialReturnInput = { detalle: CommercialReturnLineInput[] };

function createPayloadHash(idVenta: number, input: CommercialReturnInput) {
  const detalle = [...input.detalle]
    .sort((left, right) => left.idDetalleVenta - right.idDetalleVenta)
    .map((line) => ({
      idDetalleVenta: line.idDetalleVenta,
      cantidad: line.cantidad,
      motivo: line.motivo,
      condicionFisica: line.condicionFisica,
      ubicacionNoVendible: line.ubicacionNoVendible ?? null,
    }));

  return createHash('sha256').update(JSON.stringify({ idVenta, detalle })).digest('hex');
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function createCommercialReturn(
  idVenta: number,
  idUsuarioAutorizacion: number,
  idempotencyKey: string,
  input: CommercialReturnInput,
) {
  const payloadHash = createPayloadHash(idVenta, input);

  try {
    return await runSerializableTransaction(async (tx) => {
      const priorRequest = await tx.devolucionComercial.findUnique({
        where: { IdempotencyKey: idempotencyKey },
        include: { Detalles: true },
      });
      if (priorRequest) {
        if (priorRequest.PayloadHash !== payloadHash) {
          throw new Error('Idempotency-Key ya fue usado con datos diferentes');
        }
        return { data: priorRequest, replayed: true };
      }

      const user = await tx.usuario.findFirst({
        where: { Id: idUsuarioAutorizacion, Anulado: false },
        select: { Id: true },
      });
      if (!user) {
        throw new Error('Usuario no existe');
      }

      const sale = await tx.venta.findFirst({
        where: { Id: idVenta, Anulado: false, TipoRegistro: 'VENTA' },
        select: {
          Id: true,
          IdRutaSesion: true,
          DetalleVenta: {
            where: { Anulado: false },
            select: { Id: true, IdInventarioItem: true, Cantidad: true },
          },
        },
      });
      if (!sale) {
        throw new Error('Venta no existe o no está confirmada');
      }
      if (!sale.IdRutaSesion) {
        throw new Error('Las devoluciones comerciales de ventas fuera de ruta requieren un flujo de inventario aprobado');
      }

      const session = await tx.rutaSesion.findFirst({
        where: { Id: sale.IdRutaSesion, Anulado: false },
        select: { Estado: true },
      });
      if (session?.Estado !== 'EN_CURSO') {
        throw new Error('La ruta debe estar EN_CURSO para registrar una devolución comercial');
      }

      const dispatch = await tx.despachoRuta.findUnique({
        where: { IdRutaSesion: sale.IdRutaSesion },
        select: { Detalles: { select: { IdInventarioItem: true } } },
      });
      if (!dispatch) {
        throw new Error('No existe un despacho confirmado para la sesión de ruta');
      }
      if (await tx.devolucionRuta.findUnique({
        where: { IdRutaSesion: sale.IdRutaSesion },
        select: { Id: true },
      })) {
        throw new Error('No se pueden registrar devoluciones comerciales después de confirmar la recepción de ruta');
      }

      const sourceLines = new Map(sale.DetalleVenta.map((line) => [line.Id, line]));
      const dispatchedItems = new Set(dispatch.Detalles.map((line) => line.IdInventarioItem));
      const returnedLines = await tx.devolucionComercialDetalle.findMany({
        where: { DetalleVenta: { IdVenta: sale.Id } },
        select: { IdDetalleVenta: true, Cantidad: true },
      });
      const returnedBySaleLine = new Map<number, number>();
      for (const line of returnedLines) {
        returnedBySaleLine.set(
          line.IdDetalleVenta,
          (returnedBySaleLine.get(line.IdDetalleVenta) ?? 0) + line.Cantidad,
        );
      }

      const requestedBySaleLine = new Map<number, number>();
      for (const line of input.detalle) {
        requestedBySaleLine.set(
          line.idDetalleVenta,
          (requestedBySaleLine.get(line.idDetalleVenta) ?? 0) + line.cantidad,
        );
      }

      for (const [idDetalleVenta, requestedQuantity] of requestedBySaleLine) {
        const sourceLine = sourceLines.get(idDetalleVenta);
        if (!sourceLine || !dispatchedItems.has(sourceLine.IdInventarioItem)) {
          throw new Error(`DetalleVenta ${idDetalleVenta} no pertenece a una venta despachada en esta ruta`);
        }
        const alreadyReturned = returnedBySaleLine.get(idDetalleVenta) ?? 0;
        if (alreadyReturned + requestedQuantity > sourceLine.Cantidad + 0.009) {
          throw new Error(`La cantidad devuelta supera la cantidad vendida en el detalle ${idDetalleVenta}`);
        }
      }

      const data = await tx.devolucionComercial.create({
        data: {
          IdVenta: sale.Id,
          IdUsuarioAutorizacion: idUsuarioAutorizacion,
          IdempotencyKey: idempotencyKey,
          PayloadHash: payloadHash,
          Detalles: {
            create: input.detalle.map((line) => ({
              IdDetalleVenta: line.idDetalleVenta,
              Cantidad: line.cantidad,
              Motivo: line.motivo,
              CondicionFisica: line.condicionFisica,
              UbicacionNoVendible: line.ubicacionNoVendible,
            })),
          },
        },
        include: { Detalles: true },
      });

      return { data, replayed: false };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const priorRequest = await prisma.devolucionComercial.findUnique({
      where: { IdempotencyKey: idempotencyKey },
      include: { Detalles: true },
    });
    if (!priorRequest) {
      throw error;
    }
    if (priorRequest.PayloadHash !== payloadHash) {
      throw new Error('Idempotency-Key ya fue usado con datos diferentes');
    }
    return { data: priorRequest, replayed: true };
  }
}
