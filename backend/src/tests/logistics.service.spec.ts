import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    vehiculo: { findFirst: vi.fn(), update: vi.fn() },
    rutaSesion: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/notification.service', () => ({
  NotificationEvents: { VEHICULO_NO_DISPONIBLE: 'VEHICULO_NO_DISPONIBLE' },
  send: sendMock,
}));

import { deleteRutaSesion, updateVehiculo } from '../services/logistics.service';

describe('Fase 10 - logística: sincronización de estado de vehículo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('no sobreescribe el estado MANTENIMIENTO de un vehículo al anular una sesión de ruta', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 1,
      IdVehiculo: 5,
      DespachoRuta: null,
      Venta: [],
    });
    prismaMock.rutaSesion.update.mockResolvedValueOnce({});
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Estado: 'MANTENIMIENTO' });

    await deleteRutaSesion(1, 9);

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.vehiculo.update).not.toHaveBeenCalled();
  });

  it('sincroniza a DISPONIBLE cuando el vehículo no está en mantenimiento ni tiene sesión activa', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce({
      Id: 1,
      IdVehiculo: 5,
      DespachoRuta: null,
      Venta: [],
    });
    prismaMock.rutaSesion.update.mockResolvedValueOnce({});
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Estado: 'EN_RUTA' });
    prismaMock.rutaSesion.findFirst.mockResolvedValueOnce(null);
    prismaMock.vehiculo.update.mockResolvedValueOnce({});

    await deleteRutaSesion(1, 9);

    expect(prismaMock.vehiculo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ Estado: 'DISPONIBLE' }) }),
    );
  });
});

describe('Fase 22 - notificación VEHICULO_NO_DISPONIBLE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('notifica cuando el vehículo transiciona de DISPONIBLE a MANTENIMIENTO', async () => {
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 5, Estado: 'DISPONIBLE' });
    prismaMock.vehiculo.update.mockResolvedValueOnce({
      Id: 5,
      Placa: 'P123ABC',
      Marca: 'Toyota',
      Modelo: 'Hilux',
      Estado: 'MANTENIMIENTO',
    });
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    await updateVehiculo(5, { estado: 'MANTENIMIENTO' });
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('VEHICULO_NO_DISPONIBLE', {
      placa: 'P123ABC',
      marca: 'Toyota',
      modelo: 'Hilux',
      estado: 'MANTENIMIENTO',
    });
  });

  it('no notifica si el vehículo ya estaba en MANTENIMIENTO', async () => {
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 5, Estado: 'MANTENIMIENTO' });
    prismaMock.vehiculo.update.mockResolvedValueOnce({
      Id: 5,
      Placa: 'P123ABC',
      Marca: 'Toyota',
      Modelo: 'Hilux',
      Estado: 'MANTENIMIENTO',
    });

    await updateVehiculo(5, { estado: 'MANTENIMIENTO' });
    await Promise.resolve();

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('no notifica cuando el cambio de estado no es hacia MANTENIMIENTO/NO_DISPONIBLE', async () => {
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 5, Estado: 'MANTENIMIENTO' });
    prismaMock.vehiculo.update.mockResolvedValueOnce({
      Id: 5,
      Placa: 'P123ABC',
      Marca: 'Toyota',
      Modelo: 'Hilux',
      Estado: 'DISPONIBLE',
    });

    await updateVehiculo(5, { estado: 'DISPONIBLE' });
    await Promise.resolve();

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('no notifica si input.estado no fue enviado (actualización de otros campos)', async () => {
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 5, Estado: 'DISPONIBLE' });
    prismaMock.vehiculo.update.mockResolvedValueOnce({
      Id: 5,
      Placa: 'P999ZZZ',
      Marca: 'Toyota',
      Modelo: 'Hilux',
      Estado: 'DISPONIBLE',
    });

    await updateVehiculo(5, { placa: 'P999ZZZ' });
    await Promise.resolve();

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('no afecta la operación principal si la notificación falla', async () => {
    prismaMock.vehiculo.findFirst.mockResolvedValueOnce({ Id: 5, Estado: 'DISPONIBLE' });
    prismaMock.vehiculo.update.mockResolvedValueOnce({
      Id: 5,
      Placa: 'P123ABC',
      Marca: 'Toyota',
      Modelo: 'Hilux',
      Estado: 'NO_DISPONIBLE',
    });
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado de red'));

    const result = await updateVehiculo(5, { estado: 'NO_DISPONIBLE' });
    await Promise.resolve();
    await Promise.resolve();

    expect(result.estado).toBe('NO_DISPONIBLE');
  });
});
