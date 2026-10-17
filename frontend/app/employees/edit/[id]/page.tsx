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
import { listCommissionConfigs } from "@/services/commissions.service";
import { getEmployeeById, listWorkerTypes, updateEmployee, uploadEmployeeImage } from "@/services/employees.service";

const EMPTY_FORM: EmployeeFormValues = {
  idConfiguracionComision: "",
  idTipoTrabajador: "",
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
  fechaInicioVigenciaSueldo: "",
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(EMPTY_FORM);
  const [commissionConfigs, setCommissionConfigs] = useState<Array<{ id: number; nombre: string }>>([]);
  const [workerTypes, setWorkerTypes] = useState<Array<{ id: number; clave: string; nombre: string }>>([]);
  const [originalSalary, setOriginalSalary] = useState<number | null>(null);

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
    async function loadData() {
      const employeeId = Number(params.id);
      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        toast.error("ID de empleado invalido.");
        router.push("/employees");
        return;
      }

      setLoading(true);
      try {
        const [employeeData, configsData, workerTypesData] = await Promise.all([
          getEmployeeById(employeeId),
          listCommissionConfigs(),
          listWorkerTypes(),
        ]);

        setCommissionConfigs(configsData.map((item) => ({ id: item.id, nombre: item.nombre })));
        setWorkerTypes(workerTypesData);
        setOriginalSalary(employeeData.sueldoBase);
        setForm({
          idConfiguracionComision: employeeData.idConfiguracionComision
            ? String(employeeData.idConfiguracionComision)
            : "",
          idTipoTrabajador: employeeData.idTipoTrabajador
            ? String(employeeData.idTipoTrabajador)
            : "",
          nombreCompleto: employeeData.entidad.nombreCompleto,
          sexo: employeeData.entidad.sexo ?? "",
          fechaNacimiento: toInputDate(employeeData.entidad.fechaNacimiento),
          correoElectronico: employeeData.entidad.correoElectronico ?? "",
          telefono1: employeeData.entidad.telefono1 ?? "",
          telefono2: employeeData.entidad.telefono2 ?? "",
          rutaImagen: employeeData.entidad.rutaImagen ?? "",
          nit: employeeData.entidad.nit ?? "",
          dpi: employeeData.entidad.dpi ?? "",
          puestoTrabajo: employeeData.puestoTrabajo,
          descripcionPuesto: employeeData.descripcionPuesto ?? "",
          fechaContratacion: toInputDate(employeeData.fechaContratacion),
          fechaSalida: toInputDate(employeeData.fechaSalida),
          sueldoBase: String(employeeData.sueldoBase ?? ""),
          fechaInicioVigenciaSueldo: "",
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
    if (!form.idTipoTrabajador) {
      toast.error("El tipo de trabajador es obligatorio.");
      return;
    }

    const sueldoBase = Number(form.sueldoBase);
    if (!Number.isFinite(sueldoBase) || sueldoBase < 0) {
      toast.error("El sueldo base debe ser un numero valido.");
      return;
    }
    if (originalSalary !== null && sueldoBase !== originalSalary && !form.fechaInicioVigenciaSueldo) {
      toast.error("Indica desde cuándo entra en vigor el nuevo sueldo.");
      return;
    }

    setSaving(true);
    try {
      const commissionConfigId = form.idConfiguracionComision
        ? Number(form.idConfiguracionComision)
        : null;
      await updateEmployee(employeeId, {
        idUsuarioModificador: user.id,
        idConfiguracionComision: commissionConfigId,
        idTipoTrabajador: Number(form.idTipoTrabajador),
        puestoTrabajo: form.puestoTrabajo.trim(),
        descripcionPuesto: form.descripcionPuesto.trim() || null,
        fechaContratacion: form.fechaContratacion,
        fechaSalida: form.fechaSalida || null,
        sueldoBase,
        ...(sueldoBase !== originalSalary
          ? { fechaInicioVigenciaSueldo: form.fechaInicioVigenciaSueldo }
          : {}),
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
              commissionConfigs={commissionConfigs}
              workerTypes={workerTypes}
              form={form}
              saving={saving}
              uploadingImage={uploadingImage}
              onChange={setForm}
              onUploadImage={handleUploadImage}
              onCancel={() => router.push("/employees")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
