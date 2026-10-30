"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  UserFormCard,
  type UserFormValues,
} from "@/app/users/_components/user-form-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { listAvailableEmployees } from "@/services/employees.service";
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
  entidadRutaImagen: "",
  entidadNit: "",
  entidadDpi: "",
};

function emptyToUndefined(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export default function CreateUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [rolesData, employeesData] = await Promise.all([
          listRoles(),
          listAvailableEmployees(),
        ]);
        setRoles(rolesData);
        setEmployees(employeesData);

        // Permite llegar desde el módulo de Empleados con el vínculo preseleccionado
        // (p. ej. "Vincular usuario" de un empleado de ruta sin cuenta aún).
        const preselected = searchParams.get("idEmpleadoVinculado");
        if (preselected && employeesData.some((employee) => String(employee.id) === preselected)) {
          setForm((prev) => ({ ...prev, idEmpleadoVinculado: preselected }));
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudieron cargar los catalogos del formulario."));
      }
    }

    void loadCatalogs();
  }, [searchParams]);

  async function handleSubmit() {
    if (!form.nombre.trim() || !form.correo.trim()) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }

    if (!form.clave || form.clave.length < 8 || form.clave.length > 128) {
      toast.error("La clave debe tener entre 8 y 128 caracteres.");
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
        ...(!selectedLinkedEmployeeId
          ? {
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
            }
          : {}),
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
