"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { downloadReportExcel, downloadReportPdf, executeReport, getReportsByCategory } from "@/services/reports.service";
import type { ReportCatalogEntry, ReportParamField, ReportResult } from "@/types/reports";

import { ReportResultsSkeleton } from "../../_components/reports-skeletons";
import { ReportParamForm, type ReportParamValues } from "./_components/report-param-form";
import { ReportResults } from "./_components/report-results";

function buildExecutionParams(parametros: ReportParamField[], values: ReportParamValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of parametros) {
    const raw = values[field.key];
    if (raw === undefined || raw === "") continue;

    if (field.type === "number") {
      payload[field.key] = Number(raw);
    } else if (field.type === "boolean") {
      payload[field.key] = raw === "true";
    } else {
      payload[field.key] = raw;
    }
  }

  return payload;
}

export default function ReportRunnerPage() {
  const params = useParams<{ categoria: string; reportId: string }>();
  const router = useRouter();
  const categoria = decodeURIComponent(params.categoria);
  const reportId = decodeURIComponent(params.reportId);

  const [report, setReport] = useState<ReportCatalogEntry | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [values, setValues] = useState<ReportParamValues>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingReport(true);

    getReportsByCategory(categoria)
      .then((reports) => {
        if (cancelled) return;
        const found = reports.find((item) => item.id === reportId) ?? null;
        setReport(found);
        if (!found) {
          toast.error("El reporte solicitado no existe o no está disponible.");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, "No se pudo cargar la definición del reporte."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReport(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoria, reportId]);

  const executionParams = useMemo(
    () => (report ? buildExecutionParams(report.parametros, values) : {}),
    [report, values],
  );

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleClear() {
    setValues({});
    setResult(null);
  }

  async function handleSubmit() {
    if (!report) return;

    const missingRequired = report.parametros.find(
      (field) => field.required && !executionParams[field.key] && executionParams[field.key] !== 0,
    );
    if (missingRequired) {
      toast.error(`El parámetro "${missingRequired.label}" es obligatorio.`);
      return;
    }

    setIsGenerating(true);
    try {
      const data = await executeReport(report.id, executionParams);
      setResult(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo generar el reporte."));
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExportPdf() {
    if (!report) return;
    setIsExportingPdf(true);
    try {
      await downloadReportPdf(report.id, executionParams);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo exportar el PDF."));
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    if (!report) return;
    setIsExportingExcel(true);
    try {
      await downloadReportExcel(report.id, executionParams);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo exportar el Excel."));
    } finally {
      setIsExportingExcel(false);
    }
  }

  return (
    <RequireAuth moduleKey="reportes" action="read">
      <DashboardShell
        title={report?.nombre ?? "Reporte"}
        description={report?.descripcion ?? "Configura los parámetros y genera el reporte."}
      >
        <div className="flex flex-col gap-6">
          <Button variant="ghost" className="w-fit" onClick={() => router.push("/reports")}>
            <ArrowLeft className="mr-2 size-4" /> Volver al catálogo
          </Button>

          {isLoadingReport ? (
            <ReportResultsSkeleton />
          ) : !report ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Este reporte no existe o no tienes permisos para consultarlo.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="p-4">
                  <ReportParamForm
                    parametros={report.parametros}
                    values={values}
                    onChange={handleChange}
                    onSubmit={() => void handleSubmit()}
                    onClear={handleClear}
                    isSubmitting={isGenerating}
                  />
                </CardContent>
              </Card>

              {result ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {result.meta.totalRegistros} registro(s) · generado el{" "}
                      {new Date(result.meta.generadoEn).toLocaleString("es-GT")}
                    </p>
                    <div className="flex flex-wrap gap-2 print:hidden">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2 size-4" /> Imprimir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleExportPdf()} disabled={isExportingPdf}>
                        <FileText className="mr-2 size-4" /> {isExportingPdf ? "Generando PDF..." : "Exportar PDF"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleExportExcel()}
                        disabled={isExportingExcel}
                      >
                        <FileSpreadsheet className="mr-2 size-4" />
                        {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
                      </Button>
                    </div>
                  </div>
                  <ReportResults result={result} />
                </>
              ) : isGenerating ? (
                <ReportResultsSkeleton />
              ) : null}
            </>
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
