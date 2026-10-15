import { describe, expect, it } from 'vitest';

import { createCommercialReturnSchema, createSaleSchema } from '../validators/sale.validators';

const validProforma = () => ({
  idUsuario: 1,
  idCliente: 1,
  idRutaSesion: 1,
  tipoRegistro: 'PROFORMA' as const,
  fechaExpiracionProforma: new Date(Date.now() + 60_000).toISOString(),
  condicionPago: 'CONTADO' as const,
  requiereFactura: false,
  detalle: [{ idInventarioItem: 1, cantidad: 1 }],
  pagoInicial: { monto: 1, metodoPago: 'EFECTIVO' as const },
});

describe('createSaleSchema route proforma expiration', () => {
  it('requires a future expiration for route proformas', () => {
    expect(createSaleSchema.safeParse(validProforma()).success).toBe(true);
    expect(
      createSaleSchema.safeParse({
        ...validProforma(),
        fechaExpiracionProforma: undefined,
      }).success,
    ).toBe(false);
    expect(
      createSaleSchema.safeParse({
        ...validProforma(),
        fechaExpiracionProforma: new Date(Date.now() - 60_000).toISOString(),
      }).success,
    ).toBe(false);
  });

  describe('createCommercialReturnSchema', () => {
    it('requires a segregated location for non-sellable returned products', () => {
      expect(createCommercialReturnSchema.safeParse({
        detalle: [{
          idDetalleVenta: 1,
          cantidad: 1,
          motivo: 'Producto dañado',
          condicionFisica: 'DANADO',
        }],
      }).success).toBe(false);
      expect(createCommercialReturnSchema.safeParse({
        detalle: [{
          idDetalleVenta: 1,
          cantidad: 1,
          motivo: 'Empaque dañado',
          condicionFisica: 'DANADO',
          ubicacionNoVendible: 'Compartimento segregado',
        }],
      }).success).toBe(true);
    });
  });

  it('rejects expiration data outside route proformas', () => {
    const routeProforma = validProforma();
    expect(
      createSaleSchema.safeParse({
        ...routeProforma,
        idRutaSesion: undefined,
      }).success,
    ).toBe(false);
    expect(
      createSaleSchema.safeParse({
        ...routeProforma,
        tipoRegistro: 'VENTA',
      }).success,
    ).toBe(false);
  });
});
