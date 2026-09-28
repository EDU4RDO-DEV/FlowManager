import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    controlCalidadAgua: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import {
  createControlCalidad,
  listFechasFaltantes,
  updateControlCalidad,
  validateControlCalidadRegistro,
} from '../services/quality.service';

describe('Fase 8 - control de calidad de agua (pH y cloro)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza crear un registro sin las 4 mediciones cuando no es día no laborado', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });

    await expect(
      createControlCalidad({
        idUsuario: 1,
        fecha: '2026-09-28',
        cloroAntesFiltrado: 1.2,
      }),
    ).rejects.toThrowError('Debe registrar las 4 mediciones');
  });

  it('permite crear un registro de día no laborado sin mediciones', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.controlCalidadAgua.findFirst.mockResolvedValueOnce(null);
    prismaMock.controlCalidadAgua.create.mockResolvedValueOnce({
      Id: 1,
      IdUsuario: 1,
      Fecha: new Date('2026-09-27'),
      DiaNoLaborado: true,
      CloroAntesFiltrado: null,
      CloroDespuesFiltrado: null,
      PhAntesFiltrado: null,
      PhDespuesFiltrado: null,
      Observaciones: 'Domingo, planta cerrada',
      Validado: false,
      IdUsuarioValidador: null,
      FechaValidacion: null,
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await createControlCalidad({
      idUsuario: 1,
      fecha: '2026-09-27',
      diaNoLaborado: true,
      observaciones: 'Domingo, planta cerrada',
    });

    expect(result.diaNoLaborado).toBe(true);
    expect(result.cloroAntesFiltrado).toBeNull();
  });

  it('rechaza fecha duplicada para un registro activo', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.controlCalidadAgua.findFirst.mockResolvedValueOnce({ Id: 5 });

    await expect(
      createControlCalidad({
        idUsuario: 1,
        fecha: '2026-09-28',
        cloroAntesFiltrado: 1,
        cloroDespuesFiltrado: 0.8,
        phAntesFiltrado: 7,
        phDespuesFiltrado: 7.2,
      }),
    ).rejects.toThrowError('Ya existe un registro activo de control de calidad para esa fecha');
  });

  it('rechaza editar un registro ya validado', async () => {
    prismaMock.controlCalidadAgua.findFirst.mockResolvedValueOnce({
      Id: 1,
      Validado: true,
      DiaNoLaborado: false,
      CloroAntesFiltrado: 1,
      CloroDespuesFiltrado: 1,
      PhAntesFiltrado: 7,
      PhDespuesFiltrado: 7,
    });

    await expect(updateControlCalidad(1, { observaciones: 'cambio' })).rejects.toThrowError(
      'No se puede editar un registro ya validado',
    );
  });

  it('valida un registro y setea IdUsuarioValidador/FechaValidacion', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 4 });
    prismaMock.controlCalidadAgua.findFirst.mockResolvedValueOnce({ Id: 1, Validado: false });
    prismaMock.controlCalidadAgua.update.mockResolvedValueOnce({});
    prismaMock.controlCalidadAgua.findFirst.mockResolvedValueOnce({
      Id: 1,
      IdUsuario: 1,
      Fecha: new Date('2026-09-28'),
      DiaNoLaborado: false,
      CloroAntesFiltrado: 1,
      CloroDespuesFiltrado: 1,
      PhAntesFiltrado: 7,
      PhDespuesFiltrado: 7,
      Observaciones: null,
      Validado: true,
      IdUsuarioValidador: 4,
      FechaValidacion: new Date(),
      FechaRegistro: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await validateControlCalidadRegistro(1, 4);

    expect(prismaMock.controlCalidadAgua.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Validado: true, IdUsuarioValidador: 4 }),
      }),
    );
    expect(result.validado).toBe(true);
  });

  it('identifica fechas faltantes del mes hasta el día actual', async () => {
    prismaMock.controlCalidadAgua.findMany.mockResolvedValueOnce([
      { Fecha: new Date('2026-01-01T00:00:00.000Z') },
      { Fecha: new Date('2026-01-02T00:00:00.000Z') },
    ]);

    const fijarFecha = new Date('2026-01-05T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fijarFecha);

    const faltantes = await listFechasFaltantes(2026, 1);

    vi.useRealTimers();

    expect(faltantes).toEqual(['2026-01-03', '2026-01-04', '2026-01-05']);
  });
});
