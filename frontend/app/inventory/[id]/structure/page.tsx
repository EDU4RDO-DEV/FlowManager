"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Plus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { getProductById, listProducts } from "@/services/products.service";
import {
  createProductStructure,
  listStructureByProduct,
  listAnulatedStructureByProduct,
  deleteProductStructure,
  restoreProductStructure,
  updateProductStructure,
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
  const [allProducts, setAllProducts] = useState<ProductDto[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editCandidate, setEditCandidate] = useState<ProductStructureDto | null>(null);
  const [editCantidad, setEditCantidad] = useState("");
  const [createMateriaPrimaId, setCreateMateriaPrimaId] = useState<number | null>(null);
  const [createCantidad, setCreateCantidad] = useState("");
  const [createComponentOpen, setCreateComponentOpen] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);

  useEffect(() => {
    void loadData();
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

      const firstProductsPage = await listProducts({ page: 1, limit: 100, anulado: false });
      let products = firstProductsPage.items;

      if (firstProductsPage.pagination.totalPages > 1) {
        const otherPages = await Promise.all(
          Array.from({ length: firstProductsPage.pagination.totalPages - 1 }, (_, idx) =>
            listProducts({ page: idx + 2, limit: 100, anulado: false }),
          ),
        );

        products = [
          ...products,
          ...otherPages.flatMap((pageResult) => pageResult.items),
        ];
      }

      setProduct(productData);
      setActiveStructure(activeItems);
      setAnulatedStructure(anulatedItems);
      setAllProducts(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      toast.error(getApiErrorMessage(err, "No se pudo cargar la estructura de producto."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  const availableProductsForCreate = useMemo(() => {
    const activeComponentIds = new Set(activeStructure.map((item) => item.idMateriaPrima));
    return allProducts.filter(
      (p) =>
        p.id !== productId &&
        ["MATERIA_PRIMA", "INSUMO"].includes(p.categoria) &&
        !activeComponentIds.has(p.id),
    );
  }, [activeStructure, allProducts, productId]);

  async function handleCreateComponent(data: { idMateriaPrima: number; cantidadRequerida: number }) {
    if (!canCreateStructure) {
      toast.error("No tienes permisos para agregar componentes.");
      return;
    }

    try {
      setIsSavingForm(true);
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
      throw err;
    } finally {
      setIsSavingForm(false);
    }
  }

  async function handleCreateInlineComponent() {
    if (!createMateriaPrimaId) {
      toast.error("Selecciona un componente.");
      return;
    }

    const cantidad = Number(createCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Cantidad requerida debe ser mayor a 0.");
      return;
    }

    await handleCreateComponent({
      idMateriaPrima: createMateriaPrimaId,
      cantidadRequerida: cantidad,
    });

    setCreateMateriaPrimaId(null);
    setCreateCantidad("");
  }

  async function handleUpdateComponent() {
    if (!editCandidate) {
      return;
    }

    if (!canUpdateStructure) {
      toast.error("No tienes permisos para editar componentes.");
      return;
    }

    const cantidad = Number(editCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Cantidad requerida debe ser mayor a 0.");
      return;
    }

    try {
      setIsSavingForm(true);
      await updateProductStructure(editCandidate.id, {
        cantidadRequerida: cantidad,
      });
      toast.success("Componente actualizado correctamente.");
      setIsFormOpen(false);
      setEditCandidate(null);
      setEditCantidad("");
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo actualizar el componente."));
    } finally {
      setIsSavingForm(false);
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
      <div className="flex justify-start">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Componentes ({activeStructure.length + anulatedStructure.length})
          </h2>
        </div>
        <Button
          onClick={() => {
            setFormMode("create");
            setEditCandidate(null);
            setEditCantidad("");
            setCreateMateriaPrimaId(null);
            setCreateCantidad("");
            setCreateComponentOpen(false);
            setIsFormOpen(true);
          }}
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

      {isFormOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              {formMode === "create" ? "Agregar componente" : "Editar componente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {formMode === "create" ? (
              <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor="create-materia-prima">Componente</Label>
                  <Popover open={createComponentOpen} onOpenChange={setCreateComponentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="create-materia-prima"
                        variant="outline"
                        role="combobox"
                        className="h-9 w-full justify-between"
                        disabled={isSavingForm || availableProductsForCreate.length === 0}
                      >
                        {createMateriaPrimaId
                          ? availableProductsForCreate.find((component) => component.id === createMateriaPrimaId)?.nombre ?? "Selecciona componente"
                          : "Selecciona componente"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre, categoría o ID..." />
                        <CommandList>
                          <CommandEmpty>No hay componentes disponibles.</CommandEmpty>
                          <CommandGroup>
                            {availableProductsForCreate.map((component) => (
                              <CommandItem
                                key={component.id}
                                value={`${component.nombre} ${component.categoria} ${component.id}`}
                                onSelect={() => {
                                  setCreateMateriaPrimaId(component.id);
                                  setCreateComponentOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    createMateriaPrimaId === component.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate">
                                  {component.nombre} (#{component.id})
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="create-cantidad-requerida">Cantidad</Label>
                  <Input
                    id="create-cantidad-requerida"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={createCantidad}
                    onChange={(event) => setCreateCantidad(event.target.value)}
                    disabled={isSavingForm}
                    className="h-9"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsFormOpen(false);
                      setCreateComponentOpen(false);
                    }}
                    disabled={isSavingForm}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateInlineComponent}
                    disabled={isSavingForm || availableProductsForCreate.length === 0}
                    className="h-9"
                  >
                    {isSavingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Agregar
                  </Button>
                </div>
              </div>
            ) : editCandidate ? (
              <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor="edit-materia-prima">Componente</Label>
                  <Button
                    id="edit-materia-prima"
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-start"
                    disabled
                  >
                    {editCandidate.materiaPrima.nombre} (#{editCandidate.materiaPrima.id})
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-cantidad-requerida">Cantidad</Label>
                  <Input
                    id="edit-cantidad-requerida"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editCantidad}
                    onChange={(event) => setEditCantidad(event.target.value)}
                    disabled={isSavingForm}
                    className="h-9"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditCandidate(null);
                      setEditCantidad("");
                    }}
                    disabled={isSavingForm}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateComponent}
                    disabled={isSavingForm}
                    className="h-9"
                  >
                    {isSavingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !product ? (
        <>
          <FormSkeleton />
          <TableSkeleton rows={6} columns={7} />
        </>
      ) : isLoading && !hasLoadedOnce ? (
        <TableSkeleton rows={6} columns={7} />
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
                                    onClick={() => {
                                      setFormMode("edit");
                                      setEditCandidate(item);
                                      setEditCantidad(item.cantidadRequerida.toString());
                                      setIsFormOpen(true);
                                    }}
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
