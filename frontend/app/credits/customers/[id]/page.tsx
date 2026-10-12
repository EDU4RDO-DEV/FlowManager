"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditPaymentDialog } from "@/app/credits/_components/credit-payment-dialog";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { listCreditsByCustomer } from "@/services/credits.service";
import type { CreditDto } from "@/types/credits";

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

function getDocumentLabel(credit: CreditDto): string {
  if (credit.venta.serieFel && credit.venta.numeroFel) {
    return `${credit.venta.serieFel} / ${credit.venta.numeroFel}`;
  }
  return `Venta #${credit.venta.numeroVenta}`;
}

function getCreditDisplayStatus(credit: CreditDto): string {
  if (credit.anulado || credit.estado === "ANULADO" || credit.venta.anulado) return "ANULADO";
  return credit.venta.estadoPago;
}

export default function CreditCustomerPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canCreatePayments = hasModulePermission(user, "ventas", "create");
  const customerId = Number(params.id);
  const [credits, setCredits] = useState<CreditDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<CreditDto | null>(null);

  const loadCustomerCredits = useCallback(async () => {
    if (!Number.isInteger(customerId) || customerId <= 0) {
      setLoadError("Identificador de cliente inválido");
      setIsLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      setCredits(await listCreditsByCustomer(customerId));
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar la ficha financiera del cliente");
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [customerId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadCustomerCredits(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadCustomerCredits]);

  const customer = credits[0]?.cliente;
  const totalPending = useMemo(
    () =>
      Number(
        credits
          .filter((credit) => credit.estado === "ACTIVO" && !credit.anulado && !credit.venta.anulado)
          .reduce((total, credit) => total + credit.saldo, 0)
          .toFixed(2),
      ),
    [credits],
  );
  const paymentHistory = useMemo(
    () =>
      credits
        .flatMap((credit) =>
          credit.pagos.map((payment) => ({
            ...payment,
            numeroVenta: credit.venta.numeroVenta,
          })),
        )
        .sort((left, right) => new Date(right.fechaPago ?? 0).getTime() - new Date(left.fechaPago ?? 0).getTime()),
    [credits],
  );

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title={customer ? `Ficha financiera · ${customer.nombre}` : "Ficha financiera del cliente"}
        description="Consulta el saldo global, documentos por cobrar y el historial de abonos."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="outline">
              <Link href="/credits">
                <ArrowLeft className="mr-2 size-4" />
                Volver a Créditos y Abonos
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadCustomerCredits()} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Actualizar
            </Button>
          </div>

          {isLoading && !hasLoadedOnce ? (
            <Card>
              <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando ficha financiera...
              </CardContent>
            </Card>
          ) : loadError ? (
            <Card>
              <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
            </Card>
          ) : !customer ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Este cliente no tiene cuentas por cobrar disponibles.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{customer.nombre}</p>
                    {customer.nit ? <p className="text-sm text-muted-foreground">NIT {customer.nit}</p> : null}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo total pendiente del cliente</p>
                    <p className="text-xl font-bold text-amber-700">{formatMoney(totalPending)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Documentos</p>
                    <p className="font-semibold">
                      {credits.filter((credit) => credit.estado === "ACTIVO" && getCreditDisplayStatus(credit) !== "ANULADO").length} pendientes ·{" "}
                      {credits.filter((credit) => credit.estado === "PAGADO" && getCreditDisplayStatus(credit) !== "ANULADO").length} pagados ·{" "}
                      {credits.filter((credit) => getCreditDisplayStatus(credit) === "ANULADO").length} anulados
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documentos del cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Documento</TableHead>
                          <TableHead>Emisión</TableHead>
                          <TableHead className="text-right">Importe original</TableHead>
                          <TableHead className="text-right">Abonado</TableHead>
                          <TableHead className="text-right">Saldo del documento</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {credits.map((credit) => (
                          <TableRow key={credit.id}>
                            <TableCell className="min-w-40">
                              <Link
                                className="font-medium underline-offset-4 hover:underline"
                                href={`/sales/${credit.venta.id}`}
                              >
                                {getDocumentLabel(credit)}
                              </Link>
                              <p className="text-xs text-muted-foreground">Venta #{credit.venta.numeroVenta}</p>
                              {getCreditDisplayStatus(credit) === "ANULADO" ? (
                                <p className="text-xs text-rose-700">
                                  Anulado {formatDate(credit.fechaAnulacion)}
                                  {credit.motivoCierre ? ` · ${credit.motivoCierre}` : ""}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(credit.venta.fechaEmision)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {formatMoney(credit.totalOriginal)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {formatMoney(credit.totalAbonado)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-semibold">
                              {formatMoney(credit.saldo)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getCreditDisplayStatus(credit) === "ANULADO" ? "destructive" : "secondary"}
                                className={
                                  getCreditDisplayStatus(credit) === "ANULADO"
                                    ? ""
                                    : credit.venta.estadoPago === "PAGADO"
                                    ? "bg-emerald-600 text-white"
                                    : credit.venta.estadoPago === "PARCIAL"
                                      ? "bg-amber-500 text-white"
                                      : "bg-slate-500 text-white"
                                }
                              >
                                {getCreditDisplayStatus(credit)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {canCreatePayments &&
                              getCreditDisplayStatus(credit) !== "ANULADO" &&
                              credit.estado === "ACTIVO" &&
                              credit.saldo > 0 ? (
                                <Button size="sm" onClick={() => setSelectedCredit(credit)}>
                                  Registrar abono
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historial de abonos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Registrado por</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Anulación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                              No hay abonos registrados para este cliente.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paymentHistory.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="whitespace-nowrap">{formatDate(payment.fechaPago)}</TableCell>
                              <TableCell>
                                <Link
                                  className="underline-offset-4 hover:underline"
                                  href={`/sales/${payment.idVenta}`}
                                >
                                  Venta #{payment.numeroVenta}
                                </Link>
                              </TableCell>
                              <TableCell>{payment.metodoPago}</TableCell>
                              <TableCell>{payment.numeroReferencia ?? "-"}</TableCell>
                              <TableCell>{payment.usuario.nombre}</TableCell>
                              <TableCell className="whitespace-nowrap text-right font-medium">
                                {formatMoney(payment.monto)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={payment.anulado ? "destructive" : "secondary"}
                                  className={payment.anulado ? "" : "bg-emerald-100 text-emerald-800"}
                                >
                                  {payment.estado}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {payment.anulado ? formatDate(payment.fechaAnulacion) : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {canCreatePayments && selectedCredit ? (
          <CreditPaymentDialog
            credit={selectedCredit}
            open
            onOpenChange={(open) => { if (!open) setSelectedCredit(null); }}
            onPaymentSuccess={() => void loadCustomerCredits()}
          />
        ) : null}
      </DashboardShell>
    </RequireAuth>
  );
}
