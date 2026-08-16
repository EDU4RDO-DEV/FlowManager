"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { deleteProduct, getProductById } from "@/services/products.service";
import type { ProductDto } from "@/types/products";

export default function DeleteProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const productId = Number(params.id);

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!Number.isInteger(productId) || productId <= 0) {
        toast.error("ID de producto invalido.");
        router.push("/inventory");
        return;
      }

      setIsLoading(true);
      try {
        const data = await getProductById(productId);
        setProduct(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el producto."));
        router.push("/inventory");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProduct();
  }, [productId, router]);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      await deleteProduct(
        productId,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      toast.success("Producto anulado correctamente.");
      router.push("/inventory");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el producto."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="delete">
      <DashboardShell
        title="Anular Producto"
        description="Confirmacion en pagina dedicada para anular un producto del inventario."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/inventory")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a inventario
          </Button>

          {isLoading ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">Cargando producto...</CardContent>
            </Card>
          ) : product ? (
            <Card className="border-red-200">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-red-700">
                  <AlertTriangle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-medium">¿Seguro que deseas anular este producto?</p>
                    <p className="text-sm">
                      {product.nombre} sera movido a anulados y podras restaurarlo despues.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Producto: </span>
                    <span className="font-medium">{product.nombre}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Categoria: </span>
                    <span className="font-medium">{product.categoria}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Existencia: </span>
                    <span className="font-medium">{product.existencia}</span>
                  </p>
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/inventory")}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Anular producto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
