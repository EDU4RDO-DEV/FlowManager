"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createAdjustment } from "@/services/adjustments.service";
import { listProducts } from "@/services/products.service";
import type { ProductDto } from "@/types/products";

type AdjustmentLine = {
  id: number;
  idInventarioItem: number | "";
  tipoAjuste: "ENTRADA" | "SALIDA";
  cantidad: string;
};

const ADJUSTMENT_NAME_OPTIONS = [
  "AJUSTE POR CONTEO",
  "MERMA POR DANIO",
  "MERMA POR VENCIMIENTO",
  "DEVOLUCION A PROVEEDOR",
  "CONSUMO INTERNO",
  "RECLASIFICACION DE INVENTARIO",
] as const;

type AdjustmentNameOption = (typeof ADJUSTMENT_NAME_OPTIONS)[number];

export default function CreateAdjustmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [nombreAjuste, setNombreAjuste] = useState<AdjustmentNameOption | "">("");
  const [observacion, setObservacion] = useState("");
  const [lines, setLines] = useState<AdjustmentLine[]>([
    {
      id: Date.now(),
      idInventarioItem: "",
      tipoAjuste: "ENTRADA",
      cantidad: "",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openProductLineId, setOpenProductLineId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

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

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const stockWarnings = useMemo(() => {
    const currentStock = new Map<number, number>(
      products.map((product) => [product.id, product.existencia]),
    );
    const warnings = new Map<number, string>();

    for (const line of lines) {
      if (line.idInventarioItem === "") continue;

      const itemId = line.idInventarioItem;
      const cantidadNum = Number(line.cantidad);
      if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) continue;

      const stock = currentStock.get(itemId);
      if (stock === undefined) continue;

      const nextStock =
        line.tipoAjuste === "ENTRADA" ? stock + cantidadNum : stock - cantidadNum;

      if (nextStock < 0) {
        warnings.set(
          line.id,
          `Stock insuficiente para ${productById.get(itemId)?.nombre ?? "item"}. Disponible: ${stock.toFixed(2)}`,
        );
      }

      currentStock.set(itemId, nextStock);
    }

    return warnings;
  }, [lines, productById, products]);

  const isFormValid = useMemo(() => {
    if (!user) return false;
    if (nombreAjuste === "") return false;
    if (observacion.trim().length < 10) return false;
    if (lines.length === 0) return false;
    if (stockWarnings.size > 0) return false;

    for (const line of lines) {
      if (line.idInventarioItem === "") return false;
      const cantidadNum = Number(line.cantidad);
      if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) return false;
    }

    return true;
  }, [lines, nombreAjuste, observacion, stockWarnings.size, user]);

  function updateLine(lineId: number, patch: Partial<AdjustmentLine>) {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        idInventarioItem: "",
        tipoAjuste: "ENTRADA",
        cantidad: "",
      },
    ]);
  }

  function removeLine(lineId: number) {
    setLines((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((line) => line.id !== lineId);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !isFormValid) return;
    if (nombreAjuste === "") return;

    const payloadItems = lines.map((line) => ({
      idInventarioItem: line.idInventarioItem as number,
      tipoAjuste: line.tipoAjuste,
      cantidadAjustada: Number(line.cantidad),
    }));

    setIsSubmitting(true);
    try {
      const result = await createAdjustment({
        idUsuario: user.id,
        nombreAjuste,
        observacion: observacion.trim(),
        items: payloadItems,
      });

      toast.success(`Ajuste #${result.numeroAjuste} registrado con ${result.totalItems} item(s).`);
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
              <Label htmlFor="nombre-ajuste">Nombre del ajuste *</Label>
              <Select
                value={nombreAjuste}
                onValueChange={(value) => setNombreAjuste(value as AdjustmentNameOption)}
              >
                <SelectTrigger id="nombre-ajuste" className="h-10">
                  <SelectValue placeholder="Seleccionar tipo de ajuste" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_NAME_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items del ajuste *</Label>
                <Button type="button" variant="outline" onClick={addLine} className="h-10 px-4 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar item
                </Button>
              </div>

              {lines.map((line, index) => {
                const product =
                  line.idInventarioItem !== "" ? productById.get(line.idInventarioItem) ?? null : null;
                const selectedProductName = product?.nombre ?? "Seleccionar producto";
                const cantidadNum = Number(line.cantidad);
                const currentStock = product?.existencia ?? 0;
                const nextStock =
                  line.tipoAjuste === "ENTRADA"
                    ? currentStock + (Number.isFinite(cantidadNum) ? cantidadNum : 0)
                    : currentStock - (Number.isFinite(cantidadNum) ? cantidadNum : 0);
                const warning = stockWarnings.get(line.id);

                return (
                  <div key={line.id} className="rounded-lg border p-3">
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_0.8fr_1fr_1fr_auto] md:items-end">
                      <div className="space-y-1">
                        <Label htmlFor={`item-product-${line.id}`}>Producto #{index + 1}</Label>
                        <Popover
                          open={openProductLineId === line.id}
                          onOpenChange={(open) => {
                            setOpenProductLineId(open ? line.id : null);
                            if (!open) {
                              setProductSearch("");
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id={`item-product-${line.id}`}
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={openProductLineId === line.id}
                              className="h-10 w-full justify-between"
                              disabled={loadingProducts}
                            >
                              <span className="truncate">{selectedProductName}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[460px] max-w-[95vw] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Buscar producto..."
                                value={productSearch}
                                onValueChange={setProductSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No se encontraron productos</CommandEmpty>
                                <CommandGroup>
                                  {products.map((prod) => (
                                    <CommandItem
                                      key={prod.id}
                                      value={`${prod.nombre} ${prod.id} ${prod.existencia}`}
                                      onSelect={() => {
                                        updateLine(line.id, { idInventarioItem: prod.id });
                                        setOpenProductLineId(null);
                                        setProductSearch("");
                                      }}
                                      data-checked={line.idInventarioItem === prod.id}
                                    >
                                      <div className="flex w-full items-center justify-between gap-2">
                                        <span className="truncate">{prod.nombre}</span>
                                        <span className="text-xs text-muted-foreground">
                                          Stock: {prod.existencia.toFixed(2)}
                                        </span>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-2 h-4 w-4",
                                          line.idInventarioItem === prod.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`item-tipo-${line.id}`}>Tipo</Label>
                        <Select
                          value={line.tipoAjuste}
                          onValueChange={(value) =>
                            updateLine(line.id, { tipoAjuste: value as "ENTRADA" | "SALIDA" })
                          }
                        >
                          <SelectTrigger id={`item-tipo-${line.id}`} className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENTRADA">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <span>Entrada</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="SALIDA">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                <span>Salida</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`item-cantidad-${line.id}`}>Cantidad</Label>
                        <Input
                          id={`item-cantidad-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={line.cantidad}
                          onChange={(event) => updateLine(line.id, { cantidad: event.target.value })}
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Stock actual</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                          <span className="font-mono font-semibold">{currentStock.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label>Nuevo stock</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                          <span
                            className={`font-mono font-semibold ${warning ? "text-red-600" : "text-emerald-700"}`}
                          >
                            {nextStock.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className="h-10"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Quitar
                      </Button>
                    </div>

                    {warning ? <p className="mt-2 text-xs text-red-600">{warning}</p> : null}
                  </div>
                );
              })}
            </div>

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
                Registrar ajuste por lote
              </Button>
            </div>
          </form>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
