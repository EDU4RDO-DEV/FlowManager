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
import { listProviders } from "@/services/providers.service";
import { createPurchase } from "@/services/purchases.service";
import type { ProviderDto } from "@/types/providers";

const purchaseExpenseSchema = z.object({
  idProveedor: z.number().int().positive(),
  numeroFactura: z.string().trim().min(1, "Numero de factura es obligatorio").max(50),
  fechaFactura: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  observaciones: z.string().trim().max(255).optional(),
  detalleGasto: z
    .array(
      z.object({
        descripcion: z
          .string()
          .trim()
          .min(3, "Descripcion debe tener al menos 3 caracteres")
          .max(255),
        cantidad: z.number().positive("Cantidad debe ser mayor a 0"),
        precioUnitario: z.number().positive("Precio unitario debe ser mayor a 0"),
      }),
    )
    .min(1, "Agrega al menos un gasto"),
});

type PurchaseExpenseValues = z.infer<typeof purchaseExpenseSchema>;

export default function CreatePurchaseExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseExpenseValues>({
    resolver: zodResolver(purchaseExpenseSchema),
    defaultValues: {
      idProveedor: 0,
      numeroFactura: "",
      fechaFactura: new Date().toISOString().slice(0, 10),
      observaciones: "",
      detalleGasto: [],
    },
  });

  const {
    fields: detalleGastoFields,
    append: appendDetalleGasto,
    remove: removeDetalleGasto,
  } = useFieldArray({
    control,
    name: "detalleGasto",
  });

  const selectedProviderId = watch("idProveedor");
  const detalleGasto = watch("detalleGasto") ?? [];

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
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
    async function loadProviders() {
      setLoadingSources(true);
      try {
        const providersData = await listProviders();
        setProviders(providersData);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar proveedores"));
      } finally {
        setLoadingSources(false);
      }
    }

    void loadProviders();
  }, []);

  function addExpenseRow() {
    appendDetalleGasto({
      descripcion: "",
      cantidad: 1,
      precioUnitario: 0.01,
    });
  }

  async function onSubmit(values: PurchaseExpenseValues) {
    if (!user) {
      return;
    }

    try {
      await createPurchase({
        idUsuario: user.id,
        idProveedor: values.idProveedor,
        numeroFactura: values.numeroFactura.trim(),
        esGasto: true,
        observaciones: values.observaciones?.trim() || undefined,
        fechaFactura: values.fechaFactura,
        detalleGasto: values.detalleGasto.map((item) => ({
          descripcion: item.descripcion.trim(),
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
        })),
      });

      toast.success("Gasto registrado correctamente");
      router.push("/purchases/gastos");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el gasto"));
    }
  }

  return (
    <RequireAuth moduleKey="compras" action="create">
      <DashboardShell
        title="Nuevo Gasto de Compra"
        description="Registra gastos de compra en una pagina dedicada, sin ventanas encima."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/purchases/gastos")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a gastos
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
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="w-32">Cantidad</TableHead>
                      <TableHead className="w-40">Precio Unitario</TableHead>
                      <TableHead className="w-40 text-right">Subtotal</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleGastoFields.map((field, index) => {
                      const row = detalleGasto[index];
                      const subtotal = Number(row?.cantidad || 0) * Number(row?.precioUnitario || 0);

                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <Input
                              {...register(`detalleGasto.${index}.descripcion` as const)}
                              placeholder="Ej. Flete"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              {...register(`detalleGasto.${index}.cantidad` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              {...register(`detalleGasto.${index}.precioUnitario` as const, {
                                valueAsNumber: true,
                              })}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">Q{subtotal.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
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
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          Agrega al menos un gasto para registrar.
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

            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Total gasto:</span>
                <span className="text-lg font-bold">Q{totalGasto.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/purchases/gastos")}
                disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || loadingSources}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar gasto
              </Button>
            </div>
          </form>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
