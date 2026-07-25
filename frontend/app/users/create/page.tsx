"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  UserFormCard,
  type UserFormValues,
} from "@/app/users/_components/user-form-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
        description="Submodulo de alta de usuarios. Completa datos y confirma guardado."
      >
        <div className="mx-auto w-full max-w-2xl">
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
      </DashboardShell>
    </RequireAuth>
  );
}
