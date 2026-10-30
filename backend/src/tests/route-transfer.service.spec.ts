import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, loadRouteInventoryMock, transferEnvaseBucketMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rutaSesion: { findFirst: vi.fn() },
    transferenciaVehiculo: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    inventarioItem: { findMany: vi.fn() },
  },
  loadRouteInventoryMock: vi.fn(),
  transferEnvaseBucketMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/route-inventory.service', () => ({
  loadRouteInventory: loadRouteInventoryMock,
  assertRouteCanClose: vi.fn(),
}));
vi.mock('../services/inventory-movement.service', () => ({
  transferEnvaseBucket: transferEnvaseBucketMock,
}));

import {
  cancelVehicleTransfer,
  confirmVehicleTransfer,
  createVehicleTransfer,
  rejectVehicleTransfer,
} from '../services/route-transfer.service';

function sessionRow(id: number, estado = 'EN_CURSO') {
  return { Id: id, Estado: estado };
}

function inventoryWithAvailable(idInventarioItem: number, disponible: number, estadoEnvaseDespachado: string | null = null) {
  return {
    session: { Id: 10, Estado: 'EN_CURSO' },
    despacho: { Id: 1 },
    devolucion: null,
    lines: [
      {
        idInventarioItem,
        nombre: 'Agua 20L',
        unidadMedida: 'unidad',
        despachado: disponible,
        estadoEnvaseDespachado,
        vendido: 0,
        devolucionComercial: 0,
        noVendibleComercial: 0,
        devuelto: 0,
        danado: 0,
        ajustado: 0,
        reservado: 0,
        envasePrestado: 0,
        envaseDevuelto: 0,
        envaseBaja: 0,
        transferidoSaliente: 0,
        transferidoRecibido: 0,
        pendienteConciliacion: disponible,
        disponible,
      },
    ],
  };
}

