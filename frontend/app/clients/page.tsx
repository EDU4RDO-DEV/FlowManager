"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function ClientsPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Clientes"
        description="Administra cartera de clientes, datos de contacto y seguimiento."
      >
        <ModulePlaceholder moduleName="Submodulo Clientes" />
      </DashboardShell>
    </RequireAuth>
  );
}
