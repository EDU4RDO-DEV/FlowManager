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
import { createEmployee, uploadEmployeeImage } from "@/services/employees.service";
import { listAvailableUsers } from "@/services/users.service";
import type { UserDto } from "@/types/users";

const EMPTY_FORM: EmployeeFormValues = {
  idUsuarioVinculado: "",
  nombreCompleto: "",
  sexo: "",
  fechaNacimiento: "",
  correoElectronico: "",
  telefono1: "",
  telefono2: "",
  rutaImagen: "",
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(EMPTY_FORM);
  const [users, setUsers] = useState<UserDto[]>([]);

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    try {
      const uploaded = await uploadEmployeeImage(file);
      setForm((prev) => ({ ...prev, rutaImagen: uploaded.rutaImagen }));
      toast.success("Imagen subida correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la imagen."));
    } finally {
      setUploadingImage(false);
    }
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        const usersData = await listAvailableUsers();
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
      sexo: linkedUser.entidad?.sexo ?? "",
      fechaNacimiento: linkedUser.entidad?.fechaNacimiento?.slice(0, 10) ?? "",
      correoElectronico: linkedUser.entidad?.correoElectronico ?? linkedUser.correo,
      telefono1: linkedUser.entidad?.telefono1 ?? "",
      telefono2: linkedUser.entidad?.telefono2 ?? "",
      rutaImagen: linkedUser.entidad?.rutaImagen ?? prev.rutaImagen,
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
          sexo: form.sexo.trim() || undefined,
          fechaNacimiento: form.fechaNacimiento.trim() || undefined,
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          telefono2: form.telefono2.trim() || undefined,
          rutaImagen: form.rutaImagen.trim() || undefined,
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
            uploadingImage={uploadingImage}
            onChange={setForm}
            onUploadImage={handleUploadImage}
            onCancel={() => router.push("/employees")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
