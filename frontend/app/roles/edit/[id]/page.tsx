"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  RoleFormCard,
  type RoleFormValues,
} from "@/app/roles/_components/role-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { getRoleById, updateRole } from "@/services/roles.service";

const EMPTY_FORM: RoleFormValues = {
  nombre: "",
  descripcion: "",
};

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoleFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadData() {
      const roleId = Number(params.id);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        toast.error("ID de rol invalido.");
        router.push("/roles");
        return;
      }

      setLoading(true);
      try {
        const roleData = await getRoleById(roleId);
        setForm({
          nombre: roleData.nombre,
          descripcion: roleData.descripcion ?? "",
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el rol."));
        router.push("/roles");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const roleId = Number(params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      toast.error("ID de rol invalido.");
      return;
    }

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
      await updateRole(roleId, {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        idUsuarioModificador: user.id,
      });

      toast.success("Rol actualizado correctamente.");
      router.push("/roles");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el rol."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="roles" action="update">
      <DashboardShell
        title="Editar Rol"
        description="Submodulo para actualizar configuraciones de permisos."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del rol...
            </p>
          ) : (
            <RoleFormCard
              title={`Editar rol #${params.id}`}
              form={form}
              saving={saving}
              onChange={setForm}
              onCancel={() => router.push("/roles")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
