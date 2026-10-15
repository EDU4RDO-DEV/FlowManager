import { afterEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../config/prisma';
import { getReportDefinition } from '../modules/reports/registry';

describe('inventory movement report', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups active entries and exits with accurate subtotals and net quantity', async () => {
    const findMany = vi.spyOn(prisma.bitacoraInventario, 'findMany').mockResolvedValue([
      {
        Id: 1,
        IdInventarioItem: 10,
        IdUsuario: 1,
        TipoDocumento: 'COMPRA',
        Documento: '100',
        Nombre: 'Compra recibida',
        TipoMovimiento: true,
        ExistenciaAnterior: 5,
        Cantidad: 10,
        NuevaExistencia: 15,
        FechaRegistro: new Date('2026-10-01T12:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: { Nombre: 'Producto A', Categoria: 'MATERIA_PRIMA' },
        Usuario: { Nombre: 'Usuario de prueba' },
      },
      {
        Id: 2,
        IdInventarioItem: 10,
        IdUsuario: 1,
        TipoDocumento: 'VENTA',
        Documento: '200',
        Nombre: 'Venta despachada',
        TipoMovimiento: false,
        ExistenciaAnterior: 15,
        Cantidad: 3,
        NuevaExistencia: 12,
        FechaRegistro: new Date('2026-10-02T12:00:00.000Z'),
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        InventarioItem: { Nombre: 'Producto A', Categoria: 'MATERIA_PRIMA' },
        Usuario: { Nombre: 'Usuario de prueba' },
      },
    ]);

    const report = getReportDefinition('movimientos-inventario-periodo');
    if (!report) throw new Error('Inventory movement report is not registered');

    const result = await report.run({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Anulado: false, UbicacionEnvase: null, EstadoEnvase: null },
        orderBy: [{ FechaRegistro: 'desc' }, { Id: 'desc' }],
        take: 5000,
      }),
    );
    expect(result.groups).toMatchObject([
      { key: 'entrada', subtotals: { cantidad: 10 }, rows: [{ producto: 'Producto A', tipo: 'Entrada' }] },
      { key: 'salida', subtotals: { cantidad: 3 }, rows: [{ producto: 'Producto A', tipo: 'Salida' }] },
    ]);
    expect(result.indicators).toEqual([
      { label: 'Movimientos', value: 2 },
      { label: 'Unidades de entrada', value: '10.00' },
      { label: 'Unidades de salida', value: '3.00' },
      { label: 'Variación neta', value: '7.00' },
    ]);
    expect(result.meta.totalRegistros).toBe(2);
  });
});
