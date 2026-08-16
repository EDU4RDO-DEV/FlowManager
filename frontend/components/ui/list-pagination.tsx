"use client";

import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (nextPage: number) => void;
  itemLabel?: string;
};

export function ListPagination({
  page,
  totalItems,
  pageSize = 10,
  onPageChange,
  itemLabel = "registros",
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  if (totalItems <= pageSize) {
    return null;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Mostrando {start} - {end} de {totalItems} {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Anterior
        </Button>

        <span className="min-w-24 text-center text-xs text-muted-foreground sm:text-sm">
          Página {currentPage} de {totalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
