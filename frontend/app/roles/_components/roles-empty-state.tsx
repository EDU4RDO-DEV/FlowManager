import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RolesEmptyStateProps = {
  onReload?: () => void;
};

export function RolesEmptyState({ onReload }: RolesEmptyStateProps) {
  return (
    <Card className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="rounded-full bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <ShieldCheck className="size-6" />
        </span>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          No hay roles para mostrar
        </h3>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
          Cree perfiles de acceso para organizar permisos por modulo y mejorar el control operativo.
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
