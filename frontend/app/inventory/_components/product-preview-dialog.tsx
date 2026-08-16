"use client";

import { EntityPreviewDialog } from "@/components/entity-preview-dialog";
import type { ProductDto } from "@/types/products";

type ProductPreviewDialogProps = {
  product: ProductDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export function ProductPreviewDialog({ product, open, onOpenChange }: ProductPreviewDialogProps) {
  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product?.nombre ?? "Producto"}
      subtitle={product ? `#${product.id}` : undefined}
      imagePath={product?.rutaImagen ?? null}
      fields={
        product
          ? [
              { label: "Categoria", value: product.categoria },
              { label: "Proveedor", value: product.proveedor.nombre },
              { label: "Existencia", value: String(product.existencia) },
              { label: "Costo", value: formatMoney(product.costoPromedio) },
              {
                label: "Precio",
                value:
                  product.categoria === "PRODUCTO_TERMINADO"
                    ? formatMoney(product.precioVenta)
                    : "-",
              },
              { label: "Registro", value: formatDate(product.fechaRegistro) },
            ]
          : []
      }
    />
  );
}
