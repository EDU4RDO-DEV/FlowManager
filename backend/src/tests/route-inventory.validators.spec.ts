import { describe, expect, it } from 'vitest';

import {
  createRouteAdjustmentSchema,
  createRouteDispatchSchema,
  createRouteReturnSchema,
} from '../validators/route-inventory.validators';

describe('route inventory validators', () => {
  it('requires unique products and positive dispatch quantities', () => {
    expect(() => createRouteDispatchSchema.parse({
      detalle: [
        { idInventarioItem: 3, cantidad: 2 },
        { idInventarioItem: 3, cantidad: 1 },
      ],
    })).toThrow('No se permite repetir producto');

    expect(() => createRouteDispatchSchema.parse({
      detalle: [{ idInventarioItem: 3, cantidad: 0 }],
    })).toThrow();
  });

  it('accepts an empty receipt detail to record an all-missing physical return', () => {
    expect(createRouteReturnSchema.parse({ detalle: [] }).detalle).toEqual([]);
  });

  it('requires a physical location for damaged route-return quantities', () => {
    expect(() => createRouteReturnSchema.parse({
      detalle: [{ idInventarioItem: 3, cantidadRecibida: 2, cantidadDanada: 1 }],
    })).toThrow('ubicacionDanada es obligatoria');

    expect(createRouteReturnSchema.parse({
      detalle: [{
        idInventarioItem: 3,
        cantidadRecibida: 2,
        cantidadDanada: 1,
        ubicacionDanada: 'Área no vendible de planta',
      }],
    }).detalle[0]?.ubicacionDanada).toBe('Área no vendible de planta');
  });

  it('requires a documented classification, positive quantity and reason for a route adjustment', () => {
    expect(() => createRouteAdjustmentSchema.parse({
      idInventarioItem: 3,
      clasificacion: 'FALTANTE',
      cantidad: 1,
      motivo: 'ok',
    })).toThrow();

    expect(createRouteAdjustmentSchema.parse({
      idInventarioItem: 3,
      clasificacion: 'DANADO',
      cantidad: 1.5,
      motivo: 'Producto deteriorado',
    }).cantidad).toBe(1.5);
  });
});
