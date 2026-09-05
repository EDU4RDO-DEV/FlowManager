"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { LogisticsEmptyState } from "@/app/logistics/_components/logistics-empty-state";
import {
  LogisticsCardsSkeleton,
  LogisticsTableSkeleton,
} from "@/app/logistics/_components/logistics-skeletons";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
import {
  createVehiculo,
  deleteVehiculo,
  listVehiculos,
  restoreVehiculo,
  updateVehiculo,
} from "@/services/logistics.service";
import type { VehiculoDto, VehiculoEstado } from "@/types/logistics";

const VEHICLE_STATES: VehiculoEstado[] = ["DISPONIBLE", "EN_RUTA", "MANTENIMIENTO", "NO_DISPONIBLE"];

type FormState = {
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  estado: VehiculoEstado;
};

const EMPTY_FORM: FormState = {
  placa: "",
  marca: "",
  modelo: "",
  color: "",
  estado: "DISPONIBLE",
};

export default function LogisticsVehiclesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "logistica", "create");
  const canUpdate = hasModulePermission(user, "logistica", "update");
  const canDelete = hasModulePermission(user, "logistica", "delete");

  const [activeItems, setActiveItems] = useState<VehiculoDto[]>([]);
  const [trashItems, setTrashItems] = useState<VehiculoDto[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<VehiculoDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [active, trash] = await Promise.all([
        listVehiculos({ anulado: false }),
        listVehiculos({ anulado: true }),
      ]);
      setActiveItems(active);
      setTrashItems(trash);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar la gestión de vehículos"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredActive = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeItems.filter((item) => {
      if (!normalized) return true;
      return (
        item.placa.toLowerCase().includes(normalized) ||
        item.marca.toLowerCase().includes(normalized) ||
        item.modelo.toLowerCase().includes(normalized)
      );
    });
  }, [activeItems, query]);

  const filteredTrash = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return trashItems.filter((item) => {
      if (!normalized) return true;
      return (
        item.placa.toLowerCase().includes(normalized) ||
        item.marca.toLowerCase().includes(normalized) ||
        item.modelo.toLowerCase().includes(normalized)
      );
    });
  }, [trashItems, query]);

  const metrics = useMemo(() => {
    return {
      total: activeItems.length + trashItems.length,
      activos: activeItems.length,
      disponibles: activeItems.filter((item) => item.estado === "DISPONIBLE").length,
    };
  }, [activeItems, trashItems]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: VehiculoDto) {
    setEditingId(item.id);
    setForm({
      placa: item.placa,
      marca: item.marca,
      modelo: item.modelo,
      color: item.color ?? "",
      estado: item.estado,
    });
  }

  async function saveVehicle() {
    if (!user?.id) {
      toast.error("No se encontró usuario autenticado");
      return;
    }

    try {
      setIsSaving(true);
      if (editingId) {
        const updated = await updateVehiculo(editingId, {
          placa: form.placa,
          marca: form.marca,
          modelo: form.modelo,
          color: form.color || null,
          estado: form.estado,
          idUsuarioModificador: user.id,
        });

        setActiveItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Vehículo actualizado correctamente");
      } else {
        const created = await createVehiculo({
          idUsuario: user.id,
          placa: form.placa,
          marca: form.marca,
          modelo: form.modelo,
          color: form.color || undefined,
          estado: form.estado,
        });

        setActiveItems((prev) => [created, ...prev]);
        toast.success("Vehículo creado correctamente");
      }

      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el vehículo"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate || !user?.id) return;

    try {
      await deleteVehiculo(deleteCandidate.id, { idUsuarioAnulador: user.id });
      setActiveItems((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setTrashItems((prev) => [{ ...deleteCandidate, anulado: true }, ...prev]);
      toast.success("Vehículo anulado correctamente");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el vehículo"));
    }
  }

  async function restoreFromTrash(item: VehiculoDto) {
    if (!user?.id) return;

    try {
      const restored = await restoreVehiculo(item.id, { idUsuarioModificador: user.id });
      setTrashItems((prev) => prev.filter((row) => row.id !== item.id));
      setActiveItems((prev) => [restored, ...prev]);
      toast.success("Vehículo restaurado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el vehículo"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Vehículos"
        description="Administración de unidades de flota, estado operativo y disponibilidad para rutas."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <LogisticsCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 transition-opacity duration-300">
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Vehículos totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Disponibles</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.disponibles}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label htmlFor="placa">Placa</Label>
                  <Input
                    id="placa"
                    value={form.placa}
                    onChange={(event) => setForm((prev) => ({ ...prev, placa: event.target.value }))}
                    placeholder="P123ABC"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value={form.marca}
                    onChange={(event) => setForm((prev) => ({ ...prev, marca: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modelo">Modelo</Label>
                  <Input
                    id="modelo"
                    value={form.modelo}
                    onChange={(event) => setForm((prev) => ({ ...prev, modelo: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={form.color}
                    onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estado">Estado</Label>
                  <select
                    id="estado"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.estado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, estado: event.target.value as VehiculoEstado }))
                    }
                  >
                    {VEHICLE_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={saveVehicle}
                  disabled={!canCreate && !editingId ? true : !canUpdate && !!editingId ? true : isSaving}
                  className="bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {editingId ? "Guardar cambios" : "Registrar vehículo"}
                </Button>
                {editingId ? (
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar edición
                  </Button>
                ) : null}
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="search-vehicles">Búsqueda</Label>
                <Input
                  id="search-vehicles"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por placa, marca o modelo"
                />
              </div>

              {isLoading && hasLoadedOnce ? <p className="text-xs text-muted-foreground">Actualizando vehículos...</p> : null}

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredActive.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredTrash.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="space-y-4">
                  {isLoading && !hasLoadedOnce ? (
                    <LogisticsTableSkeleton rows={6} />
                  ) : filteredActive.length === 0 ? (
                    <LogisticsEmptyState
                      title="No hay vehículos registrados"
                      description="Registra una unidad para habilitar su asignación en rutas y sesiones."
                      actionLabel="Crear vehículo"
                      onAction={() => document.getElementById("placa")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Placa</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActive.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.placa}</TableCell>
                            <TableCell>{item.marca}</TableCell>
                            <TableCell>{item.modelo}</TableCell>
                            <TableCell>{item.estado}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => startEdit(item)} disabled={!canUpdate}>
                                  <Pencil className="size-4" />
                                  Editar
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(item)} disabled={!canDelete}>
                                  <Trash2 className="size-4" />
                                  Anular
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="anulados">
                  {filteredTrash.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay vehículos anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Placa</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTrash.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.placa}</TableCell>
                            <TableCell>{item.marca}</TableCell>
                            <TableCell>{item.modelo}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => restoreFromTrash(item)}
                                disabled={!canUpdate}
                              >
                                <RotateCcw className="size-4" />
                                Restaurar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>

      <ConfirmActionDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Anular vehículo"
        description="La unidad quedará fuera de asignación hasta su restauración."
        confirmLabel="Anular"
        cancelLabel="Cancelar"
        loading={false}
      />
    </RequireAuth>
  );
}
