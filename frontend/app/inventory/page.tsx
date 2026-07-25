"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function InventoryPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Inventario"
        description="Administra entradas, salidas, ajustes y control de existencias."
      >
        <ModulePlaceholder moduleName="Submodulo Inventario" />
      </DashboardShell>
    </RequireAuth>
  );
}
