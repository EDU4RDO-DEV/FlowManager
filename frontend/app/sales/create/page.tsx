"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import { listClients } from "@/services/clients.service";
import { listProducts } from "@/services/products.service";
import { createSale, listTalonarios, uploadSaleProofImage } from "@/services/sales.service";
import type { ClientDto } from "@/types/clients";
import type { ProductDto } from "@/types/products";
import type { CreateSaleDetailPayload, SalePaymentPayload, TalonarioDto } from "@/types/sales";

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

export default function CreateSalePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [talonarios, setTalonarios] = useState<TalonarioDto[]>([]);

  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [idTalonario, setIdTalonario] = useState<number | null>(null);
  const [condicionPago, setCondicionPago] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [nitFacturado, setNitFacturado] = useState("");
  const [nombreFacturado, setNombreFacturado] = useState("");
  const [direccionFacturada, setDireccionFacturada] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetailRow[]>([]);

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
        const [clientsData, talonariosData, firstProductsPage] = await Promise.all([
          listClients(),
          listTalonarios(),
          listProducts({ anulado: false, page: 1, limit: 100 }),
        ]);

        const pages = firstProductsPage.pagination.totalPages;
        let allProducts = firstProductsPage.items;

        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, idx) =>
              listProducts({ anulado: false, page: idx + 2, limit: 100 }),
            ),
          );
          allProducts = [...allProducts, ...rest.flatMap((page) => page.items)];
        }

        setClients(clientsData.filter((client) => !client.anulado));
        setTalonarios(talonariosData.filter((talonario) => !talonario.anulado));
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

  function addProductRow() {
    if (!selectedProductId) {
      return;
    }

    const found = products.find((item) => item.id === selectedProductId);
    if (!found) {
      return;
    }

    setDetalle((prev) => [
      ...prev,
      {
        idInventarioItem: found.id,
        nombre: found.nombre,
        cantidad: 1,
        precioUnitario: found.precioVenta,
      },
    ]);

    setSelectedProductId(null);
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

    if (condicionPago === "CONTADO" && pagoMonto + 0.0001 < total) {
      return "En contado el pago inicial no puede ser menor al total";
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
                <Select
                  value={idCliente ? String(idCliente) : undefined}
                  onValueChange={(value) => setIdCliente(Number(value))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.entidad.nombreCompleto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  </div>
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
                  <Select
                    value={selectedProductId ? String(selectedProductId) : undefined}
                    onValueChange={(value) => setSelectedProductId(Number(value))}
                    disabled={isLoading || selectableProducts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableProducts.map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          {product.nombre} · Stock {product.existencia.toFixed(2)} · {toMoney(product.precioVenta)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
      </DashboardShell>
    </RequireAuth>
  );
}
