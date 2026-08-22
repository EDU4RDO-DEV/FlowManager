"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  CommissionsCardsSkeleton,
  CommissionsTableSkeleton,
} from "@/app/commissions/_components/commissions-skeletons";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import {
  createCommissionConfig,
  createCommissionRule,
  deleteCommissionConfig,
  deleteCommissionRule,
  getCommissionConfigById,
  listAnulatedCommissionConfigs,
  listAnulatedCommissionRules,
  listCommissionConfigs,
  restoreCommissionConfig,
  restoreCommissionRule,
  updateCommissionRule,
} from "@/services/commissions.service";
import { listProducts } from "@/services/products.service";
import type { CommissionConfigDto, CommissionRuleDto, CommissionRuleType } from "@/types/commissions";

type ProductOption = { id: number; nombre: string };

type RuleFormState = {
  idInventarioItem: string;
  cantidadMinima: string;
  cantidadMaxima: string;
  tipoCalculo: CommissionRuleType;
  porcentaje: string;
  montoPorUnidad: string;
};

const EMPTY_RULE_FORM: RuleFormState = {
  idInventarioItem: "",
  cantidadMinima: "",
  cantidadMaxima: "",
  tipoCalculo: "PORCENTAJE_VENTA",
  porcentaje: "",
  montoPorUnidad: "",
};

