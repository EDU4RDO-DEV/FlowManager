import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    inventarioItem: { findFirst: vi.fn() },
    estructuraProducto: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { deleteProductStructure, restoreProductStructure } from '../services/product-structure.service';

describe('Fase 11 - auditoría en estructura de producto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteProductStructure registra IdUsuarioAnulador y FechaAnulacion', async () => {
    prismaMock.estructuraProducto.findFirst.mockResolvedValueOnce({ Id: 5 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.estructuraProducto.update.mockResolvedValueOnce({});

    await deleteProductStructure(5, 9);

    expect(prismaMock.estructuraProducto.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: expect.objectContaining({
        Anulado: true,
        IdUsuarioAnulador: 9,
        FechaAnulacion: expect.any(Date),
      }),
    });
  });

  it('restoreProductStructure limpia anulación y registra IdUsuarioModificador/FechaModificacion', async () => {
    prismaMock.estructuraProducto.findFirst.mockResolvedValueOnce({
      Id: 5,
      IdProductoTerminado: 1,
      IdMateriaPrima: 2,
    });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.estructuraProducto.findFirst.mockResolvedValueOnce(null);
    prismaMock.estructuraProducto.update.mockResolvedValueOnce({
      Id: 5,
      IdProductoTerminado: 1,
      IdMateriaPrima: 2,
      CantidadRequerida: 1,
      FechaRegistro: new Date(),
      IdUsuarioModificador: 9,
      FechaModificacion: new Date(),
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        Id: 2,
        Nombre: 'Insumo',
        Categoria: 'INSUMO',
        Existencia: 10,
        CostoPromedio: 1,
        PrecioVenta: 2,
        RutaImagen: null,
        Anulado: false,
      },
    });

    await restoreProductStructure(5, 9);

    expect(prismaMock.estructuraProducto.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: expect.objectContaining({
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: 9,
        FechaModificacion: expect.any(Date),
      }),
      include: expect.anything(),
    });
  });
});
