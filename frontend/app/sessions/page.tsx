"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function SessionsPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Sesiones de Ruta y Caja"
        description="Controla apertura, cierre y trazabilidad de sesiones operativas."
      >
        <ModulePlaceholder moduleName="Submodulo Sesiones" />
      </DashboardShell>
    </RequireAuth>
  );
}
