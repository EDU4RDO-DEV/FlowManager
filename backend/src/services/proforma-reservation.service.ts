import { Prisma } from '@prisma/client';

import { runSerializableTransaction } from '../utils/serializable-transaction';

export async function expireProformaReservations(
  tx: Prisma.TransactionClient,
  idRutaSesion?: number,
  now = new Date(),
) {
  const result = await tx.reservaProforma.updateMany({
    where: {
      Estado: 'ACTIVA',
      FechaExpiracion: { lte: now },
      ...(idRutaSesion !== undefined
        ? {
            Venta: {
              is: {
                IdRutaSesion: idRutaSesion,
                Anulado: false,
              },
            },
          }
        : {}),
    },
    data: {
      Estado: 'VENCIDA',
      FechaLiberacion: now,
      MotivoLiberacion: 'VENCIMIENTO',
    },
  });

  return result.count;
}

export async function processExpiredProformaReservations() {
  return runSerializableTransaction((tx) => expireProformaReservations(tx));
}

export function startProformaReservationExpiryWorker(intervalMs = 30_000) {
  let running = false;

  const sweep = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const expiredCount = await processExpiredProformaReservations();
      if (expiredCount > 0) {
        console.info(`[proformas] ${expiredCount} reserva(s) vencida(s) liberada(s)`);
      }
    } catch (error) {
      console.error('[proformas] No se pudieron procesar las reservas vencidas:', error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void sweep();
  }, intervalMs);
  timer.unref();
  void sweep();

  return () => clearInterval(timer);
}
