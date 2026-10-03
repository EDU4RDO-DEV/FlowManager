"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
  createMantenimiento,
  deleteMantenimiento,
  listAnulatedMantenimientos,
  listMantenimientos,
  listVehiculos,
  restoreMantenimiento,
  updateMantenimiento,
} from "@/services/logistics.service";
import { listProviders } from "@/services/providers.service";
import type {
  EstadoMantenimiento,
  MantenimientoVehiculoDto,
  TipoMantenimiento,
  VehiculoDto,
} from "@/types/logistics";
import type { ProviderDto } from "@/types/providers";

const TIPO_MANTENIMIENTO: TipoMantenimiento[] = ["PREVENTIVO", "CORRECTIVO"];
const ESTADO_MANTENIMIENTO: EstadoMantenimiento[] = ["PROGRAMADO", "REALIZADO", "CANCELADO"];

type FormState = {
  idVehiculo: string;
  idProveedor: string;
  tipoMantenimiento: TipoMantenimiento;
  descripcion: string;
  fechaMantenimiento: string;
  costo: string;
  estado: EstadoMantenimiento;
  proximoMantenimiento: string;
  observaciones: string;
};

const EMPTY_FORM: FormState = {
  idVehiculo: "",
  idProveedor: "",
  tipoMantenimiento: "PREVENTIVO",
  descripcion: "",
  fechaMantenimiento: "",
  costo: "",
  estado: "PROGRAMADO",
  proximoMantenimiento: "",
  observaciones: "",
};

