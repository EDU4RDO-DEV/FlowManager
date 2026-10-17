import { describe, expect, it } from 'vitest';

import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '../validators/product.validators';

const baseProduct = {
  idUsuario: 1,
  idProveedor: 1,
  nombre: 'Artículo de prueba',
  categoria: 'PRODUCTO_TERMINADO',
  costoPromedio: 10,
};

describe('product category and independent capabilities', () => {
  it('accepts only the three inventory categories', () => {
    for (const categoria of ['PRODUCTO_TERMINADO', 'MATERIA_PRIMA', 'INSUMO']) {
      expect(createProductSchema.safeParse({ ...baseProduct, categoria }).success).toBe(true);
    }
    expect(createProductSchema.safeParse({ ...baseProduct, categoria: 'ENVASE' }).success).toBe(false);
  });

  it('defaults vendibility and physical-container tracking to false independently of category', () => {
    const product = createProductSchema.parse(baseProduct);
    expect(product.esVendible).toBe(false);
    expect(product.esEnvaseRetornable).toBe(false);

    const sellableInput = createProductSchema.parse({
      ...baseProduct,
      categoria: 'INSUMO',
      esVendible: true,
      precioVenta: 12,
    });
    expect(sellableInput.esVendible).toBe(true);
    expect(sellableInput.esEnvaseRetornable).toBe(false);

    const returnableFinishedProduct = createProductSchema.parse({
      ...baseProduct,
      esVendible: true,
      esEnvaseRetornable: true,
      precioVenta: 12,
    });
    expect(returnableFinishedProduct.esEnvaseRetornable).toBe(true);
  });

  it('requires a valid price for any vendible product, not based on category', () => {
    expect(createProductSchema.safeParse({
      ...baseProduct,
      categoria: 'INSUMO',
      esVendible: true,
    }).success).toBe(false);
    expect(createProductSchema.safeParse({
      ...baseProduct,
      categoria: 'PRODUCTO_TERMINADO',
      esVendible: false,
    }).success).toBe(true);
  });

  it('accepts server-side sales catalog filtering and rejects capacity on non-returnable items', () => {
    expect(listProductsQuerySchema.parse({ esVendible: 'true' }).esVendible).toBe(true);
    expect(createProductSchema.safeParse({
      ...baseProduct,
      capacidadEnvaseGalones: 5,
    }).success).toBe(false);
    expect(updateProductSchema.safeParse({
      esEnvaseRetornable: false,
      capacidadEnvaseGalones: 5,
    }).success).toBe(false);
  });
});
