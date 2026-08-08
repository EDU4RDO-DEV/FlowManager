import { FileX, ReceiptText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface PurchasesEmptyStateProps {
  isEmpty: boolean;
  hasFilters: boolean;
  isTrash?: boolean;
}

export function PurchasesEmptyState({
  isEmpty,
  hasFilters,
  isTrash = false,
}: PurchasesEmptyStateProps) {
  if (!isEmpty && hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileX className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No se encontraron compras con los filtros aplicados
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
            ? "No hay compras anuladas"
            : "No hay compras registradas. Crea la primera usando el botón de arriba"}
        </p>
      </CardContent>
    </Card>
  );
}
