"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function RolesPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Roles y Permisos"
        description="Configura acceso por perfil y politicas operativas por modulo."
      >
        <ModulePlaceholder moduleName="Submodulo Permisos" />
      </DashboardShell>
    </RequireAuth>
  );
}