describe('route-transfer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('creates a PENDIENTE transfer when the origin has enough disponible stock', async () => {
    prismaMock.rutaSesion.findFirst
      .mockResolvedValueOnce(sessionRow(10))
      .mockResolvedValueOnce(sessionRow(20));
    loadRouteInventoryMock.mockResolvedValueOnce(inventoryWithAvailable(7, 10));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 20L', UnidadMedida: 'unidad', EsEnvaseRetornable: false },
    ]);
    prismaMock.transferenciaVehiculo.create.mockResolvedValueOnce({
      Id: 1,
      IdRutaSesionOrigen: 10,
      IdRutaSesionDestino: 20,
      IdUsuario: 5,
      Motivo: 'Reparto cruzado',
      EstadoConfirmacion: 'PENDIENTE',
      IdUsuarioConfirma: null,
      FechaConfirmacion: null,
      FechaRegistro: new Date('2026-10-30T10:00:00.000Z'),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      MotivoAnulacion: null,
      Detalles: [{ Id: 1, IdInventarioItem: 7, NombreSnapshot: 'Agua 20L', UnidadMedidaSnapshot: 'unidad', Cantidad: 6, EstadoEnvase: null }],
    });

    const result = await createVehicleTransfer(5, {
      idRutaSesionOrigen: 10,
      idRutaSesionDestino: 20,
      motivo: 'Reparto cruzado',
      detalle: [{ idInventarioItem: 7, cantidad: 6 }],
    });

    expect(result.estadoConfirmacion).toBe('PENDIENTE');
    expect(prismaMock.transferenciaVehiculo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          IdRutaSesionOrigen: 10,
          IdRutaSesionDestino: 20,
          EstadoConfirmacion: 'PENDIENTE',
        }),
      }),
    );
  });

  it('rejects a transfer that exceeds the disponible stock of the origin vehicle (no over-allocation)', async () => {
    prismaMock.rutaSesion.findFirst
      .mockResolvedValueOnce(sessionRow(10))
      .mockResolvedValueOnce(sessionRow(20));
    loadRouteInventoryMock.mockResolvedValueOnce(inventoryWithAvailable(7, 4));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 20L', UnidadMedida: 'unidad', EsEnvaseRetornable: false },
    ]);

    await expect(
      createVehicleTransfer(5, {
        idRutaSesionOrigen: 10,
        idRutaSesionDestino: 20,
        motivo: 'Reparto cruzado',
        detalle: [{ idInventarioItem: 7, cantidad: 6 }],
      }),
    ).rejects.toThrow('Existencia insuficiente');

    expect(prismaMock.transferenciaVehiculo.create).not.toHaveBeenCalled();
  });

  it(
    'prevents concurrent transfers from over-allocating the same origin stock: a second ' +
      'serialized read must already see the first transfer as PENDIENTE and reject the combined total',
    async () => {
      prismaMock.rutaSesion.findFirst
        .mockResolvedValue(sessionRow(10))
        .mockResolvedValueOnce(sessionRow(10))
        .mockResolvedValueOnce(sessionRow(20))
        .mockResolvedValueOnce(sessionRow(10))
        .mockResolvedValueOnce(sessionRow(30));
      // 10 unidades disponibles en origen.
      loadRouteInventoryMock
        .mockResolvedValueOnce(inventoryWithAvailable(7, 10))
        // Tras confirmarse/registrarse la primera transferencia (6 unidades), una
        // transacción SERIALIZABLE que reintenta debe leer el disponible YA DESCONTADO.
        .mockResolvedValueOnce(inventoryWithAvailable(7, 4));
      prismaMock.inventarioItem.findMany.mockResolvedValue([
        { Id: 7, Nombre: 'Agua 20L', UnidadMedida: 'unidad', EsEnvaseRetornable: false },
      ]);
      prismaMock.transferenciaVehiculo.create.mockResolvedValueOnce({
        Id: 1,
        IdRutaSesionOrigen: 10,
        IdRutaSesionDestino: 20,
        IdUsuario: 5,
        Motivo: 'Primera transferencia',
        EstadoConfirmacion: 'PENDIENTE',
        IdUsuarioConfirma: null,
        FechaConfirmacion: null,
        FechaRegistro: new Date(),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        MotivoAnulacion: null,
        Detalles: [{ Id: 1, IdInventarioItem: 7, NombreSnapshot: 'Agua 20L', UnidadMedidaSnapshot: 'unidad', Cantidad: 6, EstadoEnvase: null }],
      });

      const first = await createVehicleTransfer(5, {
        idRutaSesionOrigen: 10,
        idRutaSesionDestino: 20,
        motivo: 'Primera transferencia',
        detalle: [{ idInventarioItem: 7, cantidad: 6 }],
      });
      expect(first.estadoConfirmacion).toBe('PENDIENTE');

      // Segunda transferencia concurrente solicitando otras 6 unidades: ya no caben
      // (10 - 6 = 4 disponibles) y debe rechazarse en vez de sobreasignar existencias.
      await expect(
        createVehicleTransfer(9, {
          idRutaSesionOrigen: 10,
          idRutaSesionDestino: 30,
          motivo: 'Segunda transferencia concurrente',
          detalle: [{ idInventarioItem: 7, cantidad: 6 }],
        }),
      ).rejects.toThrow('Existencia insuficiente');

      expect(prismaMock.transferenciaVehiculo.create).toHaveBeenCalledTimes(1);
    },
  );

  it('confirms a PENDIENTE transfer and moves the envase bucket from origin to destination', async () => {
    prismaMock.transferenciaVehiculo.findFirst.mockResolvedValueOnce({
      Id: 1,
      IdRutaSesionOrigen: 10,
      IdRutaSesionDestino: 20,
      EstadoConfirmacion: 'PENDIENTE',
      Detalles: [{ IdInventarioItem: 7, Cantidad: 4, EstadoEnvase: 'VACIO' }],
    });
    prismaMock.rutaSesion.findFirst
      .mockResolvedValueOnce(sessionRow(20))
      .mockResolvedValueOnce(sessionRow(10));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Garrafón', EsEnvaseRetornable: true },
    ]);
    prismaMock.transferenciaVehiculo.update.mockResolvedValueOnce({
      Id: 1,
      IdRutaSesionOrigen: 10,
      IdRutaSesionDestino: 20,
      IdUsuario: 5,
      Motivo: 'Reparto cruzado',
      EstadoConfirmacion: 'CONFIRMADA',
      IdUsuarioConfirma: 8,
      FechaConfirmacion: new Date(),
      FechaRegistro: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      MotivoAnulacion: null,
      Detalles: [{ Id: 1, IdInventarioItem: 7, NombreSnapshot: 'Garrafón', UnidadMedidaSnapshot: null, Cantidad: 4, EstadoEnvase: 'VACIO' }],
    });

    const result = await confirmVehicleTransfer(1, 8);

    expect(result.estadoConfirmacion).toBe('CONFIRMADA');
    expect(transferEnvaseBucketMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idInventarioItem: 7,
        origen: { ubicacion: 'RUTA', estado: 'VACIO', idRutaSesion: 10 },
        destino: { ubicacion: 'RUTA', estado: 'VACIO', idRutaSesion: 20 },
        cantidad: 4,
      }),
    );
  });

  it('rejects confirming a transfer that is not PENDIENTE', async () => {
    prismaMock.transferenciaVehiculo.findFirst.mockResolvedValueOnce({
      Id: 1,
      EstadoConfirmacion: 'CONFIRMADA',
      Detalles: [],
    });

    await expect(confirmVehicleTransfer(1, 8)).rejects.toThrow('Solo una transferencia PENDIENTE puede confirmarse');
  });

  it('rejects a PENDIENTE transfer and keeps it available for audit (not anulado)', async () => {
    prismaMock.transferenciaVehiculo.findFirst.mockResolvedValueOnce({
      Id: 1,
      EstadoConfirmacion: 'PENDIENTE',
      Detalles: [],
    });
    prismaMock.transferenciaVehiculo.update.mockResolvedValueOnce({
      Id: 1,
      IdRutaSesionOrigen: 10,
      IdRutaSesionDestino: 20,
      IdUsuario: 5,
      Motivo: 'Reparto cruzado',
      EstadoConfirmacion: 'RECHAZADA',
      IdUsuarioConfirma: 8,
      FechaConfirmacion: new Date(),
      FechaRegistro: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      MotivoAnulacion: 'No tiene espacio',
      Detalles: [],
    });

    const result = await rejectVehicleTransfer(1, 8, 'No tiene espacio');

    expect(result.estadoConfirmacion).toBe('RECHAZADA');
    expect(result.anulado).toBe(false);
  });

  it('blocks cancelling a CONFIRMADA transfer (requires a counter-transfer instead)', async () => {
    prismaMock.transferenciaVehiculo.findFirst.mockResolvedValueOnce({
      Id: 1,
      EstadoConfirmacion: 'CONFIRMADA',
      Detalles: [],
    });

    await expect(cancelVehicleTransfer(1, 8, 'Error de captura')).rejects.toThrow(
      'requiere una contra-transferencia',
    );
  });
});
