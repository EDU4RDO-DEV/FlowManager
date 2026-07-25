"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { RequireAuth } from "@/components/require-auth";

export default function UsersPage() {
  return (
    <RequireAuth>
      <DashboardShell
        title="Administracion de Usuarios"
        description="Gestiona usuarios, estado de cuenta y seguridad de acceso."
      >
        <ModulePlaceholder moduleName="Submodulo Usuarios" />
      </DashboardShell>
    </RequireAuth>
  );
}
