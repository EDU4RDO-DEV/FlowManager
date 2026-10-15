import { describe, expect, it } from 'vitest';

import { renderReportHtml, type ReportLayoutName } from '../modules/reports/export/templates/handlebars';

const layouts: ReportLayoutName[] = ['standard', 'financial', 'inventory-landscape'];
const commercialDescription = '¿Cuánto vendimos? Detalle o resumen de ventas agrupado por día, semana o mes.';

describe('report PDF templates', () => {
  it.each(layouts)('renders %s without commercial descriptions', (layout) => {
    const html = renderReportHtml(layout, {
      company: {
        nombreComercial: 'Empresa de prueba',
        direccion: 'Dirección empresarial',
        logoDataUri: null,
      },
      report: {
        nombre: 'Ventas por período',
        descripcion: commercialDescription,
        categoriaLabel: 'Ventas',
      },
      metaItems: [
        { label: 'Fecha inicial', value: '01/01/2026' },
        { label: 'Generado', value: '15 oct 2026, 15:11' },
      ],
      indicators: [{ label: 'Total vendido', value: 'Q 100.00' }],
      columns: [{ key: 'cliente', label: 'Cliente', type: 'text', align: 'left' }],
      columnCount: 1,
      rows: [{ cliente: 'Cliente de prueba' }],
      groups: [],
      totals: null,
      hasData: true,
      truncado: false,
    });

    expect(html).toContain('Ventas por período');
    expect(html).toContain('Empresa de prueba');
    expect(html).toContain('report-header__logo-fallback');
    expect(html).toContain('Ventas');
    expect(html).toContain('15 oct 2026, 15:11');
    expect(html).not.toContain(commercialDescription);
    expect(html).not.toContain('report-header__subtitle');
  });

  it.each(layouts)('describes truncated grouped results without reporting a false row count in %s', (layout) => {
    const html = renderReportHtml(layout, {
      company: { nombreComercial: 'Empresa de prueba', direccion: null, logoDataUri: null },
      report: { nombre: 'Existencias valorizadas', categoriaLabel: 'Inventario' },
      metaItems: [],
      indicators: [],
      columns: [{ key: 'producto', label: 'Producto', type: 'text' }],
      columnCount: 1,
      rows: [],
      groups: [{ key: 'producto', label: 'Productos', rows: [{ producto: 'Producto de prueba' }] }],
      totals: null,
      hasData: true,
      truncado: true,
    });

    expect(html).toContain('el resultado puede estar incompleto');
    expect(html).not.toContain('primeros 0 registros');
  });
});
