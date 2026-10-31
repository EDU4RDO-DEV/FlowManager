import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  getRouteInventoryMock,
  loadRouteInventoryMock,
} = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    rutaSesion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    vehiculo: { findFirst: vi.fn(), update: vi.fn() },
    ruta: { findFirst: vi.fn() },
    usuario: { findFirst: vi.fn() },
    empleado: { findFirst: vi.fn() },
    inventarioItem: { findMany: vi.fn() },
    transferenciaVehiculo: { create: vi.fn() },
    relevoVehiculo: { create: vi.fn() },
  },
  getRouteInventoryMock: vi.fn(),
  loadRouteInventoryMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/route-inventory.service', () => ({
  loadRouteInventory: loadRouteInventoryMock,
  getRouteInventory: getRouteInventoryMock,
  assertRouteCanClose: vi.fn(),
}));
vi.mock('../services/inventory-movement.service', () => ({
  transferEnvaseBucket: vi.fn(),
}));
vi.mock('../services/notification.service', () => ({
  NotificationEvents: { VEHICULO_NO_DISPONIBLE: 'VEHICULO_NO_DISPONIBLE' },
  send: vi.fn(),
}));

import { createVehicleHandoff } from '../services/route-handoff.service';

function baseInventory(disponibleAgua: number) {
  return {
    session: { Id: 10, Estado: 'EN_CURSO' },
    despacho: { Id: 1 },
    devolucion: null,
    lines: [
      {
        idInventarioItem: 7,
        nombre: 'Agua 20L',
        unidadMedida: 'unidad',
        despachado: disponibleAgua,
        estadoEnvaseDespachado: null,
        esEnvaseRetornable: false,
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
        pendienteConciliacion: disponibleAgua,
        disponible: disponibleAgua,
      },
    ],
  };
}

