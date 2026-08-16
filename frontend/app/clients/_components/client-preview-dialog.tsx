"use client";

import { EntityPreviewDialog } from "@/components/entity-preview-dialog";
import type { ClientDto } from "@/types/clients";

type ClientPreviewDialogProps = {
  client: ClientDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export function ClientPreviewDialog({ client, open, onOpenChange }: ClientPreviewDialogProps) {
  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={client?.entidad.nombreCompleto ?? "Cliente"}
      subtitle={client ? `#${client.id}` : undefined}
      imagePath={client?.entidad.rutaImagen ?? null}
      fields={
        client
          ? [
              { label: "Correo", value: client.entidad.correoElectronico?.trim() || "-" },
              { label: "Telefono", value: client.entidad.telefono1?.trim() || "-" },
              { label: "Telefono 2", value: client.entidad.telefono2?.trim() || "-" },
              { label: "NIT", value: client.entidad.nit?.trim() || "-" },
              { label: "DPI", value: client.entidad.dpi?.trim() || "-" },
              { label: "Registro", value: formatDate(client.fechaRegistro) },
            ]
          : []
      }
    />
  );
}
