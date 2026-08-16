"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import {
  getStructureById,
  updateProductStructure,
} from "@/services/product-structure.service";
import type { ProductStructureDto } from "@/types/product-structure";

export default function EditProductStructurePage() {
  const params = useParams<{ id: string; componentId: string }>();
  const router = useRouter();

  const productId = Number(params.id);
  const componentId = Number(params.componentId);

  const [component, setComponent] = useState<ProductStructureDto | null>(null);
  const [cantidadRequerida, setCantidadRequerida] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        setCantidadRequerida(data.cantidadRequerida.toString());
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el componente."));
      } finally {
        setIsLoading(false);
      }
    }

    void loadComponent();
  }, [componentId, productId, router]);

  async function handleSave() {
    const cantidad = Number(cantidadRequerida);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Cantidad requerida debe ser mayor a 0.");
      return;
    }

    try {
      setIsSaving(true);
      await updateProductStructure(componentId, {
        cantidadRequerida: cantidad,
      });
      toast.success("Cantidad actualizada correctamente.");
      router.push(`/inventory/${productId}/structure`);
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el componente."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="update">
      <DashboardShell
        title="Editar Componente BOM"
        description="Pagina dedicada para editar cantidad requerida del componente."
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
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Componente</p>
                  <p className="font-medium">{component.materiaPrima.nombre}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cantidadRequerida">Cantidad requerida</Label>
                  <Input
                    id="cantidadRequerida"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={cantidadRequerida}
                    onChange={(event) => setCantidadRequerida(event.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/inventory/${productId}/structure`)}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar cambios
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
