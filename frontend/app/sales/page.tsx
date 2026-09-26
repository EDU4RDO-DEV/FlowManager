"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Receipt, RefreshCw, Send, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { listSales, pingFel } from "@/services/sales.service";
import type { SaleDto } from "@/types/sales";

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
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [nitReceptor, setNitReceptor] = useState("");
  const [isPingingFel, setIsPingingFel] = useState(false);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listSales({
        page: 1,
        limit: 20,
        ...(query.trim() ? { busqueda: query.trim() } : {}),
      });
      setSales(response.items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar las ventas"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadSales();
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [loadSales]);

  const metrics = useMemo(() => {
    const total = sales.length;
    const pendientes = sales.filter((item) => item.estadoPago === "PENDIENTE").length;
    const parciales = sales.filter((item) => item.estadoPago === "PARCIAL").length;
    const pagadas = sales.filter((item) => item.estadoPago === "PAGADO").length;
    return { total, pendientes, parciales, pagadas };
  }, [sales]);

  async function handlePingFel() {
    try {
      setIsPingingFel(true);
      const result = await pingFel({
        nitReceptor: nitReceptor.trim() || undefined,
        validarNit: true,
      });

      toast.success(`FEL ${result.entorno.toUpperCase()}: ${result.servidor}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo ejecutar diagnóstico FEL"));
    } finally {
      setIsPingingFel(false);
    }
  }

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Administración de Ventas"
        description="Vista operativa inicial del módulo de ventas y diagnóstico FEL"
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
            <CardHeader>
              <CardTitle>Diagnóstico FEL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor="nit-receptor">NIT receptor (opcional)</Label>
                  <Input
                    id="nit-receptor"
                    value={nitReceptor}
                    onChange={(event) => setNitReceptor(event.target.value)}
                    placeholder="1268645K"
                  />
                </div>
                <Button className="mt-auto" onClick={handlePingFel} disabled={isPingingFel}>
                  {isPingingFel ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Probar FEL
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usuario actual: {user?.nombre ?? "-"}. Esta prueba usa /api/ventas/fel/ping sin crear ventas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial reciente de ventas</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  className="w-64"
                  placeholder="Buscar cliente o NIT"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
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
            <CardContent>
              {!isLoading && hasLoadedOnce && sales.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No hay ventas para los filtros actuales.
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.map((sale) => (
                    <div key={sale.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-6 md:items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Número</p>
                        <p className="font-medium">#{sale.numeroVenta}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="font-medium">{sale.cliente.nombre}</p>
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
