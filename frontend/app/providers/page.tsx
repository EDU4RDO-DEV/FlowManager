"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function ProvidersPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Proveedores"
        description="Gestiona proveedores, contacto comercial y abastecimiento."
      >
        <ModulePlaceholder moduleName="Submodulo Proveedores" />
      </DashboardShell>
    </RequireAuth>
  );
}
