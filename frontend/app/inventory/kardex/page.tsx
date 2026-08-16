"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { getApiErrorMessage } from "@/lib/api";
import {
  listAnulatedInventoryLog,
  listInventoryLog,
} from "@/services/inventory-log.service";
import type { InventoryLogItemDto } from "@/types/inventory-log";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryKardexPage() {
  const [activeMovements, setActiveMovements] = useState<InventoryLogItemDto[]>([]);
  const [anulatedMovements, setAnulatedMovements] = useState<InventoryLogItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [movementFilter, setMovementFilter] = useState<"" | "ENTRADA" | "SALIDA">("");
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);

  const PAGE_SIZE = 10;

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activeResult, trashResult] = await Promise.all([
        listInventoryLog({ anulado: false, limit: 100 }),
        listAnulatedInventoryLog(),
      ]);

      setActiveMovements(activeResult.items);
      setAnulatedMovements(trashResult);
      setHasLoadedOnce(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar la bitacora de inventario."));
    } finally {
      setIsLoading(false);
    }
  }

  const filteredActive = useMemo(() => {
    return activeMovements.filter((movement) => {
      const normalized = query.trim().toLowerCase();
      const matchesQuery =
        normalized.length === 0 ||
        movement.inventarioItem.nombre.toLowerCase().includes(normalized) ||
        movement.nombre.toLowerCase().includes(normalized) ||
        (movement.documento ?? "").toLowerCase().includes(normalized);

      const typeLabel = movement.tipoMovimiento ? "ENTRADA" : "SALIDA";
      const matchesType = movementFilter === "" || movementFilter === typeLabel;
      return matchesQuery && matchesType;
    });
  }, [activeMovements, query, movementFilter]);

  const filteredAnulated = useMemo(() => {
    return anulatedMovements.filter((movement) => {
      const normalized = query.trim().toLowerCase();
      const matchesQuery =
        normalized.length === 0 ||
        movement.inventarioItem.nombre.toLowerCase().includes(normalized) ||
        movement.nombre.toLowerCase().includes(normalized) ||
        (movement.documento ?? "").toLowerCase().includes(normalized);

      const typeLabel = movement.tipoMovimiento ? "ENTRADA" : "SALIDA";
      const matchesType = movementFilter === "" || movementFilter === typeLabel;
      return matchesQuery && matchesType;
    });
  }, [anulatedMovements, query, movementFilter]);

  const paginatedActive = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredActive.slice(start, start + PAGE_SIZE);
  }, [activePage, filteredActive]);

  const paginatedAnulated = useMemo(() => {
    const start = (trashPage - 1) * PAGE_SIZE;
    return filteredAnulated.slice(start, start + PAGE_SIZE);
  }, [filteredAnulated, trashPage]);

  useEffect(() => {
    setActivePage(1);
    setTrashPage(1);
  }, [query, movementFilter]);

  return (
    <RequireAuth moduleKey="inventario" action="read">
      <DashboardShell
        title="Bitacora / Kardex"
        description="Historial de entradas y salidas de inventario"
      >
        <div className="space-y-4">
          <Card className="module-page-card">
            <CardHeader className="flex flex-row items-center justify-end gap-4">
              <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Recargar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kardex-search">Busqueda</Label>
                  <Input
                    id="kardex-search"
                    placeholder="Producto, movimiento o documento"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kardex-type">Tipo</Label>
                  <select
                    id="kardex-type"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={movementFilter}
                    onChange={(event) =>
                      setMovementFilter(event.target.value as "" | "ENTRADA" | "SALIDA")
                    }
                  >
                    <option value="">Todos</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </select>
                </div>
              </div>

              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando movimientos...</p>
              ) : null}

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredActive.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulated.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Movimiento</TableHead>
                          <TableHead className="text-right">Exist. Anterior</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Nueva Exist.</TableHead>
                          <TableHead>Usuario</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedActive.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDate(movement.fechaRegistro)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{movement.inventarioItem.nombre}</div>
                              <div className="text-xs text-muted-foreground">
                                {movement.inventarioItem.categoria}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{movement.tipoDocumento ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                {movement.documento ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={movement.tipoMovimiento ? "default" : "destructive"}
                                className="gap-1"
                              >
                                {movement.tipoMovimiento ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5" />
                                )}
                                {movement.tipoMovimiento ? "Entrada" : "Salida"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{movement.existenciaAnterior}</TableCell>
                            <TableCell className="text-right">{movement.cantidad}</TableCell>
                            <TableCell className="text-right font-medium">
                              {movement.nuevaExistencia}
                            </TableCell>
                            <TableCell>{movement.usuario.nombre}</TableCell>
                          </TableRow>
                        ))}

                        {!isLoading && filteredActive.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                              No hay movimientos activos para mostrar.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 pb-4 pt-2">
                    <ListPagination
                      page={activePage}
                      totalItems={filteredActive.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setActivePage}
                      itemLabel="movimientos"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Movimiento</TableHead>
                          <TableHead className="text-right">Exist. Anterior</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Nueva Exist.</TableHead>
                          <TableHead>Anulacion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAnulated.map((movement) => (
                          <TableRow key={movement.id} className="opacity-70">
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDate(movement.fechaRegistro)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{movement.inventarioItem.nombre}</div>
                              <div className="text-xs text-muted-foreground">
                                {movement.inventarioItem.categoria}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{movement.tipoDocumento ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                {movement.documento ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={movement.tipoMovimiento ? "default" : "destructive"}
                                className="gap-1"
                              >
                                {movement.tipoMovimiento ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5" />
                                )}
                                {movement.tipoMovimiento ? "Entrada" : "Salida"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{movement.existenciaAnterior}</TableCell>
                            <TableCell className="text-right">{movement.cantidad}</TableCell>
                            <TableCell className="text-right font-medium">
                              {movement.nuevaExistencia}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDate(movement.fechaAnulacion)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {!isLoading && filteredAnulated.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                              No hay movimientos anulados.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 pb-4 pt-2">
                    <ListPagination
                      page={trashPage}
                      totalItems={filteredAnulated.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setTrashPage}
                      itemLabel="movimientos"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
