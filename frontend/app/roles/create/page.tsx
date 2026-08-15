"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  RoleFormCard,
  type RoleFormValues,
} from "@/app/roles/_components/role-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { createRole } from "@/services/roles.service";

const EMPTY_FORM: RoleFormValues = {
  nombre: "",
  descripcion: "",
};

export default function CreateRolePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RoleFormValues>(EMPTY_FORM);

  async function handleSubmit() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombre.trim()) {
      toast.error("El nombre del rol es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await createRole({
        idUsuario: user.id,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
      });

      toast.success("Rol creado correctamente.");
      router.push("/roles");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el rol."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="roles" action="create">
      <DashboardShell
        title="Crear Rol"
        description="Submodulo para crear roles y permisos del sistema."
      >
        <div className="w-full">
          <RoleFormCard
            title="Nuevo rol"
            form={form}
            saving={saving}
            onChange={setForm}
            onCancel={() => router.push("/roles")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
