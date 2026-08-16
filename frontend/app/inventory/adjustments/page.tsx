"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AdjustmentEmptyState } from "@/app/inventory/adjustments/_components/adjustment-empty-state";
import { TableSkeleton } from "@/app/inventory/adjustments/_components/adjustment-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteAdjustment,
  listAdjustments,
  listAnulatedAdjustments,
  restoreAdjustment,
} from "@/services/adjustments.service";
import type { AdjustmentDto } from "@/types/adjustments";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function AdjustmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeAdjustments, setActiveAdjustments] = useState<AdjustmentDto[]>([]);
  const [anulatedAdjustments, setAnulatedAdjustments] = useState<AdjustmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"" | "ENTRADA" | "SALIDA">("");
  const [deleteCandidate, setDeleteCandidate] = useState<AdjustmentDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activeResult, anulatedResult] = await Promise.all([
        listAdjustments({ anulado: false }),
        listAnulatedAdjustments(),
      ]);

      setActiveAdjustments(activeResult.items);
      setAnulatedAdjustments(anulatedResult);
      setHasLoadedOnce(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar los ajustes de inventario"));
    } finally {
      setIsLoading(false);
    }
  }

  const filteredActiveAdjustments = useMemo(() => {
    return activeAdjustments.filter((adj) => {
      const matchesQuery =
        query.trim() === "" ||
        adj.inventarioItem.nombre.toLowerCase().includes(query.toLowerCase()) ||
        adj.numeroAjuste.toString().includes(query);
      const matchesTipo = tipoFilter === "" || adj.tipoAjuste === tipoFilter;
      return matchesQuery && matchesTipo;
    });
  }, [activeAdjustments, query, tipoFilter]);

  const filteredAnulatedAdjustments = useMemo(() => {
    return anulatedAdjustments.filter((adj) => {
      const matchesQuery =
        query.trim() === "" ||
        adj.inventarioItem.nombre.toLowerCase().includes(query.toLowerCase()) ||
        adj.numeroAjuste.toString().includes(query);
      const matchesTipo = tipoFilter === "" || adj.tipoAjuste === tipoFilter;
      return matchesQuery && matchesTipo;
    });
  }, [anulatedAdjustments, query, tipoFilter]);

  async function confirmDeleteAdjustment(adj: AdjustmentDto) {
    if (!user) return;

    try {
      setIsDeleting(true);
      await deleteAdjustment(adj.id);
      toast.success("Ajuste anulado exitosamente");

      // Mover de activos a anulados sin reload
      setActiveAdjustments((prev) => prev.filter((item) => item.id !== adj.id));
      setAnulatedAdjustments((prev) => [
        {
          ...adj,
          anulado: true,
          idUsuarioAnulador: user.id,
          fechaAnulacion: new Date().toISOString(),
        },
        ...prev,
      ]);
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el ajuste"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreAdjustmentFromTrash(adj: AdjustmentDto) {
    if (!user) return;

    try {
      await restoreAdjustment(adj.id);
      toast.success("Ajuste restaurado exitosamente");

      // Mover de anulados a activos sin reload
      setAnulatedAdjustments((prev) => prev.filter((item) => item.id !== adj.id));
      setActiveAdjustments((prev) => [
        {
          ...adj,
          anulado: false,
          idUsuarioAnulador: null,
          fechaAnulacion: null,
        },
        ...prev,
      ]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el ajuste"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Ajustes de Inventario"
        description="Gestiona entradas y salidas por ajustes de existencias"
      >
        <Tabs defaultValue="activos">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="activos">
                Activos ({filteredActiveAdjustments.length})
              </TabsTrigger>
              <TabsTrigger value="anulados">
                Anulados ({filteredAnulatedAdjustments.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="busqueda" className="whitespace-nowrap text-sm">
                  Buscar:
                </Label>
                <Input
                  id="busqueda"
                  placeholder="Producto o número"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
                  onChange={(e) => setTipoFilter(e.target.value as "" | "ENTRADA" | "SALIDA")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                </select>
              </div>

              <Button onClick={() => router.push("/inventory/adjustments/create")} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Registrar Ajuste
              </Button>

              <Button variant="outline" size="icon" onClick={() => void loadData()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <TabsContent value="activos" className="mt-0">
            {isLoading && !hasLoadedOnce ? (
              <TableSkeleton />
            ) : filteredActiveAdjustments.length === 0 ? (
              <AdjustmentEmptyState
                isEmpty={activeAdjustments.length === 0}
                hasFilters={query.trim() !== "" || tipoFilter !== ""}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Número</TableHead>
                          <TableHead className="whitespace-nowrap">Producto</TableHead>
                          <TableHead className="whitespace-nowrap">Tipo</TableHead>
                          <TableHead className="whitespace-nowrap">Cantidad</TableHead>
                          <TableHead className="whitespace-nowrap">Motivo</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActiveAdjustments.map((adj) => (
                          <TableRow key={adj.id}>
                            <TableCell className="font-mono font-medium">#{adj.numeroAjuste}</TableCell>
                            <TableCell>{adj.inventarioItem.nombre}</TableCell>
                            <TableCell>
                              <Badge
                                variant={adj.tipoAjuste === "ENTRADA" ? "default" : "destructive"}
                              >
                                {adj.tipoAjuste}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {adj.tipoAjuste === "ENTRADA" ? "+" : "-"}
                              {adj.cantidadAjustada.toFixed(2)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {adj.observacion || "-"}
                            </TableCell>
                            <TableCell>{formatDate(adj.fechaRegistro)}</TableCell>
                            <TableCell className="text-right">
                              {deleteCandidate?.id === adj.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void confirmDeleteAdjustment(adj)}
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteCandidate(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteCandidate(adj)}
                                  title="Anular ajuste"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
              <TableSkeleton />
            ) : filteredAnulatedAdjustments.length === 0 ? (
              <AdjustmentEmptyState
                isEmpty={anulatedAdjustments.length === 0}
                hasFilters={query.trim() !== "" || tipoFilter !== ""}
                isTrash
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Número</TableHead>
                          <TableHead className="whitespace-nowrap">Producto</TableHead>
                          <TableHead className="whitespace-nowrap">Tipo</TableHead>
                          <TableHead className="whitespace-nowrap">Cantidad</TableHead>
                          <TableHead className="whitespace-nowrap">Motivo</TableHead>
                          <TableHead className="whitespace-nowrap">Fecha Anulación</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAnulatedAdjustments.map((adj) => (
                          <TableRow key={adj.id} className="opacity-60">
                            <TableCell className="font-mono font-medium">#{adj.numeroAjuste}</TableCell>
                            <TableCell>{adj.inventarioItem.nombre}</TableCell>
                            <TableCell>
                              <Badge
                                variant={adj.tipoAjuste === "ENTRADA" ? "default" : "destructive"}
                              >
                                {adj.tipoAjuste}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {adj.tipoAjuste === "ENTRADA" ? "+" : "-"}
                              {adj.cantidadAjustada.toFixed(2)}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {adj.observacion || "-"}
                            </TableCell>
                            <TableCell>{formatDate(adj.fechaAnulacion)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void restoreAdjustmentFromTrash(adj)}
                                title="Restaurar ajuste"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
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
          title="Confirmar anulación de ajuste"
          description={`Esta acción anulará el ajuste ${deleteCandidate ? `#${deleteCandidate.numeroAjuste}` : "seleccionado"}.`}
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
