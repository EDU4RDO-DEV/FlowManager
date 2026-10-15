import { describe, expect, it } from 'vitest';

import { getAllReportDefinitions, getCatalog } from '../modules/reports/registry';

describe('reports registry', () => {
  it('registers every report once with a supported PDF layout', () => {
    const reports = getAllReportDefinitions();
    const ids = reports.map((report) => report.id);
    const supportedLayouts = new Set(['standard', 'financial', 'inventory-landscape']);

    expect(reports.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getCatalog()).toHaveLength(reports.length);
    expect(ids).toContain('movimientos-inventario-periodo');

    for (const report of reports) {
      expect(report.id).toBeTruthy();
      expect(report.nombre).toBeTruthy();
      expect(report.categoria).toBeTruthy();
      expect(report.moduloPermiso).toBeTruthy();
      expect(report.run).toBeTypeOf('function');
      expect(supportedLayouts.has(report.layout ?? 'standard')).toBe(true);
    }
  });

  it('validates inventory movement report filters and date ranges', () => {
    const report = getAllReportDefinitions().find((item) => item.id === 'movimientos-inventario-periodo');

    expect(report).toBeDefined();
    if (!report) throw new Error('Inventory movement report is not registered');

    expect(report.moduloPermiso).toBe('inventario');
    expect(report.schema.parse({ tipoMovimiento: 'ENTRADA', idInventarioItem: '12' })).toMatchObject({
      tipoMovimiento: 'ENTRADA',
      idInventarioItem: 12,
    });
    expect(() =>
      report.schema.parse({ fechaInicio: '2026-02-01', fechaFin: '2026-01-31' }),
    ).toThrow();
  });

});
