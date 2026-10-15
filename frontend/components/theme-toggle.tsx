"use client";

import { MonitorCog, MoonStar, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";

const ORDER: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];

function getThemeLabel(theme: string | undefined): string {
  if (theme === "dark") return "Oscuro";
  if (theme === "light") return "Claro";
  return "Sistema";
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === "dark") return <MoonStar className="size-4" />;
  if (theme === "light") return <Sun className="size-4" />;
  return <MonitorCog className="size-4" />;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const current = theme ?? "system";
  const currentIndex = ORDER.indexOf(current as "light" | "dark" | "system");
  const next = ORDER[(currentIndex + 1) % ORDER.length];
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon-sm" : "sm"}
      onClick={() => setTheme(next)}
      className="hover:bg-muted/50 transition-colors"
      aria-label={`Cambiar tema. Actual: ${getThemeLabel(current)}. Siguiente: ${getThemeLabel(next)}.`}
      title={`Tema ${getThemeLabel(current)}${current === "system" ? ` (${resolvedTheme === "dark" ? "oscuro" : "claro"} por sistema)` : ""}`}
    >
      <ThemeIcon theme={current} />
      {!compact ? <span>{getThemeLabel(current)}</span> : null}
    </Button>
  );
}