export default function CommissionsPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "planilla", "create");
  const canUpdate = hasModulePermission(user, "planilla", "update");
  const canDelete = hasModulePermission(user, "planilla", "delete");

  const [configs, setConfigs] = useState<CommissionConfigDto[]>([]);
  const [trashConfigs, setTrashConfigs] = useState<CommissionConfigDto[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [activeRules, setActiveRules] = useState<CommissionRuleDto[]>([]);
  const [trashRules, setTrashRules] = useState<CommissionRuleDto[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [newConfigName, setNewConfigName] = useState("");
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [deleteConfigCandidate, setDeleteConfigCandidate] = useState<CommissionConfigDto | null>(null);
  const [deleteRuleCandidate, setDeleteRuleCandidate] = useState<CommissionRuleDto | null>(null);

  const selectedConfig = useMemo(
    () => configs.find((item) => item.id === selectedConfigId) ?? null,
    [configs, selectedConfigId],
  );

  async function loadAll() {
    setIsLoading(true);
    try {
      const [active, trash, productsData] = await Promise.all([
        listCommissionConfigs(),
        listAnulatedCommissionConfigs(),
        listProducts({ limit: 100 }),
      ]);
      setConfigs(active);
      setTrashConfigs(trash);
      setProducts(productsData.items.map((item) => ({ id: item.id, nombre: item.nombre })));
      setSelectedConfigId((prev) => prev ?? active[0]?.id ?? null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el módulo de comisiones"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function loadRules(configId: number) {
    try {
      const [configDetail, anulatedRules] = await Promise.all([
        getCommissionConfigById(configId),
        listAnulatedCommissionRules(configId),
      ]);
      setActiveRules(configDetail.reglas);
      setTrashRules(anulatedRules);
    } catch (error) {
      setActiveRules([]);
      setTrashRules([]);
      toast.error(getApiErrorMessage(error, "No se pudieron cargar las reglas"));
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedConfigId) {
      setActiveRules([]);
      setTrashRules([]);
      return;
    }
    void loadRules(selectedConfigId);
  }, [selectedConfigId]);

  const metrics = useMemo(() => {
    return {
      totalConfigs: configs.length + trashConfigs.length,
      activos: configs.length,
      anulados: trashConfigs.length,
      reglasActivas: activeRules.length,
    };
  }, [configs, trashConfigs, activeRules.length]);

  async function handleCreateConfig() {
    if (!canCreate) {
      toast.error("No tienes permisos para crear configuraciones");
      return;
    }

    const nombre = newConfigName.trim();
    if (nombre.length < 3) {
      toast.error("Ingresa un nombre válido");
      return;
    }

    if (!user?.id) {
      toast.error("Usuario no identificado");
      return;
    }

    setIsSavingConfig(true);
    try {
      const created = await createCommissionConfig({ idUsuario: user.id, nombre });
      setConfigs((prev) => [created, ...prev]);
      setSelectedConfigId(created.id);
      setNewConfigName("");
      toast.success("Configuración creada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la configuración"));
    } finally {
      setIsSavingConfig(false);
    }
  }

  function startEditingRule(rule: CommissionRuleDto) {
    setEditingRuleId(rule.id);
    setRuleForm({
      idInventarioItem: String(rule.idInventarioItem),
      cantidadMinima: String(rule.cantidadMinima),
      cantidadMaxima: rule.cantidadMaxima === null ? "" : String(rule.cantidadMaxima),
      tipoCalculo: rule.tipoCalculo,
      porcentaje: rule.tipoCalculo === "PORCENTAJE_VENTA" ? String(rule.porcentaje) : "",
      montoPorUnidad:
        rule.tipoCalculo === "MONTO_POR_UNIDAD" ? String(rule.montoPorUnidad ?? "") : "",
    });
  }

  function clearRuleForm() {
    setEditingRuleId(null);
    setRuleForm(EMPTY_RULE_FORM);
  }

  async function handleSubmitRule() {
    if (!selectedConfigId) {
      toast.error("Selecciona una configuración");
      return;
    }

    if (!editingRuleId && !canCreate) {
      toast.error("No tienes permisos para crear reglas");
      return;
    }

    if (editingRuleId && !canUpdate) {
      toast.error("No tienes permisos para editar reglas");
      return;
    }

    const idInventarioItem = Number(ruleForm.idInventarioItem);
    const cantidadMinima = Number(ruleForm.cantidadMinima);
    const cantidadMaxima = ruleForm.cantidadMaxima.trim() ? Number(ruleForm.cantidadMaxima) : undefined;
    const porcentaje = ruleForm.porcentaje.trim() ? Number(ruleForm.porcentaje) : 0;
    const montoPorUnidad = ruleForm.montoPorUnidad.trim()
      ? Number(ruleForm.montoPorUnidad)
      : undefined;

    if (!Number.isInteger(idInventarioItem) || idInventarioItem <= 0) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!Number.isFinite(cantidadMinima) || cantidadMinima <= 0) {
      toast.error("Cantidad mínima inválida");
      return;
    }

    setIsSavingRule(true);
    try {
      if (editingRuleId) {
        await updateCommissionRule(selectedConfigId, editingRuleId, {
          idInventarioItem,
          cantidadMinima,
          cantidadMaxima: cantidadMaxima ?? null,
          tipoCalculo: ruleForm.tipoCalculo,
          porcentaje,
          montoPorUnidad: montoPorUnidad ?? null,
          idUsuarioModificador: user?.id,
        });
      } else {
        await createCommissionRule(selectedConfigId, {
          idInventarioItem,
          cantidadMinima,
          cantidadMaxima,
          tipoCalculo: ruleForm.tipoCalculo,
          porcentaje,
          montoPorUnidad,
        });
      }
      clearRuleForm();
      await loadRules(selectedConfigId);
      toast.success(editingRuleId ? "Regla actualizada" : "Regla creada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la regla"));
    } finally {
      setIsSavingRule(false);
    }
  }

  async function handleDeleteConfig() {
    if (!deleteConfigCandidate) return;
    try {
      await deleteCommissionConfig(deleteConfigCandidate.id, {
        idUsuarioAnulador: user?.id,
      });
      setDeleteConfigCandidate(null);
      await loadAll();
      toast.success("Configuración anulada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la configuración"));
    }
  }

  async function handleRestoreConfig(item: CommissionConfigDto) {
    try {
      await restoreCommissionConfig(item.id, { idUsuarioModificador: user?.id });
      await loadAll();
      toast.success("Configuración restaurada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar"));
    }
  }

  async function handleDeleteRule() {
    if (!deleteRuleCandidate || !selectedConfigId) return;
    try {
      await deleteCommissionRule(selectedConfigId, deleteRuleCandidate.id, {
        idUsuarioAnulador: user?.id,
      });
      setDeleteRuleCandidate(null);
      await loadRules(selectedConfigId);
      toast.success("Regla anulada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la regla"));
    }
  }

  async function handleRestoreRule(ruleId: number) {
    if (!selectedConfigId) return;
    try {
      await restoreCommissionRule(selectedConfigId, ruleId, {
        idUsuarioModificador: user?.id,
      });
      await loadRules(selectedConfigId);
      toast.success("Regla restaurada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar la regla"));
    }
  }

  return (
    <RequireAuth moduleKey="planilla" action="read">
      <DashboardShell
        title="Configuración de Comisiones"
        description="Define reglas por producto y rangos para cálculo automático de planilla"
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <>
              <CommissionsCardsSkeleton />
              <CommissionsTableSkeleton rows={8} />
            </>
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Configuraciones</p><p className="text-2xl font-bold">{metrics.totalConfigs}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Activas</p><p className="text-2xl font-bold">{metrics.activos}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Anuladas</p><p className="text-2xl font-bold">{metrics.anulados}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Reglas activas</p><p className="text-2xl font-bold">{metrics.reglasActivas}</p></CardContent></Card>
            </section>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void loadAll()} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recargar
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <Card className="rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle>Configuraciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canCreate ? (
                  <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                    <Label htmlFor="new-config-name">Nueva configuración</Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-config-name"
                        value={newConfigName}
                        onChange={(e) => setNewConfigName(e.target.value)}
                        placeholder="Ej. Comisiones repartidores"
                      />
                      <Button onClick={() => void handleCreateConfig()} disabled={isSavingConfig}>
                        {isSavingConfig ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <Tabs defaultValue="activos">
                  <TabsList>
                    <TabsTrigger value="activos">Activas ({configs.length})</TabsTrigger>
                    <TabsTrigger value="anulados">Anuladas ({trashConfigs.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="activos" className="space-y-2">
                    {configs.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-3 ${selectedConfigId === item.id ? "border-sky-500 bg-sky-50/60" : "bg-background"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            className="text-left"
                            onClick={() => setSelectedConfigId(item.id)}
                            type="button"
                          >
                            <p className="font-medium">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">{item.totalReglasActivas ?? 0} reglas activas</p>
                          </button>
                          {canDelete ? (
                            <Button variant="ghost" size="xs" onClick={() => setDeleteConfigCandidate(item)}>
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="anulados" className="space-y-2">
                    {trashConfigs.map((item) => (
                      <div key={item.id} className="rounded-lg border border-dashed bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">ID #{item.id}</p>
                          </div>
                          {canUpdate ? (
                            <Button variant="outline" size="xs" onClick={() => void handleRestoreConfig(item)}>
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle>
                  {selectedConfig ? `Reglas de ${selectedConfig.nombre}` : "Reglas de comisión"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedConfig ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Selecciona una configuración para administrar reglas.
                  </div>
                ) : (
                  <>
                    {canCreate || canUpdate ? (
                      <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {editingRuleId ? "Editar regla" : "Agregar regla"}
                          </p>
                          {editingRuleId ? (
                            <Button variant="ghost" size="xs" onClick={clearRuleForm}>
                              <X className="size-4" />
                              Cancelar edición
                            </Button>
                          ) : null}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5 md:col-span-2">
                            <Label>Producto</Label>
                            <Popover open={isProductPickerOpen} onOpenChange={setIsProductPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                >
                                  {ruleForm.idInventarioItem
                                    ? products.find((product) => String(product.id) === ruleForm.idInventarioItem)
                                        ?.nombre ?? "Selecciona un producto"
                                    : "Selecciona un producto"}
                                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandList>
                                    <CommandEmpty>Sin resultados</CommandEmpty>
                                    {products.map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={`${product.id} ${product.nombre}`}
                                        onSelect={() => {
                                          setRuleForm((prev) => ({
                                            ...prev,
                                            idInventarioItem: String(product.id),
                                          }));
                                          setIsProductPickerOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 size-4",
                                            ruleForm.idInventarioItem === String(product.id)
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {product.nombre}
                                      </CommandItem>
                                    ))}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Cantidad mínima</Label>
                            <Input
                              type="number"
                              value={ruleForm.cantidadMinima}
                              onChange={(e) => setRuleForm((prev) => ({ ...prev, cantidadMinima: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Cantidad máxima (opcional)</Label>
                            <Input
                              type="number"
                              value={ruleForm.cantidadMaxima}
                              onChange={(e) => setRuleForm((prev) => ({ ...prev, cantidadMaxima: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Tipo de cálculo</Label>
                            <select
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={ruleForm.tipoCalculo}
                              onChange={(e) =>
                                setRuleForm((prev) => ({
                                  ...prev,
                                  tipoCalculo: e.target.value as CommissionRuleType,
                                }))
                              }
                            >
                              <option value="PORCENTAJE_VENTA">Porcentaje sobre venta</option>
                              <option value="MONTO_POR_UNIDAD">Monto por unidad</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Porcentaje</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={ruleForm.porcentaje}
                              onChange={(e) => setRuleForm((prev) => ({ ...prev, porcentaje: e.target.value }))}
                              disabled={ruleForm.tipoCalculo !== "PORCENTAJE_VENTA"}
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <Label>Monto por unidad</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={ruleForm.montoPorUnidad}
                              onChange={(e) => setRuleForm((prev) => ({ ...prev, montoPorUnidad: e.target.value }))}
                              disabled={ruleForm.tipoCalculo !== "MONTO_POR_UNIDAD"}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button onClick={() => void handleSubmitRule()} disabled={isSavingRule}>
                            {isSavingRule ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            {editingRuleId ? "Guardar cambios" : "Agregar regla"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <Tabs defaultValue="reglas-activas">
                      <TabsList>
                        <TabsTrigger value="reglas-activas">Reglas activas ({activeRules.length})</TabsTrigger>
                        <TabsTrigger value="reglas-anuladas">Reglas anuladas ({trashRules.length})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="reglas-activas">
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <Table className="min-w-full">
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Rango</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeRules.map((rule) => (
                                <TableRow key={rule.id}>
                                  <TableCell>{rule.inventarioItem?.nombre ?? `#${rule.idInventarioItem}`}</TableCell>
                                  <TableCell>{rule.cantidadMinima} - {rule.cantidadMaxima ?? "∞"}</TableCell>
                                  <TableCell>{rule.tipoCalculo === "PORCENTAJE_VENTA" ? "Porcentaje" : "Monto"}</TableCell>
                                  <TableCell>
                                    {rule.tipoCalculo === "PORCENTAJE_VENTA"
                                      ? `${rule.porcentaje}%`
                                      : `Q${Number(rule.montoPorUnidad ?? 0).toFixed(2)}`}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {canUpdate ? (
                                        <Button variant="ghost" size="xs" onClick={() => startEditingRule(rule)}>
                                          <Pencil className="size-4" />
                                        </Button>
                                      ) : null}
                                      {canDelete ? (
                                        <Button variant="ghost" size="xs" onClick={() => setDeleteRuleCandidate(rule)}>
                                          <Trash2 className="size-4" />
                                        </Button>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="reglas-anuladas" className="space-y-2">
                        {trashRules.map((rule) => (
                          <div key={rule.id} className="rounded-lg border border-dashed bg-muted/40 p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{rule.inventarioItem?.nombre ?? `Producto #${rule.idInventarioItem}`}</p>
                              <p className="text-xs text-muted-foreground">Rango {rule.cantidadMinima} - {rule.cantidadMaxima ?? "∞"}</p>
                            </div>
                            {canUpdate ? (
                              <Button variant="outline" size="xs" onClick={() => void handleRestoreRule(rule.id)}>
                                <RotateCcw className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmActionDialog
          open={!!deleteConfigCandidate}
          onOpenChange={(open) => !open && setDeleteConfigCandidate(null)}
          title="Anular configuración"
          description="Se anulará la configuración y sus reglas activas."
          confirmLabel="Anular"
          onConfirm={handleDeleteConfig}
        />

        <ConfirmActionDialog
          open={!!deleteRuleCandidate}
          onOpenChange={(open) => !open && setDeleteRuleCandidate(null)}
          title="Anular regla"
          description="La regla pasará a la papelera y podrá restaurarse."
          confirmLabel="Anular"
          onConfirm={handleDeleteRule}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
