import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    vehiculo: { findFirst: vi.fn() },
    proveedor: { findFirst: vi.fn() },
    mantenimientoVehiculo: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import {
  createMaintenance,
  deleteMaintenance,
  restoreMaintenance,
  updateMaintenance,
} from '../services/maintenance.service';

describe('Fase 9 - mantenimiento de vehículos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite registrar un mantenimiento PROGRAMADO sin costo', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.mantenimientoVehiculo.create.mockResolvedValueOnce({
      Id: 10,
      IdVehiculo: 3,
      IdProveedor: null,
      IdUsuario: 1,
      TipoMantenimiento: 'PREVENTIVO',
      Descripcion: 'Cambio de aceite programado',
      FechaMantenimiento: new Date('2026-10-05'),
      Costo: null,
      Estado: 'PROGRAMADO',
      ProximoMantenimiento: null,
      Observaciones: null,
      RutaImagen: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await createMaintenance({
      idUsuario: 1,
      idVehiculo: 3,
      tipoMantenimiento: 'PREVENTIVO',
      descripcion: 'Cambio de aceite programado',
      fechaMantenimiento: '2026-10-05',
    });

    expect(result.estado).toBe('PROGRAMADO');
    expect(result.costo).toBeNull();
  });

  it('rechaza crear un mantenimiento REALIZADO sin costo', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 3 });

    await expect(
      createMaintenance({
        idUsuario: 1,
        idVehiculo: 3,
        tipoMantenimiento: 'CORRECTIVO',
        descripcion: 'Cambio de frenos',
        fechaMantenimiento: '2026-10-05',
        estado: 'REALIZADO',
      }),
    ).rejects.toThrowError('costo es obligatorio cuando el mantenimiento está REALIZADO');
  });

  it('rechaza marcar como REALIZADO sin costo al actualizar', async () => {
    prismaMock.mantenimientoVehiculo.findFirst.mockResolvedValueOnce({
      Id: 10,
      Estado: 'PROGRAMADO',
      Costo: null,
    });

    await expect(updateMaintenance(10, { estado: 'REALIZADO' })).rejects.toThrowError(
      'costo es obligatorio cuando el mantenimiento está REALIZADO',
    );
  });

  it('permite marcar como REALIZADO cuando se envía el costo', async () => {
    prismaMock.mantenimientoVehiculo.findFirst.mockResolvedValueOnce({
      Id: 10,
      Estado: 'PROGRAMADO',
      Costo: null,
    });
    prismaMock.mantenimientoVehiculo.update.mockResolvedValueOnce({
      Id: 10,
      IdVehiculo: 3,
      IdProveedor: null,
      IdUsuario: 1,
      TipoMantenimiento: 'PREVENTIVO',
      Descripcion: 'Cambio de aceite',
      FechaMantenimiento: new Date('2026-10-05'),
      Costo: 250,
      Estado: 'REALIZADO',
      ProximoMantenimiento: null,
      Observaciones: null,
      RutaImagen: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: 1,
      FechaModificacion: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await updateMaintenance(10, { estado: 'REALIZADO', costo: 250 });

    expect(result.estado).toBe('REALIZADO');
    expect(result.costo).toBe(250);
  });

  it('anula y restaura un mantenimiento correctamente', async () => {
    prismaMock.mantenimientoVehiculo.findFirst.mockResolvedValueOnce({ Id: 10 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.mantenimientoVehiculo.update.mockResolvedValueOnce({});

    await deleteMaintenance(10, 9);

    expect(prismaMock.mantenimientoVehiculo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Anulado: true, IdUsuarioAnulador: 9 }) }),
    );

    prismaMock.mantenimientoVehiculo.findFirst.mockResolvedValueOnce({ Id: 10 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.mantenimientoVehiculo.update.mockResolvedValueOnce({
      Id: 10,
      IdVehiculo: 3,
      IdProveedor: null,
      IdUsuario: 1,
      TipoMantenimiento: 'PREVENTIVO',
      Descripcion: 'Cambio de aceite',
      FechaMantenimiento: new Date('2026-10-05'),
      Costo: null,
      Estado: 'PROGRAMADO',
      ProximoMantenimiento: null,
      Observaciones: null,
      RutaImagen: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: 9,
      FechaModificacion: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const restored = await restoreMaintenance(10, 9);
    expect(restored.anulado).toBe(false);
  });
});
