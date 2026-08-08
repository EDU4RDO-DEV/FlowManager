import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InventoryEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function InventoryEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: InventoryEmptyStateProps) {
  return (
    <Card className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="rounded-full bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <PackageSearch className="size-6" />
        </span>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">{description}</p>
        {actionLabel && onAction ? (
          <Button variant="outline" onClick={onAction} className="mt-2">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
