"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  ListTree,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { deleteProduct, listProducts } from "@/services/products.service";
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

type CategoryFilter = "" | "PRODUCTO_TERMINADO" | "MATERIA_PRIMA" | "INSUMO" | "ENVASE";

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("");
  const [deleteCandidate, setDeleteCandidate] = useState<ProductDto | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const response = await listProducts({
        page: 1,
        limit: 100,
        ...(query.trim() ? { busqueda: query.trim() } : {}),
        ...(category ? { categoria: category } : {}),
      });
      setProducts(response.items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el catalogo de productos."));
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const total = products.length;
    const activos = products.filter((item) => !item.anulado).length;
    const sinExistencia = products.filter((item) => item.existencia <= 0).length;
    const finales = products.filter((item) => item.esProductoFinal).length;
    return { total, activos, sinExistencia, finales };
  }, [products]);

  async function confirmDeleteProduct() {
    if (!deleteCandidate) return;

    try {
      await deleteProduct(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      toast.success("Producto anulado correctamente.");
      setDeleteCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el producto."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Inventario"
        description="Catalogo maestro de productos, costos, precios y existencias."
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  disabled={loading}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
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
                    <option value="ENVASE">ENVASE</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadData}
                      disabled={loading}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      Aplicar filtros
                    </Button>
                    <p className="self-center text-xs text-muted-foreground">
                      Usa Recargar o Aplicar filtros para consultar productos.
                    </p>
                  </div>
                </div>
              </div>

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
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          No hay productos para mostrar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{product.id}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{product.nombre}</span>
                              {product.esProductoFinal ? (
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
                          <TableCell>{formatMoney(product.precioVenta)}</TableCell>
                          <TableCell>{formatDate(product.fechaRegistro)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {product.esProductoFinal && (
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {deleteCandidate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Confirmar anulacion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta accion anulara el producto <span className="font-medium text-foreground">{deleteCandidate.nombre}</span>.
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteProduct}>
                  Confirmar
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DashboardShell>
    </RequireAuth>
  );
}
