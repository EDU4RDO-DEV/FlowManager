import { FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ReportsEmptyStateProps = {
  message?: string;
  onReload?: () => void;
};

export function ReportsEmptyState({ message, onReload }: ReportsEmptyStateProps) {
  return (
    <Card className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="rounded-full bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <FileBarChart className="size-6" />
        </span>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          No se encontraron reportes
        </h3>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
          {message ?? "Intenta con otra búsqueda o selecciona otra categoría."}
        </p>
        {onReload ? (
          <Button variant="outline" onClick={onReload} className="mt-2">
            Recargar
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ReportResultsEmptyStateProps = {
  message?: string;
};

export function ReportResultsEmptyState({ message }: ReportResultsEmptyStateProps) {
  return (
    <Card className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No se encontraron registros para los parámetros seleccionados.
        </p>
        {message ? <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
