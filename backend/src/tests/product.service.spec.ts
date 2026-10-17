import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    proveedor: { findFirst: vi.fn() },
    categoriaComision: { findFirst: vi.fn() },
    inventarioItem: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    estructuraProducto: { count: vi.fn() },
    ordenProduccion: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/inventory-movement.service', () => ({
  anulateInventoryMovementByReference: vi.fn(),
  registerInventoryMovement: vi.fn(),
  restoreInventoryMovementByReference: vi.fn(),
}));

import { createProduct, listProducts, updateProduct } from '../services/product.service';

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    Id: 7,
    IdUsuario: 1,
    IdProveedor: 2,
    Nombre: 'Producto terminado',
    Categoria: 'PRODUCTO_TERMINADO',
    EsVendible: true,
    EsEnvaseRetornable: false,
    EsFabricable: false,
    PermitirReceta: false,
    CapacidadEnvaseGalones: null,
    IdCategoriaComision: null,
    UnidadMedida: 'unidad',
    Existencia: 0,
    CostoPromedio: 10,
    PrecioVenta: 12,
    RutaImagen: null,
    FechaRegistro: null,
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Proveedor: {
      Id: 2,
      Anulado: false,
      Entidad: { NombreCompleto: 'Proveedor de prueba' },
    },
    ...overrides,
  };
}

