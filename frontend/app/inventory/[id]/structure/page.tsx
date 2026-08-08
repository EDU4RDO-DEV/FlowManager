"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProductStructureForm } from "@/app/inventory/_components/product-structure-form";
import {
  FormSkeleton,
  TableSkeleton,
} from "@/app/inventory/_components/inventory-skeletons";
import { InventoryEmptyState } from "@/app/inventory/_components/inventory-empty-state";
import { getApiErrorMessage } from "@/lib/api";
import { getProductById, listProducts } from "@/services/products.service";
import {
  listStructureByProduct,
  createProductStructure,
  updateProductStructure,
  deleteProductStructure,
} from "@/services/product-structure.service";
import type { ProductDto } from "@/types/products";
import type { ProductStructureDto } from "@/types/product-structure";

export default function ProductStructurePage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [structure, setStructure] = useState<ProductStructureDto[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ProductStructureDto | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const [productData, structureData, productsData] = await Promise.all([
        getProductById(productId),
        listStructureByProduct(productId),
        listProducts({ limit: 100, anulado: false }),
      ]);

      const existingComponentIds = new Set(
        structureData.filter((item) => !item.anulado).map((item) => item.idMateriaPrima),
      );

      setProduct(productData);
      setStructure(structureData);
      setAvailableProducts(
        productsData.items.filter(
          (p) =>
            p.id !== productId &&
            ["MATERIA_PRIMA", "INSUMO", "ENVASE"].includes(p.categoria) &&
            !existingComponentIds.has(p.id),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      toast.error(getApiErrorMessage(err, "No se pudo cargar la estructura de producto."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function handleCreate(data: { idMateriaPrima: number; cantidadRequerida: number }) {
    try {
      await createProductStructure({
        idProductoTerminado: productId,
        idMateriaPrima: data.idMateriaPrima,
        cantidadRequerida: data.cantidadRequerida,
      });

      toast.success("Componente agregado correctamente.");
      setIsFormOpen(false);
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo agregar el componente."));
    }
  }

  async function handleEdit() {
    if (!selectedComponent) return;

    try {
      await updateProductStructure(selectedComponent.id, {
        cantidadRequerida: Number(editQuantity),
      });

      toast.success("Cantidad actualizada correctamente.");
      setIsEditModalOpen(false);
      setSelectedComponent(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
      toast.error(getApiErrorMessage(err, "No se pudo actualizar el componente."));
    }
  }

  async function handleDelete() {
    if (!selectedComponent) return;

    try {
      await deleteProductStructure(selectedComponent.id);
      toast.success("Componente eliminado correctamente.");
      setIsDeleteModalOpen(false);
      setSelectedComponent(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el componente."));
    }
  }

  function openEditModal(component: ProductStructureDto) {
    setSelectedComponent(component);
    setEditQuantity(component.cantidadRequerida.toString());
    setIsEditModalOpen(true);
  }

  function openDeleteModal(component: ProductStructureDto) {
    setSelectedComponent(component);
    setIsDeleteModalOpen(true);
  }

  if (isLoading && !product) {
    return (
      <div className="space-y-6">
        <FormSkeleton />
        <TableSkeleton rows={6} columns={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Estructura de Producto</h1>
          <p className="text-muted-foreground">
            {product?.nombre} - {product?.categoria}
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Componentes ({structure.length})</h2>
          <p className="text-sm text-muted-foreground">
            Lista de materias primas y componentes necesarios
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Componente
        </Button>
      </div>

      {isLoading && hasLoadedOnce ? (
        <p className="text-xs text-muted-foreground">Actualizando estructura...</p>
      ) : null}

      {isFormOpen && (
        <ProductStructureForm
          availableProducts={availableProducts}
          onSubmit={handleCreate}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {isLoading && !hasLoadedOnce ? (
        <TableSkeleton rows={6} columns={8} />
      ) : structure.length === 0 ? (
        <InventoryEmptyState
          title="No hay componentes registrados"
          description="Agregue materias primas, insumos o envases para construir la estructura BOM de este producto terminado."
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
                  {structure.map((item) => (
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(item)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
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

      {structure.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Costo Total de Componentes:</span>
              <span>
                Q
                {structure
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

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cantidad</DialogTitle>
            <DialogDescription>
              Modificar cantidad requerida de {selectedComponent?.materiaPrima.nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-quantity">Cantidad Requerida</Label>
              <Input
                id="edit-quantity"
                type="number"
                step="0.01"
                min="0.01"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar {selectedComponent?.materiaPrima.nombre} de la
              estructura? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
