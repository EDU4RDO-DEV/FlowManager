"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDto } from "@/types/products";

type ProductStructureFormSubmitInput = {
  idMateriaPrima: number;
  cantidadRequerida: number;
};

interface ProductStructureFormProps {
  availableProducts: ProductDto[];
  onSubmit: (data: ProductStructureFormSubmitInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProductStructureForm({
  availableProducts,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductStructureFormProps) {
  const [idMateriaPrima, setIdMateriaPrima] = useState<number | null>(null);
  const [cantidadRequerida, setCantidadRequerida] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const selectedProduct =
    idMateriaPrima !== null
      ? availableProducts.find((product) => product.id === idMateriaPrima) ?? null
      : null;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = availableProducts.filter((product) => {
    if (!normalizedSearch) return true;

    return (
      product.nombre.toLowerCase().includes(normalizedSearch) ||
      product.categoria.toLowerCase().includes(normalizedSearch) ||
      String(product.id).includes(normalizedSearch)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!idMateriaPrima) {
      setError("Debe seleccionar una materia prima");
      return;
    }

    if (!cantidadRequerida || Number(cantidadRequerida) <= 0) {
      setError("Cantidad debe ser mayor a 0");
      return;
    }

    try {
      await onSubmit({
        idMateriaPrima,
        cantidadRequerida: Number(cantidadRequerida),
      });

      setIdMateriaPrima(null);
      setCantidadRequerida("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar componente");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-2">
          <Label htmlFor="search-component">Buscar componente</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-component"
              placeholder="Buscar por nombre, categoría o ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading || availableProducts.length === 0}
              className="h-10 pl-9"
            />
          </div>

          <div className="h-80 overflow-y-auto rounded-lg border border-border bg-background">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No hay resultados para la búsqueda actual.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredProducts.map((product) => {
                  const selected = product.id === idMateriaPrima;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setIdMateriaPrima(product.id)}
                      className={`w-full px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? "bg-sky-100/70 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200"
                          : "hover:bg-muted/50"
                      }`}
                      disabled={isLoading}
                    >
                      <p className="truncate text-sm font-medium">{product.nombre}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        #{product.id} · {product.categoria} · Stock: {product.existencia}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Solo se muestran componentes INSUMO o MATERIA_PRIMA.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
          <div>
            <p className="text-sm font-semibold">Componente seleccionado</p>
            {selectedProduct ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-medium">{selectedProduct.nombre}</p>
                <p className="text-muted-foreground">Categoría: {selectedProduct.categoria}</p>
                <p className="text-muted-foreground">Stock disponible: {selectedProduct.existencia}</p>
                <p className="text-muted-foreground">Costo promedio: Q{selectedProduct.costoPromedio.toFixed(2)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Seleccione un componente de la lista.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cantidadRequerida">Cantidad requerida</Label>
            <Input
              id="cantidadRequerida"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ej: 2.50"
              value={cantidadRequerida}
              onChange={(e) => setCantidadRequerida(e.target.value)}
              disabled={isLoading}
              className="h-10"
            />
          </div>

          <div className="rounded-md border border-border bg-background p-2.5 text-xs text-muted-foreground">
            Tip: usa cantidades con decimales para componentes por volumen o peso.
          </div>
        </div>
      </div>

      {availableProducts.length === 0 ? (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No hay componentes disponibles para agregar. Verifique que existan productos activos y que no estén ya en esta estructura.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || availableProducts.length === 0} className="w-full sm:w-auto">
          {isLoading ? "Guardando..." : "Agregar componente"}
        </Button>
      </div>
    </form>
  );
}
