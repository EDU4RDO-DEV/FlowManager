"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

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
import { CreditPaymentDialog } from "@/app/credits/_components/credit-payment-dialog";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import { listCredits } from "@/services/credits.service";
import type { CreditDto, CreditPaymentStatus, CreditsFilters } from "@/types/credits";

const PAGE_SIZE = 20;

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

function getPaymentBadgeClass(status: CreditPaymentStatus): string {
  if (status === "PAGADO") return "bg-emerald-600 text-white";
  if (status === "PARCIAL") return "bg-amber-500 text-white";
  return "bg-slate-500 text-white";
}

function getCreditDisplayStatus(credit: CreditDto): CreditPaymentStatus | "ANULADO" {
  if (credit.anulado || credit.estado === "ANULADO" || credit.venta.anulado) return "ANULADO";
  return credit.venta.estadoPago;
}

function getStatusBadgeClass(status: CreditPaymentStatus | "ANULADO"): string {
  if (status === "ANULADO") return "bg-rose-700 text-white";
  return getPaymentBadgeClass(status);
}

function getDocumentLabel(credit: CreditDto): string {
  if (credit.venta.serieFel && credit.venta.numeroFel) {
    return `${credit.venta.serieFel} / ${credit.venta.numeroFel}`;
  }
  return `Venta #${credit.venta.numeroVenta}`;
}

export default function CreditsPage() {
  const { user } = useAuth();
  const canCreatePayments = hasModulePermission(user, "ventas", "create");
  const [credits, setCredits] = useState<CreditDto[]>([]);
  const [query, setQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"" | CreditPaymentStatus>("");
  const [showAnnulled, setShowAnnulled] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<CreditDto | null>(null);

  const loadCredits = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const filters: CreditsFilters = {
        page,
        limit: PAGE_SIZE,
        ...(showAnnulled ? { incluirAnulados: true } : { anulado: false }),
        ...(query.trim() ? { busqueda: query.trim() } : {}),
        ...(paymentStatus ? { estadoPago: paymentStatus } : {}),
        ...(dateFrom ? { fechaDesde: dateFrom } : {}),
        ...(dateTo ? { fechaHasta: dateTo } : {}),
      };
      const result = await listCredits(filters);
      setCredits(result.items);
      setTotal(result.pagination.total);
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudieron cargar las cuentas por cobrar");
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [dateFrom, dateTo, page, paymentStatus, query, showAnnulled]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadCredits(), 250);
    return () => clearTimeout(timeoutId);
  }, [loadCredits]);

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Créditos y Abonos"
        description="Consulta y administra desde una sola vista las cuentas por cobrar."
      >
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Cuentas por cobrar
            </CardTitle>
            <Button variant="outline" onClick={() => void loadCredits()} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Actualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="credit-search">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="credit-search"
                    className="pl-9"
                    placeholder="Cliente, NIT, número o documento"
                    value={query}
                    onChange={(event) => {
                      setPage(1);
                      setQuery(event.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Estado de pago</Label>
                <Select
                  value={paymentStatus || "TODOS"}
                  onValueChange={(value) => {
                    setPage(1);
                    setPaymentStatus(value === "TODOS" ? "" : (value as CreditPaymentStatus));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="PAGADO">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vigencia del documento</Label>
                <Select
                  value={showAnnulled ? "TODOS" : "VIGENTES"}
                  onValueChange={(value) => {
                    setPage(1);
                    setShowAnnulled(value === "TODOS");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIGENTES">Solo vigentes</SelectItem>
                    <SelectItem value="TODOS">Incluir anulados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-date-from">Emisión desde</Label>
                <Input
                  id="credit-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setPage(1);
                    setDateFrom(event.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-date-to">Emisión hasta</Label>
                <Input
                  id="credit-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setPage(1);
                    setDateTo(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Emisión</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Abonado</TableHead>
                    <TableHead className="text-right">Saldo pendiente</TableHead>
                    <TableHead>Estado del documento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && !hasLoadedOnce ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                        <Loader2 className="mr-2 inline size-4 animate-spin" />
                        Cargando cuentas por cobrar...
                      </TableCell>
                    </TableRow>
                  ) : loadError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-destructive">
                        {loadError}
                      </TableCell>
                    </TableRow>
                  ) : credits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No hay documentos para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    credits.map((credit) => (
                      <TableRow key={credit.id}>
                        <TableCell className="min-w-48">
                          <Link
                            className="font-medium underline-offset-4 hover:underline"
                            href={`/credits/customers/${credit.cliente.id}`}
                          >
                            {credit.cliente.nombre}
                          </Link>
                          {credit.cliente.nit ? (
                            <p className="text-xs text-muted-foreground">NIT {credit.cliente.nit}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-40">
                          <Link
                            className="font-medium underline-offset-4 hover:underline"
                            href={`/sales/${credit.venta.id}`}
                          >
                            {getDocumentLabel(credit)}
                          </Link>
                          {credit.venta.numeroFel ? (
                            <p className="text-xs text-muted-foreground">Venta #{credit.venta.numeroVenta}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(credit.venta.fechaEmision)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatMoney(credit.totalOriginal)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatMoney(credit.totalAbonado)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold">
                          {formatMoney(credit.saldo)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeClass(getCreditDisplayStatus(credit))}>
                            {getCreditDisplayStatus(credit)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {canCreatePayments &&
                            getCreditDisplayStatus(credit) !== "ANULADO" &&
                            credit.estado === "ACTIVO" &&
                            credit.saldo > 0 ? (
                              <Button size="sm" onClick={() => setSelectedCredit(credit)}>
                                Registrar abono
                              </Button>
                            ) : null}
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/credits/customers/${credit.cliente.id}`}>Ficha</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {total} documento{total === 1 ? "" : "s"} · Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE)) || isLoading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {canCreatePayments && selectedCredit ? (
          <CreditPaymentDialog
            credit={selectedCredit}
            open
            onOpenChange={(open) => { if (!open) setSelectedCredit(null); }}
            onPaymentSuccess={() => void loadCredits()}
          />
        ) : null}
      </DashboardShell>
    </RequireAuth>
  );
}
