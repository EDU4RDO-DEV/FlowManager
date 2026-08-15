import { FileX, ReceiptText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface PurchasesEmptyStateProps {
  isEmpty: boolean;
  hasFilters: boolean;
  isTrash?: boolean;
  entityLabel?: string;
}

export function PurchasesEmptyState({
  isEmpty,
  hasFilters,
  isTrash = false,
  entityLabel = "compras",
}: PurchasesEmptyStateProps) {
  if (!isEmpty && hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileX className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No se encontraron {entityLabel} con los filtros aplicados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <ReceiptText className="h-16 w-16 text-muted-foreground/50" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isTrash
            ? `No hay ${entityLabel} anulados`
            : `No hay ${entityLabel} registrados. Crea el primero usando el botón de arriba`}
        </p>
      </CardContent>
    </Card>
  );
}
