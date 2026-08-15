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
  entidadNombreCompleto: "",
  entidadSexo: "",
  entidadFechaNacimiento: "",
  entidadTelefono1: "",
  entidadTelefono2: "",
  entidadCorreoElectronico: "",
  entidadNit: "",
  entidadDpi: "",
};

function emptyToUndefined(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

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
        entidad: {
          nombreCompleto: emptyToUndefined(form.entidadNombreCompleto),
          sexo: emptyToUndefined(form.entidadSexo),
          fechaNacimiento: emptyToUndefined(form.entidadFechaNacimiento),
          telefono1: emptyToUndefined(form.entidadTelefono1),
          telefono2: emptyToUndefined(form.entidadTelefono2),
          correoElectronico: emptyToUndefined(form.entidadCorreoElectronico),
          nit: emptyToUndefined(form.entidadNit),
          dpi: emptyToUndefined(form.entidadDpi),
        },
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
    <RequireAuth moduleKey="usuarios" action="create">
      <DashboardShell
        title="Crear Usuario"
        description="Submodulo corporativo para alta de usuarios en Industrias Basan."
      >
        <div className="w-full">
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
