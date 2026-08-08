"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [error, setError] = useState("");

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
    <Card>
      <CardHeader>
        <CardTitle>Agregar Componente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="idMateriaPrima">Materia Prima / Componente</Label>
            <Select
              value={idMateriaPrima?.toString() ?? ""}
              onValueChange={(value) => setIdMateriaPrima(Number(value))}
              disabled={isLoading || availableProducts.length === 0}
            >
              <SelectTrigger id="idMateriaPrima">
                <SelectValue placeholder="Seleccione un componente" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.nombre} - {product.categoria} (Stock: {product.existencia})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableProducts.length === 0 && (
            <p className="text-sm text-amber-700">
              No hay componentes disponibles para agregar. Verifique que existan productos activos
              con categoría INSUMO, ENVASE o MATERIA_PRIMA y que no estén ya en esta estructura.
            </p>
          )}

          <div>
            <Label htmlFor="cantidadRequerida">Cantidad Requerida</Label>
            <Input
              id="cantidadRequerida"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ej: 2.5"
              value={cantidadRequerida}
              onChange={(e) => setCantidadRequerida(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || availableProducts.length === 0}>
              {isLoading ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