export default function LogisticsMaintenancePage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "logistica", "create");
  const canUpdate = hasModulePermission(user, "logistica", "update");
  const canDelete = hasModulePermission(user, "logistica", "delete");

  const [activeItems, setActiveItems] = useState<MantenimientoVehiculoDto[]>([]);
  const [trashItems, setTrashItems] = useState<MantenimientoVehiculoDto[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoDto[]>([]);
  const [proveedores, setProveedores] = useState<ProviderDto[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<MantenimientoVehiculoDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [active, trash, vehiculosList, proveedoresList] = await Promise.all([
        listMantenimientos(),
        listAnulatedMantenimientos(),
        listVehiculos({ anulado: false }),
        listProviders(),
      ]);
      setActiveItems(active);
      setTrashItems(trash);
      setVehiculos(vehiculosList);
      setProveedores(proveedoresList.filter((item) => !item.anulado));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el mantenimiento de vehículos"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const vehiculoById = useMemo(() => {
    const map = new Map<number, VehiculoDto>();
    vehiculos.forEach((item) => map.set(item.id, item));
    return map;
  }, [vehiculos]);

  const filteredActive = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeItems.filter((item) => {
      if (!normalized) return true;
      const placa = item.vehiculo?.placa ?? vehiculoById.get(item.idVehiculo)?.placa ?? "";
      return (
        item.descripcion.toLowerCase().includes(normalized) ||
        placa.toLowerCase().includes(normalized)
      );
    });
  }, [activeItems, query, vehiculoById]);

  const filteredTrash = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return trashItems.filter((item) => {
      if (!normalized) return true;
      return item.descripcion.toLowerCase().includes(normalized);
    });
  }, [trashItems, query]);

  const metrics = useMemo(() => {
    return {
      total: activeItems.length + trashItems.length,
      programados: activeItems.filter((item) => item.estado === "PROGRAMADO").length,
      realizados: activeItems.filter((item) => item.estado === "REALIZADO").length,
    };
  }, [activeItems, trashItems]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: MantenimientoVehiculoDto) {
    setEditingId(item.id);
    setForm({
      idVehiculo: String(item.idVehiculo),
      idProveedor: item.idProveedor ? String(item.idProveedor) : "",
      tipoMantenimiento: item.tipoMantenimiento,
      descripcion: item.descripcion,
      fechaMantenimiento: item.fechaMantenimiento.slice(0, 10),
      costo: item.costo !== null ? String(item.costo) : "",
      estado: item.estado,
      proximoMantenimiento: item.proximoMantenimiento ? item.proximoMantenimiento.slice(0, 10) : "",
      observaciones: item.observaciones ?? "",
    });
  }

  async function saveMaintenance() {
    try {
      setIsSaving(true);

      if (editingId) {
        const updated = await updateMantenimiento(editingId, {
          idProveedor: form.idProveedor ? Number(form.idProveedor) : null,
          tipoMantenimiento: form.tipoMantenimiento,
          descripcion: form.descripcion,
          fechaMantenimiento: form.fechaMantenimiento,
          costo: form.costo ? Number(form.costo) : null,
          estado: form.estado,
          proximoMantenimiento: form.proximoMantenimiento || null,
          observaciones: form.observaciones || null,
          idUsuarioModificador: user?.id,
        });

        setActiveItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Mantenimiento actualizado correctamente");
      } else {
        const created = await createMantenimiento({
          idVehiculo: Number(form.idVehiculo),
          idProveedor: form.idProveedor ? Number(form.idProveedor) : undefined,
          tipoMantenimiento: form.tipoMantenimiento,
          descripcion: form.descripcion,
          fechaMantenimiento: form.fechaMantenimiento,
          costo: form.costo ? Number(form.costo) : undefined,
          estado: form.estado,
          proximoMantenimiento: form.proximoMantenimiento || undefined,
          observaciones: form.observaciones || undefined,
        });

        setActiveItems((prev) => [created, ...prev]);
        toast.success("Mantenimiento registrado correctamente");
      }

      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el mantenimiento"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;

    try {
      await deleteMantenimiento(deleteCandidate.id, { idUsuarioAnulador: user?.id ?? 0 });
      setActiveItems((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setTrashItems((prev) => [{ ...deleteCandidate, anulado: true }, ...prev]);
      toast.success("Mantenimiento anulado correctamente");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el mantenimiento"));
    }
  }

  async function restoreFromTrash(item: MantenimientoVehiculoDto) {
    try {
      const restored = await restoreMantenimiento(item.id, { idUsuarioModificador: user?.id ?? 0 });
      setTrashItems((prev) => prev.filter((row) => row.id !== item.id));
      setActiveItems((prev) => [restored, ...prev]);
      toast.success("Mantenimiento restaurado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el mantenimiento"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Mantenimiento de Vehículos"
        description="Control de mantenimiento preventivo y correctivo de la flota."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <LogisticsCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 transition-opacity duration-300">
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Registros totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Programados</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.programados}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Realizados</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.realizados}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maint-vehiculo">Vehículo</Label>
                  <select
                    id="maint-vehiculo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idVehiculo}
                    onChange={(event) => setForm((prev) => ({ ...prev, idVehiculo: event.target.value }))}
                    disabled={!!editingId}
                  >
                    <option value="">Selecciona un vehículo</option>
                    {vehiculos.map((vehiculo) => (
                      <option key={vehiculo.id} value={vehiculo.id}>
                        {vehiculo.placa} - {vehiculo.marca} {vehiculo.modelo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-proveedor">Proveedor (opcional)</Label>
                  <select
                    id="maint-proveedor"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idProveedor}
                    onChange={(event) => setForm((prev) => ({ ...prev, idProveedor: event.target.value }))}
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-tipo">Tipo</Label>
                  <select
                    id="maint-tipo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.tipoMantenimiento}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tipoMantenimiento: event.target.value as TipoMantenimiento }))
                    }
                  >
                    {TIPO_MANTENIMIENTO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-estado">Estado</Label>
                  <select
                    id="maint-estado"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.estado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, estado: event.target.value as EstadoMantenimiento }))
                    }
                  >
                    {ESTADO_MANTENIMIENTO.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label htmlFor="maint-descripcion">Descripción</Label>
                  <Input
                    id="maint-descripcion"
                    value={form.descripcion}
                    onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    placeholder="Cambio de aceite, revisión de frenos, etc."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-fecha">Fecha de mantenimiento</Label>
                  <Input
                    id="maint-fecha"
                    type="date"
                    value={form.fechaMantenimiento}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, fechaMantenimiento: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-costo">Costo</Label>
                  <Input
                    id="maint-costo"
                    type="number"
                    min="0"
                    value={form.costo}
                    onChange={(event) => setForm((prev) => ({ ...prev, costo: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maint-proximo">Próximo mantenimiento</Label>
                  <Input
                    id="maint-proximo"
                    type="date"
                    value={form.proximoMantenimiento}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, proximoMantenimiento: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                  <Label htmlFor="maint-observaciones">Observaciones</Label>
                  <Input
                    id="maint-observaciones"
                    value={form.observaciones}
                    onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={saveMaintenance}
                  disabled={!canCreate && !editingId ? true : !canUpdate && !!editingId ? true : isSaving}
                  className="bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {editingId ? "Guardar cambios" : "Registrar mantenimiento"}
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
                <Label htmlFor="search-maintenance">Búsqueda</Label>
                <Input
                  id="search-maintenance"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por descripción o placa"
                />
              </div>

              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando mantenimientos...</p>
              ) : null}

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
                      title="No hay mantenimientos registrados"
                      description="Registra un mantenimiento preventivo o correctivo para darle seguimiento a la flota."
                      actionLabel="Registrar mantenimiento"
                      onAction={() => document.getElementById("maint-vehiculo")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehículo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActive.map((item) => {
                          const vehiculo = item.vehiculo ?? vehiculoById.get(item.idVehiculo);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {vehiculo ? `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}` : item.idVehiculo}
                              </TableCell>
                              <TableCell>{item.tipoMantenimiento}</TableCell>
                              <TableCell>{item.descripcion}</TableCell>
                              <TableCell>{item.fechaMantenimiento.slice(0, 10)}</TableCell>
                              <TableCell>{item.estado}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => startEdit(item)} disabled={!canUpdate}>
                                    <Pencil className="size-4" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setDeleteCandidate(item)}
                                    disabled={!canDelete}
                                  >
                                    <Trash2 className="size-4" />
                                    Anular
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="anulados">
                  {filteredTrash.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay mantenimientos anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTrash.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.descripcion}</TableCell>
                            <TableCell>{item.tipoMantenimiento}</TableCell>
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

        <ConfirmActionDialog
          open={!!deleteCandidate}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Anular mantenimiento"
          description={`¿Deseas anular el mantenimiento "${deleteCandidate?.descripcion ?? ""}"? Podrás restaurarlo luego desde la pestaña de anulados.`}
          confirmLabel="Anular"
          onConfirm={confirmDelete}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
