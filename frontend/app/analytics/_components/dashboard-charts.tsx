"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/types/dashboard";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-[310px] animate-pulse rounded-md bg-muted/60" />,
});

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

function getThemeColors() {
  if (typeof window === "undefined") {
    return {
      foreground: "#334155",
      muted: "#64748b",
      border: "#cbd5e1",
      palette: ["#2563eb", "#0891b2", "#059669", "#7c3aed"],
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    foreground: read("--foreground", "#334155"),
    muted: read("--muted-foreground", "#64748b"),
    border: read("--border", "#cbd5e1"),
    palette: [
      read("--chart-1", "#2563eb"),
      read("--chart-2", "#0891b2"),
      read("--chart-3", "#059669"),
      read("--chart-4", "#7c3aed"),
    ],
  };
}

function formatCurrency(value: number): string {
  return `Q ${currencyFormatter.format(value)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateLabel(date: string, granularity: DashboardData["period"]["granularidad"]): string {
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  if (granularity === "month") {
    return new Intl.DateTimeFormat("es-GT", { month: "short", year: "2-digit" }).format(localDate);
  }
  if (granularity === "week") {
    return `Sem. ${new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(localDate)}`;
  }
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(localDate);
}

function DashboardChartCard({
  title,
  description,
  empty,
  children,
  className,
}: {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[310px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            No hay datos disponibles para este período.
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  const [colors, setColors] = useState(getThemeColors);

  useEffect(() => {
    const updateColors = () => setColors(getThemeColors());
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    updateColors();
    return () => observer.disconnect();
  }, []);

  const axisStyle = useMemo(
    () => ({
      axisLabel: { color: colors.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: colors.border } },
      splitLine: { lineStyle: { color: colors.border, type: "dashed" as const } },
    }),
    [colors],
  );
  const trendOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 350,
      color: colors.palette,
      grid: { left: 18, right: 20, top: 24, bottom: 22, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => formatCurrency(Number(value)),
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.trend.map((item) => formatDateLabel(item.date, data.period.granularidad)),
        axisLabel: { ...axisStyle.axisLabel, hideOverlap: true },
        axisLine: axisStyle.axisLine,
      },
      yAxis: {
        type: "value",
        axisLabel: {
          ...axisStyle.axisLabel,
          formatter: (value: number) => `Q ${numberFormatter.format(value)}`,
        },
        splitLine: axisStyle.splitLine,
      },
      series: [
        {
          name: "Ventas",
          type: "line",
          smooth: true,
          showSymbol: data.trend.length < 20,
          symbolSize: 7,
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.12 },
          data: data.trend.map((item) => item.salesAmount),
        },
      ],
    }),
    [axisStyle, colors.palette, data],
  );
  const productsOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 350,
      color: colors.palette,
      grid: { left: 8, right: 24, top: 12, bottom: 18, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value) => `${numberFormatter.format(Number(value))} unidades`,
      },
      xAxis: {
        type: "value",
        axisLabel: axisStyle.axisLabel,
        axisLine: { show: false },
        splitLine: axisStyle.splitLine,
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.topProducts.map((product) => product.name),
        axisLabel: { ...axisStyle.axisLabel, width: 130, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Unidades vendidas",
          type: "bar",
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 5, 5, 0] },
          data: data.topProducts.map((product) => product.quantity),
        },
      ],
    }),
    [axisStyle, colors.palette, data.topProducts],
  );
  const customersOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 350,
      color: colors.palette,
      grid: { left: 8, right: 24, top: 12, bottom: 18, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          if (!point || typeof point !== "object" || !("dataIndex" in point)) return "";
          const customer = data.topCustomers[Number(point.dataIndex)];
          if (!customer) return "";
          const averageTicket =
            customer.orderCount > 0 ? customer.salesAmount / customer.orderCount : 0;
          return [
            escapeHtml(customer.name),
            `Ventas: ${formatCurrency(customer.salesAmount)}`,
            `Pedidos: ${numberFormatter.format(customer.orderCount)}`,
            `Ticket promedio: ${formatCurrency(averageTicket)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        axisLabel: {
          ...axisStyle.axisLabel,
          formatter: (value: number) => `Q ${numberFormatter.format(value)}`,
        },
        axisLine: { show: false },
        splitLine: axisStyle.splitLine,
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.topCustomers.map((customer) => customer.name),
        axisLabel: { ...axisStyle.axisLabel, width: 130, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Ventas por cliente",
          type: "bar",
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 5, 5, 0] },
          data: data.topCustomers.map((customer) => customer.salesAmount),
        },
      ],
    }),
    [axisStyle, colors.palette, data.topCustomers],
  );
  const statusesOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 350,
      color: colors.palette,
      tooltip: {
        trigger: "item",
        valueFormatter: (value) => `${numberFormatter.format(Number(value))} pedidos`,
      },
      legend: {
        bottom: 0,
        left: "center",
        textStyle: { color: colors.muted },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: "Estado de entrega",
          type: "pie",
          radius: ["48%", "72%"],
          center: ["50%", "46%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "transparent", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
          data: data.orderStatuses.map((status) => ({ name: status.label, value: status.count })),
        },
      ],
    }),
    [colors.muted, colors.palette, data.orderStatuses],
  );

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <DashboardChartCard
        className="xl:col-span-2"
        title="Evolución de ventas"
        description="Importe de ventas registradas en el período seleccionado."
        empty={!data.trend.some((item) => item.salesAmount > 0)}
      >
        <ReactECharts option={trendOption} notMerge lazyUpdate style={{ width: "100%", height: 310 }} />
      </DashboardChartCard>
      <DashboardChartCard
        title="Productos más vendidos"
        description="Hasta diez productos, excluyendo bonificaciones."
        empty={data.topProducts.length === 0}
      >
        <ReactECharts option={productsOption} notMerge lazyUpdate style={{ width: "100%", height: 310 }} />
      </DashboardChartCard>
      <DashboardChartCard
        title="Clientes principales"
        description="Ordenados por importe; el detalle muestra pedidos y ticket promedio."
        empty={data.topCustomers.length === 0}
      >
        <ReactECharts option={customersOption} notMerge lazyUpdate style={{ width: "100%", height: 310 }} />
      </DashboardChartCard>
      <DashboardChartCard
        title="Estado de los pedidos"
        description="Distribución por estado de entrega."
        empty={!data.orderStatuses.some((status) => status.count > 0)}
      >
        <ReactECharts option={statusesOption} notMerge lazyUpdate style={{ width: "100%", height: 310 }} />
      </DashboardChartCard>
    </div>
  );
}
