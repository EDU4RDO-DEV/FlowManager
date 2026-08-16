"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PreviewField = {
  label: string;
  value: string;
};

type EntityPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  imagePath?: string | null;
  fields: PreviewField[];
};

function resolveImagePreviewUrl(rutaImagen: string): string {
  if (!rutaImagen) {
    return "";
  }

  if (rutaImagen.startsWith("http://") || rutaImagen.startsWith("https://")) {
    return rutaImagen;
  }

  const configuredBase = process.env.NEXT_PUBLIC_API_URL;
  if (configuredBase) {
    return `${configuredBase}${rutaImagen}`;
  }

  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000${rutaImagen}`;
  }

  return rutaImagen;
}

export function EntityPreviewDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  imagePath,
  fields,
}: EntityPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[97vw] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-5 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="text-base sm:text-lg">Vista previa</DialogTitle>
          <DialogDescription>
            {title}
            {subtitle ? ` - ${subtitle}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            <div className="rounded-2xl border bg-muted/25 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imagen</p>
              <div className="flex items-center justify-center rounded-xl border bg-background p-3">
                {imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImagePreviewUrl(imagePath)}
                    alt={title}
                    className="h-56 w-full max-w-[240px] rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-56 w-full max-w-[240px] items-center justify-center rounded-lg border border-dashed bg-muted/30 text-xs text-muted-foreground">
                    Sin imagen
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-4 sm:p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalles</p>
              <div className="grid gap-3 md:grid-cols-1 2xl:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.label} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed break-words">{field.value || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
