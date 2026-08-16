"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api";
import { createAdjustment } from "@/services/adjustments.service";
import { listProducts } from "@/services/products.service";
import type { ProductDto } from "@/types/products";

export default function CreateAdjustmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductDto | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true);
      try {
        const firstPage = await listProducts({ anulado: false, page: 1, limit: 100 });

        if (firstPage.pagination.totalPages <= 1) {
          setProducts(firstPage.items);
          return;
        }

        const restPages = await Promise.all(
          Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, idx) =>
            listProducts({ anulado: false, page: idx + 2, limit: 100 }),
          ),
        );

        setProducts([
          ...firstPage.items,
          ...restPages.flatMap((pageResult) => pageResult.items),
        ]);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar los productos"));
      } finally {
        setLoadingProducts(false);
      }
    }

    void loadProducts();
  }, []);

  const cantidadNum = parseFloat(cantidad) || 0;
  const stockActual = selectedProduct?.existencia ?? 0;
  const nuevoStock = tipoAjuste === "ENTRADA" ? stockActual + cantidadNum : stockActual - cantidadNum;
  const isStockNegative = nuevoStock < 0;
  const isFormValid = selectedProduct && cantidadNum > 0 && observacion.trim().length >= 10 && !isStockNegative;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedProduct || !isFormValid) return;

    setIsSubmitting(true);
    try {
      await createAdjustment({
        idUsuario: user.id,
        idInventarioItem: selectedProduct.id,
        tipoAjuste,
        cantidadAjustada: cantidadNum,
        observacion: observacion.trim(),
      });

      toast.success("Ajuste registrado exitosamente");
      router.push("/inventory/adjustments");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el ajuste"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="create">
      <DashboardShell
        title="Registrar Ajuste de Inventario"
        description="Formulario en página dedicada para registrar entradas y salidas."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/inventory/adjustments")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a ajustes
          </Button>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-5">
            <div className="space-y-2">
              <Label htmlFor="producto">Producto *</Label>
              <Popover open={productsOpen} onOpenChange={setProductsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={loadingProducts}
                  >
                    {selectedProduct ? selectedProduct.nombre : "Seleccionar producto..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar producto..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron productos</CommandEmpty>
                      <CommandGroup>
                        {products.map((prod) => (
                          <CommandItem
                            key={prod.id}
                            value={prod.nombre}
                            onSelect={() => {
                              setSelectedProduct(prod);
                              setProductsOpen(false);
                            }}
                          >
                            <div className="flex w-full items-center justify-between">
                              <span>{prod.nombre}</span>
                              <span className="text-xs text-muted-foreground">
                                Stock: {prod.existencia.toFixed(2)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoAjuste">Tipo de Ajuste *</Label>
              <Select value={tipoAjuste} onValueChange={(val) => setTipoAjuste(val as "ENTRADA" | "SALIDA")}>
                <SelectTrigger id="tipoAjuste">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span>Entrada (Agregar existencias)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="SALIDA">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span>Salida (Descontar existencias / Merma)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad *</Label>
              <Input
                id="cantidad"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>

            {selectedProduct && cantidadNum > 0 ? (
              <div className="rounded-md border bg-muted/50 p-4">
                <p className="text-sm font-medium">Cálculo de Stock:</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stock actual:</span>
                  <span className="font-mono font-medium">{stockActual.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{tipoAjuste === "ENTRADA" ? "Suma:" : "Resta:"}</span>
                  <span className="font-mono font-medium">
                    {tipoAjuste === "ENTRADA" ? "+" : "-"}
                    {cantidadNum.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Nuevo stock:</span>
                  <span className={`font-mono text-lg font-bold ${isStockNegative ? "text-red-600" : "text-green-600"}`}>
                    {nuevoStock.toFixed(2)}
                  </span>
                </div>
                {isStockNegative ? <p className="mt-2 text-xs text-red-600">El stock no puede ser negativo.</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="observacion">Motivo / Observación * (mínimo 10 caracteres)</Label>
              <Textarea
                id="observacion"
                placeholder="Describe el motivo del ajuste..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{observacion.trim().length} / 10 caracteres</p>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/inventory/adjustments")} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Registrar ajuste
              </Button>
            </div>
          </form>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
