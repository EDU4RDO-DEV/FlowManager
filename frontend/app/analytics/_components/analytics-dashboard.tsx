"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Boxes,
  CalendarRange,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import { getDashboardData } from "@/services/dashboard.service";
import type { DashboardData, DashboardFilters } from "@/types/dashboard";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardStatCard } from "./dashboard-stat-card";

type Preset = "today" | "last7" | "last30" | "month" | "year" | "custom";

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: Exclude<Preset, "custom">, now: Date): DashboardFilters {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const end = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
  const start = new Date(end);
  if (preset === "last7") start.setUTCDate(start.getUTCDate() - 6);
  if (preset === "last30") start.setUTCDate(start.getUTCDate() - 29);
  if (preset === "month") start.setUTCDate(1);
  if (preset === "year") {
    start.setUTCMonth(0, 1);
  }
  return { fechaInicio: dateKey(start), fechaFin: dateKey(end) };
}

function formatCurrency(value: number): string {
  return `Q ${new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(value);
}

function formatDateRange(filters: DashboardFilters): string {
  const start = new Date(`${filters.fechaInicio}T00:00:00`);
  const end = new Date(`${filters.fechaFin}T00:00:00`);
  const formatter = new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", year: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function AnalyticsDashboard() {
  const [preset, setPreset] = useState<Preset>("last30");
  const [filters, setFilters] = useState<DashboardFilters>(() => getPresetRange("last30", new Date()));
  const [result, setResult] = useState<{
    queryKey: string;
    data: DashboardData | null;
    error: string | null;
  } | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const queryKey = `${filters.fechaInicio}|${filters.fechaFin}|${refreshCount}`;
  const currentResult = result?.queryKey === queryKey ? result : null;
  const data = currentResult?.data ?? null;
  const error = currentResult?.error ?? null;
  const canQuery = Boolean(filters.fechaInicio && filters.fechaFin && filters.fechaInicio <= filters.fechaFin);
  const isLoading = canQuery && currentResult === null;

  useEffect(() => {
    if (!filters.fechaInicio || !filters.fechaFin || filters.fechaInicio > filters.fechaFin) return;

    const controller = new AbortController();

    getDashboardData(filters, controller.signal)
      .then((dashboardData) => {
        if (!controller.signal.aborted) {
          setResult({ queryKey, data: dashboardData, error: null });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            queryKey,
            data: null,
            error: getApiErrorMessage(requestError, "No se pudo consultar el dashboard."),
          });
        }
      });

    return () => controller.abort();
  }, [filters, queryKey]);

  const rangeLabel = useMemo(
    () => (canQuery ? formatDateRange(filters) : "Selecciona un rango de fechas"),
    [canQuery, filters],
  );

  function changePreset(value: string) {
    const nextPreset = value as Preset;
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setFilters(getPresetRange(nextPreset, new Date()));
    }
  }

  function updateDate(field: keyof DashboardFilters, value: string) {
    setPreset("custom");
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function refresh() {
    setRefreshCount((current) => current + 1);
  }

  const summary = data?.summary;
  const statCards = [
    {
      title: "Ventas totales",
      value: summary ? formatCurrency(summary.salesAmount) : "—",
      description: "Importe de ventas sin bonificaciones",
      changePercent: summary?.salesAmountChangePercent ?? null,
      icon: ShoppingCart,
    },
    {
      title: "Pedidos registrados",
      value: summary ? formatNumber(summary.orderCount) : "—",
      description: "Ventas registradas en el período",
      changePercent: summary?.orderCountChangePercent ?? null,
      icon: ClipboardList,
    },
    {
      title: "Pendientes o en proceso",
      value: summary ? formatNumber(summary.pendingOrderCount) : "—",
      description: "Pendiente, en ruta o entrega parcial",
      changePercent: summary?.pendingOrderCountChangePercent ?? null,
      icon: PackageCheck,
    },
    {
      title: "Productos vendidos",
      value: summary ? formatNumber(summary.unitsSold) : "—",
      description: "Unidades vendidas, sin bonificaciones",
      changePercent: summary?.unitsSoldChangePercent ?? null,
      icon: Boxes,
    },
      {
        title: "Ticket promedio",
        value: summary ? formatCurrency(summary.averageTicket) : "—",
        description: "Venta promedio por pedido",
        changePercent: summary?.averageTicketChangePercent ?? null,
        icon: ShoppingCart,
      },
    ];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
            <div className="min-w-48 space-y-2">
              <label className="text-sm font-medium" htmlFor="dashboard-period">Período</label>
              <Select value={preset} onValueChange={changePreset}>
                <SelectTrigger id="dashboard-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="last7">Últimos 7 días</SelectItem>
                  <SelectItem value="last30">Últimos 30 días</SelectItem>
                  <SelectItem value="month">Mes actual</SelectItem>
                  <SelectItem value="year">Año actual</SelectItem>
                  <SelectItem value="custom">Rango personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="dashboard-start">Desde</label>
                  <input
                    id="dashboard-start"
                    type="date"
                    value={filters.fechaInicio}
                    max={filters.fechaFin || undefined}
                    onChange={(event) => updateDate("fechaInicio", event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="dashboard-end">Hasta</label>
                  <input
                    id="dashboard-end"
                    type="date"
                    value={filters.fechaFin}
                    min={filters.fechaInicio || undefined}
                    onChange={(event) => updateDate("fechaFin", event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange aria-hidden="true" className="h-4 w-4" />
              {rangeLabel}
            </p>
            <Button variant="outline" onClick={refresh} disabled={!canQuery || isLoading}>
              <RefreshCw aria-hidden="true" className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">No se pudieron cargar los indicadores</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!canQuery && preset === "custom" && (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Rango de fechas inválido</p>
            <p className="mt-1 text-muted-foreground">Selecciona una fecha inicial y final válidas.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <DashboardStatCard key={card.title} {...card} isLoading={isLoading} />
        ))}
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-[390px] animate-pulse rounded-xl bg-muted/60 xl:even:col-span-1" />
          ))}
        </div>
      ) : data ? (
        <>
          {data.summary.orderCount === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No se registraron ventas en el período seleccionado.
            </div>
          )}
          <DashboardCharts data={data} />
        </>
      ) : null}
    </div>
  );
}
