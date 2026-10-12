import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    talonario: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    venta: { findFirst: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { restoreTalonario, updateTalonario } from '../services/talonario.service';

describe('Fase 11 - auditoría en talonarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateTalonario registra IdUsuarioModificador y FechaModificacion', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.talonario.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });

    await updateTalonario(3, { idUsuarioModificador: 7 });

    expect(prismaMock.talonario.updateMany).toHaveBeenCalledWith({
      where: { Id: 3, Anulado: false, UltimoUtilizado: 5 },
      data: expect.objectContaining({
        IdUsuarioModificador: 7,
        FechaModificacion: expect.any(Date),
      }),
    });
  });

  it('rechaza retroceder el correlativo utilizado', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });

    await expect(updateTalonario(3, { ultimoUtilizado: 4 })).rejects.toThrow(
      'No se permite retroceder el correlativo utilizado',
    );
    expect(prismaMock.talonario.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza un cursor anterior a correlativos presentes en ventas históricas', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });
    prismaMock.venta.findFirst.mockResolvedValueOnce({ NumeroProForma: 7 });

    await expect(updateTalonario(3, { ultimoUtilizado: 6 })).rejects.toThrow(
      'ultimoUtilizado no puede ser menor que un correlativo ya asignado',
    );
    expect(prismaMock.talonario.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza una actualización que compite con una reserva concurrente', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
      CorrelativoInicial: 1,
      CorrelativoFinal: 100,
      UltimoUtilizado: 5,
    });
    prismaMock.talonario.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(updateTalonario(3, { correlativoFinal: 90 })).rejects.toThrow(
      'Talonario modificado concurrentemente; vuelva a cargarlo',
    );
    expect(prismaMock.talonario.findFirst).toHaveBeenCalledTimes(1);
  });

  it('restoreTalonario limpia anulación y registra IdUsuarioModificador/FechaModificacion', async () => {
    prismaMock.talonario.findFirst.mockResolvedValueOnce({
      Id: 3,
      Nombre: 'Talonario A',
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.talonario.findFirst.mockResolvedValueOnce(null);
    prismaMock.talonario.update.mockResolvedValueOnce({});

    await restoreTalonario(3, 7);

    expect(prismaMock.talonario.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: expect.objectContaining({
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: 7,
        FechaModificacion: expect.any(Date),
      }),
    });
  });
});
