import type { ReportColumnType } from '../types';

const currencyFormatter = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-GT', {
  maximumFractionDigits: 2,
});

export function formatCellValue(value: unknown, type: ReportColumnType): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  switch (type) {
    case 'currency':
      return `Q ${currencyFormatter.format(Number(value))}`;
    case 'number':
      return numberFormatter.format(Number(value));
    case 'percent':
      return `${numberFormatter.format(Number(value))} %`;
    case 'date':
      return formatDate(value);
    case 'badge':
    case 'text':
    default:
      return String(value);
  }
}

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  // `timeZone: 'UTC'` evita que una fecha-calendario (guardada como medianoche UTC,
  // típico de columnas @db.Date o FechaRegistro) se muestre un día antes cuando el
  // proceso corre en un huso horario negativo (ej. Guatemala, UTC-6).
  return date.toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}
