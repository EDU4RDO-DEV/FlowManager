"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { QualityEmptyState } from "@/app/quality/_components/quality-empty-state";
import {
  QualityCardsSkeleton,
  QualityTableSkeleton,
} from "@/app/quality/_components/quality-skeletons";
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
  createControlCalidad,
  deleteControlCalidad,
  listAnulatedControlCalidad,
  listControlCalidad,
  restoreControlCalidad,
  updateControlCalidad,
  validateControlCalidad,
} from "@/services/quality.service";
import type { ControlCalidadDto } from "@/types/quality";

type FormState = {
  fecha: string;
  diaNoLaborado: boolean;
  cloroAntesFiltrado: string;
  cloroDespuesFiltrado: string;
  phAntesFiltrado: string;
  phDespuesFiltrado: string;
  observaciones: string;
};

const EMPTY_FORM: FormState = {
  fecha: "",
  diaNoLaborado: false,
  cloroAntesFiltrado: "",
  cloroDespuesFiltrado: "",
  phAntesFiltrado: "",
  phDespuesFiltrado: "",
  observaciones: "",
};

export default function QualityPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "calidad", "create");
  const canUpdate = hasModulePermission(user, "calidad", "update");
  const canDelete = hasModulePermission(user, "calidad", "delete");

  const [activeItems, setActiveItems] = useState<ControlCalidadDto[]>([]);
  const [trashItems, setTrashItems] = useState<ControlCalidadDto[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ControlCalidadDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [active, trash] = await Promise.all([
        listControlCalidad({ anulado: false }),
        listAnulatedControlCalidad(),
      ]);
      setActiveItems(active);
      setTrashItems(trash);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el control de calidad"));
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
      return item.fecha.slice(0, 10).includes(normalized);
    });
  }, [activeItems, query]);

  const metrics = useMemo(() => {
    return {
      total: activeItems.length + trashItems.length,
      validados: activeItems.filter((item) => item.validado).length,
      pendientes: activeItems.filter((item) => !item.validado).length,
    };
  }, [activeItems, trashItems]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: ControlCalidadDto) {
    setEditingId(item.id);
    setForm({
      fecha: item.fecha.slice(0, 10),
      diaNoLaborado: item.diaNoLaborado,
      cloroAntesFiltrado: item.cloroAntesFiltrado !== null ? String(item.cloroAntesFiltrado) : "",
      cloroDespuesFiltrado: item.cloroDespuesFiltrado !== null ? String(item.cloroDespuesFiltrado) : "",
      phAntesFiltrado: item.phAntesFiltrado !== null ? String(item.phAntesFiltrado) : "",
      phDespuesFiltrado: item.phDespuesFiltrado !== null ? String(item.phDespuesFiltrado) : "",
      observaciones: item.observaciones ?? "",
    });
  }

  async function saveRegistro() {
    if (!user?.id) {
      toast.error("No se encontró usuario autenticado");
      return;
    }

    try {
      setIsSaving(true);

      if (editingId) {
        const updated = await updateControlCalidad(editingId, {
          diaNoLaborado: form.diaNoLaborado,
          cloroAntesFiltrado: form.cloroAntesFiltrado ? Number(form.cloroAntesFiltrado) : null,
          cloroDespuesFiltrado: form.cloroDespuesFiltrado ? Number(form.cloroDespuesFiltrado) : null,
          phAntesFiltrado: form.phAntesFiltrado ? Number(form.phAntesFiltrado) : null,
          phDespuesFiltrado: form.phDespuesFiltrado ? Number(form.phDespuesFiltrado) : null,
          observaciones: form.observaciones || null,
          idUsuarioModificador: user.id,
        });

        setActiveItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Registro actualizado correctamente");
      } else {
        const created = await createControlCalidad({
          idUsuario: user.id,
          fecha: form.fecha,
          diaNoLaborado: form.diaNoLaborado,
          cloroAntesFiltrado: form.cloroAntesFiltrado ? Number(form.cloroAntesFiltrado) : undefined,
          cloroDespuesFiltrado: form.cloroDespuesFiltrado ? Number(form.cloroDespuesFiltrado) : undefined,
          phAntesFiltrado: form.phAntesFiltrado ? Number(form.phAntesFiltrado) : undefined,
          phDespuesFiltrado: form.phDespuesFiltrado ? Number(form.phDespuesFiltrado) : undefined,
          observaciones: form.observaciones || undefined,
        });

        setActiveItems((prev) => [created, ...prev]);
        toast.success("Control de calidad registrado correctamente");
      }

      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el registro"));
    } finally {
      setIsSaving(false);
    }
  }

  async function validateRegistro(item: ControlCalidadDto) {
    if (!user?.id) return;

    try {
      const validated = await validateControlCalidad(item.id, { idUsuarioValidador: user.id });
      setActiveItems((prev) => prev.map((row) => (row.id === validated.id ? validated : row)));
      toast.success("Registro validado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo validar el registro"));
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate || !user?.id) return;

    try {
      await deleteControlCalidad(deleteCandidate.id, { idUsuarioAnulador: user.id });
      setActiveItems((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setTrashItems((prev) => [{ ...deleteCandidate, anulado: true }, ...prev]);
      toast.success("Registro anulado correctamente");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el registro"));
    }
  }

  async function restoreFromTrash(item: ControlCalidadDto) {
    if (!user?.id) return;

    try {
      const restored = await restoreControlCalidad(item.id, { idUsuarioModificador: user.id });
      setTrashItems((prev) => prev.filter((row) => row.id !== item.id));
      setActiveItems((prev) => [restored, ...prev]);
      toast.success("Registro restaurado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el registro"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Control de Calidad"
        description="Registro diario de pH y cloro del agua, antes y después de filtrado."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <QualityCardsSkeleton />
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
                  <p className="text-sm text-muted-foreground">Validados</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.validados}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Pendientes de validar</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.pendientes}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="quality-fecha">Fecha</Label>
                  <Input
                    id="quality-fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quality-cloro-antes">Cloro antes de filtrado</Label>
                  <Input
                    id="quality-cloro-antes"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cloroAntesFiltrado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cloroAntesFiltrado: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quality-cloro-despues">Cloro después de filtrado</Label>
                  <Input
                    id="quality-cloro-despues"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cloroDespuesFiltrado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cloroDespuesFiltrado: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quality-ph-antes">pH antes de filtrado</Label>
                  <Input
                    id="quality-ph-antes"
                    type="number"
                    step="0.01"
                    min="0"
                    max="14"
                    value={form.phAntesFiltrado}
                    onChange={(event) => setForm((prev) => ({ ...prev, phAntesFiltrado: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quality-ph-despues">pH después de filtrado</Label>
                  <Input
                    id="quality-ph-despues"
                    type="number"
                    step="0.01"
                    min="0"
                    max="14"
                    value={form.phDespuesFiltrado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, phDespuesFiltrado: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                  <Label htmlFor="quality-observaciones">Observaciones</Label>
                  <Input
                    id="quality-observaciones"
                    value={form.observaciones}
                    onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="quality-dia-no-laborado"
                    type="checkbox"
                    checked={form.diaNoLaborado}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, diaNoLaborado: event.target.checked }))
                    }
                  />
                  <Label htmlFor="quality-dia-no-laborado">Día no laborado</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={saveRegistro}
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
                  {editingId ? "Guardar cambios" : "Registrar control"}
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
                <Label htmlFor="search-quality">Búsqueda</Label>
                <Input
                  id="search-quality"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por fecha (YYYY-MM-DD)"
                />
              </div>

              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando registros...</p>
              ) : null}

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredActive.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({trashItems.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="space-y-4">
                  {isLoading && !hasLoadedOnce ? (
                    <QualityTableSkeleton rows={6} />
                  ) : filteredActive.length === 0 ? (
                    <QualityEmptyState
                      title="No hay registros de calidad"
                      description="Registra el control diario de pH y cloro para llevar la trazabilidad del agua."
                      actionLabel="Registrar control"
                      onAction={() => document.getElementById("quality-fecha")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cloro (antes/después)</TableHead>
                          <TableHead>pH (antes/después)</TableHead>
                          <TableHead>Validado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActive.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.fecha.slice(0, 10)}</TableCell>
                            <TableCell>
                              {item.cloroAntesFiltrado ?? "-"} / {item.cloroDespuesFiltrado ?? "-"}
                            </TableCell>
                            <TableCell>
                              {item.phAntesFiltrado ?? "-"} / {item.phDespuesFiltrado ?? "-"}
                            </TableCell>
                            <TableCell>{item.validado ? "Sí" : "No"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {!item.validado ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => validateRegistro(item)}
                                    disabled={!canUpdate}
                                  >
                                    <CheckCircle2 className="size-4" />
                                    Validar
                                  </Button>
                                ) : null}
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
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="anulados">
                  {trashItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay registros anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trashItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.fecha.slice(0, 10)}</TableCell>
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
          title="Anular registro de calidad"
          description={`¿Deseas anular el registro del ${deleteCandidate?.fecha.slice(0, 10) ?? ""}?`}
          confirmLabel="Anular"
          onConfirm={confirmDelete}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
