import { ImagePlus, Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProviderFormValues = {
  nombreCompleto: string;
  correoElectronico: string;
  telefono1: string;
  rutaImagen: string;
  nit: string;
  dpi: string;
};

type ProviderFormCardProps = {
  title: string;
  form: ProviderFormValues;
  saving: boolean;
  uploadingImage: boolean;
  onChange: (next: ProviderFormValues) => void;
  onUploadImage: (file: File) => Promise<void>;
  onCancel: () => void;
  onSubmit: () => void;
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

export function ProviderFormCard({
  title,
  form,
  saving,
  uploadingImage,
  onChange,
  onUploadImage,
  onCancel,
  onSubmit,
}: ProviderFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/40 p-4">
            <p className="mb-3 text-sm font-semibold text-sky-800">Informacion comercial</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="provider-fullname">Nombre proveedor</Label>
                <Input
                  id="provider-fullname"
                  value={form.nombreCompleto}
                  onChange={(event) => onChange({ ...form, nombreCompleto: event.target.value })}
                  placeholder="Nombre completo de proveedor"
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="provider-email">Correo electronico</Label>
                <Input
                  id="provider-email"
                  value={form.correoElectronico}
                  onChange={(event) => onChange({ ...form, correoElectronico: event.target.value })}
                  placeholder="contacto@proveedor.com"
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provider-phone">Telefono</Label>
                <Input
                  id="provider-phone"
                  value={form.telefono1}
                  onChange={(event) => onChange({ ...form, telefono1: event.target.value })}
                  placeholder="5555-5555"
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provider-nit">NIT</Label>
                <Input
                  id="provider-nit"
                  value={form.nit}
                  onChange={(event) => onChange({ ...form, nit: event.target.value })}
                  placeholder="NIT"
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="provider-dpi">DPI</Label>
                <Input
                  id="provider-dpi"
                  value={form.dpi}
                  onChange={(event) => onChange({ ...form, dpi: event.target.value })}
                  placeholder="CUI"
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Imagen del proveedor</Label>
                <div className="flex flex-col gap-3 rounded-lg border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-background">
                      {form.rutaImagen.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveImagePreviewUrl(form.rutaImagen)}
                          alt="Vista previa proveedor"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {form.rutaImagen.trim() ? "Imagen cargada" : "Sin imagen"}
                      </p>
                      <p className="text-xs text-muted-foreground">JPG, PNG o WEBP. Maximo 5MB.</p>
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="provider-image-upload"
                      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/60"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : form.rutaImagen.trim() ? (
                        <RefreshCcw className="h-4 w-4" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      {form.rutaImagen.trim() ? "Reemplazar imagen" : "Agregar imagen"}
                    </Label>
                    <Input
                      id="provider-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={saving || uploadingImage}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        await onUploadImage(file);
                        event.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="hover:bg-muted/50 transition-colors">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
