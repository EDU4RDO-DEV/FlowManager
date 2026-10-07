import { Prisma } from '@prisma/client';

const MAX_REPORT_ROWS = 5000;

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

export function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function toStartOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Fecha inválida');
  }
  return date;
}

// Límite exclusivo (siguiente medianoche) para incluir todo el día de `fechaFin`
// sin depender de la porción de hora almacenada en columnas DATETIME.
export function toExclusiveEndOfDay(value: string): Date {
  const start = toStartOfDay(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function buildDateTimeRangeFilter(
  fechaInicio?: string,
  fechaFin?: string,
): Prisma.DateTimeFilter | undefined {
  if (!fechaInicio && !fechaFin) {
    return undefined;
  }

  return {
    ...(fechaInicio ? { gte: toStartOfDay(fechaInicio) } : {}),
    ...(fechaFin ? { lt: toExclusiveEndOfDay(fechaFin) } : {}),
  };
}

export function buildDateOnlyRangeFilter(
  fechaInicio?: string,
  fechaFin?: string,
): Prisma.DateTimeFilter | undefined {
  if (!fechaInicio && !fechaFin) {
    return undefined;
  }

  return {
    ...(fechaInicio ? { gte: toStartOfDay(fechaInicio) } : {}),
    ...(fechaFin ? { lte: toStartOfDay(fechaFin) } : {}),
  };
}

export function sumByKey<T>(rows: T[], selector: (row: T) => number): number {
  return round2(rows.reduce((sum, row) => sum + selector(row), 0));
}

export type GroupedRows<T> = {
  key: string;
  label: string;
  rows: T[];
};

export function groupRowsBy<T>(rows: T[], selector: (row: T) => { key: string; label: string }): GroupedRows<T>[] {
  const groups = new Map<string, GroupedRows<T>>();

  for (const row of rows) {
    const { key, label } = selector(row);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(key, { key, label, rows: [row] });
  }

  return Array.from(groups.values());
}

export function limitRows<T>(rows: T[]): { rows: T[]; truncado: boolean } {
  if (rows.length <= MAX_REPORT_ROWS) {
    return { rows, truncado: false };
  }

  return { rows: rows.slice(0, MAX_REPORT_ROWS), truncado: true };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export type PeriodGranularity = 'dia' | 'semana' | 'mes';

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function isoWeek(date: Date): { year: number; week: number } {
  // Se usan los getters UTC (no locales) para que el día considerado coincida
  // siempre con el que se muestra en el resto del reporte (ver nota en `periodKey`).
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const week = 1 + Math.round((firstThursday - target.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { year: new Date(firstThursday).getUTCFullYear(), week };
}

// Todas las fechas de negocio se interpretan por su día-calendario en UTC (ver
// `toStartOfDay`/`toExclusiveEndOfDay`: se guardan como medianoche sin offset). Usar
// getters/format locales aquí causaría que el grupo (ej. "03/10/2026") no coincida con
// las filas que contiene cuando el proceso corre en un huso horario negativo.
export function periodKey(date: Date, granularity: PeriodGranularity): { key: string; label: string } {
  if (granularity === 'dia') {
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }),
    };
  }

  if (granularity === 'semana') {
    const { year, week } = isoWeek(date);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    return { key, label: `Semana ${week} de ${year}` };
  }

  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return { key, label: `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}` };
}

export { MAX_REPORT_ROWS };
