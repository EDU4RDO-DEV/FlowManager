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
import {
  deleteProductStructure,
  getStructureById,
} from "@/services/product-structure.service";
import type { ProductStructureDto } from "@/types/product-structure";

export default function DeleteProductStructurePage() {
  const params = useParams<{ id: string; componentId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const productId = Number(params.id);
  const componentId = Number(params.componentId);

  const [component, setComponent] = useState<ProductStructureDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadComponent() {
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(componentId) || componentId <= 0) {
        toast.error("Datos de componente invalidos");
        router.push("/inventory/structure");
        return;
      }

      setIsLoading(true);
      try {
        const data = await getStructureById(componentId);
        setComponent(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el componente."));
      } finally {
        setIsLoading(false);
      }
    }

    void loadComponent();
  }, [componentId, productId, router]);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      await deleteProductStructure(
        componentId,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      toast.success("Componente anulado correctamente.");
      router.push(`/inventory/${productId}/structure`);
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el componente."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="delete">
      <DashboardShell
        title="Anular Componente BOM"
        description="Confirmacion en pagina dedicada para anular componente de estructura."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push(`/inventory/${productId}/structure`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a estructura
          </Button>

          {isLoading ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">Cargando componente...</CardContent>
            </Card>
          ) : component ? (
            <Card className="border-red-200">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-red-700">
                  <AlertTriangle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-medium">¿Seguro que deseas anular este componente?</p>
                    <p className="text-sm">
                      {component.materiaPrima.nombre} sera movido a anulados y podras restaurarlo luego.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Componente: </span>
                    <span className="font-medium">{component.materiaPrima.nombre}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Cantidad requerida: </span>
                    <span className="font-medium">{component.cantidadRequerida}</span>
                  </p>
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/inventory/${productId}/structure`)}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Anular componente
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
