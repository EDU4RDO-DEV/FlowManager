export type ReportsAccentKey = "blue" | "slate" | "emerald" | "indigo";

export const DEFAULT_REPORTS_ACCENT: ReportsAccentKey = "blue";

export const REPORTS_ACCENT_OPTIONS: Array<{ key: ReportsAccentKey; label: string }> = [
  { key: "blue", label: "Azul corporativo" },
  { key: "slate", label: "Gris ejecutivo" },
  { key: "emerald", label: "Verde profesional" },
  { key: "indigo", label: "Índigo sobrio" },
];

export function isReportsAccentKey(value: string): value is ReportsAccentKey {
  return REPORTS_ACCENT_OPTIONS.some((option) => option.key === value);
}

export function reportsAccentStorageKey(userId?: number | null): string {
  return `flowmanager:reports:accent:${userId ?? "anon"}`;
}

export function reportsAccentVariables(accent: ReportsAccentKey): Record<string, string> {
  if (accent === "slate") {
    return {
      "--reports-accent": "#334155",
      "--reports-accent-strong": "#1e293b",
      "--reports-accent-soft": "#e2e8f0",
      "--reports-accent-muted": "#f8fafc",
      "--reports-accent-text": "#0f172a",
      "--reports-accent-ring": "rgba(51, 65, 85, 0.28)",
      "--reports-kpi-bg": "#f8fafc",
      "--reports-table-head": "#1f2937",
    };
  }

  if (accent === "emerald") {
    return {
      "--reports-accent": "#0f766e",
      "--reports-accent-strong": "#115e59",
      "--reports-accent-soft": "#ccfbf1",
      "--reports-accent-muted": "#f0fdfa",
      "--reports-accent-text": "#134e4a",
      "--reports-accent-ring": "rgba(15, 118, 110, 0.26)",
      "--reports-kpi-bg": "#f0fdfa",
      "--reports-table-head": "#134e4a",
    };
  }

  if (accent === "indigo") {
    return {
      "--reports-accent": "#4f46e5",
      "--reports-accent-strong": "#4338ca",
      "--reports-accent-soft": "#e0e7ff",
      "--reports-accent-muted": "#eef2ff",
      "--reports-accent-text": "#312e81",
      "--reports-accent-ring": "rgba(79, 70, 229, 0.25)",
      "--reports-kpi-bg": "#eef2ff",
      "--reports-table-head": "#3730a3",
    };
  }

  return {
    "--reports-accent": "#1d4ed8",
    "--reports-accent-strong": "#1e40af",
    "--reports-accent-soft": "#dbeafe",
    "--reports-accent-muted": "#f8fbff",
    "--reports-accent-text": "#1e3a8a",
    "--reports-accent-ring": "rgba(29, 78, 216, 0.25)",
    "--reports-kpi-bg": "#f0f7ff",
    "--reports-table-head": "#1e3a8a",
  };
}
