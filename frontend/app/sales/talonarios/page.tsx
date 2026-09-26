"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, ReceiptText, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  anulateTalonario,
  createTalonario,
  listAnulatedTalonarios,
  listTalonarios,
  restoreTalonario,
  updateTalonario,
} from "@/services/sales.service";
import type { TalonarioDto } from "@/types/sales";

type TalonarioForm = {
  nombre: string;
  correlativoInicial: string;
  correlativoFinal: string;
  ultimoUtilizado: string;
};

const EMPTY_FORM: TalonarioForm = {
  nombre: "",
  correlativoInicial: "",
  correlativoFinal: "",
  ultimoUtilizado: "",
};

export default function SalesTalonariosPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "ventas", "create");
  const canUpdate = hasModulePermission(user, "ventas", "update");
  const canDelete = hasModulePermission(user, "ventas", "delete");

  const [items, setItems] = useState<TalonarioDto[]>([]);
  const [anulatedItems, setAnulatedItems] = useState<TalonarioDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<TalonarioDto | null>(null);
  const [form, setForm] = useState<TalonarioForm>(EMPTY_FORM);

  const [deleteCandidate, setDeleteCandidate] = useState<TalonarioDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [activos, anulados] = await Promise.all([listTalonarios(), listAnulatedTalonarios()]);
      setItems(activos);
      setAnulatedItems(anulados);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar los talonarios"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredActivos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(normalized) ||
        String(item.correlativoInicial).includes(normalized) ||
        String(item.correlativoFinal).includes(normalized)
      );
    });
  }, [items, query]);

  const filteredAnulados = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return anulatedItems;
    }

    return anulatedItems.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(normalized) ||
        String(item.correlativoInicial).includes(normalized) ||
        String(item.correlativoFinal).includes(normalized)
      );
    });
  }, [anulatedItems, query]);

  const metrics = useMemo(() => {
    const total = items.length + anulatedItems.length;
    const activos = items.length;
    const anulados = anulatedItems.length;
    const disponibles = items.filter((item) => item.disponible).length;

    return { total, activos, anulados, disponibles };
  }, [items, anulatedItems]);

  function openCreateDialog() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditDialog(item: TalonarioDto) {
    setEditingItem(item);
    setForm({
      nombre: item.nombre,
      correlativoInicial: String(item.correlativoInicial),
      correlativoFinal: String(item.correlativoFinal),
      ultimoUtilizado: item.ultimoUtilizado !== null ? String(item.ultimoUtilizado) : "",
    });
    setIsFormOpen(true);
  }

  function validateForm(): string | null {
    if (!form.nombre.trim()) {
      return "El nombre del talonario es obligatorio";
    }

    const correlativoInicial = Number(form.correlativoInicial);
    const correlativoFinal = Number(form.correlativoFinal);

    if (!Number.isInteger(correlativoInicial) || correlativoInicial <= 0) {
      return "correlativoInicial debe ser entero positivo";
    }

    if (!Number.isInteger(correlativoFinal) || correlativoFinal <= 0) {
      return "correlativoFinal debe ser entero positivo";
    }

    if (correlativoInicial >= correlativoFinal) {
      return "correlativoInicial debe ser menor que correlativoFinal";
    }

    if (form.ultimoUtilizado.trim()) {
      const ultimoUtilizado = Number(form.ultimoUtilizado);
      if (!Number.isInteger(ultimoUtilizado) || ultimoUtilizado <= 0) {
        return "ultimoUtilizado debe ser entero positivo";
      }

      if (ultimoUtilizado < correlativoInicial - 1 || ultimoUtilizado > correlativoFinal) {
        return "ultimoUtilizado debe estar dentro del rango del talonario";
      }
    }

    return null;
  }

  async function handleSave() {
    if (!user) {
      toast.error("Usuario no autenticado");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const correlativoInicial = Number(form.correlativoInicial);
    const correlativoFinal = Number(form.correlativoFinal);
    const ultimoUtilizado = form.ultimoUtilizado.trim() ? Number(form.ultimoUtilizado) : undefined;

    setIsSaving(true);
    try {
      if (editingItem) {
        const updated = await updateTalonario(editingItem.id, {
          nombre: form.nombre.trim(),
          correlativoInicial,
          correlativoFinal,
          ...(ultimoUtilizado !== undefined ? { ultimoUtilizado } : {}),
          idUsuarioModificador: user.id,
        });

        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Talonario actualizado correctamente");
      } else {
        const created = await createTalonario({
          idUsuario: user.id,
          nombre: form.nombre.trim(),
          correlativoInicial,
          correlativoFinal,
          ...(ultimoUtilizado !== undefined ? { ultimoUtilizado } : {}),
        });

        setItems((prev) => [created, ...prev]);
        toast.success("Talonario creado correctamente");
      }

      setIsFormOpen(false);
      setEditingItem(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el talonario"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || !deleteCandidate) {
      return;
    }

    setIsDeleting(true);
    try {
      await anulateTalonario(deleteCandidate.id, { idUsuarioAnulador: user.id });

      const moved = {
        ...deleteCandidate,
        anulado: true,
      };

      setItems((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedItems((prev) => [moved, ...prev]);
      setDeleteCandidate(null);
      toast.success("Talonario anulado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el talonario"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRestore(item: TalonarioDto) {
    if (!user) {
      return;
    }

    setIsRestoring(item.id);
    try {
      const restored = await restoreTalonario(item.id, { idUsuarioModificador: user.id });

      setAnulatedItems((prev) => prev.filter((row) => row.id !== item.id));
      setItems((prev) => [restored, ...prev]);
      toast.success("Talonario restaurado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el talonario"));
    } finally {
      setIsRestoring(null);
    }
  }

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Talonarios"
        description="Gestión de talonarios y control de correlativos para ventas"
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Talonarios totales</p>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </div>
                <ReceiptText className="size-5 text-sky-600" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold">{metrics.activos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Disponibles</p>
                <p className="text-2xl font-bold">{metrics.disponibles}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Anulados</p>
                <p className="text-2xl font-bold">{metrics.anulados}</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Talonarios</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  className="w-64"
                  placeholder="Buscar por nombre o rango"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
                {canCreate ? (
                  <Button onClick={openCreateDialog}>
                    <Plus className="size-4" />
                    Nuevo
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredActivos.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulados.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <div className="rounded-lg border p-6 text-sm text-muted-foreground">Cargando talonarios...</div>
                  ) : filteredActivos.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No hay talonarios activos.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredActivos.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center"
                        >
                          <div>
                            <p className="text-xs text-muted-foreground">Nombre</p>
                            <p className="font-medium">{item.nombre}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Rango</p>
                            <p className="font-medium">{item.correlativoInicial} - {item.correlativoFinal}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Último usado</p>
                            <p className="font-medium">{item.ultimoUtilizado ?? "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Siguiente</p>
                            <p className="font-medium">{item.siguienteCorrelativo ?? "Sin disponibilidad"}</p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Badge className={item.disponible ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                              {item.disponible ? "Disponible" : "Agotado"}
                            </Badge>
                            {canUpdate ? (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                                <Pencil className="size-4" />
                                Editar
                              </Button>
                            ) : null}
                            {canDelete ? (
                              <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(item)}>
                                <Trash2 className="size-4" />
                                Anular
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <div className="rounded-lg border p-6 text-sm text-muted-foreground">Cargando talonarios anulados...</div>
                  ) : filteredAnulados.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No hay talonarios anulados.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAnulados.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center"
                        >
                          <div>
                            <p className="text-xs text-muted-foreground">Nombre</p>
                            <p className="font-medium">{item.nombre}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Rango</p>
                            <p className="font-medium">{item.correlativoInicial} - {item.correlativoFinal}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Último usado</p>
                            <p className="font-medium">{item.ultimoUtilizado ?? "-"}</p>
                          </div>
                          <div className="flex justify-end">
                            {canUpdate ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isRestoring === item.id}
                                onClick={() => void handleRestore(item)}
                              >
                                <RotateCcw className="size-4" />
                                Restaurar
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar talonario" : "Nuevo talonario"}</DialogTitle>
              <DialogDescription>
                Define rango y correlativo actual para control de comprobantes físicos.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  placeholder="Talonario principal"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="correlativoInicial">Correlativo inicial</Label>
                  <Input
                    id="correlativoInicial"
                    type="number"
                    min={1}
                    value={form.correlativoInicial}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, correlativoInicial: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correlativoFinal">Correlativo final</Label>
                  <Input
                    id="correlativoFinal"
                    type="number"
                    min={1}
                    value={form.correlativoFinal}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, correlativoFinal: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ultimoUtilizado">Último utilizado (opcional)</Label>
                <Input
                  id="ultimoUtilizado"
                  type="number"
                  min={0}
                  value={form.ultimoUtilizado}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ultimoUtilizado: event.target.value }))
                  }
                  placeholder="Ejemplo: 120"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Anular talonario"
          description={`El talonario ${deleteCandidate?.nombre ?? ""} pasará a anulados.`}
          confirmLabel="Anular"
          loading={isDeleting}
          onConfirm={handleConfirmDelete}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
