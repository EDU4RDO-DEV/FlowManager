"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  EmployeeFormCard,
  type EmployeeFormValues,
} from "@/app/employees/_components/employee-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { getEmployeeById, updateEmployee } from "@/services/employees.service";
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

function toInputDate(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EmployeeFormValues>(EMPTY_FORM);
  const [users, setUsers] = useState<UserDto[]>([]);

  useEffect(() => {
    async function loadData() {
      const employeeId = Number(params.id);
      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        toast.error("ID de empleado invalido.");
        router.push("/employees");
        return;
      }

      setLoading(true);
      try {
        const [employeeData, usersData] = await Promise.all([
          getEmployeeById(employeeId),
          listUsers(),
        ]);
        setUsers(usersData);
        const linkedUser = usersData.find(
          (candidateUser) => candidateUser.idEntidad === employeeData.idEntidad,
        );
        setForm({
          idUsuarioVinculado: linkedUser ? String(linkedUser.id) : "",
          nombreCompleto: employeeData.entidad.nombreCompleto,
          correoElectronico: employeeData.entidad.correoElectronico ?? "",
          telefono1: employeeData.entidad.telefono1 ?? "",
          nit: employeeData.entidad.nit ?? "",
          dpi: employeeData.entidad.dpi ?? "",
          puestoTrabajo: employeeData.puestoTrabajo,
          descripcionPuesto: employeeData.descripcionPuesto ?? "",
          fechaContratacion: toInputDate(employeeData.fechaContratacion),
          fechaSalida: toInputDate(employeeData.fechaSalida),
          sueldoBase: String(employeeData.sueldoBase ?? ""),
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el empleado."));
        router.push("/employees");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

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
    const employeeId = Number(params.id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      toast.error("ID de empleado invalido.");
      return;
    }

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
      const linkedUserId = form.idUsuarioVinculado ? Number(form.idUsuarioVinculado) : null;
      await updateEmployee(employeeId, {
        idUsuarioModificador: user.id,
        idUsuarioVinculado: linkedUserId,
        puestoTrabajo: form.puestoTrabajo.trim(),
        descripcionPuesto: form.descripcionPuesto.trim() || null,
        fechaContratacion: form.fechaContratacion,
        fechaSalida: form.fechaSalida || null,
        sueldoBase,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          nit: form.nit.trim() || undefined,
          dpi: form.dpi.trim() || undefined,
        },
      });

      toast.success("Empleado actualizado correctamente.");
      router.push("/employees");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el empleado."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Editar Empleado"
        description="Submodulo para actualizar informacion laboral y de contacto."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del empleado...
            </p>
          ) : (
            <EmployeeFormCard
              title={`Editar empleado #${params.id}`}
              users={users}
              form={form}
              saving={saving}
              onChange={setForm}
              onCancel={() => router.push("/employees")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
