"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { ProductStructureForm } from "@/app/inventory/_components/product-structure-form";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { getProductById, listProducts } from "@/services/products.service";
import {
  createProductStructure,
  listStructureByProduct,
} from "@/services/product-structure.service";
import type { ProductDto } from "@/types/products";

export default function CreateProductStructurePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const productId = Number(params.id);

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!Number.isInteger(productId) || productId <= 0) {
        toast.error("ID de producto invalido");
        router.push("/inventory/structure");
        return;
      }

      setIsLoading(true);
      try {
        const [productData, activeItems, productsData] = await Promise.all([
          getProductById(productId),
          listStructureByProduct(productId),
          listProducts({ limit: 100, anulado: false }),
        ]);

        const existingComponentIds = new Set(
          activeItems.filter((item) => !item.anulado).map((item) => item.idMateriaPrima),
        );

        setProduct(productData);
        setAvailableProducts(
          productsData.items.filter(
            (p) =>
              p.id !== productId &&
              ["MATERIA_PRIMA", "INSUMO"].includes(p.categoria) &&
              !existingComponentIds.has(p.id),
          ),
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar la estructura de producto."));
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [productId, router]);

  async function handleCreate(data: { idMateriaPrima: number; cantidadRequerida: number }) {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    try {
      setIsCreating(true);
      await createProductStructure({
        idProductoTerminado: productId,
        idMateriaPrima: data.idMateriaPrima,
        cantidadRequerida: data.cantidadRequerida,
      });

      toast.success("Componente agregado correctamente.");
      router.push(`/inventory/${productId}/structure`);
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo agregar el componente."));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="create">
      <DashboardShell
        title="Agregar Componente BOM"
        description="Pagina dedicada para agregar materia prima o insumo a la estructura."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push(`/inventory/${productId}/structure`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a estructura
          </Button>

          {isLoading ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">Cargando datos...</CardContent>
            </Card>
          ) : (
            <div className="space-y-4 rounded-xl border p-5">
              <div>
                <h2 className="text-lg font-semibold">{product?.nombre ?? "Producto"}</h2>
                <p className="text-sm text-muted-foreground">
                  Selecciona materia prima o insumo para integrarlo en la estructura.
                </p>
              </div>

              <ProductStructureForm
                availableProducts={availableProducts}
                onSubmit={handleCreate}
                onCancel={() => router.push(`/inventory/${productId}/structure`)}
                isLoading={isCreating}
              />
            </div>
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
