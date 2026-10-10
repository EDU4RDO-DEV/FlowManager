"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CreditCard,
  FileBarChart,
  FileSpreadsheet,
  PackageOpen,
  Receipt,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { getApiErrorMessage } from "@/lib/api";
import {
  DEFAULT_REPORTS_ACCENT,
  isReportsAccentKey,
  reportsAccentStorageKey,
  reportsAccentVariables,
  type ReportsAccentKey,
} from "@/lib/reports-accent";
import { getReportsCatalog } from "@/services/reports.service";
import type { ReportCatalogEntry, ReportCategorySummary } from "@/types/reports";

import { ReportsEmptyState } from "./_components/reports-empty-state";
import { ReportCategoriesSkeleton, ReportListSkeleton } from "./_components/reports-skeletons";

const CATEGORY_ICONS: Record<string, typeof ShoppingCart> = {
  ventas: ShoppingCart,
  clientes: Users,
  creditos: CreditCard,
  facturacion: Receipt,
  envases: PackageOpen,
};

function getCategoryIcon(categoria: string) {
  return CATEGORY_ICONS[categoria] ?? FileSpreadsheet;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<ReportCategorySummary[]>([]);
  const [reportes, setReportes] = useState<ReportCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accent, setAccent] = useState<ReportsAccentKey>(DEFAULT_REPORTS_ACCENT);
  const [query, setQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);

  async function loadCatalog() {
    setIsLoading(true);
    try {
      const data = await getReportsCatalog();
      setCategorias(data.categorias);
      setReportes(data.reportes);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el catálogo de reportes."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const stored = window.localStorage.getItem(reportsAccentStorageKey(user.id));
    if (stored && isReportsAccentKey(stored)) {
      setAccent(stored);
    }
  }, [user?.id]);

  const filteredReportes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reportes.filter((report) => {
      if (selectedCategoria && report.categoria !== selectedCategoria) return false;
      if (normalizedQuery.length === 0) return true;
      return (
        report.nombre.toLowerCase().includes(normalizedQuery) ||
        report.descripcion.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [reportes, query, selectedCategoria]);

  return (
    <RequireAuth moduleKey="reportes" action="read">
      <DashboardShell
        title="Reportes"
        description="Centro de reportería: selecciona una categoría, configura los parámetros y genera información lista para decidir."
      >
        <div className="flex flex-col gap-6" style={reportsAccentVariables(accent) as CSSProperties}>
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar reporte..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-[color:var(--reports-accent-soft)] focus-visible:ring-[color:var(--reports-accent-ring)]"
            />
          </InputGroup>

          {isLoading ? (
            <ReportCategoriesSkeleton />
          ) : categorias.length === 0 ? (
            <ReportsEmptyState message="Aún no hay reportes configurados." onReload={() => void loadCatalog()} />
          ) : (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categorias.map((categoria) => {
                const Icon = getCategoryIcon(categoria.categoria);
                const isActive = selectedCategoria === categoria.categoria;
                return (
                  <button
                    key={categoria.categoria}
                    type="button"
                    onClick={() => setSelectedCategoria(isActive ? null : categoria.categoria)}
                    className="text-left"
                  >
                    <Card
                      className={`rounded-xl border bg-background transition-colors ${
                        isActive
                          ? "border-[color:var(--reports-accent)] ring-2 ring-[color:var(--reports-accent-ring)]"
                          : "border-border hover:border-[color:var(--reports-accent)]"
                      }`}
                    >
                      <CardContent className="flex flex-col gap-2 p-4">
                        <span className="w-fit rounded-lg bg-[color:var(--reports-accent-soft)] p-2 text-[color:var(--reports-accent-text)]">
                          <Icon className="size-5" />
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {categoria.categoriaLabel}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {categoria.totalReportes} {categoria.totalReportes === 1 ? "reporte" : "reportes"}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </section>
          )}

          {isLoading ? (
            <ReportListSkeleton />
          ) : filteredReportes.length === 0 ? (
            <ReportsEmptyState onReload={() => void loadCatalog()} />
          ) : (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredReportes.map((report) => (
                <Link key={report.id} href={`/reports/${report.categoria}/${report.id}`}>
                  <Card className="h-full rounded-xl border border-border bg-background transition-colors hover:border-[color:var(--reports-accent)]">
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="flex items-center gap-2">
                        <FileBarChart className="size-4 text-[color:var(--reports-accent)]" />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {report.nombre}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground">{report.descripcion}</p>
                      <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {report.categoriaLabel}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </section>
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
