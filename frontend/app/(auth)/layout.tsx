import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[oklch(0.34_0.11_247)] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(65% 55% at -10% 100%, color-mix(in oklch, var(--chart-2) 36%, transparent), transparent 62%), radial-gradient(75% 60% at 110% -20%, color-mix(in oklch, white 16%, transparent), transparent 68%)",
        }}
      />

      <div className="absolute right-4 top-4 z-30">
        <ThemeToggle />
      </div>

      <main className="relative mx-auto flex min-h-svh w-full items-center justify-center px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
