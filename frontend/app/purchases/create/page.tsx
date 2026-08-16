"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api";
import { listProducts } from "@/services/products.service";
import { listProviders } from "@/services/providers.service";
import { createPurchase } from "@/services/purchases.service";
import type { ProductDto } from "@/types/products";
import type { ProviderDto } from "@/types/providers";

const purchaseCreateSchema = z.object({
  idProveedor: z.number().int().positive(),
  numeroFactura: z.string().trim().min(1, "Numero de factura es obligatorio").max(50),
  fechaFactura: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  observaciones: z.string().trim().max(255).optional(),
  detalleCompra: z
    .array(
      z.object({
        idInventarioItem: z.number().int().positive(),
        nombreProducto: z.string().trim().min(1),
        cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
        costoUnitario: z.number().positive("Costo unitario debe ser mayor a 0"),
      }),
    )
    .min(1, "Agrega al menos un producto"),
});

type PurchaseCreateValues = z.infer<typeof purchaseCreateSchema>;

export default function CreatePurchasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseCreateValues>({
    resolver: zodResolver(purchaseCreateSchema),
    defaultValues: {
      idProveedor: 0,
      numeroFactura: "",
      fechaFactura: new Date().toISOString().slice(0, 10),
      observaciones: "",
      detalleCompra: [],
    },
  });

  const {
    fields: detalleCompraFields,
    append: appendDetalleCompra,
    remove: removeDetalleCompra,
  } = useFieldArray({
    control,
    name: "detalleCompra",
  });

  const selectedProviderId = watch("idProveedor");
  const detalleCompra = watch("detalleCompra") ?? [];

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  const selectedProductIds = useMemo(
    () => new Set(detalleCompra.map((item) => item.idInventarioItem)),
    [detalleCompra],
  );

  const availableProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();

    return products.filter((product) => {
      if (selectedProductIds.has(product.id)) {
        return false;
      }

      if (normalized.length === 0) {
        return true;
      }

      return (
        product.nombre.toLowerCase().includes(normalized) ||
        product.categoria.toLowerCase().includes(normalized)
      );
    });
  }, [products, productSearch, selectedProductIds]);

  const totalCompra = useMemo(
    () =>
      detalleCompra.reduce((sum, row) => {
        const subtotal = Number(row.cantidad || 0) * Number(row.costoUnitario || 0);
        return sum + subtotal;
      }, 0),
    [detalleCompra],
  );

  useEffect(() => {
    async function loadSources() {
      setLoadingSources(true);
      try {
        const [providersData, firstProductsPage] = await Promise.all([
          listProviders(),
          listProducts({ anulado: false, page: 1, limit: 100 }),
        ]);

        if (firstProductsPage.pagination.totalPages <= 1) {
          setProviders(providersData);
          setProducts(firstProductsPage.items);
          return;
        }

        const restPages = await Promise.all(
          Array.from({ length: firstProductsPage.pagination.totalPages - 1 }, (_, idx) =>
            listProducts({ anulado: false, page: idx + 2, limit: 100 }),
          ),
        );

        setProviders(providersData);
        setProducts([
          ...firstProductsPage.items,
          ...restPages.flatMap((result) => result.items),
        ]);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar proveedores/productos"));
      } finally {
        setLoadingSources(false);
      }
    }

    void loadSources();
  }, []);

  function addProductRow(product: ProductDto) {
    appendDetalleCompra({
      idInventarioItem: product.id,
      nombreProducto: product.nombre,
      cantidad: 1,
      costoUnitario: product.costoPromedio,
    });
    setProductsOpen(false);
    setProductSearch("");
  }

  async function onSubmit(values: PurchaseCreateValues) {
    if (!user) {
      return;
    }

    try {
      await createPurchase({
        idUsuario: user.id,
        idProveedor: values.idProveedor,
        numeroFactura: values.numeroFactura.trim(),
        esGasto: false,
        observaciones: values.observaciones?.trim() || undefined,
        fechaFactura: values.fechaFactura,
        detalleCompra: values.detalleCompra.map((item) => ({
          idInventarioItem: item.idInventarioItem,
          cantidad: Number(item.cantidad),
          costoUnitario: Number(item.costoUnitario),
        })),
      });

      toast.success("Compra registrada correctamente");
      router.push("/purchases");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la compra"));
    }
  }

  return (
    <RequireAuth moduleKey="compras" action="create">
      <DashboardShell
        title="Nueva Compra"
        description="Registra una compra de inventario sin ventanas superpuestas."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/purchases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a compras
          </Button>

          <form className="space-y-5 rounded-xl border p-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <Popover open={providersOpen} onOpenChange={setProvidersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={loadingSources}
                    >
                      {selectedProvider?.nombre ?? "Seleccionar proveedor"}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-md p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar proveedor..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron proveedores</CommandEmpty>
                        <CommandGroup>
                          {providers.map((provider) => (
                            <CommandItem
                              key={provider.id}
                              value={`${provider.nombre} ${provider.entidad.nombreCompleto}`}
                              onSelect={() => {
                                setValue("idProveedor", provider.id, { shouldValidate: true });
                                setProvidersOpen(false);
                              }}
                            >
                              <div className="flex w-full flex-col">
                                <span>{provider.nombre}</span>
                                <span className="text-xs text-muted-foreground">
                                  {provider.entidad.nombreCompleto}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <input type="hidden" {...register("idProveedor", { valueAsNumber: true })} />
                {errors.idProveedor ? (
                  <p className="text-xs text-destructive">{errors.idProveedor.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numeroFactura">Numero de Factura *</Label>
                <Input id="numeroFactura" {...register("numeroFactura")} />
                {errors.numeroFactura ? (
                  <p className="text-xs text-destructive">{errors.numeroFactura.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaFactura">Fecha de Factura *</Label>
                <Input id="fechaFactura" type="date" {...register("fechaFactura")} />
                {errors.fechaFactura ? (
                  <p className="text-xs text-destructive">{errors.fechaFactura.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea id="observaciones" rows={2} {...register("observaciones")} />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium">Detalle de Compra (Inventario)</h4>
                <Popover open={productsOpen} onOpenChange={setProductsOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" disabled={loadingSources}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar producto
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-lg p-0" align="end">
                    <Command>
                      <CommandInput
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No hay productos disponibles</CommandEmpty>
                        <CommandGroup>
                          {availableProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.nombre} ${product.categoria}`}
                              onSelect={() => addProductRow(product)}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <span>{product.nombre}</span>
                                <span className="text-xs text-muted-foreground">
                                  Stock: {product.existencia.toFixed(2)}
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

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="w-36">Cantidad</TableHead>
                      <TableHead className="w-44">Costo Unitario</TableHead>
                      <TableHead className="w-40 text-right">Subtotal</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleCompraFields.map((field, index) => {
                      const row = detalleCompra[index];
                      const subtotal = Number(row?.cantidad || 0) * Number(row?.costoUnitario || 0);

                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <input
                              type="hidden"
                              {...register(`detalleCompra.${index}.idInventarioItem` as const, {
                                valueAsNumber: true,
                              })}
                            />
                            <input
                              type="hidden"
                              {...register(`detalleCompra.${index}.nombreProducto` as const)}
                            />
                            {row?.nombreProducto}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              {...register(`detalleCompra.${index}.cantidad` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              {...register(`detalleCompra.${index}.costoUnitario` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {subtotal.toLocaleString("es-GT", {
                              style: "currency",
                              currency: "GTQ",
                            })}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDetalleCompra(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {detalleCompraFields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Agrega al menos un producto para registrar la compra.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              {errors.detalleCompra ? (
                <p className="text-xs text-destructive">{errors.detalleCompra.message as string}</p>
              ) : null}
            </div>

            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Total general:</span>
                <span className="text-lg font-bold">
                  {totalCompra.toLocaleString("es-GT", {
                    style: "currency",
                    currency: "GTQ",
                  })}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/purchases")}
                disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || loadingSources}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Registrar compra
              </Button>
            </div>
          </form>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
