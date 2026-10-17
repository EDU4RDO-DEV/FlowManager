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
});
