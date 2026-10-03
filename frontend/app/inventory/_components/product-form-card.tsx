import { useMemo, useState } from "react";
import { ImagePlus, Loader2, RefreshCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  "ENVASE",
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
  const [providersOpen, setProvidersOpen] = useState(false);

  const selectedProvider = useMemo(
    () => providers.find((provider) => String(provider.id) === form.idProveedor),
    [providers, form.idProveedor],
  );

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
            <Popover open={providersOpen} onOpenChange={setProvidersOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="product-provider"
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-between bg-background px-3 font-normal"
                >
                  <span className="truncate text-left">
                    {selectedProvider?.nombre ?? "Selecciona un proveedor"}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar proveedor..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron proveedores</CommandEmpty>
                    <CommandGroup>
                      {providers.map((provider) => {
                        const comercial = provider.nombre.trim();
                        const entidad = provider.entidad.nombreCompleto.trim();
                        const showEntidad = comercial.toLowerCase() !== entidad.toLowerCase();

                        return (
                          <CommandItem
                            key={provider.id}
                            value={showEntidad ? `${comercial} ${entidad}` : comercial}
                            onSelect={() => {
                              onChange({ ...form, idProveedor: String(provider.id) });
                              setProvidersOpen(false);
                            }}
                          >
                            <div className="flex w-full flex-col">
                              <span>{provider.nombre}</span>
                              {showEntidad ? (
                                <span className="text-xs text-muted-foreground">{provider.entidad.nombreCompleto}</span>
                              ) : null}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Imagen del producto</Label>
            <div className="flex flex-col gap-3 rounded-lg border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-background">
                  {form.rutaImagen.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImagePreviewUrl(form.rutaImagen)}
                      alt="Vista previa del producto"
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
                  htmlFor="product-image-upload"
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
                  id="product-image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingImage || saving}
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
