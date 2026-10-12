export function formatSatNameForDisplay(value: string): string {
  return value.replace(/,\s*/g, " ").replace(/\s+/g, " ").trim();
}
