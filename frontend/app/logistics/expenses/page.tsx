"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
  createGastoVehiculo,
  deleteGastoVehiculo,
  listGastosVehiculo,
  listRutaSesiones,
  restoreGastoVehiculo,
  updateGastoVehiculo,
  uploadGastoVehiculoImage,
} from "@/services/logistics.service";
import { listProviders } from "@/services/providers.service";
import type { GastoEstadoPago, GastoVehiculoDto, RutaSesionDto } from "@/types/logistics";
import type { ProviderDto } from "@/types/providers";

const PAYMENT_STATES: GastoEstadoPago[] = ["PENDIENTE", "PAGADO"];

type FormState = {
  idRutaSesion: string;
  idProveedor: string;
  descripcion: string;
  monto: string;
  metodoPago: string;
  numeroVale: string;
  estadoPago: GastoEstadoPago;
  referenciaPago: string;
  rutaImagen: string;
};

const EMPTY_FORM: FormState = {
  idRutaSesion: "",
  idProveedor: "",
  descripcion: "",
  monto: "",
  metodoPago: "",
  numeroVale: "",
  estadoPago: "PAGADO",
  referenciaPago: "",
  rutaImagen: "",
};

export default function LogisticsExpensesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "logistica", "create");
  const canUpdate = hasModulePermission(user, "logistica", "update");
  const canDelete = hasModulePermission(user, "logistica", "delete");

  const [activeItems, setActiveItems] = useState<GastoVehiculoDto[]>([]);
  const [trashItems, setTrashItems] = useState<GastoVehiculoDto[]>([]);
  const [sessions, setSessions] = useState<RutaSesionDto[]>([]);
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GastoVehiculoDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [active, trash, routeSessions, providerList] = await Promise.all([
        listGastosVehiculo({ anulado: false }),
        listGastosVehiculo({ anulado: true }),
        listRutaSesiones({ anulado: false }),
        listProviders(),
      ]);

      setActiveItems(active);
      setTrashItems(trash);
      setSessions(routeSessions);
      setProviders(providerList);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar gastos de vehículo"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const metrics = useMemo(() => {
    const totalActivo = activeItems.reduce((acc, item) => acc + item.monto, 0);
    const pendientes = activeItems.filter((item) => item.estadoPago === "PENDIENTE").length;
    return {
      totalRegistros: activeItems.length + trashItems.length,
      totalActivo,
      pendientes,
    };
  }, [activeItems, trashItems]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: GastoVehiculoDto) {
    setEditingId(item.id);
    setForm({
      idRutaSesion: String(item.idRutaSesion),
      idProveedor: item.idProveedor ? String(item.idProveedor) : "",
      descripcion: item.descripcion,
      monto: String(item.monto),
      metodoPago: item.metodoPago,
      numeroVale: item.numeroVale ? String(item.numeroVale) : "",
      estadoPago: item.estadoPago,
      referenciaPago: item.referenciaPago ?? "",
      rutaImagen: item.rutaImagen ?? "",
    });
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadGastoVehiculoImage(file);
      setForm((prev) => ({ ...prev, rutaImagen: result.rutaImagen }));
      toast.success("Comprobante cargado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir el comprobante"));
    }
  }

  async function save() {
    if (!user?.id) {
      toast.error("No se encontró usuario autenticado");
      return;
    }

    try {
      setIsSaving(true);

      if (editingId) {
        const updated = await updateGastoVehiculo(editingId, {
          idRutaSesion: Number(form.idRutaSesion),
          idUsuario: user.id,
          idProveedor: form.idProveedor ? Number(form.idProveedor) : null,
          descripcion: form.descripcion,
          monto: Number(form.monto),
          metodoPago: form.metodoPago,
          numeroVale: form.numeroVale ? Number(form.numeroVale) : null,
          estadoPago: form.estadoPago,
          referenciaPago: form.referenciaPago || null,
          rutaImagen: form.rutaImagen || null,
          idUsuarioModificador: user.id,
        });

        setActiveItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Gasto actualizado correctamente");
      } else {
        const created = await createGastoVehiculo({
          idRutaSesion: Number(form.idRutaSesion),
          idUsuario: user.id,
          idProveedor: form.idProveedor ? Number(form.idProveedor) : undefined,
          descripcion: form.descripcion,
          monto: Number(form.monto),
          metodoPago: form.metodoPago,
          numeroVale: form.numeroVale ? Number(form.numeroVale) : undefined,
          estadoPago: form.estadoPago,
          referenciaPago: form.referenciaPago || undefined,
          rutaImagen: form.rutaImagen || undefined,
        });

        setActiveItems((prev) => [created, ...prev]);
        toast.success("Gasto registrado correctamente");
      }

      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el gasto"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate || !user?.id) return;

    try {
      await deleteGastoVehiculo(deleteCandidate.id, { idUsuarioAnulador: user.id });
      setActiveItems((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setTrashItems((prev) => [{ ...deleteCandidate, anulado: true }, ...prev]);
      toast.success("Gasto anulado correctamente");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el gasto"));
    }
  }

  async function restoreFromTrash(item: GastoVehiculoDto) {
    if (!user?.id) return;

    try {
      const restored = await restoreGastoVehiculo(item.id, { idUsuarioModificador: user.id });
      setTrashItems((prev) => prev.filter((row) => row.id !== item.id));
      setActiveItems((prev) => [restored, ...prev]);
      toast.success("Gasto restaurado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el gasto"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Gastos de Vehículo"
        description="Registro de gastos por sesión de ruta con control de pago y comprobantes."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <LogisticsCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Registros totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.totalRegistros}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total activo</p>
                  <p className="text-2xl font-bold tracking-tight">Q{metrics.totalActivo.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.pendientes}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recargar
            </Button>
          </div>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <h2 className="text-lg font-semibold">Registro de gasto</h2>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-session">Sesión de ruta</Label>
                  <select
                    id="expense-session"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idRutaSesion}
                    onChange={(event) => setForm((prev) => ({ ...prev, idRutaSesion: event.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    {sessions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.ruta?.nombre ?? `Ruta ${item.idRuta}`)} - {item.fechaSesion.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-provider">Proveedor</Label>
                  <select
                    id="expense-provider"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idProveedor}
                    onChange={(event) => setForm((prev) => ({ ...prev, idProveedor: event.target.value }))}
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.entidad.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-description">Descripción</Label>
                  <Input
                    id="expense-description"
                    value={form.descripcion}
                    onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-amount">Monto</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    min="0"
                    value={form.monto}
                    onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-method">Método de pago</Label>
                  <Input
                    id="expense-method"
                    value={form.metodoPago}
                    onChange={(event) => setForm((prev) => ({ ...prev, metodoPago: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-voucher">No. vale</Label>
                  <Input
                    id="expense-voucher"
                    type="number"
                    min="0"
                    value={form.numeroVale}
                    onChange={(event) => setForm((prev) => ({ ...prev, numeroVale: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-state">Estado de pago</Label>
                  <select
                    id="expense-state"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.estadoPago}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, estadoPago: event.target.value as GastoEstadoPago }))
                    }
                  >
                    {PAYMENT_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-reference">Referencia</Label>
                  <Input
                    id="expense-reference"
                    value={form.referenciaPago}
                    onChange={(event) => setForm((prev) => ({ ...prev, referenciaPago: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                  <Label htmlFor="expense-file">Comprobante</Label>
                  <Input id="expense-file" type="file" accept="image/*" onChange={uploadFile} />
                  {form.rutaImagen ? (
                    <p className="text-xs text-muted-foreground">Archivo: {form.rutaImagen}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={save}
                  disabled={!canCreate && !editingId ? true : !canUpdate && !!editingId ? true : isSaving}
                  className="bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {editingId ? "Guardar cambios" : "Registrar gasto"}
                </Button>

                {editingId ? (
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar edición
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({activeItems.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({trashItems.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos">
                  {activeItems.length === 0 ? (
                    <LogisticsEmptyState
                      title="Sin gastos registrados"
                      description="Registra gastos de combustible, peajes, vales o servicios por sesión de ruta."
                      actionLabel="Registrar gasto"
                      onAction={() => document.getElementById("expense-session")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sesión</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.rutaSesion?.ruta.nombre ?? `#${item.idRutaSesion}`}</TableCell>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell>Q{item.monto.toFixed(2)}</TableCell>
                            <TableCell>{item.estadoPago}</TableCell>
                            <TableCell>{item.proveedor?.nombre ?? "-"}</TableCell>
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
                  {trashItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay gastos anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Sesión</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trashItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell>Q{item.monto.toFixed(2)}</TableCell>
                            <TableCell>{item.rutaSesion?.ruta.nombre ?? `#${item.idRutaSesion}`}</TableCell>
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
        title="Anular gasto de vehículo"
        description="El gasto quedará fuera de reportes activos, pero podrá restaurarse."
        confirmLabel="Anular"
        cancelLabel="Cancelar"
        loading={false}
      />
    </RequireAuth>
  );
}
