import { describe, expect, it } from 'vitest';

import {
  createPurchaseSchema,
  listPurchasesQuerySchema,
  restorePurchaseBodySchema,
  restorePurchaseExpenseBodySchema,
} from '../validators/purchase.validators';

describe('purchase.validators', () => {
  it('valida compra de inventario con detalleCompra', () => {
    const parsed = createPurchaseSchema.parse({
      idUsuario: 1,
      idProveedor: 2,
      numeroFactura: 'F-100',
      esGasto: false,
      fechaFactura: '2026-08-15',
      detalleCompra: [{ idInventarioItem: 5, cantidad: 2, costoUnitario: 10.5 }],
    });

    expect(parsed.esGasto).toBe(false);
    expect(parsed.detalleCompra).toHaveLength(1);
  });

  it('rechaza detalleGasto cuando es compra de inventario', () => {
    expect(() =>
      createPurchaseSchema.parse({
        idUsuario: 1,
        idProveedor: 2,
        numeroFactura: 'F-101',
        esGasto: false,
        fechaFactura: '2026-08-15',
        detalleCompra: [{ idInventarioItem: 5, cantidad: 2, costoUnitario: 10.5 }],
        detalleGasto: [{ descripcion: 'Flete', cantidad: 1, precioUnitario: 25 }],
      }),
    ).toThrowError(/detalleGasto no debe enviarse cuando esGasto=false/i);
  });

  it('acepta cuerpos vacios en restauracion cuando se usa req.auth.userId', () => {
    expect(restorePurchaseBodySchema.parse({})).toEqual({});
    expect(restorePurchaseExpenseBodySchema.parse({})).toEqual({});
  });

  it('valida rango de fechas en filtros de compra', () => {
    expect(() =>
      listPurchasesQuerySchema.parse({
        fechaDesde: '2026-08-20',
        fechaHasta: '2026-08-10',
      }),
    ).toThrowError(/fechaDesde debe ser menor o igual a fechaHasta/i);
  });
});
