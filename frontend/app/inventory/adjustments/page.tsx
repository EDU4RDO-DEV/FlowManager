"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
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
import { AdjustmentEmptyState } from "@/app/inventory/adjustments/_components/adjustment-empty-state";
import { AdjustmentOperationDetail } from "@/app/inventory/adjustments/_components/adjustment-operation-detail";
import { TableSkeleton } from "@/app/inventory/adjustments/_components/adjustment-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteAdjustmentOperation,
  getAdjustmentOperation,
  listAdjustmentOperations,
  restoreAdjustmentOperation,
} from "@/services/adjustments.service";
import type {
  AdjustmentOperationDetailDto,
  AdjustmentOperationDto,
  AdjustmentOperationSummary,
} from "@/types/adjustments";

const PAGE_SIZE = 10;

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function AdjustmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeAdjustments, setActiveAdjustments] = useState<AdjustmentOperationDto[]>([]);
  const [anulatedAdjustments, setAnulatedAdjustments] = useState<AdjustmentOperationDto[]>([]);
  const [activePagination, setActivePagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [trashPagination, setTrashPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [metrics, setMetrics] = useState<AdjustmentOperationSummary>({
    total: 0,
    active: 0,
    entradas: 0,
    salidas: 0,
    mixtos: 0,
    anulados: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"" | "ENTRADA" | "SALIDA">("");
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const [deleteCandidate, setDeleteCandidate] = useState<AdjustmentOperationDto | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<AdjustmentOperationDto | null>(null);
  const [operationDetails, setOperationDetails] = useState<AdjustmentOperationDetailDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const requestSequence = useRef(0);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      const [activeResult, anulatedResult] = await Promise.all([
        listAdjustmentOperations({
          page: activePage,
          limit: PAGE_SIZE,
          busqueda: query.trim() || undefined,
          tipoAjuste: tipoFilter || undefined,
          anulado: false,
        }),
        listAdjustmentOperations({
          page: trashPage,
          limit: PAGE_SIZE,
          busqueda: query.trim() || undefined,
          tipoAjuste: tipoFilter || undefined,
          anulado: true,
        }),
      ]);

      if (requestId !== requestSequence.current) return;
      setActiveAdjustments(activeResult.items);
      setAnulatedAdjustments(anulatedResult.items);
      setActivePagination(activeResult.pagination);
      setTrashPagination(anulatedResult.pagination);
      setMetrics(activeResult.summary);
      setHasLoadedOnce(true);
    } catch (error) {
      if (requestId === requestSequence.current) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar los ajustes de inventario"));
      }
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [activePage, query, tipoFilter, trashPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadData]);

  async function confirmDeleteAdjustment(adj: AdjustmentOperationDto) {
    if (!user) return;

    try {
      setIsDeleting(true);
      await deleteAdjustmentOperation(adj.numeroAjuste);
      toast.success("Ajuste anulado exitosamente");
      setDeleteCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el ajuste"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreAdjustmentFromTrash(adj: AdjustmentOperationDto) {
    if (!user) return;

    try {
      await restoreAdjustmentOperation(adj.numeroAjuste);
      toast.success("Ajuste restaurado exitosamente");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el ajuste"));
    }
  }

  async function showOperationDetails(operation: AdjustmentOperationDto) {
    setDetailCandidate(operation);
    setOperationDetails(null);
    setIsDetailLoading(true);
    try {
      setOperationDetails(await getAdjustmentOperation(operation.numeroAjuste));
    } catch (error) {
      setDetailCandidate(null);
      toast.error(getApiErrorMessage(error, "No se pudo cargar el detalle del ajuste"));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    if (detailCandidate) {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [detailCandidate]);

  return (
    <RequireAuth>
      <DashboardShell
        title="Ajustes de Inventario"
        description="Gestiona entradas y salidas por ajustes de existencias"
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="metric-card metric-card-primary rounded-xl bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ajustes totales</p>
                  <p className="metric-number-primary text-2xl font-bold tracking-tight">{metrics.total}</p>
                </div>
                <BadgeCheck className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="metric-card metric-card-success rounded-xl bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Entradas</p>
                  <p className="metric-number-success text-2xl font-bold tracking-tight">{metrics.entradas}</p>
                </div>
                <ArrowUpCircle className="size-5 text-emerald-600" />
              </CardContent>
            </Card>

            <Card className="metric-card metric-card-warning rounded-xl bg-muted/50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Salidas</p>
                  <p className="metric-number-warning text-2xl font-bold tracking-tight">{metrics.salidas}</p>
                </div>
                <ArrowDownCircle className="size-5 text-amber-600" />
              </CardContent>
            </Card>

            <Card className="metric-card metric-card-danger rounded-xl bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Anulados</p>
                <p className="metric-number-danger mt-1 text-2xl font-bold tracking-tight">{metrics.anulados}</p>
              </CardContent>
            </Card>
          </section>

          {detailCandidate ? (
            <div ref={detailPanelRef}>
              <AdjustmentOperationDetail
                operation={detailCandidate}
                details={operationDetails}
                isLoading={isDetailLoading}
                onBack={() => {
                  setDetailCandidate(null);
                  setOperationDetails(null);
                }}
              />
            </div>
          ) : (
          <Tabs defaultValue="activos">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="activos">
                Activos ({activePagination.total})
              </TabsTrigger>
              <TabsTrigger value="anulados">
                Anulados ({trashPagination.total})
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="busqueda" className="whitespace-nowrap text-sm">
                  Buscar:
                </Label>
                <Input
                  id="busqueda"
                  placeholder="Motivo, producto o número AJU"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActivePage(1);
                    setTrashPage(1);
                  }}
                  className="max-w-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="tipo" className="whitespace-nowrap text-sm">
                  Tipo:
                </Label>
                <select
                  id="tipo"
                  value={tipoFilter}
                  onChange={(e) => {
                    setTipoFilter(e.target.value as "" | "ENTRADA" | "SALIDA");
                    setActivePage(1);
                    setTrashPage(1);
                  }}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                </select>
              </div>

              <Button onClick={() => router.push("/inventory/adjustments/create")} className="h-10 shrink-0 px-4 text-sm">
                <Plus className="mr-2 h-4 w-4" />
                Registrar Ajuste
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setIsLoading(true);
                  void loadData();
                }}
                disabled={isLoading}
                className="h-10 px-4 text-sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Recargar
              </Button>
            </div>
          </div>

          <TabsContent value="activos" className="mt-0">
            {isLoading && !hasLoadedOnce ? (
              <TableSkeleton />
            ) : activeAdjustments.length === 0 ? (
              <AdjustmentEmptyState
                isEmpty={activePagination.total === 0 && query.trim() === "" && tipoFilter === ""}
                hasFilters={query.trim() !== "" || tipoFilter !== ""}
              />
            ) : (
              <Card className="module-page-card">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Número</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha</TableHead>
                          <TableHead className="whitespace-nowrap">Motivo</TableHead>
                          <TableHead className="whitespace-nowrap">Productos</TableHead>
                          <TableHead className="whitespace-nowrap">Tipo</TableHead>
                          <TableHead className="whitespace-nowrap">Responsable</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeAdjustments.map((adj) => (
                          <TableRow key={adj.numeroAjuste}>
                            <TableCell className="font-mono font-medium">
                              AJU-{String(adj.numeroAjuste).padStart(6, "0")}
                            </TableCell>
                            <TableCell>{formatDate(adj.fechaRegistro)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              <span className="font-medium">{adj.nombreAjuste || "-"}</span>
                              {adj.observacion && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {adj.observacion}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{adj.totalProductos}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  adj.tipoAjuste === "ENTRADA"
                                    ? "default"
                                    : adj.tipoAjuste === "SALIDA"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {adj.tipoAjuste}
                              </Badge>
                            </TableCell>
                            <TableCell>{adj.responsable}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void showOperationDetails(adj)}
                                  title="Ver ajuste"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteCandidate(adj)}
                                  title="Anular ajuste completo"
                                >
                                  <Trash2 className="h-4 w-4" />
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
                      totalItems={activePagination.total}
                      pageSize={PAGE_SIZE}
                      onPageChange={setActivePage}
                      itemLabel="ajustes"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="anulados" className="mt-0">
            {isLoading && !hasLoadedOnce ? (
              <TableSkeleton />
            ) : anulatedAdjustments.length === 0 ? (
              <AdjustmentEmptyState
                isEmpty={trashPagination.total === 0 && query.trim() === "" && tipoFilter === ""}
                hasFilters={query.trim() !== "" || tipoFilter !== ""}
                isTrash
              />
            ) : (
              <Card className="module-page-card">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Número</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha</TableHead>
                          <TableHead className="whitespace-nowrap">Motivo</TableHead>
                          <TableHead className="whitespace-nowrap">Productos</TableHead>
                          <TableHead className="whitespace-nowrap">Tipo</TableHead>
                          <TableHead className="whitespace-nowrap">Responsable</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha Anulación</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anulatedAdjustments.map((adj) => (
                          <TableRow key={adj.numeroAjuste} className="opacity-70">
                            <TableCell className="font-mono font-medium">
                              AJU-{String(adj.numeroAjuste).padStart(6, "0")}
                            </TableCell>
                            <TableCell>{formatDate(adj.fechaRegistro)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              <span className="font-medium">{adj.nombreAjuste || "-"}</span>
                              {adj.observacion && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {adj.observacion}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{adj.totalProductos}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  adj.tipoAjuste === "ENTRADA"
                                    ? "default"
                                    : adj.tipoAjuste === "SALIDA"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {adj.tipoAjuste}
                              </Badge>
                            </TableCell>
                            <TableCell>{adj.responsable}</TableCell>
                            <TableCell>{formatDate(adj.fechaAnulacion)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void showOperationDetails(adj)}
                                  title="Ver ajuste"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void restoreAdjustmentFromTrash(adj)}
                                  title="Restaurar ajuste completo"
                                >
                                  <RotateCcw className="h-4 w-4" />
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
                      page={trashPage}
                      totalItems={trashPagination.total}
                      pageSize={PAGE_SIZE}
                      onPageChange={setTrashPage}
                      itemLabel="ajustes"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          </Tabs>
          )}
        </div>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de ajuste"
          description={`Esta acción anulará todas las líneas del ajuste ${deleteCandidate ? `AJU-${String(deleteCandidate.numeroAjuste).padStart(6, "0")}` : "seleccionado"} y revertirá sus existencias.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={async () => {
            if (deleteCandidate) {
              await confirmDeleteAdjustment(deleteCandidate);
            }
          }}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
