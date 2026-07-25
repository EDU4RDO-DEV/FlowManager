"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function HomePage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Resumen Operativo"
        description="Panel principal de control para la operacion diaria de la planta."
      >
        <ModulePlaceholder moduleName="Vista General" />
      </DashboardShell>
    </RequireAuth>
  );
}
