"use client";

import { EntityPreviewDialog } from "@/components/entity-preview-dialog";
import type { ProviderDto } from "@/types/providers";

type ProviderPreviewDialogProps = {
  provider: ProviderDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export function ProviderPreviewDialog({ provider, open, onOpenChange }: ProviderPreviewDialogProps) {
  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={provider?.entidad.nombreCompleto ?? "Proveedor"}
      subtitle={provider ? `#${provider.id}` : undefined}
      imagePath={provider?.entidad.rutaImagen ?? null}
      fields={
        provider
          ? [
              { label: "Telefono", value: provider.entidad.telefono1?.trim() || "-" },
              { label: "Correo", value: provider.entidad.correoElectronico?.trim() || "-" },
              { label: "NIT", value: provider.entidad.nit?.trim() || "-" },
              { label: "DPI", value: provider.entidad.dpi?.trim() || "-" },
              { label: "Registro", value: formatDate(provider.fechaRegistro) },
              { label: "Estado", value: provider.anulado ? "Anulado" : "Activo" },
            ]
          : []
      }
    />
  );
}
