import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SessionsEmptyStateProps = {
  mode?: "activas" | "anuladas";
  onReload?: () => void;
};

export function SessionsEmptyState({ mode = "activas", onReload }: SessionsEmptyStateProps) {
  const isAnulatedMode = mode === "anuladas";

  return (
    <Card className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="rounded-full bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <History className="size-6" />
        </span>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {isAnulatedMode ? "No hay sesiones anuladas" : "No hay sesiones activas"}
        </h3>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
          {isAnulatedMode
            ? "Las sesiones anuladas apareceran aqui para restaurarlas cuando sea necesario."
            : "Cuando existan sesiones operativas activas, se listaran en esta vista."}
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
