import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import {
  registerEnvaseBucketChange,
  registerInventoryMovement,
  type EnvaseBucket,
} from './inventory-movement.service';
import {
  assertSaleAccess,
  type OperationalActor,
} from './operational-scope.service';
import { syncSaleReceivableAfterCommercialReturn } from './sale.service';
import { accrueMonthlyCommissionsForSale } from './commission-accrual.service';

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
  actor?: OperationalActor,
) {
  const payloadHash = createPayloadHash(idVenta, input);

  try {
    return await runSerializableTransaction(async (tx) => {
      if (actor) await assertSaleAccess(tx, idVenta, actor);

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
          IdCliente: true,
          IdRutaSesion: true,
          DetalleVenta: {
            where: { Anulado: false },
            select: {
              Id: true,
              IdInventarioItem: true,
              Cantidad: true,
              EstadoEnvase: true,
              InventarioItem: {
                select: {
                  EsEnvaseRetornable: true,
                  Existencia: true,
                  Nombre: true,
                },
              },
              Envases: {
                select: {
                  Id: true,
                  IdInventarioItemEnvase: true,
                  Modo: true,
                  Cantidad: true,
                },
              },
            },
          },
        },
      });
      if (!sale) {
        throw new Error('Venta no existe o no está confirmada');
      }
      const dispatchedItems = new Set<number>();
      if (sale.IdRutaSesion) {
        const session = await tx.rutaSesion.findFirst({
      where: { Id: sale.IdRutaSesion, Anulado: false },
      select: { Estado: true },
        });
        if (session?.Estado !== 'EN_CURSO') {
      throw new Error('La ruta debe estar EN_CURSO para registrar una devolución comercial');
        }

        const dispatch = await tx.despachoRuta.findFirst({
      where: { IdRutaSesion: sale.IdRutaSesion, Anulado: false },
      select: { Detalles: { select: { IdInventarioItem: true } } },
        });
        if (!dispatch) {
      throw new Error('No existe un despacho confirmado para la sesión de ruta');
        }
        for (const line of dispatch.Detalles) {
      dispatchedItems.add(line.IdInventarioItem);
        }
        if (await tx.devolucionRuta.findFirst({
      where: { IdRutaSesion: sale.IdRutaSesion, Anulado: false },
      select: { Id: true },
        })) {
      throw new Error('No se pueden registrar devoluciones comerciales después de confirmar la recepción de ruta');
        }
      }

      const sourceLines = new Map(sale.DetalleVenta.map((line) => [line.Id, line]));
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
        if (!sourceLine || (sale.IdRutaSesion && !dispatchedItems.has(sourceLine.IdInventarioItem))) {
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

      const sourceLinesById = new Map(sale.DetalleVenta.map((line) => [line.Id, line]));
      const plantSellableReturns = new Map<number, { cantidad: number; nombre: string }>();
      for (const returnedLine of input.detalle) {
        const sourceLine = sourceLinesById.get(returnedLine.idDetalleVenta);
        if (!sourceLine) {
          throw new Error(`DetalleVenta ${returnedLine.idDetalleVenta} no pertenece a la venta`);
        }

        if (
          !sale.IdRutaSesion &&
          !sourceLine.InventarioItem.EsEnvaseRetornable &&
          returnedLine.condicionFisica === 'VENDIBLE'
        ) {
          const current = plantSellableReturns.get(sourceLine.IdInventarioItem);
          plantSellableReturns.set(sourceLine.IdInventarioItem, {
            cantidad: Number(((current?.cantidad ?? 0) + returnedLine.cantidad).toFixed(2)),
            nombre: current?.nombre ?? sourceLine.InventarioItem.Nombre,
          });
        }

        if (!sourceLine?.InventarioItem?.EsEnvaseRetornable) continue;

        const envaseDetail = sourceLine.Envases.length === 1 ? sourceLine.Envases[0] : undefined;
        if (
          !envaseDetail ||
          (sourceLine.EstadoEnvase !== 'VACIO' && sourceLine.EstadoEnvase !== 'LLENO')
        ) {
          throw new Error('No se puede registrar la devolución física del envase sin estado y custodia verificables');
        }
        if (!Number.isInteger(returnedLine.cantidad)) {
          throw new Error('La cantidad devuelta de envases debe ser entera');
        }
        if (returnedLine.cantidad > envaseDetail.Cantidad) {
          throw new Error('La cantidad devuelta supera la cantidad de envases registrada en la venta');
        }

        const estadoRecibido = returnedLine.condicionFisica === 'VENDIBLE'
          ? sourceLine.EstadoEnvase
          : 'DANADO';
        let idMovimientoEnvase: number | undefined;

        if (envaseDetail.Modo === 'PRESTAMO_EMPRESA') {
          const balance = await tx.envaseClienteSaldo.findFirst({
            where: {
              IdCliente: sale.IdCliente,
              IdInventarioItem: envaseDetail.IdInventarioItemEnvase,
            },
            select: { Id: true, CantidadPrestada: true },
          });
          if (!balance || balance.CantidadPrestada + 0.009 < returnedLine.cantidad) {
            throw new Error('La cantidad devuelta supera el saldo de envases prestados al cliente');
          }

          const balanceUpdated = Number((balance.CantidadPrestada - returnedLine.cantidad).toFixed(2));
          await tx.envaseClienteSaldo.update({
            where: { Id: balance.Id },
            data: { CantidadPrestada: balanceUpdated, FechaActualizacion: new Date() },
          });
          const location = sale.IdRutaSesion
            ? 'RUTA'
            : estadoRecibido === 'DANADO'
              ? 'CUARENTENA'
              : 'PLANTA';
          const movement = await tx.movimientoEnvase.create({
            data: {
              IdInventarioItem: envaseDetail.IdInventarioItemEnvase,
              IdCliente: sale.IdCliente,
              IdVenta: sale.Id,
              IdDetalleVentaEnvase: envaseDetail.Id,
              IdRutaSesion: sale.IdRutaSesion,
              IdUsuario: idUsuarioAutorizacion,
              TipoMovimiento: estadoRecibido === 'DANADO' ? 'DEVOLUCION_DANADA' : 'DEVOLUCION',
              EstadoEnvase: estadoRecibido,
              UbicacionEnvase: location,
              Cantidad: returnedLine.cantidad,
              SaldoAnterior: balance.CantidadPrestada,
              SaldoNuevo: balanceUpdated,
              Observaciones: `Devolución comercial #${data.Id}`,
              Anulado: false,
            },
            select: { Id: true },
          });
          idMovimientoEnvase = movement.Id;
        }

        const bucket: EnvaseBucket = sale.IdRutaSesion
          ? {
              ubicacion: 'RUTA',
              estado: estadoRecibido,
              idRutaSesion: sale.IdRutaSesion,
            }
          : {
              ubicacion: estadoRecibido === 'DANADO' ? 'CUARENTENA' : 'PLANTA',
              estado: estadoRecibido,
            };
        await registerEnvaseBucketChange(tx, {
          idInventarioItem: envaseDetail.IdInventarioItemEnvase,
          idUsuario: idUsuarioAutorizacion,
          bucket,
          cantidad: returnedLine.cantidad,
          entrada: true,
          nombre: `Devolución comercial #${data.Id} - ${sourceLine.IdInventarioItem}`,
          tipoDocumento: 'DEVCOM',
          documento: data.Id.toString(),
          idRutaSesion: sale.IdRutaSesion ?? undefined,
          idMovimientoEnvase,
          idDetalleVenta: sourceLine.Id,
        });
      }

      for (const [idInventarioItem, returned] of plantSellableReturns) {
        const item = await tx.inventarioItem.findFirst({
          where: { Id: idInventarioItem, Anulado: false },
          select: { Id: true, Existencia: true },
        });
        if (!item) {
          throw new Error(`InventarioItem ${idInventarioItem} no existe o está anulado`);
        }

        const existenceAfter = Number((item.Existencia + returned.cantidad).toFixed(2));
        await tx.inventarioItem.update({
          where: { Id: item.Id },
          data: { Existencia: existenceAfter },
        });
        await registerInventoryMovement(tx, {
          idInventarioItem: item.Id,
          idUsuario: idUsuarioAutorizacion,
          tipoDocumento: 'DEVCOM',
          documento: data.Id.toString(),
          nombre: `Ingreso por devolución comercial #${data.Id} - ${returned.nombre}`,
          tipoMovimiento: true,
          existenciaAnterior: item.Existencia,
          cantidad: returned.cantidad,
          nuevaExistencia: existenceAfter,
        });
      }

      await syncSaleReceivableAfterCommercialReturn(tx, sale.Id, idUsuarioAutorizacion);
      await accrueMonthlyCommissionsForSale(tx, sale.Id, idUsuarioAutorizacion, false, data.Id);
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
