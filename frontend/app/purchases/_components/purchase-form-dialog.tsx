"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { PurchaseDto } from "@/types/purchases";

const purchaseFormSchema = z
  .object({
    idProveedor: z.number().int().positive(),
    numeroFactura: z.string().trim().min(1, "Número de factura es obligatorio").max(50),
    fechaFactura: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    esGasto: z.boolean(),
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
      .optional(),
    detalleGasto: z
      .array(
        z.object({
          descripcion: z
            .string()
            .trim()
            .min(3, "Descripción debe tener al menos 3 caracteres")
            .max(255),
          cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
          precioUnitario: z.number().positive("Precio unitario debe ser mayor a 0"),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const detalleCompra = data.detalleCompra ?? [];
    const detalleGasto = data.detalleGasto ?? [];

    if (data.esGasto) {
      if (detalleGasto.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Agrega al menos un gasto",
          path: ["detalleGasto"],
        });
      }

      if (detalleCompra.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No debes agregar productos cuando es gasto",
          path: ["detalleCompra"],
        });
      }

      return;
    }

    if (detalleCompra.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Agrega al menos un producto",
        path: ["detalleCompra"],
      });
    }

    if (detalleGasto.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No debes agregar gastos cuando es compra de inventario",
        path: ["detalleGasto"],
      });
    }

    const uniqueProducts = new Set<number>();
    detalleCompra.forEach((item, index) => {
      if (uniqueProducts.has(item.idInventarioItem)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No se permite repetir el producto",
          path: ["detalleCompra", index, "idInventarioItem"],
        });
      }
      uniqueProducts.add(item.idInventarioItem);
    });
  });

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface PurchaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (purchase: PurchaseDto) => void;
}

export function PurchaseFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: PurchaseFormDialogProps) {
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
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      idProveedor: 0,
      numeroFactura: "",
      fechaFactura: new Date().toISOString().slice(0, 10),
      esGasto: false,
      observaciones: "",
      detalleCompra: [],
      detalleGasto: [],
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

  const {
    fields: detalleGastoFields,
    append: appendDetalleGasto,
    remove: removeDetalleGasto,
  } = useFieldArray({
    control,
    name: "detalleGasto",
  });

  const esGasto = watch("esGasto");
  const selectedProviderId = watch("idProveedor");
  const detalleCompra = watch("detalleCompra") ?? [];
  const detalleGasto = watch("detalleGasto") ?? [];

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

  const totalGasto = useMemo(
    () =>
      detalleGasto.reduce((sum, row) => {
        const subtotal = Number(row.cantidad || 0) * Number(row.precioUnitario || 0);
        return sum + subtotal;
      }, 0),
    [detalleGasto],
  );

  useEffect(() => {
    if (!open) {
      reset({
        idProveedor: 0,
        numeroFactura: "",
        fechaFactura: new Date().toISOString().slice(0, 10),
        esGasto: false,
        observaciones: "",
        detalleCompra: [],
        detalleGasto: [],
      });
      setProductSearch("");
      return;
    }

    void loadSources();
  }, [open]);

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

  function addExpenseRow() {
    appendDetalleGasto({
      descripcion: "",
      cantidad: 1,
      precioUnitario: 0.01,
    });
  }

  async function onSubmit(values: PurchaseFormValues) {
    if (!user) {
      return;
    }

    try {
      const payload = {
        idUsuario: user.id,
        idProveedor: values.idProveedor,
        numeroFactura: values.numeroFactura.trim(),
        esGasto: values.esGasto,
        observaciones: values.observaciones?.trim() || undefined,
        fechaFactura: values.fechaFactura,
        detalleCompra: values.esGasto
          ? undefined
          : (values.detalleCompra ?? []).map((item) => ({
              idInventarioItem: item.idInventarioItem,
              cantidad: Number(item.cantidad),
              costoUnitario: Number(item.costoUnitario),
            })),
        detalleGasto: values.esGasto
          ? (values.detalleGasto ?? []).map((item) => ({
              descripcion: item.descripcion.trim(),
              cantidad: Number(item.cantidad),
              precioUnitario: Number(item.precioUnitario),
            }))
          : undefined,
      };

      const created = await createPurchase(payload);
      onSuccess(created);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la compra"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Compra</DialogTitle>
          <DialogDescription>
            Registra compras de inventario o gastos operativos asociados a proveedor.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
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
              <Label htmlFor="numeroFactura">Número de Factura *</Label>
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

            <div className="space-y-2">
              <Label>Tipo de registro *</Label>
              <Select
                value={esGasto ? "gasto" : "compra"}
                onValueChange={(value) => {
                  const nextEsGasto = value === "gasto";
                  setValue("esGasto", nextEsGasto, { shouldValidate: true });
                  if (nextEsGasto) {
                    setValue("detalleCompra", [], { shouldValidate: true });
                  } else {
                    setValue("detalleGasto", [], { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compra">Compra de Inventario</SelectItem>
                  <SelectItem value="gasto">Registro de Gastos</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" {...register("esGasto")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" rows={2} {...register("observaciones")} />
            {errors.observaciones ? (
              <p className="text-xs text-destructive">{errors.observaciones.message}</p>
            ) : null}
          </div>

          {!esGasto ? (
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
                      const subtotal =
                        Number(row?.cantidad || 0) * Number(row?.costoUnitario || 0);

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
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Detalle de Gastos</h4>
                <Button type="button" variant="outline" onClick={addExpenseRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar gasto
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-36">Cantidad</TableHead>
                      <TableHead className="w-44">Precio Unitario</TableHead>
                      <TableHead className="w-40 text-right">Subtotal</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleGastoFields.map((field, index) => {
                      const row = detalleGasto[index];
                      const subtotal =
                        Number(row?.cantidad || 0) * Number(row?.precioUnitario || 0);

                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <Input
                              {...register(`detalleGasto.${index}.descripcion` as const)}
                              placeholder="Ej. Flete, mantenimiento"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              {...register(`detalleGasto.${index}.cantidad` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              {...register(`detalleGasto.${index}.precioUnitario` as const, {
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
                              onClick={() => removeDetalleGasto(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {detalleGastoFields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Agrega al menos un gasto para registrar esta operación.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              {errors.detalleGasto ? (
                <p className="text-xs text-destructive">{errors.detalleGasto.message as string}</p>
              ) : null}
            </div>
          )}

          <div className="rounded-md border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal compra:</span>
              <span className="font-medium">
                {totalCompra.toLocaleString("es-GT", {
                  style: "currency",
                  currency: "GTQ",
                })}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal gastos:</span>
              <span className="font-medium">
                {totalGasto.toLocaleString("es-GT", {
                  style: "currency",
                  currency: "GTQ",
                })}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Total general:</span>
              <span className="text-lg font-bold">
                {(totalCompra + totalGasto).toLocaleString("es-GT", {
                  style: "currency",
                  currency: "GTQ",
                })}
              </span>
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
            <Button type="submit" disabled={isSubmitting || loadingSources}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar compra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
