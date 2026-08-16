"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  ListTree,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryEmptyState } from "@/app/inventory/_components/inventory-empty-state";
import { CardSkeleton, TableSkeleton } from "@/app/inventory/_components/inventory-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteProduct,
  listAnulatedProducts,
  listProducts,
  restoreProduct,
} from "@/services/products.service";
import type { ProductDto } from "@/types/products";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type CategoryFilter = "" | "PRODUCTO_TERMINADO" | "MATERIA_PRIMA" | "INSUMO";

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeProducts, setActiveProducts] = useState<ProductDto[]>([]);
  const [anulatedProducts, setAnulatedProducts] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("");
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const [deleteCandidate, setDeleteCandidate] = useState<ProductDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 10;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = {
        page: 1,
        limit: 100,
        ...(query.trim() ? { busqueda: query.trim() } : {}),
        ...(category ? { categoria: category } : {}),
      };

      const [activeResponse, trashItems] = await Promise.all([
        listProducts(filters),
        listAnulatedProducts(),
      ]);

      const normalizedQuery = query.trim().toLowerCase();
      const filteredTrash = trashItems.filter((item) => {
        if (normalizedQuery.length === 0) return true;
        return (
          item.nombre.toLowerCase().includes(normalizedQuery) ||
          item.proveedor.nombre.toLowerCase().includes(normalizedQuery)
        );
      });

      const filteredByCategory = category
        ? filteredTrash.filter((item) => item.categoria === category)
        : filteredTrash;

      setActiveProducts(activeResponse.items);
      setAnulatedProducts(filteredByCategory);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el catalogo de productos."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [category, query]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [loadData]);

  const metrics = useMemo(() => {
    const total = activeProducts.length + anulatedProducts.length;
    const activos = activeProducts.length;
    const sinExistencia = activeProducts.filter((item) => item.existencia <= 0).length;
    const finales = activeProducts.filter((item) => item.categoria === "PRODUCTO_TERMINADO").length;
    return { total, activos, sinExistencia, finales };
  }, [activeProducts, anulatedProducts]);

  const paginatedActiveProducts = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return activeProducts.slice(start, start + PAGE_SIZE);
  }, [activePage, activeProducts]);

  const paginatedTrashProducts = useMemo(() => {
    const start = (trashPage - 1) * PAGE_SIZE;
    return anulatedProducts.slice(start, start + PAGE_SIZE);
  }, [anulatedProducts, trashPage]);

  useEffect(() => {
    setActivePage(1);
    setTrashPage(1);
  }, [query, category]);

  async function confirmDeleteProduct() {
    if (!deleteCandidate) return;

    try {
      setIsDeleting(true);
      await deleteProduct(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: ProductDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setActiveProducts((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedProducts((prev) => [movedToTrash, ...prev]);
      toast.success("Producto anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el producto."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreProductFromTrash(candidate: ProductDto) {
    try {
      const restored = await restoreProduct(
        candidate.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );

      setAnulatedProducts((prev) => prev.filter((item) => item.id !== candidate.id));
      setActiveProducts((prev) => [restored, ...prev]);
      toast.success("Producto restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el producto."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Inventario"
        description="Catalogo maestro de productos, costos, precios y existencias."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <CardSkeleton count={4} />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 transition-opacity duration-300">
              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Productos totales</p>
                    <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                  </div>
                  <PackageSearch className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Activos</p>
                    <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                  </div>
                  <BadgeCheck className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Sin existencia</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.sinExistencia}</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Productos finales</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.finales}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de productos</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra productos terminados, materias primas e insumos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={isLoading}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors"
                >
                  <Link href="/inventory/create">
                    <Plus className="size-4" />
                    Nuevo producto
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando datos...</p>
              ) : null}

              <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="search-products">Busqueda</Label>
                  <Input
                    id="search-products"
                    placeholder="Nombre o proveedor"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-category">Categoria</Label>
                  <select
                    id="filter-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as CategoryFilter)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    <option value="">Todas</option>
                    <option value="PRODUCTO_TERMINADO">PRODUCTO_TERMINADO</option>
                    <option value="MATERIA_PRIMA">MATERIA_PRIMA</option>
                    <option value="INSUMO">INSUMO</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <p className="self-center text-xs text-muted-foreground">
                      La búsqueda y categoría se aplican automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({activeProducts.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({anulatedProducts.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <TableSkeleton rows={8} columns={9} />
                  ) : activeProducts.length === 0 ? (
                    <InventoryEmptyState
                      title="No hay productos registrados"
                      description="Agrega productos al catalogo para comenzar a gestionar inventario y estructura BOM."
                      actionLabel="Recargar"
                      onAction={loadData}
                    />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Producto</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Existencia</TableHead>
                              <TableHead>Costo</TableHead>
                              <TableHead>Precio</TableHead>
                              <TableHead>Registro</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedActiveProducts.map((product) => (
                              <TableRow key={product.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{product.id}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span>{product.nombre}</span>
                                    {product.categoria === "PRODUCTO_TERMINADO" ? (
                                      <Badge variant="secondary">Final</Badge>
                                    ) : (
                                      <Badge variant="outline">Insumo</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{product.categoria}</TableCell>
                                <TableCell>{product.proveedor.nombre}</TableCell>
                                <TableCell>{product.existencia}</TableCell>
                                <TableCell>{formatMoney(product.costoPromedio)}</TableCell>
                                <TableCell>
                                  {product.categoria === "PRODUCTO_TERMINADO"
                                    ? formatMoney(product.precioVenta)
                                    : "-"}
                                </TableCell>
                                <TableCell>{formatDate(product.fechaRegistro)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {product.categoria === "PRODUCTO_TERMINADO" && (
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        asChild
                                        className="hover:bg-muted/50 transition-colors"
                                      >
                                        <Link href={`/inventory/${product.id}/structure`}>
                                          <ListTree className="size-3.5" />
                                          BOM
                                        </Link>
                                      </Button>
                                    )}
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      asChild
                                      className="hover:bg-muted/50 transition-colors"
                                    >
                                      <Link href={`/inventory/edit/${product.id}`}>
                                        <Pencil className="size-3.5" />
                                        Editar
                                      </Link>
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="destructive"
                                      onClick={() => setDeleteCandidate(product)}
                                    >
                                      <Trash2 className="size-3.5" />
                                      Anular
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={activePage}
                          totalItems={activeProducts.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setActivePage}
                          itemLabel="productos"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <TableSkeleton rows={8} columns={8} />
                  ) : anulatedProducts.length === 0 ? (
                    <InventoryEmptyState
                      title="No hay productos anulados"
                      description="Cuando anules productos, apareceran aqui para restaurarlos cuando sea necesario."
                      actionLabel="Recargar"
                      onAction={loadData}
                    />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Producto</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Existencia</TableHead>
                              <TableHead>Costo</TableHead>
                              <TableHead>Anulacion</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedTrashProducts.map((product) => (
                              <TableRow key={product.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{product.id}</TableCell>
                                <TableCell className="font-medium">{product.nombre}</TableCell>
                                <TableCell>{product.categoria}</TableCell>
                                <TableCell>{product.proveedor.nombre}</TableCell>
                                <TableCell>{product.existencia}</TableCell>
                                <TableCell>{formatMoney(product.costoPromedio)}</TableCell>
                                <TableCell>{formatDate(product.fechaAnulacion)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreProductFromTrash(product)}
                                  >
                                    <RotateCcw className="size-3.5" />
                                    Restaurar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={trashPage}
                          totalItems={anulatedProducts.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setTrashPage}
                          itemLabel="productos"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de producto"
          description={`Esta acción moverá ${deleteCandidate?.nombre ?? "el producto"} a anulados.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={confirmDeleteProduct}
        />

      </DashboardShell>
    </RequireAuth>
  );
}
