import { describe, expect, it } from 'vitest';

import { listInventoryLogQuerySchema } from '../validators/inventory-log.validators';

describe('inventory-log.validators', () => {
  it('acepta filtros válidos de consulta', () => {
    const parsed = listInventoryLogQuerySchema.parse({
      page: '2',
      limit: '50',
      busqueda: 'compra',
      tipoMovimiento: 'true',
      anulado: 'false',
      idInventarioItem: '10',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.tipoMovimiento).toBe(true);
    expect(parsed.anulado).toBe(false);
    expect(parsed.idInventarioItem).toBe(10);
  });

  it('rechaza limit fuera de rango', () => {
    expect(() => listInventoryLogQuerySchema.parse({ limit: '101' })).toThrowError(
      /limit debe estar entre 1 y 100/i,
    );
  });

  it('rechaza busqueda vacía', () => {
    expect(() => listInventoryLogQuerySchema.parse({ busqueda: '   ' })).toThrowError(
      /busqueda no puede ir vacia/i,
    );
  });

  it('rechaza idInventarioItem no positivo', () => {
    expect(() => listInventoryLogQuerySchema.parse({ idInventarioItem: '0' })).toThrowError(
      /debe ser mayor a 0/i,
    );
  });
});
