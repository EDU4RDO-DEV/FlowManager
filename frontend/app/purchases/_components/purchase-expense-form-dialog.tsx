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
import type { PurchaseDto } from "@/types/purchases";

const purchaseExpenseFormSchema = z.object({
  idProveedor: z.number().int().positive(),
  numeroFactura: z.string().trim().min(1, "Número de factura es obligatorio").max(50),
  fechaFactura: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  observaciones: z.string().trim().max(255).optional(),
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
    .min(1, "Agrega al menos un gasto"),
});

type PurchaseExpenseFormValues = z.infer<typeof purchaseExpenseFormSchema>;

interface PurchaseExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (purchase: PurchaseDto) => void;
}

export function PurchaseExpenseFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: PurchaseExpenseFormDialogProps) {
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseExpenseFormValues>({
    resolver: zodResolver(purchaseExpenseFormSchema),
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
    if (!open) {
      reset({
        idProveedor: 0,
        numeroFactura: "",
        fechaFactura: new Date().toISOString().slice(0, 10),
        observaciones: "",
        detalleGasto: [],
      });
      return;
    }

    void loadSources();
  }, [open, reset]);

  async function loadSources() {
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

  function addExpenseRow() {
    appendDetalleGasto({
      descripcion: "",
      cantidad: 1,
      precioUnitario: 0.01,
    });
  }

  async function onSubmit(values: PurchaseExpenseFormValues) {
    if (!user) {
      return;
    }

    try {
      const created = await createPurchase({
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

      onSuccess(created);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el gasto"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>Registrar Gasto de Compra</DialogTitle>
          <DialogDescription>
            Registra gastos asociados a proveedor para control operativo.
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
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
                <Label htmlFor="numeroFacturaGasto">Número de Factura *</Label>
                <Input id="numeroFacturaGasto" {...register("numeroFactura")} />
                {errors.numeroFactura ? (
                  <p className="text-xs text-destructive">{errors.numeroFactura.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaFacturaGasto">Fecha de Factura *</Label>
                <Input id="fechaFacturaGasto" type="date" {...register("fechaFactura")} />
                {errors.fechaFactura ? (
                  <p className="text-xs text-destructive">{errors.fechaFactura.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacionesGasto">Observaciones</Label>
              <Textarea id="observacionesGasto" rows={2} {...register("observaciones")} />
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
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-32">Cantidad</TableHead>
                      <TableHead className="w-40">Precio Unitario</TableHead>
                      <TableHead className="w-40 text-right">Subtotal</TableHead>
                      <TableHead className="w-20" />
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
                          <TableCell className="text-right font-medium">
                            Q{subtotal.toFixed(2)}
                          </TableCell>
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
          </div>

          <DialogFooter>
            <div className="mr-auto text-sm font-semibold">
              Total Gasto: Q{totalGasto.toFixed(2)}
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || loadingSources}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar gasto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
