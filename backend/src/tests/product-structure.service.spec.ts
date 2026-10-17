import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    usuario: { findFirst: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    estructuraProducto: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transactionClient: {
      usuario: { findFirst: vi.fn() },
      inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
      estructuraProducto: { findMany: vi.fn() },
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import {
  createProductStructure,
  deleteProductStructure,
  applyRecipeCost,
  getRecipeCostEstimate,
  restoreProductStructure,
  updateRecipeCostPolicy,
} from '../services/product-structure.service';

describe('Fase 11 - auditoría en estructura de producto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (operation) =>
      operation(prismaMock.transactionClient),
    );
  });

  it('rejects a non-finished product as a recipe parent', async () => {
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce(null);

    await expect(createProductStructure({
      idProductoTerminado: 1,
      idMateriaPrima: 2,
      cantidadRequerida: 1,
    })).rejects.toThrow('Producto terminado no existe o no es un producto final');

    expect(prismaMock.estructuraProducto.create).not.toHaveBeenCalled();
  });

  it('rejects finished products as recipe components', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce({ Id: 1 })
      .mockResolvedValueOnce(null);

    await expect(createProductStructure({
      idProductoTerminado: 1,
      idMateriaPrima: 2,
      cantidadRequerida: 1,
    })).rejects.toThrow('El componente debe ser una materia prima o insumo activo');

    expect(prismaMock.estructuraProducto.create).not.toHaveBeenCalled();
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

  it('calculates the active recipe cost from component quantities and current costs', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: true,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 25,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 5,
          Anulado: false,
        },
      },
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 3,
          Nombre: 'Insumo',
          Categoria: 'INSUMO',
          UnidadMedida: 'unidad',
          CostoPromedio: 4.25,
          Anulado: false,
        },
      },
    ]);

    await expect(getRecipeCostEstimate(1)).resolves.toMatchObject({
      costoActual: 15,
      costoCalculado: 18.5,
      diferencia: 3.5,
      puedeActualizar: true,
    });
  });

  it('does not calculate a cost when a component quantity is invalid', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: false,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 0,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 0,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 5,
          Anulado: false,
        },
      },
    ]);

    await expect(getRecipeCostEstimate(1)).rejects.toThrow(
      'La cantidad requerida de Materia prima no es válida',
    );
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('does not calculate or update a recipe when the finished product unit is missing', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: false,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: null,
      CostoPromedio: 15,
      PrecioVenta: 0,
    });

    await expect(getRecipeCostEstimate(1)).rejects.toThrow(
      'El producto terminado no tiene unidad de medida configurada',
    );
    expect(prismaMock.transactionClient.estructuraProducto.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('updates only the product average cost after a matching confirmed estimate', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: true,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 25,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 9.25,
          Anulado: false,
        },
      },
    ]);

    await applyRecipeCost(1, 15, 18.5);

    expect(prismaMock.transactionClient.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 1 },
      data: {
        CostoPromedio: 18.5,
        FechaModificacion: expect.any(Date),
      },
    });
  });

  it('rejects stale recipe cost confirmation without changing the product', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: false,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 0,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 9.25,
          Anulado: false,
        },
      },
    ]);

    await expect(applyRecipeCost(1, 15, 19)).rejects.toThrow(
      'El costo o la receta cambiaron; vuelva a revisar los valores antes de confirmar',
    );
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('requires a finished product when saving the recipe cost preference', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce(null);

    await expect(updateRecipeCostPolicy(1, {
      actualizarCostoSegunReceta: true,
    })).rejects.toThrow('Producto terminado no existe o no es un producto final');
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('persists the recipe cost preference without changing other product values', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.transactionClient.inventarioItem.update.mockResolvedValueOnce({
      ActualizarCostoSegunReceta: true,
    });

    await expect(updateRecipeCostPolicy(1, {
      actualizarCostoSegunReceta: true,
    })).resolves.toEqual({ actualizarCostoSegunReceta: true });

    expect(prismaMock.transactionClient.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 1 },
      data: {
        ActualizarCostoSegunReceta: true,
        FechaModificacion: expect.any(Date),
      },
      select: { ActualizarCostoSegunReceta: true },
    });
  });

  it('does not apply the recipe cost when the preference is disabled', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: false,
      ActualizarCostoSegunReceta: false,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 0,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 9.25,
          Anulado: false,
        },
      },
    ]);

    await expect(applyRecipeCost(1, 15, 18.5)).rejects.toThrow(
      'La actualización del costo según receta está desactivada',
    );
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('preserves the selling price rule and never changes price when recipe cost exceeds it', async () => {
    prismaMock.transactionClient.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 1,
      Categoria: 'PRODUCTO_TERMINADO',
      EsVendible: true,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: 'paquete',
      CostoPromedio: 15,
      PrecioVenta: 18,
    });
    prismaMock.transactionClient.estructuraProducto.findMany.mockResolvedValueOnce([
      {
        CantidadRequerida: 2,
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          Id: 2,
          Nombre: 'Materia prima',
          Categoria: 'MATERIA_PRIMA',
          UnidadMedida: 'kg',
          CostoPromedio: 9.25,
          Anulado: false,
        },
      },
    ]);

    await expect(applyRecipeCost(1, 15, 18.5)).rejects.toThrow(
      'El costo calculado supera el precio de venta; actualice el precio manualmente antes de cambiar el costo.',
    );
    expect(prismaMock.transactionClient.inventarioItem.update).not.toHaveBeenCalled();
  });
});
