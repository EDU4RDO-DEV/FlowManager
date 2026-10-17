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
import { ListPagination } from "@/components/ui/list-pagination";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  getRecipeCostEstimate,
  listStructureByProduct,
  listAnulatedStructureByProduct,
  deleteProductStructure,
  restoreProductStructure,
  updateProductStructure,
  updateRecipeCostPolicy,
  applyRecipeCost,
} from "@/services/product-structure.service";
import type { ProductDto } from "@/types/products";
import type { ProductStructureDto, RecipeCostEstimateDto } from "@/types/product-structure";

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
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isSavingCostPolicy, setIsSavingCostPolicy] = useState(false);
  const [costDialogEstimate, setCostDialogEstimate] = useState<RecipeCostEstimateDto | null>(null);
  const [isApplyingRecipeCost, setIsApplyingRecipeCost] = useState(false);

  const PAGE_SIZE = 10;

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

  const paginatedActiveStructure = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return activeStructure.slice(start, start + PAGE_SIZE);
  }, [activePage, activeStructure]);

  const paginatedTrashStructure = useMemo(() => {
    const start = (trashPage - 1) * PAGE_SIZE;
    return anulatedStructure.slice(start, start + PAGE_SIZE);
  }, [anulatedStructure, trashPage]);

  const recipeCostReference = useMemo(
    () =>
      activeStructure.reduce(
        (sum, item) => sum + item.materiaPrima.costoPromedio * item.cantidadRequerida,
        0,
      ),
    [activeStructure],
  );

  useEffect(() => {
    setActivePage(1);
    setTrashPage(1);
  }, [activeStructure.length, anulatedStructure.length]);

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
      if (product?.permitirReceta && product.actualizarCostoSegunReceta) {
        await openRecipeCostConfirmation();
      }
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
      if (product?.permitirReceta && product.actualizarCostoSegunReceta) {
        await openRecipeCostConfirmation();
      }
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
      if (product?.permitirReceta && product.actualizarCostoSegunReceta) {
        await openRecipeCostConfirmation();
      }
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
      if (product?.permitirReceta && product.actualizarCostoSegunReceta) {
        await openRecipeCostConfirmation();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el componente."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function openRecipeCostConfirmation() {
    try {
      const estimate = await getRecipeCostEstimate(productId);
      if (estimate.costoActual === estimate.costoCalculado) {
        toast.info("El costo actual ya coincide con el costo calculado de la receta.");
        return;
      }
      setCostDialogEstimate(estimate);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo calcular el costo de la receta."));
    }
  }

  async function handleRecipeCostPolicyChange(enabled: boolean) {
    if (!canUpdateStructure || !product || !product.permitirReceta) {
      toast.error("No tienes permiso para cambiar la actualización de costo de la receta.");
      return;
    }

    try {
      setIsSavingCostPolicy(true);
      const persistedValue = await updateRecipeCostPolicy(productId, enabled);
      setProduct((current) =>
        current ? { ...current, actualizarCostoSegunReceta: persistedValue } : current,
      );
      toast.success(
        persistedValue
          ? "La actualización de costo según receta quedó activada."
          : "La actualización de costo según receta quedó desactivada.",
      );
      if (persistedValue && activeStructure.length > 0) {
        await openRecipeCostConfirmation();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar la preferencia de costo."));
    } finally {
      setIsSavingCostPolicy(false);
    }
  }

  async function handleApplyRecipeCost() {
    if (!costDialogEstimate) {
      return;
    }

    try {
      setIsApplyingRecipeCost(true);
      await applyRecipeCost(productId, costDialogEstimate);
      setCostDialogEstimate(null);
      toast.success("El costo promedio del producto se actualizó según su receta.");
      await loadData();
    } catch (err) {
      setCostDialogEstimate(null);
      toast.error(getApiErrorMessage(err, "No se pudo actualizar el costo del producto."));
      await loadData();
    } finally {
      setIsApplyingRecipeCost(false);
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
            {product?.nombre ?? `Producto #${productId}`}
          </h2>
          <p className="text-sm text-muted-foreground">
          Receta del producto · {activeStructure.length + anulatedStructure.length} componentes
          </p>
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
        <Card className="module-page-card">
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
        <>
        {product?.permitirReceta ? (
          <Card className="module-page-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Costo según receta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={product.actualizarCostoSegunReceta}
                  onChange={(event) =>
                    void handleRecipeCostPolicyChange(event.currentTarget.checked)
                  }
                  disabled={!canUpdateStructure || isSavingCostPolicy}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    Actualizar costo del producto según su receta
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Costo estimado actual: Q{recipeCostReference.toFixed(2)}. El costo vigente es Q
                    {product.costoPromedio.toFixed(2)}. El costo solo cambiará después de tu confirmación.
                  </span>
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {product.actualizarCostoSegunReceta
                    ? "Al cambiar componentes se solicitará confirmar el nuevo costo. También puedes revisarlo ahora."
                    : "El cálculo es referencial; con esta opción desactivada no se sobrescribirá el costo actual."}
                </p>
                {product.actualizarCostoSegunReceta ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canUpdateStructure || isSavingCostPolicy || activeStructure.length === 0}
                    onClick={() => void openRecipeCostConfirmation()}
                  >
                    Revisar actualización
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
        <Tabs defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">Activos ({activeStructure.length})</TabsTrigger>
            <TabsTrigger value="anulados">Anulados ({anulatedStructure.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos" className="mt-4">
            {activeStructure.length === 0 ? (
              <InventoryEmptyState
                title="No hay componentes registrados"
                description="Agregue materias primas o insumos para construir la estructura BOM de este producto."
              />
            ) : (
              <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                <Card className="module-page-card">
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
                        {paginatedActiveStructure.map((item) => (
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
                <ListPagination
                  page={activePage}
                  totalItems={activeStructure.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setActivePage}
                  itemLabel="componentes"
                />
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
                <Card className="module-page-card">
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
                        {paginatedTrashStructure.map((item) => (
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
                <ListPagination
                  page={trashPage}
                  totalItems={anulatedStructure.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setTrashPage}
                  itemLabel="componentes"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
        </>
      )}

      {activeStructure.length > 0 && (
        <Card className="module-page-card">
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Costo Total de Componentes:</span>
              <span>Q{recipeCostReference.toFixed(2)}</span>
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

      <Dialog
        open={costDialogEstimate !== null}
        onOpenChange={(open) => {
          if (!open && !isApplyingRecipeCost) {
            setCostDialogEstimate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar actualización de costo</DialogTitle>
            <DialogDescription>
              {costDialogEstimate ? (
                <>
                  El costo actual de este producto es Q{costDialogEstimate.costoActual.toFixed(2)}.
                  Según los componentes y las cantidades de la receta, el costo calculado es Q
                  {costDialogEstimate.costoCalculado.toFixed(2)}. Diferencia:{" "}
                  {costDialogEstimate.diferencia >= 0 ? "+" : "-"}Q
                  {Math.abs(costDialogEstimate.diferencia).toFixed(2)}. ¿Deseas actualizar el costo
                  promedio del producto con este nuevo valor?
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {!costDialogEstimate?.puedeActualizar ? (
            <p className="text-sm text-destructive">
              {costDialogEstimate?.motivoNoActualizable}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCostDialogEstimate(null)}
              disabled={isApplyingRecipeCost}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleApplyRecipeCost()}
              disabled={
                isApplyingRecipeCost ||
                !costDialogEstimate?.puedeActualizar ||
                !canUpdateStructure
              }
            >
              {isApplyingRecipeCost ? "Actualizando..." : "Confirmar actualización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
      </DashboardShell>
    </RequireAuth>
  );
}
