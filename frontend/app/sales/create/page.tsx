"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Loader2, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getApiErrorMessage } from "@/lib/api";
import { createClient, listClients } from "@/services/clients.service";
import { listProducts } from "@/services/products.service";
import {
  createSale,
  getFelReceptorInfo,
  listAvailableRouteSessions,
  listTalonarios,
  previewSaleBonuses,
  resolveSalePrice,
  uploadSaleProofImage,
} from "@/services/sales.service";
import type { ClientDto } from "@/types/clients";
import type { ProductDto } from "@/types/products";
import type {
  BonusPreviewItem,
  CreateSaleDetailPayload,
  RouteSessionOptionDto,
  SalePaymentPayload,
  TalonarioDto,
} from "@/types/sales";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";

type DetailRow = {
  idInventarioItem: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

function toMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeNit(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function CreateSalePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [talonarios, setTalonarios] = useState<TalonarioDto[]>([]);
  const [routeSessions, setRouteSessions] = useState<RouteSessionOptionDto[]>([]);
  const [bonusPreview, setBonusPreview] = useState<BonusPreviewItem[]>([]);

  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [idRutaSesion, setIdRutaSesion] = useState<number | null>(null);
  const [idTalonario, setIdTalonario] = useState<number | null>(null);
  const [condicionPago, setCondicionPago] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [nitFacturado, setNitFacturado] = useState("");
  const [nombreFacturado, setNombreFacturado] = useState("");
  const [direccionFacturada, setDireccionFacturada] = useState("");
  const [isConsultingNit, setIsConsultingNit] = useState(false);
  const [nitConsultaError, setNitConsultaError] = useState("");
  const [clientMatchState, setClientMatchState] = useState<"idle" | "found" | "not-found">("idle");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    nombreCompleto: "",
    correoElectronico: "",
    telefono1: "",
  });
  const [lugarEntrega, setLugarEntrega] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetailRow[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const [pagoMetodo, setPagoMetodo] = useState<PaymentMethod>("EFECTIVO");
  const [pagoMonto, setPagoMonto] = useState(0);
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoBanco, setPagoBanco] = useState("");
  const [rutaConstancia, setRutaConstancia] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  useEffect(() => {
    async function loadSources() {
      setIsLoading(true);
      try {
        const [clientsData, talonariosData, routeSessionsData, firstProductsPage] = await Promise.all([
          listClients(),
          listTalonarios(),
          listAvailableRouteSessions(),
          listProducts({ anulado: false, categoria: "PRODUCTO_TERMINADO", page: 1, limit: 100 }),
        ]);

        const pages = firstProductsPage.pagination.totalPages;
        let allProducts = firstProductsPage.items;

        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, idx) =>
              listProducts({ anulado: false, categoria: "PRODUCTO_TERMINADO", page: idx + 2, limit: 100 }),
            ),
          );
          allProducts = [...allProducts, ...rest.flatMap((page) => page.items)];
        }

        setClients(clientsData.filter((client) => !client.anulado));
        setTalonarios(talonariosData.filter((talonario) => !talonario.anulado));
        setRouteSessions(routeSessionsData);
        setProducts(allProducts.filter((product) => !product.anulado));
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar catálogo comercial"));
      } finally {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    }

    void loadSources();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === idCliente) ?? null,
    [clients, idCliente],
  );

  const selectedIds = useMemo(() => new Set(detalle.map((row) => row.idInventarioItem)), [detalle]);

  const selectableProducts = useMemo(
    () => products.filter((product) => !selectedIds.has(product.id)),
    [products, selectedIds],
  );

  const subtotal = useMemo(
    () => detalle.reduce((sum, row) => sum + row.cantidad * row.precioUnitario, 0),
    [detalle],
  );

  const total = Number(subtotal.toFixed(2));

  const cambio = useMemo(() => {
    if (condicionPago !== "CONTADO") {
      return 0;
    }
    return Number(Math.max(0, pagoMonto - total).toFixed(2));
  }, [condicionPago, pagoMonto, total]);

  async function addProductRow() {
    if (!selectedProductId) {
      return;
    }

    if (!idCliente) {
      toast.error("Selecciona un cliente antes de agregar productos");
      return;
    }

    const found = products.find((item) => item.id === selectedProductId);
    if (!found) {
      return;
    }

    let precioUnitario = found.precioVenta;
    try {
      const resolved = await resolveSalePrice(idCliente, found.id);
      precioUnitario = resolved.precioUnitario;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo resolver precio por tipo de cliente, se usará precio base"));
    }

    setDetalle((prev) => [
      ...prev,
      {
        idInventarioItem: found.id,
        nombre: found.nombre,
        cantidad: 1,
        precioUnitario,
      },
    ]);

    setSelectedProductId(null);
  }

  useEffect(() => {
    if (!idCliente || detalle.length === 0) {
      return;
    }

    let cancelled = false;

    async function recalcPrices() {
      try {
        const updated = await Promise.all(
          detalle.map(async (row) => {
            try {
              const resolved = await resolveSalePrice(idCliente as number, row.idInventarioItem);
              return { ...row, precioUnitario: resolved.precioUnitario };
            } catch {
              return row;
            }
          }),
        );

        if (!cancelled) {
          setDetalle(updated);
        }
      } catch {
        // Si falla la resolución masiva, se conservan los precios actuales.
      }
    }

    void recalcPrices();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCliente]);

  useEffect(() => {
    const sellRows = detalle.filter((row) => row.cantidad > 0);
    if (sellRows.length === 0) {
      setBonusPreview([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      void previewSaleBonuses(
        sellRows.map((row) => ({ idInventarioItem: row.idInventarioItem, cantidad: row.cantidad })),
      )
        .then(setBonusPreview)
        .catch(() => setBonusPreview([]));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [detalle]);

  useEffect(() => {
    if (!requiereFactura) {
      setNitConsultaError("");
      setClientMatchState("idle");
      return;
    }

    const nit = nitFacturado.trim();
    if (!nit || nit.toUpperCase() === "CF" || nit.toUpperCase() === "C/F") {
      setNitConsultaError("");
      setClientMatchState("idle");
      return;
    }

    let cancelled = false;
    setIsConsultingNit(true);
    setNitConsultaError("");

    const timeoutId = setTimeout(() => {
      const normalized = normalizeNit(nit);
      const localMatch = clients.find((client) => normalizeNit(client.entidad.nit ?? "") === normalized);

      if (localMatch) {
        setClientMatchState("found");
        setIdCliente(localMatch.id);
      } else {
        setClientMatchState("not-found");
      }

      void getFelReceptorInfo(nit)
        .then((info) => {
          if (cancelled) return;
          setNombreFacturado(info.nombre);
          if (info.direccion) {
            setDireccionFacturada(info.direccion);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setNitConsultaError(getApiErrorMessage(error, "No se pudo consultar el NIT"));
        })
        .finally(() => {
          if (!cancelled) {
            setIsConsultingNit(false);
          }
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [nitFacturado, requiereFactura, clients]);

  async function handleCreateQuickClient() {
    if (!user) {
      return;
    }

    const nombreCompleto = quickClientForm.nombreCompleto.trim();
    if (!nombreCompleto) {
      toast.error("El nombre completo es obligatorio");
      return;
    }

    setIsCreatingClient(true);
    try {
      const created = await createClient({
        idUsuario: user.id,
        entidad: {
          nombreCompleto,
          correoElectronico: quickClientForm.correoElectronico.trim() || undefined,
          telefono1: quickClientForm.telefono1.trim() || undefined,
          nit: nitFacturado.trim() || undefined,
        },
      });

      setClients((prev) => [created, ...prev]);
      setIdCliente(created.id);
      setClientMatchState("found");
      setClientDialogOpen(false);
      setQuickClientForm({ nombreCompleto: "", correoElectronico: "", telefono1: "" });
      toast.success("Cliente creado y seleccionado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el cliente"));
    } finally {
      setIsCreatingClient(false);
    }
  }

  function removeRow(idInventarioItem: number) {
    setDetalle((prev) => prev.filter((row) => row.idInventarioItem !== idInventarioItem));
  }

  function updateRow(
    idInventarioItem: number,
    field: "cantidad" | "precioUnitario",
    value: number,
  ) {
    setDetalle((prev) =>
      prev.map((row) =>
        row.idInventarioItem === idInventarioItem
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function validateBeforeSubmit(): string | null {
    if (!user) {
      return "Usuario no autenticado";
    }

    if (!idCliente) {
      return "Selecciona un cliente";
    }

    if (detalle.length === 0) {
      return "Agrega al menos un producto al detalle";
    }

    const invalidRow = detalle.find((row) => row.cantidad <= 0 || row.precioUnitario <= 0);
    if (invalidRow) {
      return "Cantidad y precio deben ser mayores a 0";
    }

    if (condicionPago === "CONTADO" && pagoMonto <= 0) {
      return "Para contado debes registrar un pago inicial mayor a 0";
    }

    if (
      condicionPago === "CONTADO" &&
      Number(pagoMonto.toFixed(2)) !== Number(total.toFixed(2))
    ) {
      return "En contado el pago debe coincidir con el total";
    }

    if (pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE" || pagoMetodo === "POS") {
      if (!pagoReferencia.trim()) {
        return "La referencia es obligatoria para el método de pago seleccionado";
      }
    }

    if (pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE") {
      if (!pagoBanco.trim()) {
        return "El banco es obligatorio para transferencia y cheque";
      }
    }

    if (requiereFactura && !nitFacturado.trim()) {
      return "Si requiere factura, el NIT facturado es obligatorio";
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!user || !idCliente) {
      return;
    }

    const detailPayload: CreateSaleDetailPayload[] = detalle.map((row) => ({
      idInventarioItem: row.idInventarioItem,
      cantidad: Number(row.cantidad),
      precioUnitario: Number(row.precioUnitario.toFixed(2)),
    }));

    const paymentPayload: SalePaymentPayload | undefined =
      condicionPago === "CONTADO"
        ? {
            monto: Number(pagoMonto.toFixed(2)),
            metodoPago: pagoMetodo,
            numeroReferencia: pagoReferencia.trim() || undefined,
            banco: pagoBanco.trim() || undefined,
            fechaPago: new Date().toISOString().slice(0, 10),
            rutaFirma: rutaConstancia || undefined,
          }
        : undefined;

    setIsSubmitting(true);
    try {
      const result = await createSale({
        idUsuario: user.id,
        idCliente,
        idRutaSesion: idRutaSesion ?? undefined,
        idTalonario: idTalonario ?? undefined,
        tipoRegistro: "VENTA",
        estadoEntrega: "PENDIENTE",
        condicionPago,
        requiereFactura,
        nitFacturado: nitFacturado.trim() || undefined,
        nombreClienteFacturado: nombreFacturado.trim() || undefined,
        direccionClienteFacturado: direccionFacturada.trim() || undefined,
        lugarEntrega: lugarEntrega.trim() || undefined,
        detalle: detailPayload,
        pagoInicial: paymentPayload,
      });

      toast.success(`Venta #${result.numeroVenta} registrada correctamente`);
      router.push(`/sales/${result.id}`);
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la venta"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsUploadingProof(true);
      const result = await uploadSaleProofImage(file);
      setRutaConstancia(result.rutaImagen);
      toast.success("Constancia del talonario cargada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la constancia"));
    } finally {
      setIsUploadingProof(false);
      event.target.value = "";
    }
  }

  return (
    <RequireAuth moduleKey="ventas" action="create">
      <DashboardShell
        title="Nueva Venta"
        description="Registro comercial tipo POS con detalle de productos y pago inicial"
      >
        <div className="space-y-5">
          <Button asChild variant="outline">
            <Link href="/sales">
              <ArrowLeft className="mr-2 size-4" />
              Volver a ventas
            </Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Encabezado de venta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={isLoading}
                    >
                      <span className="truncate">{selectedClient?.entidad.nombreCompleto ?? "Selecciona cliente"}</span>
                      <Search className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-md p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente por nombre o NIT..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.entidad.nombreCompleto} ${client.entidad.nit ?? ""}`}
                              onSelect={() => {
                                setIdCliente(client.id);
                                setClientPopoverOpen(false);
                              }}
                            >
                              <div className="flex w-full flex-col">
                                <span>{client.entidad.nombreCompleto}</span>
                                {client.entidad.nit ? (
                                  <span className="text-xs text-muted-foreground">NIT {client.entidad.nit}</span>
                                ) : null}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label>Condición de pago *</Label>
                <Select value={condicionPago} onValueChange={(value) => setCondicionPago(value as "CONTADO" | "CREDITO")}> 
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTADO">CONTADO</SelectItem>
                    <SelectItem value="CREDITO">CREDITO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Talonario (opcional)</Label>
                <Select
                  value={idTalonario ? String(idTalonario) : "none"}
                  onValueChange={(value) => setIdTalonario(value === "none" ? null : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin talonario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin talonario</SelectItem>
                    {talonarios.map((talonario) => (
                      <SelectItem key={talonario.id} value={String(talonario.id)}>
                        {talonario.nombre} ({talonario.siguienteCorrelativo ?? "agotado"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Sesión de ruta (opcional)</Label>
                <Select
                  value={idRutaSesion ? String(idRutaSesion) : "none"}
                  onValueChange={(value) => setIdRutaSesion(value === "none" ? null : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin sesión de ruta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sesión de ruta</SelectItem>
                    {routeSessions.map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        {session.ruta?.nombre ?? `Ruta ${session.idRuta}`} · {session.vendedor?.nombre ?? "Sin vendedor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Requerido para que la venta cuente en comisiones del vendedor/chofer.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="lugar-entrega">Lugar de entrega</Label>
                <Input
                  id="lugar-entrega"
                  value={lugarEntrega}
                  onChange={(event) => setLugarEntrega(event.target.value)}
                  placeholder="Dirección de entrega"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requiereFactura}
                    onChange={(event) => setRequiereFactura(event.target.checked)}
                  />
                  Requiere factura FEL
                </label>
              </div>

              {requiereFactura ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="nit-facturado">NIT facturado *</Label>
                    <Input
                      id="nit-facturado"
                      value={nitFacturado}
                      onChange={(event) => setNitFacturado(event.target.value)}
                      placeholder="1268645K"
                    />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {isConsultingNit ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Consultando NIT en Ecofactura...</span>
                        </>
                      ) : nitConsultaError ? (
                        <span className="text-destructive">{nitConsultaError}</span>
                      ) : (
                        <span>El nombre se autocompleta al consultar el NIT.</span>
                      )}
                    </div>
                  </div>

                  {clientMatchState === "found" ? (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 md:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <BadgeCheck className="size-4 shrink-0" />
                      <span>
                        Cliente encontrado por NIT y seleccionado automáticamente
                        {selectedClient ? `: ${selectedClient.entidad.nombreCompleto}` : ""}.
                      </span>
                    </div>
                  ) : null}

                  {clientMatchState === "not-found" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 md:col-span-2 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      <span>No existe un cliente registrado con el NIT {nitFacturado.trim()}.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQuickClientForm({
                            nombreCompleto: nombreFacturado.trim(),
                            correoElectronico: "",
                            telefono1: "",
                          });
                          setClientDialogOpen(true);
                        }}
                      >
                        <UserPlus className="mr-1 size-3.5" />
                        Registrar cliente
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <Label htmlFor="nombre-facturado">Nombre facturado</Label>
                    <Input
                      id="nombre-facturado"
                      value={nombreFacturado}
                      onChange={(event) => setNombreFacturado(event.target.value)}
                      placeholder={selectedClient?.entidad.nombreCompleto ?? "Nombre de factura"}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="direccion-facturada">Dirección facturada</Label>
                    <Input
                      id="direccion-facturada"
                      value={direccionFacturada}
                      onChange={(event) => setDireccionFacturada(event.target.value)}
                      placeholder="Dirección de facturación"
                    />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-65 flex-1 space-y-1">
                  <Label>Producto</Label>
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        disabled={isLoading || selectableProducts.length === 0}
                      >
                        <span className="truncate">
                          {selectedProductId
                            ? (selectableProducts.find((product) => product.id === selectedProductId)?.nombre ??
                              "Selecciona producto")
                            : "Selecciona producto"}
                        </span>
                        <Search className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-md p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar producto terminado..." />
                        <CommandList>
                          <CommandEmpty>No hay productos disponibles</CommandEmpty>
                          <CommandGroup>
                            {selectableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.nombre}
                                onSelect={() => {
                                  setSelectedProductId(product.id);
                                  setProductPopoverOpen(false);
                                }}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span>{product.nombre}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Stock {product.existencia.toFixed(2)} · {toMoney(product.precioVenta)}
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
                <Button type="button" onClick={addProductRow} disabled={!selectedProductId}>
                  <Plus className="mr-2 size-4" />
                  Agregar
                </Button>
              </div>

              {detalle.length === 0 && hasLoadedOnce ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No hay productos agregados. Selecciona un producto y pulsa Agregar.
                </div>
              ) : null}

              <div className="space-y-2">
                {detalle.map((row) => (
                  <div key={row.idInventarioItem} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[2fr_120px_140px_120px_auto] md:items-end">
                    <div>
                      <p className="text-xs text-muted-foreground">Producto</p>
                      <p className="font-medium">{row.nombre}</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={row.cantidad}
                        onChange={(event) =>
                          updateRow(row.idInventarioItem, "cantidad", Number(event.target.value || 0))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Precio unitario</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={row.precioUnitario}
                        onChange={(event) =>
                          updateRow(row.idInventarioItem, "precioUnitario", Number(event.target.value || 0))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="font-medium">{toMoney(row.cantidad * row.precioUnitario)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.idInventarioItem)}
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>

              {bonusPreview.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-indigo-300 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    Bonificación estimada (se aplicará automáticamente al guardar)
                  </p>
                  {bonusPreview.map((bonus) => (
                    <div
                      key={bonus.idInventarioItem}
                      className="flex items-center justify-between text-sm text-indigo-700 dark:text-indigo-300"
                    >
                      <span>{bonus.nombre}</span>
                      <span>
                        {bonus.cantidad.toFixed(2)} unid. · {toMoney(0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle>Pago y cierre</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Método de pago</Label>
                <Select value={pagoMetodo} onValueChange={(value) => setPagoMetodo(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">EFECTIVO</SelectItem>
                    <SelectItem value="TRANSFERENCIA">TRANSFERENCIA</SelectItem>
                    <SelectItem value="CHEQUE">CHEQUE</SelectItem>
                    <SelectItem value="POS">POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pago-monto">{condicionPago === "CONTADO" ? "Pago inicial *" : "Abono inicial"}</Label>
                <Input
                  id="pago-monto"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagoMonto}
                  onChange={(event) => setPagoMonto(Number(event.target.value || 0))}
                />
              </div>

              {(pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE" || pagoMetodo === "POS") ? (
                <div className="space-y-1">
                  <Label htmlFor="pago-referencia">Referencia</Label>
                  <Input
                    id="pago-referencia"
                    value={pagoReferencia}
                    onChange={(event) => setPagoReferencia(event.target.value)}
                  />
                </div>
              ) : null}

              {(pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE") ? (
                <div className="space-y-1">
                  <Label htmlFor="pago-banco">Banco</Label>
                  <Input id="pago-banco" value={pagoBanco} onChange={(event) => setPagoBanco(event.target.value)} />
                </div>
              ) : null}

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="constancia-talonario">Foto de talonario (constancia)</Label>
                <Input
                  id="constancia-talonario"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadProof}
                  disabled={isUploadingProof}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isUploadingProof ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {rutaConstancia ? (
                    <a className="underline" href={rutaConstancia} target="_blank" rel="noreferrer">
                      Ver constancia cargada
                    </a>
                  ) : (
                    <span>Opcional. Formatos permitidos: JPG, PNG, WEBP (máx. 5MB).</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-sm text-muted-foreground">Resumen</p>
                <p className="text-lg font-semibold">Total: {toMoney(total)}</p>
                <p className="text-sm">Pago inicial: {toMoney(pagoMonto)}</p>
                <p className="text-sm">Cambio: {toMoney(cambio)}</p>
              </div>

              <div className="md:col-span-2">
                <Button className="w-full" disabled={isSubmitting || isLoading} onClick={handleSubmit}>
                  {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Registrar venta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar cliente</DialogTitle>
              <DialogDescription>
                Se creará con el NIT {nitFacturado.trim() || "-"} y se seleccionará automáticamente en la venta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="quick-client-nombre">Nombre completo *</Label>
                <Input
                  id="quick-client-nombre"
                  value={quickClientForm.nombreCompleto}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, nombreCompleto: event.target.value }))
                  }
                  placeholder="Nombre o razón social"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-client-correo">Correo electrónico</Label>
                <Input
                  id="quick-client-correo"
                  value={quickClientForm.correoElectronico}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, correoElectronico: event.target.value }))
                  }
                  placeholder="correo@cliente.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-client-telefono">Teléfono</Label>
                <Input
                  id="quick-client-telefono"
                  value={quickClientForm.telefono1}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, telefono1: event.target.value }))
                  }
                  placeholder="5555-5555"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreateQuickClient} disabled={isCreatingClient}>
                {isCreatingClient ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Guardar y seleccionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardShell>
    </RequireAuth>
  );
}
