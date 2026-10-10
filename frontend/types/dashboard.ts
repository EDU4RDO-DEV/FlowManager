export type DashboardGranularity = "day" | "week" | "month";

export interface DashboardData {
  period: {
    fechaInicio: string;
    fechaFin: string;
    granularidad: DashboardGranularity;
  };
  summary: {
    salesAmount: number;
    salesAmountChangePercent: number | null;
    orderCount: number;
    orderCountChangePercent: number | null;
    pendingOrderCount: number;
    pendingOrderCountChangePercent: number | null;
    unitsSold: number;
    unitsSoldChangePercent: number | null;
    averageTicket: number;
    averageTicketChangePercent: number | null;
  };
  trend: Array<{
    date: string;
    salesAmount: number;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    salesAmount: number;
  }>;
  topCustomers: Array<{
    id: number;
    name: string;
    orderCount: number;
    salesAmount: number;
  }>;
  orderStatuses: Array<{
    key: string;
    label: string;
    count: number;
  }>;
}

export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
}
