"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getApiErrorMessage } from "@/lib/api";
import { createAdjustment } from "@/services/adjustments.service";
import { listProducts } from "@/services/products.service";
import type { AdjustmentDto } from "@/types/adjustments";
import type { ProductDto } from "@/types/products";

interface AdjustmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (adjustment: AdjustmentDto) => void;
}

export function AdjustmentFormDialog({ open, onOpenChange, onSuccess }: AdjustmentFormDialogProps) {
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
    if (open) {
      void loadProducts();
    } else {
      // Reset form
      setSelectedProduct(null);
      setTipoAjuste("ENTRADA");
      setCantidad("");
      setObservacion("");
    }
  }, [open]);

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

  const cantidadNum = parseFloat(cantidad) || 0;
  const stockActual = selectedProduct?.existencia ?? 0;
  const nuevoStock =
    tipoAjuste === "ENTRADA" ? stockActual + cantidadNum : stockActual - cantidadNum;

  const isStockNegative = nuevoStock < 0;
  const isFormValid =
    selectedProduct &&
    cantidadNum > 0 &&
    observacion.trim().length >= 10 &&
    !isStockNegative;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedProduct || !isFormValid) return;

    setIsSubmitting(true);
    try {
      const newAdjustment = await createAdjustment({
        idUsuario: user.id,
        idInventarioItem: selectedProduct.id,
        tipoAjuste,
        cantidadAjustada: cantidadNum,
        observacion: observacion.trim(),
      });

      onSuccess(newAdjustment);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el ajuste"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Ajuste de Inventario</DialogTitle>
          <DialogDescription>
            Crea un ajuste de entrada o salida para corregir el inventario
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Selector de Producto */}
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

            {/* Tipo de Ajuste */}
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

            {/* Cantidad */}
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

            {/* Cálculo de Stock */}
            {selectedProduct && cantidadNum > 0 && (
              <div className="rounded-md border bg-muted/50 p-4">
                <p className="text-sm font-medium">Cálculo de Stock:</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stock actual:</span>
                  <span className="font-mono font-medium">{stockActual.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tipoAjuste === "ENTRADA" ? "Suma:" : "Resta:"}
                  </span>
                  <span className="font-mono font-medium">
                    {tipoAjuste === "ENTRADA" ? "+" : "-"}
                    {cantidadNum.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 border-t pt-2 flex items-center justify-between">
                  <span className="font-medium">Nuevo stock:</span>
                  <span
                    className={`font-mono text-lg font-bold ${
                      isStockNegative ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {nuevoStock.toFixed(2)}
                  </span>
                </div>
                {isStockNegative && (
                  <p className="mt-2 text-xs text-red-600">
                    ⚠️ El stock no puede ser negativo. Reduce la cantidad.
                  </p>
                )}
              </div>
            )}

            {/* Motivo / Observación */}
            <div className="space-y-2">
              <Label htmlFor="observacion">
                Motivo / Observación * (mínimo 10 caracteres)
              </Label>
              <Textarea
                id="observacion"
                placeholder="Describe el motivo del ajuste..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {observacion.trim().length} / 10 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