describe('route-handoff.service (relevo con custodia compartida)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.ruta.findFirst.mockResolvedValue({ Id: 1 });
    prismaMock.empleado.findFirst.mockResolvedValue({ Id: 1 });
    getRouteInventoryMock.mockResolvedValue({ productos: [] });
    prismaMock.relevoVehiculo.create.mockResolvedValue({
      Id: 1,
      IdRutaSesionSaliente: 10,
      IdRutaSesionEntrante: 20,
      IdUsuarioAutoriza: 1,
      Motivo: 'Avería mecánica',
      FechaRegistro: new Date(),
    });
  });

  // assertVehicleAvailableForSession's conflict check queries rutaSesion.findFirst WITHOUT
  // filtering by Id (it filters by IdVehiculo/FechaSesion). assertSessionTransferable (used
  // by createVehicleTransferWithinTx for both origen/destino) always filters by Id. Keying
  // the mock by `where.Id` lets both call sites resolve correctly regardless of order.
  function mockRutaSesionLookups(sessionsById: Record<number, unknown>) {
    prismaMock.rutaSesion.findFirst.mockImplementation(async (args: { where?: { Id?: number } }) => {
      if (args?.where?.Id !== undefined) {
        return sessionsById[args.where.Id] ?? null;
      }
      return null;
    });
  }

  function mockSaliente(overrides: Partial<{ Estado: string; IdVehiculo: number; IdJornada: number | null }> = {}) {
    mockRutaSesionLookups({
      10: {
        Id: 10,
        Estado: 'EN_CURSO',
        IdVehiculo: 2,
        IdJornada: 99,
        FechaSesion: new Date('2026-10-30T00:00:00.000Z'),
        ...overrides,
      },
      20: { Id: 20, Estado: 'EN_CURSO' },
    });
  }

  function mockEntranteCreate() {
    prismaMock.vehiculo.findFirst.mockResolvedValue({ Id: 3, Estado: 'DISPONIBLE' });
    prismaMock.rutaSesion.create.mockResolvedValueOnce({
      Id: 20,
      IdRuta: 1,
      IdVehiculo: 3,
      IdUsuarioChofer: 4,
      IdUsuarioVendedor: 5,
      IdJornada: 99,
      FechaSesion: new Date('2026-10-30T00:00:00.000Z'),
      KmInicial: 0,
      KmFinal: null,
      Estado: 'EN_CURSO',
      FechaCierre: null,
      IdUsuarioCierre: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });
  }

  it('creates the entrante session as EN_CURSO WITHOUT closing or touching the saliente session', async () => {
    mockSaliente();
    mockEntranteCreate();

    const result = await createVehicleHandoff(10, 1, {
      motivo: 'Avería mecánica',
      idRuta: 1,
      idVehiculo: 3,
      idUsuarioChofer: 4,
      idUsuarioVendedor: 5,
      kmInicialEntrante: 0,
    });

    expect(result.sesionEntrante.idJornada).toBe(99);
    expect(result.sesionEntrante.estado).toBe('EN_CURSO');
    // La sesión saliente nunca se actualiza/cierra desde el relevo (custodia compartida).
    expect(prismaMock.rutaSesion.update).not.toHaveBeenCalled();
    expect(result.transferenciaInventario).toBeNull();
    expect(prismaMock.transferenciaVehiculo.create).not.toHaveBeenCalled();
    expect(prismaMock.relevoVehiculo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdRutaSesionSaliente: 10, IdRutaSesionEntrante: 20 }),
      }),
    );
    // Solo se sincroniza el vehículo entrante; el saliente sigue EN_CURSO sin cambios.
    expect(prismaMock.vehiculo.update).toHaveBeenCalledTimes(1);
  });

  it('optionally moves only the explicitly requested detalle as a CONFIRMADA transfer, leaving the rest with the saliente', async () => {
    mockSaliente();
    mockEntranteCreate();
    loadRouteInventoryMock.mockResolvedValueOnce(baseInventory(10));
    prismaMock.inventarioItem.findMany.mockResolvedValue([
      { Id: 7, Nombre: 'Agua 20L', UnidadMedida: 'unidad', EsEnvaseRetornable: false },
    ]);
    prismaMock.transferenciaVehiculo.create.mockResolvedValueOnce({
      Id: 50,
      IdRutaSesionOrigen: 10,
      IdRutaSesionDestino: 20,
      IdUsuario: 1,
      Motivo: 'Relevo de vehículo: Avería mecánica',
      EstadoConfirmacion: 'CONFIRMADA',
      IdUsuarioConfirma: 1,
      FechaConfirmacion: new Date(),
      FechaRegistro: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      MotivoAnulacion: null,
      Detalles: [{ Id: 1, IdInventarioItem: 7, NombreSnapshot: 'Agua 20L', UnidadMedidaSnapshot: 'unidad', Cantidad: 4, EstadoEnvase: null }],
    });

    // Solo se transfieren 4 de las 10 disponibles: el resto queda en el vehículo saliente.
    const result = await createVehicleHandoff(10, 1, {
      motivo: 'Avería mecánica',
      idRuta: 1,
      idVehiculo: 3,
      idUsuarioChofer: 4,
      idUsuarioVendedor: 5,
      kmInicialEntrante: 0,
      detalle: [{ idInventarioItem: 7, cantidad: 4 }],
    });

    expect(result.transferenciaInventario?.estadoConfirmacion).toBe('CONFIRMADA');
    expect(result.transferenciaInventario?.detalle).toEqual([
      expect.objectContaining({ idInventarioItem: 7, cantidad: 4 }),
    ]);
    expect(prismaMock.transferenciaVehiculo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          IdRutaSesionOrigen: 10,
          IdRutaSesionDestino: 20,
          EstadoConfirmacion: 'CONFIRMADA',
        }),
      }),
    );
    // La sesión saliente sigue sin cerrarse ni actualizarse: custodia compartida real.
    expect(prismaMock.rutaSesion.update).not.toHaveBeenCalled();
  });

  it('rejects transferring more than the disponible of the saliente session (no duplicated availability)', async () => {
    mockSaliente();
    mockEntranteCreate();
    loadRouteInventoryMock.mockResolvedValueOnce(baseInventory(3));
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([
      { Id: 7, Nombre: 'Agua 20L', UnidadMedida: 'unidad', EsEnvaseRetornable: false },
    ]);

    await expect(
      createVehicleHandoff(10, 1, {
        motivo: 'Avería mecánica',
        idRuta: 1,
        idVehiculo: 3,
        idUsuarioChofer: 4,
        idUsuarioVendedor: 5,
        kmInicialEntrante: 0,
        detalle: [{ idInventarioItem: 7, cantidad: 4 }],
      }),
    ).rejects.toThrow('Existencia insuficiente');

    expect(prismaMock.transferenciaVehiculo.create).not.toHaveBeenCalled();
    expect(prismaMock.relevoVehiculo.create).not.toHaveBeenCalled();
  });

  it('rejects the handoff when the saliente session is not EN_CURSO', async () => {
    mockSaliente({ Estado: 'CERRADA' });

    await expect(
      createVehicleHandoff(10, 1, {
        motivo: 'Avería mecánica',
        idRuta: 1,
        idVehiculo: 3,
        idUsuarioChofer: 4,
        idUsuarioVendedor: 5,
        kmInicialEntrante: 0,
      }),
    ).rejects.toThrow('debe estar EN_CURSO');

    expect(prismaMock.rutaSesion.create).not.toHaveBeenCalled();
    expect(prismaMock.transferenciaVehiculo.create).not.toHaveBeenCalled();
  });

  it('rejects a handoff onto the SAME vehicle (relevo is for vehicle substitution, not a personnel-only change)', async () => {
    mockSaliente({ IdVehiculo: 3 });

    await expect(
      createVehicleHandoff(10, 1, {
        motivo: 'Cambio de vendedor',
        idRuta: 1,
        idVehiculo: 3,
        idUsuarioChofer: 4,
        idUsuarioVendedor: 5,
        kmInicialEntrante: 0,
      }),
    ).rejects.toThrow('vehículo distinto');

    expect(prismaMock.rutaSesion.create).not.toHaveBeenCalled();
  });
});
