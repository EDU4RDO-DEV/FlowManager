"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  UserFormCard,
  type UserFormValues,
} from "@/app/users/_components/user-form-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { getApiErrorMessage } from "@/lib/api";
import { listAvailableEmployees } from "@/services/employees.service";
import { getUserById, listRoles, updateUser } from "@/services/users.service";
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

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
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
        const [rolesData, employeesData, userData] = await Promise.all([
          listRoles(),
          listAvailableEmployees(userId),
          getUserById(userId),
        ]);
        setRoles(rolesData);
        setEmployees(employeesData);
        const linkedEmployee = employeesData.find(
          (employee) => employee.idEntidad === userData.idEntidad,
        );
        setForm({
          nombre: userData.nombre,
          correo: userData.correo,
          clave: "",
          idRol: userData.idRol ? String(userData.idRol) : "",
          idEmpleadoVinculado: linkedEmployee ? String(linkedEmployee.id) : "",
          entidadSexo: userData.entidad?.sexo ?? "",
          entidadFechaNacimiento: userData.entidad?.fechaNacimiento?.slice(0, 10) ?? "",
          entidadTelefono1: userData.entidad?.telefono1 ?? "",
          entidadTelefono2: userData.entidad?.telefono2 ?? "",
          entidadCorreoElectronico: userData.entidad?.correoElectronico ?? "",
          entidadRutaImagen: userData.entidad?.rutaImagen ?? "",
          entidadNit: userData.entidad?.nit ?? "",
          entidadDpi: userData.entidad?.dpi ?? "",
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
      entidadRutaImagen: linkedEmployee.entidad.rutaImagen ?? "",
      entidadNit: linkedEmployee.entidad.nit ?? "",
      entidadDpi: linkedEmployee.entidad.dpi ?? "",
    }));
  }, [form.idEmpleadoVinculado, employees]);

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
      const selectedLinkedEmployeeId = form.idEmpleadoVinculado
        ? Number(form.idEmpleadoVinculado)
        : null;
      await updateUser(userId, {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        idRol: selectedRoleId,
        idEmpleadoVinculado: selectedLinkedEmployeeId,
        ...(user?.id ? { idUsuarioModificador: user.id } : {}),
        entidad: {
          nombreCompleto: form.nombre.trim(),
          sexo: form.entidadSexo.trim() || undefined,
          fechaNacimiento: form.entidadFechaNacimiento.trim() || undefined,
          telefono1: form.entidadTelefono1.trim() || undefined,
          telefono2: form.entidadTelefono2.trim() || undefined,
          correoElectronico: form.entidadCorreoElectronico.trim() || undefined,
          rutaImagen: form.entidadRutaImagen.trim() || undefined,
          nit: form.entidadNit.trim() || undefined,
          dpi: form.entidadDpi.trim() || undefined,
        },
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
    <RequireAuth moduleKey="usuarios" action="update">
      <DashboardShell
        title="Editar Usuario"
        description="Submodulo corporativo para ajustes y mantenimiento de perfiles Basan."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del usuario...
            </p>
          ) : (
            <UserFormCard
              mode="edit"
              title={`Editar usuario #${params.id}`}
              roles={roles}
              employees={employees}
              form={form}
              saving={saving}
              onChange={setForm}
              onCancel={() => router.push("/users")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
