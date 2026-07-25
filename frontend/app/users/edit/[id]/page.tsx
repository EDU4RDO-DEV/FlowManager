"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2, FilePenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  UserFormCard,
  type UserFormValues,
} from "@/app/users/_components/user-form-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { getApiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { getUserById, listRoles, updateUser } from "@/services/users.service";
import type { RoleDto } from "@/types/users";

const EMPTY_FORM: UserFormValues = {
  nombre: "",
  correo: "",
  clave: "",
  idRol: "",
};

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadData() {
      const userId = Number(params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        toast.error("ID de usuario invalido.");
        router.push("/users");
        return;
      }

      setLoading(true);
      try {
        const [rolesData, userData] = await Promise.all([listRoles(), getUserById(userId)]);
        setRoles(rolesData);
        setForm({
          nombre: userData.nombre,
          correo: userData.correo,
          clave: "",
          idRol: userData.idRol ? String(userData.idRol) : "",
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el usuario."));
        router.push("/users");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const userId = Number(params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error("ID de usuario invalido.");
      return;
    }

    if (!form.nombre.trim() || !form.correo.trim()) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const selectedRoleId = form.idRol ? Number(form.idRol) : null;
      await updateUser(userId, {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        idRol: selectedRoleId,
        ...(user?.id ? { idUsuarioModificador: user.id } : {}),
      });

      toast.success("Usuario actualizado correctamente.");
      router.push("/users");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el usuario."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Editar Usuario"
        description="Submodulo corporativo para ajustes y mantenimiento de perfiles Basan."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="p-4">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/50 p-2">
                  <FilePenLine className="size-4 text-sky-600" />
                </div>
                <p className="text-sm font-semibold tracking-tight">Edicion dirigida</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Modifica solo los campos necesarios y conserva trazabilidad.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-background p-2">
                  <ShieldCheck className="size-4 text-sky-600" />
                </div>
                Cada cambio actualiza políticas de acceso y rol de operación.
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/50 p-2">
                  <Building2 className="size-4 text-sky-600" />
                </div>
                Panel operativo alineado a estándares de Industrias Basan.
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {loading ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Cargando informacion del usuario...
              </p>
            ) : (
              <UserFormCard
                mode="edit"
                title={`Editar usuario #${params.id}`}
                roles={roles}
                form={form}
                saving={saving}
                onChange={setForm}
                onCancel={() => router.push("/users")}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
