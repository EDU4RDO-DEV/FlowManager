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
import { listEmployees } from "@/services/employees.service";
import { createUser, listRoles } from "@/services/users.service";
import type { EmployeeDto } from "@/types/employees";
import type { RoleDto } from "@/types/users";

const EMPTY_FORM: UserFormValues = {
  nombre: "",
  correo: "",
  clave: "",
  idRol: "",
  idEmpleadoVinculado: "",
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
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [rolesData, employeesData] = await Promise.all([listRoles(), listEmployees()]);
        setRoles(rolesData);
        setEmployees(employeesData);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudieron cargar los catalogos del formulario."));
      }
    }

    void loadCatalogs();
  }, []);

  useEffect(() => {
    if (!form.idEmpleadoVinculado) return;
    const linkedEmployeeId = Number(form.idEmpleadoVinculado);
    if (!Number.isInteger(linkedEmployeeId) || linkedEmployeeId <= 0) return;

    const linkedEmployee = employees.find((item) => item.id === linkedEmployeeId);
    if (!linkedEmployee) return;

    setForm((prev) => ({
      ...prev,
      nombre: linkedEmployee.entidad.nombreCompleto,
      entidadSexo: linkedEmployee.entidad.sexo ?? "",
      entidadFechaNacimiento: linkedEmployee.entidad.fechaNacimiento?.slice(0, 10) ?? "",
      entidadTelefono1: linkedEmployee.entidad.telefono1 ?? "",
      entidadTelefono2: linkedEmployee.entidad.telefono2 ?? "",
      entidadCorreoElectronico: linkedEmployee.entidad.correoElectronico ?? "",
      entidadNit: linkedEmployee.entidad.nit ?? "",
      entidadDpi: linkedEmployee.entidad.dpi ?? "",
    }));
  }, [form.idEmpleadoVinculado, employees]);

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
      const selectedLinkedEmployeeId = form.idEmpleadoVinculado
        ? Number(form.idEmpleadoVinculado)
        : undefined;
      await createUser({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        clave: form.clave,
        ...(selectedRoleId ? { idRol: selectedRoleId } : {}),
        ...(selectedLinkedEmployeeId
          ? { idEmpleadoVinculado: selectedLinkedEmployeeId }
          : {}),
        entidad: {
          nombreCompleto: form.nombre.trim(),
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
            employees={employees}
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