describe('product service product capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
  });

  it('creates a finished product as non-vendible unless explicitly enabled', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.proveedor.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.create.mockResolvedValueOnce(productRow({
      EsVendible: false,
      PrecioVenta: 0,
    }));

    await createProduct({
      idUsuario: 1,
      idProveedor: 2,
      nombre: 'Producto terminado',
      categoria: 'PRODUCTO_TERMINADO',
      costoPromedio: 10,
    });

    expect(prismaMock.inventarioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Categoria: 'PRODUCTO_TERMINADO',
          EsVendible: false,
          EsEnvaseRetornable: false,
          EsFabricable: false,
          PermitirReceta: false,
        }),
      }),
    );
  });

  it('preserves vendibility when an item category changes', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce(productRow())
      .mockResolvedValueOnce(null);
    prismaMock.estructuraProducto.count.mockResolvedValue(0);
    prismaMock.inventarioItem.update.mockResolvedValueOnce(productRow({ Categoria: 'INSUMO' }));

    await updateProduct(7, { categoria: 'INSUMO' });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Categoria: 'INSUMO',
          EsVendible: true,
          EsEnvaseRetornable: false,
        }),
      }),
    );
  });

  it('persists the fabrication capability when editing a product', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce(productRow())
      .mockResolvedValueOnce(null);
    prismaMock.inventarioItem.update.mockResolvedValueOnce(productRow({ EsFabricable: true }));

    await updateProduct(7, { esFabricable: true });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          EsFabricable: true,
          EsVendible: true,
          EsEnvaseRetornable: false,
        }),
      }),
    );
  });

  it('persists recipe permission independently from fabrication', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.proveedor.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.create.mockResolvedValueOnce(productRow({
      Categoria: 'INSUMO',
      EsFabricable: false,
      PermitirReceta: true,
      PrecioVenta: 0,
    }));

    await createProduct({
      idUsuario: 1,
      idProveedor: 2,
      nombre: 'Insumo con receta',
      categoria: 'INSUMO',
      costoPromedio: 10,
      permitirReceta: true,
    });

    expect(prismaMock.inventarioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          EsFabricable: false,
          PermitirReceta: true,
        }),
      }),
    );
  });

  it('updates recipe permission independently from fabrication', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce(productRow({ EsFabricable: false, PermitirReceta: false }))
      .mockResolvedValueOnce(null);
    prismaMock.inventarioItem.update.mockResolvedValueOnce(productRow({
      EsFabricable: false,
      PermitirReceta: true,
    }));

    await updateProduct(7, { permitirReceta: true });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          EsFabricable: false,
          PermitirReceta: true,
        }),
      }),
    );
  });

  it('allows disabling fabrication while preserving an enabled recipe', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce(productRow({ EsFabricable: true, PermitirReceta: true }))
      .mockResolvedValueOnce(null);
    prismaMock.ordenProduccion.count.mockResolvedValueOnce(0);
    prismaMock.inventarioItem.update.mockResolvedValueOnce(productRow({
      EsFabricable: false,
      PermitirReceta: true,
    }));

    await updateProduct(7, { esFabricable: false });

    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          EsFabricable: false,
          PermitirReceta: true,
        }),
      }),
    );
    expect(prismaMock.estructuraProducto.count).not.toHaveBeenCalled();
  });

  it('prevents disabling recipe permission while any recipe history exists', async () => {
    prismaMock.inventarioItem.findFirst
      .mockResolvedValueOnce(productRow({ PermitirReceta: true }))
      .mockResolvedValueOnce(null);
    prismaMock.estructuraProducto.count.mockResolvedValueOnce(1);

    await expect(updateProduct(7, { permitirReceta: false })).rejects.toThrow(
      'No se puede desactivar Permitir receta mientras el producto tenga recetas registradas',
    );

    expect(prismaMock.inventarioItem.update).not.toHaveBeenCalled();
  });

  it('filters the products API query by vendibility for the sales catalog', async () => {
    prismaMock.inventarioItem.count.mockResolvedValueOnce(0);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([]);

    await listProducts({ esVendible: true });

    expect(prismaMock.inventarioItem.count).toHaveBeenCalledWith({
      where: { Anulado: false, EsVendible: true },
    });

    expect(prismaMock.inventarioItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Anulado: false, EsVendible: true },
      }),
    );
  });

  it('filters product queries by recipe permission', async () => {
    prismaMock.inventarioItem.count.mockResolvedValueOnce(0);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([]);

    await listProducts({ permitirReceta: true });

    expect(prismaMock.inventarioItem.count).toHaveBeenCalledWith({
      where: { Anulado: false, PermitirReceta: true },
    });
  });

  it('allows fabrication independently from category and vendibility', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.proveedor.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.create.mockResolvedValueOnce(productRow({
      Categoria: 'INSUMO',
      EsVendible: false,
      EsFabricable: true,
      PrecioVenta: 0,
    }));

    await createProduct({
      idUsuario: 1,
      idProveedor: 2,
      nombre: 'Insumo fabricable',
      categoria: 'INSUMO',
      costoPromedio: 10,
      esFabricable: true,
    });

    expect(prismaMock.inventarioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Categoria: 'INSUMO',
          EsVendible: false,
          EsFabricable: true,
        }),
      }),
    );
  });

  it('allows a vendible finished product to also be fabricable', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.proveedor.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce(null);
    prismaMock.inventarioItem.create.mockResolvedValueOnce(productRow({
      EsVendible: true,
      EsFabricable: true,
      PrecioVenta: 15,
    }));

    await createProduct({
      idUsuario: 1,
      idProveedor: 2,
      nombre: 'Producto terminado fabricable',
      categoria: 'PRODUCTO_TERMINADO',
      costoPromedio: 10,
      precioVenta: 15,
      esVendible: true,
      esFabricable: true,
    });

    expect(prismaMock.inventarioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Categoria: 'PRODUCTO_TERMINADO',
          EsVendible: true,
          EsFabricable: true,
          PrecioVenta: 15,
        }),
      }),
    );
  });

  it('filters the products API query by fabrication capability', async () => {
    prismaMock.inventarioItem.count.mockResolvedValueOnce(0);
    prismaMock.inventarioItem.findMany.mockResolvedValueOnce([]);

    await listProducts({ esFabricable: true });

    expect(prismaMock.inventarioItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Anulado: false, EsFabricable: true },
      }),
    );
  });
});
