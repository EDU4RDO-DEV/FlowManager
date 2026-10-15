"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Factory, Loader2, PackageCheck, Plus, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth-provider";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  cancelProductionOrder,
  confirmProductionOrder,
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  listProductionRecipes,
} from "@/services/production.service";
import type {
  ProductionOrderDetailDto,
  ProductionOrderDto,
  ProductionRecipeDto,
} from "@/types/production";

function formatQuantity(value: number): string {
  return value.toLocaleString("es-GT", { maximumFractionDigits: 6 });
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-GT");
}

function statusLabel(status: ProductionOrderDto["estado"]): string {
  if (status === "FABRICADA") return "Fabricada";
  if (status === "CANCELADA") return "Cancelada";
  return "Pendiente";
}

export default function ProductionPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProductionOrderDto[]>([]);
  const [recipes, setRecipes] = useState<ProductionRecipeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ProductionOrderDto["estado"]>("TODOS");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [confirmCandidate, setConfirmCandidate] = useState<ProductionOrderDto | null>(null);
  const [cancelCandidate, setCancelCandidate] = useState<ProductionOrderDto | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<ProductionOrderDetailDto | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);

  const canCreate = hasModulePermission(user, "produccion", "create");
  const canConfirm = hasModulePermission(user, "produccion", "update");
  const canCancel = hasModulePermission(user, "produccion", "delete");
  const canAllowNegative = hasModulePermission(user, "produccion", "allow-negative-stock");
  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [recipeItems, orderResult] = await Promise.all([
        listProductionRecipes(),
        listProductionOrders({
          page,
          limit: PAGE_SIZE,
          ...(query.trim() ? { busqueda: query.trim() } : {}),
          ...(statusFilter !== "TODOS" ? { estado: statusFilter } : {}),
        }),
      ]);
      setRecipes(recipeItems);
      setOrders(orderResult.items);
      setTotalPages(Math.max(orderResult.pagination.totalPages, 1));
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar Producción.");
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadData, query]);

  const eligibleRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.aptoParaProduccion),
    [recipes],
  );
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => String(recipe.id) === selectedProductId),
    [recipes, selectedProductId],
  );
  const productionQuantity = Number(quantity);
  const quantityIsValid = Number.isFinite(productionQuantity) && productionQuantity > 0;
  const requirements = useMemo(() => {
    if (!selectedRecipe || !quantityIsValid) return [];
    return selectedRecipe.componentes.map((component) => ({
      ...component,
      cantidadRequerida: component.cantidadPorUnidad * productionQuantity,
      saldoProyectado: component.existencia - component.cantidadPorUnidad * productionQuantity,
    }));
  }, [productionQuantity, quantityIsValid, selectedRecipe]);
  const hasShortage = requirements.some((item) => item.saldoProyectado < 0);

  async function handleCreateOrder() {
    if (!canCreate || !selectedRecipe || !selectedRecipe.aptoParaProduccion || !quantityIsValid) {
      return;
    }
    setSaving(true);
    try {
      await createProductionOrder({
        idProductoTerminado: selectedRecipe.id,
        cantidadProducir: productionQuantity,
      });
      toast.success("Orden de producción creada.");
      setQuantity("");
      setActiveTab("orders");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la orden."));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmProduction() {
    if (!confirmCandidate) return;
    const orderId = confirmCandidate.id;
    setActionOrderId(orderId);
    try {
      await confirmProductionOrder(orderId);
      toast.success(`Fabricación de la orden #${orderId} confirmada.`);
      setConfirmCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo confirmar la fabricación."));
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleCancelOrder() {
    if (!cancelCandidate) return;
    const orderId = cancelCandidate.id;
    setActionOrderId(orderId);
    try {
      await cancelProductionOrder(orderId);
      toast.success(`Orden #${orderId} cancelada.`);
      setCancelCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cancelar la orden."));
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleViewOrder(id: number) {
    setDetailLoadingId(id);
    try {
      setDetailOrder(await getProductionOrder(id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo consultar el detalle de la orden."));
    } finally {
      setDetailLoadingId(null);
    }
  }

  return (
    <RequireAuth moduleKey="produccion" action="read">
      <DashboardShell
        title="Producción"
        description="Planifica órdenes, calcula el consumo de recetas y registra la fabricación integrada con inventario."
      >
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Card className="metric-card metric-card-primary rounded-xl bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Órdenes visibles</p>
                  <p className="metric-number-primary text-2xl font-bold tracking-tight">{orders.length}</p>
                </div>
                <Factory className="size-5 text-sky-600" />
              </CardContent>
            </Card>
            <Card className="metric-card metric-card-success rounded-xl bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Recetas aptas</p>
                  <p className="metric-number-success text-2xl font-bold tracking-tight">{eligibleRecipes.length}</p>
                </div>
                <PackageCheck className="size-5 text-emerald-600" />
              </CardContent>
            </Card>
          </section>

          {loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void loadData()} className="mt-3">
                Reintentar
              </Button>
            </div>
          ) : null}

          <Tabs defaultValue="orders" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <TabsList>
                <TabsTrigger value="orders">Órdenes</TabsTrigger>
                {canCreate ? <TabsTrigger value="create">Nueva orden</TabsTrigger> : null}
              </TabsList>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="h-10">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Recargar
              </Button>
            </div>

            <TabsContent value="orders" className="space-y-4">
              <Card className="module-page-card">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="w-full space-y-1.5 sm:max-w-md">
                      <Label htmlFor="production-search">Buscar orden o producto</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="production-search"
                          value={query}
                          onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                          }}
                          placeholder="Número de orden o nombre"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="w-full space-y-1.5 sm:max-w-52">
                      <Label htmlFor="production-status">Estado</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          setStatusFilter(value as typeof statusFilter);
                          setPage(1);
                        }}
                      >
                        <SelectTrigger id="production-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODOS">Todos</SelectItem>
                          <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                          <SelectItem value="FABRICADA">Fabricadas</SelectItem>
                          <SelectItem value="CANCELADA">Canceladas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando órdenes...
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
                      <Factory className="mx-auto mb-3 size-8 text-muted-foreground" />
                      <p className="font-medium">No hay órdenes de producción</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {query.trim() ? "Prueba con otra búsqueda." : "Las órdenes creadas aparecerán aquí."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Orden</TableHead>
                            <TableHead>Producto terminado</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Receta / Consumo teórico</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs">#{order.id}</TableCell>
                              <TableCell className="font-medium">{order.productoTerminado.nombre}</TableCell>
                              <TableCell>{formatQuantity(order.cantidadProducir)} {order.unidadMedida}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {order.detalles.map((detail) => (
                                    <p key={detail.idInventarioItem} className="text-xs">
                                      {detail.nombre}: {formatQuantity(detail.cantidadRequerida)} {detail.unidadMedida}
                                    </p>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.estado === "FABRICADA" ? "default" : "outline"}>
                                  {statusLabel(order.estado)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatDate(order.fechaRegistro)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleViewOrder(order.id)}
                                    disabled={detailLoadingId === order.id}
                                  >
                                    {detailLoadingId === order.id
                                      ? <Loader2 className="mr-2 size-4 animate-spin" />
                                      : <Eye className="mr-2 size-4" />}
                                    Detalle
                                  </Button>
                                  {order.estado === "PENDIENTE" ? (
                                    <>
                                    {canConfirm ? (
                                      <Button
                                        size="sm"
                                        onClick={() => setConfirmCandidate(order)}
                                        disabled={actionOrderId === order.id}
                                      >
                                        Confirmar fabricación
                                      </Button>
                                    ) : null}
                                    {canCancel ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setCancelCandidate(order)}
                                        disabled={actionOrderId === order.id}
                                      >
                                        Cancelar
                                      </Button>
                                    ) : null}
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={loading || page <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={loading || page >= totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {canCreate ? (
              <TabsContent value="create">
                <Card className="module-page-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Crear orden de producción</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      El consumo teórico se calcula desde la receta activa, sin conversiones de unidades.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="production-product">Producto terminado con receta</Label>
                        <select
                          id="production-product"
                          value={selectedProductId}
                          onChange={(event) => setSelectedProductId(event.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          disabled={saving || eligibleRecipes.length === 0}
                        >
                          <option value="">Selecciona un producto</option>
                          {eligibleRecipes.map((recipe) => (
                            <option key={recipe.id} value={recipe.id}>
                              {recipe.nombre} — existencia {formatQuantity(recipe.existencia)} {recipe.unidadMedida}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="production-quantity">
                          Cantidad a producir{selectedRecipe?.unidadMedida ? ` (${selectedRecipe.unidadMedida})` : ""}
                        </Label>
                        <Input
                          id="production-quantity"
                          type="number"
                          min="0"
                          step="any"
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value)}
                          placeholder="Cantidad"
                          disabled={saving}
                        />
                      </div>
                    </div>

                    {selectedRecipe ? (
                      <div className="space-y-3">
                        {requirements.length > 0 ? (
                          <>
                            <div>
                              <h3 className="font-semibold">Consumo teórico de receta</h3>
                              <p className="text-sm text-muted-foreground">
                                Multiplicación directa de la receta por la cantidad solicitada.
                              </p>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Materia prima / insumo</TableHead>
                                    <TableHead>Existencia actual</TableHead>
                                    <TableHead>Requerido</TableHead>
                                    <TableHead>Saldo proyectado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {requirements.map((item) => (
                                    <TableRow key={item.idInventarioItem}>
                                      <TableCell>{item.nombre}</TableCell>
                                      <TableCell>{formatQuantity(item.existencia)} {item.unidadMedida}</TableCell>
                                      <TableCell>{formatQuantity(item.cantidadRequerida)} {item.unidadMedida}</TableCell>
                                      <TableCell className={item.saldoProyectado < 0 ? "font-semibold text-destructive" : ""}>
                                        {formatQuantity(item.saldoProyectado)} {item.unidadMedida}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {hasShortage ? (
                              <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                <p>
                                  La receta excede las existencias. La fabricación sólo podrá confirmarse con el permiso
                                  de saldo negativo y quedará sujeta a las existencias vigentes al confirmar.
                                  {!canAllowNegative ? " Este rol no tiene ese permiso." : ""}
                                </p>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Ingresa una cantidad positiva para calcular el consumo teórico.
                          </p>
                        )}
                      </div>
                    ) : loading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Cargando productos y recetas...
                      </div>
                    ) : recipes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No hay productos terminados activos para fabricar. Registra un producto terminado en Inventario
                        y define su receta.
                      </div>
                    ) : recipes.length > 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No hay productos terminados aptos. Completa la unidad del producto y la de cada materia prima
                        en Inventario, y define una receta activa.
                      </div>
                    ) : null}

                    <div className="flex justify-end">
                      <Button
                        onClick={() => void handleCreateOrder()}
                        disabled={saving || !selectedRecipe?.aptoParaProduccion || !quantityIsValid}
                      >
                        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                        Crear orden pendiente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>

        <Dialog open={confirmCandidate !== null} onOpenChange={(open) => !open && setConfirmCandidate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar fabricación</DialogTitle>
              <DialogDescription>
                La confirmación registrará el consumo de cada componente y la entrada del producto terminado en una
                sola transacción. No se pueden repetir movimientos para la misma orden.
              </DialogDescription>
            </DialogHeader>
            {confirmCandidate ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  Orden #{confirmCandidate.id}: {formatQuantity(confirmCandidate.cantidadProducir)}{" "}
                  {confirmCandidate.unidadMedida} de {confirmCandidate.productoTerminado.nombre}
                </p>
                {confirmCandidate.detalles.map((detail) => (
                  <p key={detail.idInventarioItem} className="text-muted-foreground">
                    {detail.nombre}: {formatQuantity(detail.cantidadRequerida)} {detail.unidadMedida}
                  </p>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  La API volverá a validar receta, unidades, existencias y permisos antes de mover inventario.
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmCandidate(null)} disabled={actionOrderId !== null}>
                Volver
              </Button>
              <Button onClick={() => void handleConfirmProduction()} disabled={actionOrderId !== null}>
                {actionOrderId !== null ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Confirmar y mover inventario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={detailOrder !== null} onOpenChange={(open) => !open && setDetailOrder(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de orden{detailOrder ? ` #${detailOrder.id}` : ""}</DialogTitle>
              <DialogDescription>
                Receta capturada al crear la orden y movimientos de inventario relacionados.
              </DialogDescription>
            </DialogHeader>
            {detailOrder ? (
              <div className="space-y-5">
                <section className="space-y-1 text-sm">
                  <p><span className="font-medium">Producto:</span> {detailOrder.productoTerminado.nombre}</p>
                  <p>
                    <span className="font-medium">Planificado:</span>{" "}
                    {formatQuantity(detailOrder.cantidadProducir)} {detailOrder.unidadMedida}
                  </p>
                  <p><span className="font-medium">Estado:</span> {statusLabel(detailOrder.estado)}</p>
                </section>
                <section className="space-y-2">
                  <h3 className="font-semibold">Consumo teórico capturado</h3>
                  {detailOrder.detalles.map((item) => (
                    <p key={item.idInventarioItem} className="text-sm text-muted-foreground">
                      {item.nombre}: {formatQuantity(item.cantidadRequerida)} {item.unidadMedida}
                    </p>
                  ))}
                </section>
                <section className="space-y-2">
                  <h3 className="font-semibold">Movimientos de inventario</h3>
                  {detailOrder.movimientos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta orden todavía no tiene movimientos de inventario asociados.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Artículo</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Saldo anterior</TableHead>
                            <TableHead>Saldo nuevo</TableHead>
                            <TableHead>Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailOrder.movimientos.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>
                                {movement.anulado ? "Anulado" : movement.tipo === "ENTRADA" ? "Entrada" : "Consumo"}
                              </TableCell>
                              <TableCell>{movement.nombre}</TableCell>
                              <TableCell>
                                {formatQuantity(movement.cantidad)}
                                {movement.unidadMedida ? ` ${movement.unidadMedida}` : ""}
                              </TableCell>
                              <TableCell>
                                {formatQuantity(movement.existenciaAnterior)}
                                {movement.unidadMedida ? ` ${movement.unidadMedida}` : ""}
                              </TableCell>
                              <TableCell>
                                {formatQuantity(movement.nuevaExistencia)}
                                {movement.unidadMedida ? ` ${movement.unidadMedida}` : ""}
                              </TableCell>
                              <TableCell>{formatDate(movement.fechaRegistro)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <ConfirmActionDialog
          open={cancelCandidate !== null}
          onOpenChange={(open) => !open && setCancelCandidate(null)}
          title="Cancelar orden pendiente"
          description={`Se cancelará la orden #${cancelCandidate?.id ?? ""}. Las órdenes fabricadas no se pueden cancelar desde este flujo.`}
          confirmLabel="Cancelar orden"
          loading={actionOrderId !== null}
          onConfirm={handleCancelOrder}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
