import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    reglaBonificacion: {
      findMany: vi.fn(),
    },
    inventarioItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tipoCliente: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tipoCredito: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    reglaPrecioCliente: {
      create: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { previewSaleBonuses } from '../services/sale.service';
import { createTipoCliente } from '../services/client-catalog.service';
import { createReglaBonificacion, createReglaPrecioCliente, createTipoCredito } from '../services/commercial-rule.service';

describe('Fase 3 - reglas comerciales (rango, vigencia, unicidad)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respeta CantidadMaxima como límite superior del rango de bonificación', async () => {
    prismaMock.reglaBonificacion.findMany.mockResolvedValueOnce([]);

    await previewSaleBonuses([{ idInventarioItem: 5, cantidad: 200 }]);

    expect(prismaMock.reglaBonificacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { CantidadMaxima: null },
                { CantidadMaxima: { gte: 200 } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('rechaza tipo de cliente duplicado por nombre', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.tipoCliente.findFirst.mockResolvedValueOnce({ Id: 9 });

    await expect(
      createTipoCliente({ idUsuario: 1, nombre: 'Mayorista' }),
    ).rejects.toThrowError('Ya existe un tipo de cliente con ese nombre');
  });

  it('rechaza tipo de crédito duplicado por nombre', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.tipoCredito.findFirst.mockResolvedValueOnce({ Id: 9 });

    await expect(
      createTipoCredito({ idUsuario: 1, nombre: '30 días' }),
    ).rejects.toThrowError('Ya existe un tipo de crédito con ese nombre');
  });

  it('rechaza regla de precio con vigencia invertida (fechaFin < fechaInicio)', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.tipoCliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 3 });

    await expect(
      createReglaPrecioCliente({
        idUsuario: 1,
        idTipoCliente: 2,
        idInventarioItem: 3,
        precio: 10,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-09-01',
      }),
    ).rejects.toThrowError('fechaFin no puede ser anterior a fechaInicio');
  });

  it('rechaza regla de bonificación con cantidadMaxima menor a cantidadMinima', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 5 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 6 });

    await expect(
      createReglaBonificacion({
        idUsuario: 1,
        idInventarioItemCompra: 5,
        cantidadMinima: 100,
        cantidadMaxima: 50,
        idInventarioItemBonificado: 6,
        cantidadBonificada: 1,
      }),
    ).rejects.toThrowError('cantidadMaxima no puede ser menor a cantidadMinima');
  });
});
