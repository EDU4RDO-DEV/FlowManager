"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  UserFormCard,
  type UserFormValues,
} from "@/app/users/_components/user-form-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { createUser, listRoles } from "@/services/users.service";
import type { RoleDto } from "@/types/users";

const EMPTY_FORM: UserFormValues = {
  nombre: "",
  correo: "",
  clave: "",
  idRol: "",
};

export default function CreateUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadRoles() {
      try {
        const data = await listRoles();
        setRoles(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudieron cargar los roles."));
      }
    }

    void loadRoles();
  }, []);

  async function handleSubmit() {
    if (!form.nombre.trim() || !form.correo.trim()) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }

    if (!form.clave || form.clave.length < 8) {
      toast.error("La clave debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const selectedRoleId = form.idRol ? Number(form.idRol) : undefined;
      await createUser({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        clave: form.clave,
        ...(selectedRoleId ? { idRol: selectedRoleId } : {}),
      });

      toast.success("Usuario creado correctamente.");
      router.push("/users");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el usuario."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Crear Usuario"
        description="Submodulo corporativo para alta de usuarios en Industrias Basan."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="p-4">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/50 p-2">
                  <UserPlus className="size-4 text-sky-600" />
                </div>
                <p className="text-sm font-semibold tracking-tight">Alta controlada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra usuarios siguiendo lineamientos de acceso interno Basan.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-background p-2">
                  <ShieldCheck className="size-4 text-sky-600" />
                </div>
                Rol y clave se aplican al crear para minimizar retrabajo operativo.
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/50 p-2">
                  <Building2 className="size-4 text-sky-600" />
                </div>
                Estandar visual Enterprise alineado con la identidad Basan.
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <UserFormCard
              mode="create"
              title="Nuevo usuario"
              roles={roles}
              form={form}
              saving={saving}
              onChange={setForm}
              onCancel={() => router.push("/users")}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
