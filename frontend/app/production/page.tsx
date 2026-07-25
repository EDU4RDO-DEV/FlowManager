"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function ProductionPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Produccion"
        description="Registro diario de produccion, lotes y trazabilidad de planta."
      >
        <ModulePlaceholder moduleName="Submodulo Produccion" />
      </DashboardShell>
    </RequireAuth>
  );
}
