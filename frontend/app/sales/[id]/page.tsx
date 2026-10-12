"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { formatSatNameForDisplay } from "@/lib/sales-formatters";
import {
  anulateSale,
  anulateSalePayment,
  createSalePayment,
  getSaleById,
  listSalePayments,
  uploadSaleProofImage,
} from "@/services/sales.service";
import type {
  CreateSalePaymentPayload,
  SaleDto,
  SalePaymentDto,
} from "@/types/sales";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveUploadUrl(rutaArchivo: string): string {
  const configuredBase = process.env.NEXT_PUBLIC_API_URL;
  if (configuredBase) {
    return `${configuredBase}${rutaArchivo}`;
  }

  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000${rutaArchivo}`;
  }

  return rutaArchivo;
}

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const [sale, setSale] = useState<SaleDto | null>(null);
  const [payments, setPayments] = useState<SalePaymentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const paymentIdempotencyKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [paymentToAnulate, setPaymentToAnulate] = useState<SalePaymentDto | null>(null);
  const [isAnulatingPayment, setIsAnulatingPayment] = useState(false);
  const [isAnulateSaleDialogOpen, setIsAnulateSaleDialogOpen] = useState(false);
  const [isAnulatingSale, setIsAnulatingSale] = useState(false);

  const [monto, setMonto] = useState(0);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("EFECTIVO");
  const [numeroReferencia, setNumeroReferencia] = useState("");
  const [banco, setBanco] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [rutaConstancia, setRutaConstancia] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const saleId = useMemo(() => Number(params.id), [params.id]);
  const canCreatePayments = hasModulePermission(user, "ventas", "create");
  const canAnulatePayments = hasModulePermission(user, "ventas", "delete");
  const canAnulateSale = hasModulePermission(user, "ventas", "delete");

  const loadData = useCallback(async () => {
    if (!Number.isInteger(saleId) || saleId <= 0) {
      toast.error("Id de venta inválido");
      router.push("/sales");
      return;
    }

    setIsLoading(true);
    try {
      const [saleData, paymentsData] = await Promise.all([
        getSaleById(saleId),
        listSalePayments(saleId),
      ]);
      setSale(saleData);
      setPayments(paymentsData);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el detalle de venta"));
      router.push("/sales");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [router, saleId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saldoPendiente = useMemo(() => {
    if (!sale || sale.anulado) {
      return 0;
    }
    return Number(Math.max(0, sale.total - sale.totalPagado).toFixed(2));
  }, [sale]);

  function validatePayment(): string | null {
    if (!user) {
      return "Usuario no autenticado";
    }

    if (!sale) {
      return "No hay venta cargada";
    }

    if (sale.anulado) {
      return "No se pueden registrar pagos en ventas anuladas";
    }

    if (monto <= 0) {
      return "El monto debe ser mayor a 0";
    }

    if (monto > saldoPendiente) {
      return "El monto no puede ser mayor al saldo pendiente";
    }

    if ((metodoPago === "TRANSFERENCIA" || metodoPago === "CHEQUE" || metodoPago === "POS") && !numeroReferencia.trim()) {
      return "La referencia es obligatoria para el método seleccionado";
    }

    if ((metodoPago === "TRANSFERENCIA" || metodoPago === "CHEQUE") && !banco.trim()) {
      return "El banco es obligatorio para transferencia y cheque";
    }

    return null;
  }

  async function handleRegisterPayment() {
    const validationError = validatePayment();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!user || !sale) {
      return;
    }

    const payload: CreateSalePaymentPayload = {
      idUsuario: user.id,
      monto: Number(monto.toFixed(2)),
      metodoPago,
      numeroReferencia: numeroReferencia.trim() || undefined,
      banco: banco.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      rutaFirma: rutaConstancia || undefined,
      fechaPago: new Date().toISOString().slice(0, 10),
    };

    setIsSavingPayment(true);
    try {
      const fingerprint = JSON.stringify(payload);
      if (!paymentIdempotencyKey.current || paymentIdempotencyKey.current.fingerprint !== fingerprint) {
        paymentIdempotencyKey.current = { fingerprint, key: crypto.randomUUID() };
      }
      await createSalePayment(sale.id, payload, paymentIdempotencyKey.current.key);
      paymentIdempotencyKey.current = null;
      toast.success("Pago registrado correctamente");
      setMonto(0);
      setNumeroReferencia("");
      setBanco("");
      setObservaciones("");
      setRutaConstancia("");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el pago"));
    } finally {
      setIsSavingPayment(false);
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
      toast.success("Constancia cargada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la constancia"));
    } finally {
      setIsUploadingProof(false);
      event.target.value = "";
    }
  }

  async function handleConfirmAnulatePayment() {
    if (!user || !sale || !paymentToAnulate) {
      return;
    }

    setIsAnulatingPayment(true);
    try {
      await anulateSalePayment(sale.id, paymentToAnulate.id, user.id);
      toast.success("Pago anulado correctamente");
      setPaymentToAnulate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el pago"));
    } finally {
      setIsAnulatingPayment(false);
    }
  }

  async function handleConfirmAnulateSale() {
    if (!user || !sale) {
      return;
    }

    setIsAnulatingSale(true);
    try {
      await anulateSale(sale.id, { idUsuarioAnulador: user.id });
      toast.success("Venta anulada correctamente");
      setIsAnulateSaleDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la venta"));
    } finally {
      setIsAnulatingSale(false);
    }
  }

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title={sale ? `Venta #${sale.numeroVenta}` : "Detalle de Venta"}
        description="Cuenta por cobrar, historial de pagos y estado comercial"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="outline">
              <Link href="/sales">
                <ArrowLeft className="mr-2 size-4" />
                Volver a ventas
              </Link>
            </Button>

            <div className="flex flex-wrap gap-2">
              {sale ? (
                <Button asChild variant="outline">
                  <Link href={`/credits/customers/${sale.idCliente}`}>Abrir Créditos y Abonos</Link>
                </Button>
              ) : null}
              {canAnulateSale && sale && !sale.anulado ? (
                <Button variant="destructive" onClick={() => setIsAnulateSaleDialogOpen(true)}>
                  Anular venta
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading && !hasLoadedOnce ? (
            <Card>
              <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando detalle de venta...
              </CardContent>
            </Card>
          ) : null}

          {sale ? (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="break-words font-medium">{formatSatNameForDisplay(sale.cliente.nombre)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Condición</p>
                    <p className="font-medium">{sale.condicionPago}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Estado de pago</p>
                    <Badge
                      className={
                        sale.anulado
                          ? "bg-rose-700 text-white"
                          : sale.estadoPago === "PAGADO"
                          ? "bg-emerald-600 text-white"
                          : sale.estadoPago === "PARCIAL"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-500 text-white"
                      }
                    >
                      {sale.anulado ? "ANULADO" : sale.estadoPago}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatDate(sale.fechaRegistro)}</p>
                  </CardContent>
                </Card>
              </section>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Resumen financiero</CardTitle>
                  <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                    Recargar
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="font-semibold">{formatMoney(sale.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total venta</p>
                    <p className="font-semibold">{formatMoney(sale.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total pagado</p>
                    <p className="font-semibold">{formatMoney(sale.totalPagado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                    <p className="font-semibold">{formatMoney(saldoPendiente)}</p>
                  </div>
                </CardContent>
              </Card>

              {sale.requiereFactura ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Facturación FEL</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">NIT facturado</p>
                      <p className="font-medium">{sale.nitFacturado ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre facturado</p>
                      <p className="break-words font-medium">
                        {sale.nombreClienteFacturado ? formatSatNameForDisplay(sale.nombreClienteFacturado) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Serie / Número</p>
                      <p className="font-medium">
                        {sale.serieFel && sale.numeroFel ? `${sale.serieFel} / ${sale.numeroFel}` : "Pendiente"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de emisión</p>
                      <p className="font-medium">{formatDate(sale.fechaEmisionFel)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">Autorización (UUID)</p>
                      <p className="break-all font-medium">{sale.autorizacionFel ?? "-"}</p>
                    </div>
                    <div className="flex items-end gap-3 md:col-span-2">
                      {sale.rutaPdfFel ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={resolveUploadUrl(sale.rutaPdfFel)} target="_blank" rel="noreferrer">
                            Ver PDF certificado
                          </a>
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {sale.autorizacionFel ? "PDF no disponible" : "Factura pendiente de emisión"}
                        </p>
                      )}
                      {sale.qrFel ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={sale.qrFel} target="_blank" rel="noreferrer">
                            Verificar en SAT
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Detalle de productos</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sale.detalle ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.nombre}</TableCell>
                          <TableCell className="text-right">{row.cantidad.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.precioUnitario)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMoney(row.subtotal)}</TableCell>
                          <TableCell className="text-center">
                            {row.esBonificacion ? (
                              <Badge className="bg-indigo-600 text-white">BONIFICACION</Badge>
                            ) : (
                              <Badge variant="secondary">Venta</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pagos y cuenta por cobrar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canCreatePayments ? (
                    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Método de pago</Label>
                        <Select value={metodoPago} onValueChange={(value) => setMetodoPago(value as PaymentMethod)}>
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
                        <Label htmlFor="monto">Monto del abono</Label>
                        <Input
                          id="monto"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={monto}
                          onChange={(event) => setMonto(Number(event.target.value || 0))}
                        />
                      </div>
                      {(metodoPago === "TRANSFERENCIA" || metodoPago === "CHEQUE" || metodoPago === "POS") ? (
                        <div className="space-y-1">
                          <Label htmlFor="numeroReferencia">Referencia</Label>
                          <Input
                            id="numeroReferencia"
                            value={numeroReferencia}
                            onChange={(event) => setNumeroReferencia(event.target.value)}
                          />
                        </div>
                      ) : null}
                      {(metodoPago === "TRANSFERENCIA" || metodoPago === "CHEQUE") ? (
                        <div className="space-y-1">
                          <Label htmlFor="banco">Banco</Label>
                          <Input id="banco" value={banco} onChange={(event) => setBanco(event.target.value)} />
                        </div>
                      ) : null}
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="observaciones">Observaciones</Label>
                        <Input
                          id="observaciones"
                          value={observaciones}
                          onChange={(event) => setObservaciones(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="constancia-abono">Foto de talonario / comprobante</Label>
                        <Input
                          id="constancia-abono"
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
                            <span>Opcional. Se guarda junto al pago en la venta.</span>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          onClick={handleRegisterPayment}
                          disabled={isSavingPayment || sale.anulado || sale.estadoPago === "PAGADO"}
                        >
                          {isSavingPayment ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Registrar abono
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Constancia</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.fechaPago)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={payment.anulado ? "destructive" : "secondary"}
                                className={payment.anulado ? "" : "bg-emerald-100 text-emerald-800"}
                              >
                                {payment.estado}
                              </Badge>
                            </TableCell>
                            <TableCell>{payment.metodoPago}</TableCell>
                            <TableCell>{payment.numeroReferencia ?? "-"}</TableCell>
                            <TableCell>{payment.banco ?? "-"}</TableCell>
                            <TableCell>
                              {payment.rutaFirma ? (
                                <a className="underline" href={payment.rutaFirma} target="_blank" rel="noreferrer">
                                  Ver imagen
                                </a>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(payment.monto)}</TableCell>
                            <TableCell>{payment.usuario.nombre}</TableCell>
                            <TableCell className="text-right">
                              {canAnulatePayments && !payment.anulado ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={sale.anulado}
                                  onClick={() => setPaymentToAnulate(payment)}
                                >
                                  Anular
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {payments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Esta venta no tiene pagos registrados.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <ConfirmActionDialog
          open={Boolean(paymentToAnulate)}
          onOpenChange={(open) => {
            if (!open) {
              setPaymentToAnulate(null);
            }
          }}
          title="Anular pago"
          description={`¿Seguro que deseas anular el pago ${paymentToAnulate ? formatMoney(paymentToAnulate.monto) : ""}? Esta acción es lógica y recalcula el saldo.`}
          confirmLabel="Anular pago"
          loading={isAnulatingPayment}
          onConfirm={handleConfirmAnulatePayment}
        />

        <ConfirmActionDialog
          open={isAnulateSaleDialogOpen}
          onOpenChange={setIsAnulateSaleDialogOpen}
          title="Anular venta"
          description={`¿Seguro que deseas anular la venta #${sale?.numeroVenta ?? ""}? Se restaurará el inventario, se anularán los pagos y, si tiene FEL emitido, se anulará ante el proveedor.`}
          confirmLabel="Anular venta"
          loading={isAnulatingSale}
          onConfirm={handleConfirmAnulateSale}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
