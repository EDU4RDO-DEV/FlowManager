import { FileX, PackageX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface AdjustmentEmptyStateProps {
  isEmpty: boolean;
  hasFilters: boolean;
  isTrash?: boolean;
}

export function AdjustmentEmptyState({
  isEmpty,
  hasFilters,
  isTrash = false,
}: AdjustmentEmptyStateProps) {
  if (!isEmpty && hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileX className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No se encontraron ajustes con los filtros aplicados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <PackageX className="h-16 w-16 text-muted-foreground/50" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isTrash
            ? "No hay ajustes anulados"
            : "No hay ajustes registrados. Crea el primero usando el botón de arriba"}
        </p>
      </CardContent>
    </Card>
  );
}
