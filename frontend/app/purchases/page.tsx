"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { PurchasesEmptyState } from "@/app/purchases/_components/purchases-empty-state";
import { PurchasesTableSkeleton } from "@/app/purchases/_components/purchases-skeletons";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { listProviders } from "@/services/providers.service";
import {
  anulatePurchase,
  listPurchases,
  restorePurchase,
} from "@/services/purchases.service";
import type { ProviderDto } from "@/types/providers";
import type { PurchaseDto } from "@/types/purchases";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PurchasesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const isGastosView = pathname === "/purchases/gastos";
  const { user } = useAuth();
  const canDeletePurchases = hasModulePermission(user, "compras", "delete");
  const canUpdatePurchases = hasModulePermission(user, "compras", "update");
  const [activePurchases, setActivePurchases] = useState<PurchaseDto[]>([]);
  const [anulatedPurchases, setAnulatedPurchases] = useState<PurchaseDto[]>([]);
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [idProveedor, setIdProveedor] = useState<number | "">("");
  const [deleteCandidate, setDeleteCandidate] = useState<PurchaseDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void loadData();
  }, [isGastosView]);

  async function loadData() {
    setIsLoading(true);
    try {
      const baseFilters = {
        limit: 100,
        ...(query.trim() ? { busqueda: query.trim() } : {}),
        ...(idProveedor !== "" ? { idProveedor } : {}),
        esGasto: isGastosView,
      };

      const [providersList, activeResult, anulatedResult] = await Promise.all([
        listProviders(),
        listPurchases({ ...baseFilters, anulado: false }),
        listPurchases({ ...baseFilters, anulado: true }),
      ]);

      setProviders(providersList);
      setActivePurchases(activeResult.items);
      setAnulatedPurchases(anulatedResult.items);
      setHasLoadedOnce(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar las compras"));
    } finally {
      setIsLoading(false);
    }
  }

  const hasFilters = query.trim().length > 0 || idProveedor !== "";

  const sortedActivePurchases = useMemo(
    () => [...activePurchases].sort((a, b) => b.id - a.id),
    [activePurchases],
  );

  const sortedAnulatedPurchases = useMemo(
    () => [...anulatedPurchases].sort((a, b) => b.id - a.id),
    [anulatedPurchases],
  );

  async function confirmDeletePurchase(purchase: PurchaseDto) {
    if (!canDeletePurchases) {
      toast.error("No tienes permisos para anular compras");
      return;
    }

    try {
      setIsDeleting(true);
      await anulatePurchase(
        purchase.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      setActivePurchases((prev) => prev.filter((item) => item.id !== purchase.id));
      setAnulatedPurchases((prev) => [
        {
          ...purchase,
          anulado: true,
          idUsuarioAnulador: user?.id ?? purchase.idUsuarioAnulador,
          fechaAnulacion: new Date().toISOString(),
        },
        ...prev,
      ]);
      setDeleteCandidate(null);
      toast.success("Compra anulada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la compra"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restorePurchaseFromTrash(purchase: PurchaseDto) {
    if (!canUpdatePurchases) {
      toast.error("No tienes permisos para restaurar compras");
      return;
    }

    try {
      const restored = await restorePurchase(
        purchase.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );

      setAnulatedPurchases((prev) => prev.filter((item) => item.id !== purchase.id));
      setActivePurchases((prev) => [restored, ...prev]);
      toast.success("Compra restaurada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar la compra"));
    }
  }

  return (
    <RequireAuth moduleKey="compras" action="read">
      <DashboardShell
        title={isGastosView ? "Administración de Gastos de Compra" : "Administración de Compras"}
        description={
          isGastosView
            ? "Controla gastos de compra y su estado de anulación"
            : "Controla compras de inventario y su estado de anulación"
        }
      >
        <Tabs defaultValue="activos">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="activos">Activos ({sortedActivePurchases.length})</TabsTrigger>
              <TabsTrigger value="anulados">Anulados ({sortedAnulatedPurchases.length})</TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="purchases-search" className="text-xs text-muted-foreground">
                  Búsqueda
                </Label>
                <Input
                  id="purchases-search"
                  placeholder={isGastosView ? "Factura o proveedor de gasto" : "Factura o proveedor"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-56"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="purchases-provider" className="text-xs text-muted-foreground">
                  Proveedor
                </Label>
                <select
                  id="purchases-provider"
                  className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
                  value={idProveedor === "" ? "" : String(idProveedor)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIdProveedor(value ? Number(value) : "");
                  }}
                >
                  <option value="">Todos</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Recargar
              </Button>

              <Button
                onClick={() =>
                  router.push(isGastosView ? "/purchases/gastos/create" : "/purchases/create")
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                {isGastosView ? "Nuevo Gasto" : "Nueva Compra"}
              </Button>
            </div>
          </div>

          <TabsContent value="activos" className="mt-0">
            {isLoading && !hasLoadedOnce ? (
              <PurchasesTableSkeleton />
            ) : sortedActivePurchases.length === 0 ? (
                <PurchasesEmptyState
                isEmpty={activePurchases.length === 0}
                hasFilters={hasFilters}
                  entityLabel={isGastosView ? "gastos" : "compras"}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isGastosView ? "# Gasto" : "# Compra"}</TableHead>
                          <TableHead>Factura</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Fecha Factura</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedActivePurchases.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="font-mono">#{purchase.numeroCompra}</TableCell>
                            <TableCell>{purchase.numeroFactura}</TableCell>
                            <TableCell>{purchase.proveedor.nombre}</TableCell>
                            <TableCell>
                              <Badge variant={purchase.esGasto ? "secondary" : "default"}>
                                {purchase.esGasto ? "Gasto" : "Compra"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(purchase.fechaFactura)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(purchase.totalGeneral)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => router.push(`/purchases/${purchase.id}`)}
                                  title="Ver detalle"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canDeletePurchases ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteCandidate(purchase)}
                                    title={isGastosView ? "Anular gasto" : "Anular compra"}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="anulados" className="mt-0">
            {isLoading && !hasLoadedOnce ? (
              <PurchasesTableSkeleton />
            ) : sortedAnulatedPurchases.length === 0 ? (
              <PurchasesEmptyState
                isEmpty={anulatedPurchases.length === 0}
                hasFilters={hasFilters}
                isTrash
                entityLabel={isGastosView ? "gastos" : "compras"}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isGastosView ? "# Gasto" : "# Compra"}</TableHead>
                          <TableHead>Factura</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Fecha Factura</TableHead>
                          <TableHead>Anulación</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedAnulatedPurchases.map((purchase) => (
                          <TableRow key={purchase.id} className="opacity-65">
                            <TableCell className="font-mono">#{purchase.numeroCompra}</TableCell>
                            <TableCell>{purchase.numeroFactura}</TableCell>
                            <TableCell>{purchase.proveedor.nombre}</TableCell>
                            <TableCell>
                              <Badge variant={purchase.esGasto ? "secondary" : "default"}>
                                {purchase.esGasto ? "Gasto" : "Compra"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(purchase.fechaFactura)}</TableCell>
                            <TableCell>{formatDate(purchase.fechaAnulacion)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(purchase.totalGeneral)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => router.push(`/purchases/${purchase.id}`)}
                                  title="Ver detalle"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canUpdatePurchases ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void restorePurchaseFromTrash(purchase)}
                                    title={isGastosView ? "Restaurar gasto" : "Restaurar compra"}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title={isGastosView ? "Confirmar anulación de gasto" : "Confirmar anulación de compra"}
          description={`Esta acción moverá ${isGastosView ? "el gasto" : "la compra"} ${
            deleteCandidate ? `#${deleteCandidate.numeroCompra}` : ""
          } a anulados.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={async () => {
            if (deleteCandidate) {
              await confirmDeletePurchase(deleteCandidate);
            }
          }}
        />

      </DashboardShell>
    </RequireAuth>
  );
}
