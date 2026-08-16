import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderDto } from "@/types/providers";
import type { ProductDto } from "@/types/products";

export type ProductFormValues = {
  nombre: string;
  categoria: ProductDto["categoria"];
  idProveedor: string;
  costoPromedio: string;
  precioVenta: string;
  rutaImagen: string;
};

type ProductFormCardProps = {
  title: string;
  form: ProductFormValues;
  providers: ProviderDto[];
  saving: boolean;
  uploadingImage: boolean;
  onChange: (next: ProductFormValues) => void;
  onUploadImage: (file: File) => Promise<void>;
  onCancel: () => void;
  onSubmit: () => void;
};

const CATEGORY_OPTIONS: ProductDto["categoria"][] = [
  "PRODUCTO_TERMINADO",
  "MATERIA_PRIMA",
  "INSUMO",
];

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

export function ProductFormCard({
  title,
  form,
  providers,
  saving,
  uploadingImage,
  onChange,
  onUploadImage,
  onCancel,
  onSubmit,
}: ProductFormCardProps) {
  const isFinishedProduct = form.categoria === "PRODUCTO_TERMINADO";

  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Nombre del producto</Label>
            <Input
              id="product-name"
              value={form.nombre}
              onChange={(event) => onChange({ ...form, nombre: event.target.value })}
              placeholder="Ej. Garrafon 18L"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-category">Categoria</Label>
            <select
              id="product-category"
              value={form.categoria}
              onChange={(event) =>
                onChange({
                  ...form,
                  categoria: event.target.value as ProductDto["categoria"],
                  precioVenta:
                    event.target.value === "PRODUCTO_TERMINADO" ? form.precioVenta : "",
                })
              }
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-provider">Proveedor</Label>
            <select
              id="product-provider"
              value={form.idProveedor}
              onChange={(event) => onChange({ ...form, idProveedor: event.target.value })}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Selecciona un proveedor</option>
              {providers.map((provider) => (
                <option key={provider.id} value={String(provider.id)}>
                  {provider.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-image">Ruta imagen</Label>
            <Input
              id="product-image"
              value={form.rutaImagen}
              onChange={(event) => onChange({ ...form, rutaImagen: event.target.value })}
              placeholder="/uploads/products/imagen.jpg"
              className="bg-background"
            />
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await onUploadImage(file);
                  event.target.value = "";
                }}
                className="bg-background"
                disabled={uploadingImage || saving}
              />
              <p className="text-xs text-muted-foreground">
                Formatos: JPG, PNG, WEBP. Tamaño máximo: 5MB.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-cost">Costo promedio</Label>
            <Input
              id="product-cost"
              type="number"
              min={0}
              step="0.01"
              value={form.costoPromedio}
              onChange={(event) => onChange({ ...form, costoPromedio: event.target.value })}
              placeholder="0.00"
              className="bg-background"
            />
          </div>

          {isFinishedProduct ? (
            <div className="space-y-1.5">
              <Label htmlFor="product-price">Precio venta</Label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                value={form.precioVenta}
                onChange={(event) => onChange({ ...form, precioVenta: event.target.value })}
                placeholder="0.00"
                className="bg-background"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Precio venta</Label>
              <div className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                Solo aplica para PRODUCTO_TERMINADO.
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            {form.rutaImagen.trim() ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Vista previa de imagen</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImagePreviewUrl(form.rutaImagen)}
                  alt="Vista previa del producto"
                  className="h-32 w-32 rounded-lg border border-border object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving}
            className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
