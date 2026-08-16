"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  FormSkeleton,
  TableSkeleton,
} from "@/app/inventory/_components/inventory-skeletons";
import { InventoryEmptyState } from "@/app/inventory/_components/inventory-empty-state";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { getProductById } from "@/services/products.service";
import {
  listStructureByProduct,
  listAnulatedStructureByProduct,
  deleteProductStructure,
  restoreProductStructure,
} from "@/services/product-structure.service";
import type { ProductDto } from "@/types/products";
import type { ProductStructureDto } from "@/types/product-structure";

export default function ProductStructurePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const productId = Number(params.id);
  const canCreateStructure = hasModulePermission(user, "inventario", "create");
  const canUpdateStructure = hasModulePermission(user, "inventario", "update");
  const canDeleteStructure = hasModulePermission(user, "inventario", "delete");

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [activeStructure, setActiveStructure] = useState<ProductStructureDto[]>([]);
  const [anulatedStructure, setAnulatedStructure] = useState<ProductStructureDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ProductStructureDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const [productData, activeItems, anulatedItems] = await Promise.all([
        getProductById(productId),
        listStructureByProduct(productId),
        listAnulatedStructureByProduct(productId),
      ]);

      setProduct(productData);
      setActiveStructure(activeItems);
      setAnulatedStructure(anulatedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      toast.error(getApiErrorMessage(err, "No se pudo cargar la estructura de producto."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function handleRestore(component: ProductStructureDto) {
    if (!canUpdateStructure) {
      toast.error("No tienes permisos para restaurar componentes.");
      return;
    }

    try {
      const restored = await restoreProductStructure(
        component.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );

      setAnulatedStructure((prev) => prev.filter((item) => item.id !== component.id));
      setActiveStructure((prev) => [restored, ...prev]);

      toast.success("Componente restaurado correctamente.");
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo restaurar el componente."));
    }
  }

  async function handleDeleteComponent() {
    if (!deleteCandidate) {
      return;
    }

    if (!canDeleteStructure) {
      toast.error("No tienes permisos para anular componentes.");
      return;
    }

    try {
      setIsDeleting(true);
      await deleteProductStructure(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: ProductStructureDto = {
        ...deleteCandidate,
        anulado: true,
      };

      setActiveStructure((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedStructure((prev) => [movedToTrash, ...prev]);
      setDeleteCandidate(null);
      toast.success("Componente anulado correctamente.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el componente."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <RequireAuth moduleKey="inventario" action="read">
      <DashboardShell
        title="Estructura de Producto"
        description="Configura componentes y costos BOM por producto terminado"
      >
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <button
            type="button"
            onClick={() => router.push("/inventory")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-background"
          >
            Inventario
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => router.push("/inventory/structure")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-background"
          >
            Estructuras
          </button>
          <span>/</span>
          <span className="font-medium text-foreground">{product?.nombre ?? "Producto"}</span>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">Estructura de Producto</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground sm:text-base">
              {product?.nombre} - {product?.categoria}
            </p>
          </div>

          <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Componentes ({activeStructure.length + anulatedStructure.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Lista de materias primas y componentes necesarios
          </p>
        </div>
        <Button
          onClick={() => router.push(`/inventory/${productId}/structure/create`)}
          disabled={isLoading || !canCreateStructure}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar componente
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && hasLoadedOnce ? (
        <p className="text-xs text-muted-foreground">Actualizando estructura...</p>
      ) : null}

      {isLoading && !product ? (
        <>
          <FormSkeleton />
          <TableSkeleton rows={6} columns={8} />
        </>
      ) : isLoading && !hasLoadedOnce ? (
        <TableSkeleton rows={6} columns={8} />
      ) : (
        <Tabs defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">Activos ({activeStructure.length})</TabsTrigger>
            <TabsTrigger value="anulados">Anulados ({anulatedStructure.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos" className="mt-4">
            {activeStructure.length === 0 ? (
              <InventoryEmptyState
                title="No hay componentes registrados"
                description="Agregue materias primas o insumos para construir la estructura BOM de este producto terminado."
              />
            ) : (
              <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Componente</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Stock Disponible</TableHead>
                          <TableHead className="text-right">Cantidad Requerida</TableHead>
                          <TableHead className="text-right">Costo Unitario</TableHead>
                          <TableHead className="text-right">Costo Total</TableHead>
                          <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeStructure.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.materiaPrima.id}</TableCell>
                            <TableCell>{item.materiaPrima.nombre}</TableCell>
                            <TableCell>{item.materiaPrima.categoria}</TableCell>
                            <TableCell className="text-right">{item.materiaPrima.existencia}</TableCell>
                            <TableCell className="text-right">{item.cantidadRequerida}</TableCell>
                            <TableCell className="text-right">
                              Q{item.materiaPrima.costoPromedio.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              Q{(item.materiaPrima.costoPromedio * item.cantidadRequerida).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-2">
                                {canUpdateStructure ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      router.push(
                                        `/inventory/${productId}/structure/edit/${item.id}`,
                                      )
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {canDeleteStructure ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteCandidate(item)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="anulados" className="mt-4">
            {anulatedStructure.length === 0 ? (
              <InventoryEmptyState
                title="No hay componentes anulados"
                description="Cuando anules componentes de la estructura, apareceran aqui para restaurarlos."
              />
            ) : (
              <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Componente</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Stock Disponible</TableHead>
                          <TableHead className="text-right">Cantidad Requerida</TableHead>
                          <TableHead className="text-right">Costo Unitario</TableHead>
                          <TableHead className="text-right">Costo Total</TableHead>
                          <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anulatedStructure.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.materiaPrima.id}</TableCell>
                            <TableCell>{item.materiaPrima.nombre}</TableCell>
                            <TableCell>{item.materiaPrima.categoria}</TableCell>
                            <TableCell className="text-right">{item.materiaPrima.existencia}</TableCell>
                            <TableCell className="text-right">{item.cantidadRequerida}</TableCell>
                            <TableCell className="text-right">
                              Q{item.materiaPrima.costoPromedio.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              Q{(item.materiaPrima.costoPromedio * item.cantidadRequerida).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {canUpdateStructure ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleRestore(item)}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Restaurar
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {activeStructure.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Costo Total de Componentes:</span>
              <span>
                Q
                {activeStructure
                  .reduce(
                    (sum, item) =>
                      sum + item.materiaPrima.costoPromedio * item.cantidadRequerida,
                    0,
                  )
                  .toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmActionDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
          }
        }}
        title="Confirmar anulación de componente"
        description={`Esta acción moverá ${deleteCandidate?.materiaPrima.nombre ?? "el componente"} a anulados.`}
        confirmLabel={isDeleting ? "Anulando..." : "Anular"}
        loading={isDeleting}
        onConfirm={handleDeleteComponent}
      />

    </div>
      </DashboardShell>
    </RequireAuth>
  );
}
