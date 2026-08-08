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
  esProductoFinal: boolean;
  rutaImagen: string;
};

type ProductFormCardProps = {
  title: string;
  form: ProductFormValues;
  providers: ProviderDto[];
  saving: boolean;
  onChange: (next: ProductFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

const CATEGORY_OPTIONS: ProductDto["categoria"][] = [
  "PRODUCTO_TERMINADO",
  "MATERIA_PRIMA",
  "INSUMO",
  "ENVASE",
];

export function ProductFormCard({
  title,
  form,
  providers,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: ProductFormCardProps) {
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
            <Label htmlFor="product-image">Ruta imagen (opcional)</Label>
            <Input
              id="product-image"
              value={form.rutaImagen}
              onChange={(event) => onChange({ ...form, rutaImagen: event.target.value })}
              placeholder="/images/productos/garrafon.png"
              className="bg-background"
            />
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

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.esProductoFinal}
              onChange={(event) =>
                onChange({ ...form, esProductoFinal: event.target.checked })
              }
              className="size-4 rounded border-border"
            />
            Es producto final
          </label>
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
