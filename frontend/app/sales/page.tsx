"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Receipt, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
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
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { formatSatNameForDisplay } from "@/lib/sales-formatters";
import { listSales } from "@/services/sales.service";
import type { SaleDto, SalesFilters } from "@/types/sales";

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

export default function SalesPage() {
  const { user } = useAuth();
  const canCreateSale = hasModulePermission(user, "ventas", "create");
  const [query, setQuery] = useState("");
  const [condicionPago, setCondicionPago] = useState<"" | "CONTADO" | "CREDITO">("");
  const [estadoPago, setEstadoPago] = useState<"" | "PENDIENTE" | "PARCIAL" | "PAGADO">("");
  const [anulado, setAnulado] = useState<"" | "true" | "false">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const PAGE_SIZE = 20;

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: SalesFilters = {
        page,
        limit: PAGE_SIZE,
        ...(query.trim() ? { busqueda: query.trim() } : {}),
        ...(condicionPago ? { condicionPago } : {}),
        ...(estadoPago ? { estadoPago } : {}),
        ...(anulado ? { anulado: anulado === "true" } : {}),
        ...(fechaDesde ? { fechaDesde } : {}),
        ...(fechaHasta ? { fechaHasta } : {}),
      };

      const response = await listSales(filters);
      setSales(response.items);
      setTotalPages(response.pagination.totalPages || 1);
      setTotal(response.pagination.total);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar las ventas"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [query, condicionPago, estadoPago, anulado, fechaDesde, fechaHasta, page]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadSales();
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [loadSales]);

  useEffect(() => {
    setPage(1);
  }, [query, condicionPago, estadoPago, anulado, fechaDesde, fechaHasta]);

  const metrics = useMemo(() => {
    const total = sales.length;
    const pendientes = sales.filter((item) => item.estadoPago === "PENDIENTE").length;
    const parciales = sales.filter((item) => item.estadoPago === "PARCIAL").length;
    const pagadas = sales.filter((item) => item.estadoPago === "PAGADO").length;
    return { total, pendientes, parciales, pagadas };
  }, [sales]);

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Administración de Ventas"
        description="Vista operativa inicial del módulo de ventas"
      >
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ventas listadas</p>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </div>
                <ShoppingCart className="size-5 text-sky-600" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Pendiente</p>
                  <p className="text-2xl font-bold">{metrics.pendientes}</p>
                </div>
                <CreditCard className="size-5 text-amber-600" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Parcial</p>
                  <p className="text-2xl font-bold">{metrics.parciales}</p>
                </div>
                <CreditCard className="size-5 text-indigo-600" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Pagado</p>
                  <p className="text-2xl font-bold">{metrics.pagadas}</p>
                </div>
                <Receipt className="size-5 text-emerald-600" />
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial de ventas</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadSales} disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
                {canCreateSale ? (
                  <Button asChild variant="default">
                    <Link href="/sales/create">Nueva venta</Link>
                  </Button>
                ) : null}
                <Button asChild>
                  <Link href="/sales/talonarios">Talonarios</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="busqueda">Cliente o NIT</Label>
                  <Input
                    id="busqueda"
                    placeholder="Buscar cliente o NIT"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Condición</Label>
                  <Select
                    value={condicionPago || "TODAS"}
                    onValueChange={(value) =>
                      setCondicionPago(value === "TODAS" ? "" : (value as "CONTADO" | "CREDITO"))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas</SelectItem>
                      <SelectItem value="CONTADO">Contado</SelectItem>
                      <SelectItem value="CREDITO">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Estado de pago</Label>
                  <Select
                    value={estadoPago || "TODOS"}
                    onValueChange={(value) =>
                      setEstadoPago(value === "TODOS" ? "" : (value as "PENDIENTE" | "PARCIAL" | "PAGADO"))
                    }
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
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select
                    value={anulado || "TODAS"}
                    onValueChange={(value) => setAnulado(value === "TODAS" ? "" : (value as "true" | "false"))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Activas y anuladas</SelectItem>
                      <SelectItem value="false">Solo activas</SelectItem>
                      <SelectItem value="true">Solo anuladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fecha-desde">Fecha desde</Label>
                  <Input
                    id="fecha-desde"
                    type="date"
                    value={fechaDesde}
                    onChange={(event) => setFechaDesde(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fecha-hasta">Fecha hasta</Label>
                  <Input
                    id="fecha-hasta"
                    type="date"
                    value={fechaHasta}
                    onChange={(event) => setFechaHasta(event.target.value)}
                  />
                </div>
              </div>

              {!isLoading && hasLoadedOnce && sales.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No hay ventas para los filtros actuales.
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.map((sale) => (
                    <div key={sale.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-7 md:items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Número</p>
                        <p className="font-medium">#{sale.numeroVenta}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="break-words font-medium">{formatSatNameForDisplay(sale.cliente.nombre)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha</p>
                        <p className="font-medium">{formatDate(sale.fechaRegistro)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">{formatMoney(sale.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-medium">{formatMoney(sale.saldo)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{sale.condicionPago}</Badge>
                        <Badge
                          className={
                            sale.estadoPago === "PAGADO"
                              ? "bg-emerald-600 text-white"
                              : sale.estadoPago === "PARCIAL"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-500 text-white"
                          }
                        >
                          {sale.estadoPago}
                        </Badge>
                      </div>
                      <div className="md:justify-self-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/sales/${sale.id}`}>Ver detalle</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                <span>
                  {total} venta{total === 1 ? "" : "s"} · Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
