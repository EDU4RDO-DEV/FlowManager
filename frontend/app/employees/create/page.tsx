"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  EmployeeFormCard,
  type EmployeeFormValues,
} from "@/app/employees/_components/employee-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { createEmployee } from "@/services/employees.service";
import { listUsers } from "@/services/users.service";
import type { UserDto } from "@/types/users";

const EMPTY_FORM: EmployeeFormValues = {
  idUsuarioVinculado: "",
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  nit: "",
  dpi: "",
  puestoTrabajo: "",
  descripcionPuesto: "",
  fechaContratacion: "",
  fechaSalida: "",
  sueldoBase: "",
};

export default function CreateEmployeePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(EMPTY_FORM);
  const [users, setUsers] = useState<UserDto[]>([]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const usersData = await listUsers();
        setUsers(usersData);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudieron cargar los usuarios."));
      }
    }

    void loadUsers();
  }, []);

  useEffect(() => {
    if (!form.idUsuarioVinculado) return;
    const linkedUserId = Number(form.idUsuarioVinculado);
    if (!Number.isInteger(linkedUserId) || linkedUserId <= 0) return;

    const linkedUser = users.find((item) => item.id === linkedUserId);
    if (!linkedUser) return;

    setForm((prev) => ({
      ...prev,
      nombreCompleto: linkedUser.entidad?.nombreCompleto ?? linkedUser.nombre,
      correoElectronico: linkedUser.entidad?.correoElectronico ?? linkedUser.correo,
      telefono1: linkedUser.entidad?.telefono1 ?? "",
      nit: linkedUser.entidad?.nit ?? "",
      dpi: linkedUser.entidad?.dpi ?? "",
    }));
  }, [form.idUsuarioVinculado, users]);

  async function handleSubmit() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombreCompleto.trim()) {
      toast.error("El nombre completo es obligatorio.");
      return;
    }

    if (!form.puestoTrabajo.trim()) {
      toast.error("El puesto de trabajo es obligatorio.");
      return;
    }

    if (!form.fechaContratacion) {
      toast.error("La fecha de contratacion es obligatoria.");
      return;
    }

    const sueldoBase = Number(form.sueldoBase);
    if (!Number.isFinite(sueldoBase) || sueldoBase < 0) {
      toast.error("El sueldo base debe ser un numero valido.");
      return;
    }

    setSaving(true);
    try {
      const linkedUserId = form.idUsuarioVinculado ? Number(form.idUsuarioVinculado) : undefined;
      await createEmployee({
        idUsuario: user.id,
        ...(linkedUserId ? { idUsuarioVinculado: linkedUserId } : {}),
        puestoTrabajo: form.puestoTrabajo.trim(),
        descripcionPuesto: form.descripcionPuesto.trim() || undefined,
        fechaContratacion: form.fechaContratacion,
        fechaSalida: form.fechaSalida || undefined,
        sueldoBase,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          nit: form.nit.trim() || undefined,
          dpi: form.dpi.trim() || undefined,
        },
      });

      toast.success("Empleado creado correctamente.");
      router.push("/employees");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el empleado."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Crear Empleado"
        description="Submodulo para registrar personal operativo y administrativo."
      >
        <div className="w-full">
          <EmployeeFormCard
            title="Nuevo empleado"
            users={users}
            form={form}
            saving={saving}
            onChange={setForm}
            onCancel={() => router.push("/employees")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
