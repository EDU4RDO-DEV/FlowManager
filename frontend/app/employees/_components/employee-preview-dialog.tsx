"use client";

import { EntityPreviewDialog } from "@/components/entity-preview-dialog";
import type { EmployeeDto } from "@/types/employees";

type EmployeePreviewDialogProps = {
  employee: EmployeeDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2,
  }).format(value);
}

export function EmployeePreviewDialog({ employee, open, onOpenChange }: EmployeePreviewDialogProps) {
  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={employee?.entidad.nombreCompleto ?? "Empleado"}
      subtitle={employee ? `#${employee.id}` : undefined}
      imagePath={employee?.entidad.rutaImagen ?? null}
      fields={
        employee
          ? [
              { label: "Puesto", value: employee.puestoTrabajo },
              { label: "Sueldo", value: formatCurrency(employee.sueldoBase) },
              { label: "Correo", value: employee.entidad.correoElectronico?.trim() || "-" },
              { label: "Telefono", value: employee.entidad.telefono1?.trim() || "-" },
              { label: "Contratacion", value: formatDate(employee.fechaContratacion) },
              { label: "NIT", value: employee.entidad.nit?.trim() || "-" },
            ]
          : []
      }
    />
  );
}
