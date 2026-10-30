import { describe, expect, it } from 'vitest';

import {
  cancelRouteDispatchSchema,
  cancelRouteReturnSchema,
  cancelRouteReturnSchema,
  createRouteAdjustmentSchema,
  createRouteDispatchSchema,
  createRouteReturnSchema,
  dispatchProductsQuerySchema,
} from '../validators/route-inventory.validators';

describe('route inventory validators', () => {
  it('supports paginated dispatch catalog queries and respects the API page size limit', () => {
    expect(dispatchProductsQuerySchema.parse({ page: '2', limit: '100' })).toEqual({
      page: 2,
      limit: 100,
    });
    expect(() => dispatchProductsQuerySchema.parse({ page: '1', limit: '101' })).toThrow();
  });

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

  it('requires a meaningful reason to cancel a confirmed dispatch', () => {
    expect(() => cancelRouteDispatchSchema.parse({ motivo: 'ok' })).toThrow();
    expect(cancelRouteDispatchSchema.parse({ motivo: 'Estado registrado incorrectamente' })).toEqual({
      motivo: 'Estado registrado incorrectamente',
    });
  });

  it('requires a meaningful reason to cancel a route return', () => {
    expect(() => cancelRouteReturnSchema.parse({ motivo: 'ok' })).toThrow();
    expect(cancelRouteReturnSchema.parse({ motivo: 'Recepción registrada incorrectamente' })).toEqual({
      motivo: 'Recepción registrada incorrectamente',
    });
  });

  it('requires a meaningful reason to cancel a route return', () => {
    expect(() => cancelRouteReturnSchema.parse({ motivo: 'ok' })).toThrow();
    expect(cancelRouteReturnSchema.parse({ motivo: 'Recepción registrada incorrectamente' })).toEqual({
      motivo: 'Recepción registrada incorrectamente',
    });
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

  it('preserves the empty/full state selected for damaged returnable containers', () => {
    const parsed = createRouteReturnSchema.parse({
      detalle: [{
        idInventarioItem: 3,
        cantidadRecibida: 1,
        cantidadDanada: 1,
        estadoEnvaseDanado: 'VACIO',
        ubicacionDanada: 'Cuarentena',
      }],
    });

    expect(parsed.detalle[0]?.estadoEnvaseDanado).toBe('VACIO');
    expect(() => createRouteReturnSchema.parse({
      detalle: [{
        idInventarioItem: 3,
        cantidadRecibida: 1,
        cantidadDanada: 1,
        estadoEnvaseDanado: 'OTRO',
        ubicacionDanada: 'Cuarentena',
      }],
    })).toThrow();
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
