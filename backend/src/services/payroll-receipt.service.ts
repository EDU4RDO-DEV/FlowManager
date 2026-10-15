import { renderHtmlToPdf } from '../modules/reports/export/browser';
import type { getPayrollById } from './planilla-mensual.service';

type PayrollDetail = Awaited<ReturnType<typeof getPayrollById>>;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function money(value: number): string {
  return `Q${value.toFixed(2)}`;
}

export async function renderPayrollReceipt(payroll: PayrollDetail) {
  const employeeName = escapeHtml(payroll.empleado?.entidad.nombreCompleto ?? `Empleado #${payroll.idEmpleado}`);
  const period = `${MONTHS[payroll.mes - 1]} ${payroll.anio}`;
  const adjustments = payroll.detalleAjustes.map((adjustment) => `
    <tr><td>${escapeHtml(adjustment.tipoAjuste)}</td><td>${escapeHtml(adjustment.descripcion)}</td>
    <td class="amount">${money(adjustment.monto)}</td></tr>`).join('');
  const commissionRows = payroll.detalleComisiones.map((commission) => `
    <tr><td>${escapeHtml(commission.categoriaComisionSnapshot ?? commission.nombreProducto)}</td>
    <td>${commission.tipoCalculo === 'PORCENTAJE_VENTA'
      ? `${commission.valorAplicado}%`
      : `${money(commission.valorAplicado)} por unidad`}</td>
    <td class="amount">${money(commission.montoComision)}</td></tr>`).join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#1f2937;margin:0}
    h1{font-size:22px;margin:0 0 6px}h2{font-size:14px;margin:24px 0 8px}
    .muted{color:#6b7280}.header{border-bottom:2px solid #0284c7;padding-bottom:14px}
    .summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
    .box{border:1px solid #d1d5db;border-radius:6px;padding:10px}
    table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
    th{background:#f3f4f6}.amount{text-align:right;white-space:nowrap}
    .total{font-weight:bold;font-size:15px}.note{margin-top:10px;color:#6b7280;font-size:10px}
  </style></head><body>
    <div class="header"><h1>Recibo de planilla</h1><div class="muted">${escapeHtml(period)} · ${employeeName}</div></div>
    <div class="summary">
      <div class="box"><div class="muted">Estado</div><strong>${escapeHtml(payroll.estado)}</strong></div>
      <div class="box"><div class="muted">Fecha de emisión</div><strong>${new Date().toLocaleDateString('es-GT')}</strong></div>
    </div>
    <h2>Ingresos y descuentos</h2>
    <table><tbody>
      <tr><td>Sueldo base</td><td class="amount">${money(payroll.sueldoBase)}</td></tr>
      <tr><td>Comisiones</td><td class="amount">${money(payroll.totalComisiones)}</td></tr>
      <tr><td>Bonos</td><td class="amount">${money(payroll.totalBonosMetas)}</td></tr>
      <tr><td>Descuentos</td><td class="amount">-${money(payroll.totalDescuentos)}</td></tr>
      <tr class="total"><td>Líquido</td><td class="amount">${money(payroll.sueldoLiquido)}</td></tr>
    </tbody></table>
    <h2>Viáticos (separados)</h2>
    <table><tbody>
      <tr><td>Días trabajados</td><td class="amount">${payroll.diasTrabajados}</td></tr>
      <tr><td>Tarifa diaria aplicada</td><td class="amount">${payroll.tarifaViaticoAplicada === null ? '—' : money(payroll.tarifaViaticoAplicada)}</td></tr>
      <tr class="total"><td>Total de viáticos</td><td class="amount">${money(payroll.totalViaticos)}</td></tr>
    </tbody></table>
    <p class="note">Los viáticos se presentan por separado y no se incluyen en el líquido de la planilla.</p>
    ${commissionRows ? `<h2>Detalle de comisiones</h2><table><thead><tr><th>Categoría o producto</th><th>Tasa</th><th class="amount">Monto</th></tr></thead><tbody>${commissionRows}</tbody></table>` : ''}
    ${adjustments ? `<h2>Detalle de bonos y deducciones</h2><table><thead><tr><th>Tipo</th><th>Descripción</th><th class="amount">Monto</th></tr></thead><tbody>${adjustments}</tbody></table>` : ''}
  </body></html>`;

  return renderHtmlToPdf(html, {
    format: 'letter',
    landscape: false,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#6b7280"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
}
