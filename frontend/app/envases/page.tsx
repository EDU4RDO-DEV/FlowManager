"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PackageOpen, PackageMinus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EnvasesEmptyState } from "@/app/envases/_components/envases-empty-state";
import {
  EnvasesCardsSkeleton,
  EnvasesTableSkeleton,
} from "@/app/envases/_components/envases-skeletons";
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
import { listClients } from "@/services/clients.service";
import {
  anulateMovimientoEnvase,
  listEnvasePhysicalBalances,
  listEnvaseSaldos,
  listMovimientosEnvase,
  registerEnvasePhysicalCount,
  registrarBajaEnvase,
  registrarDevolucionEnvase,
  registrarPerdidaEnvase,
  registrarPrestamoEnvase,
  reconcileEnvasePhysicalStock,
  restoreMovimientoEnvase,
} from "@/services/envases.service";
import { listProducts } from "@/services/products.service";
import type { ClientDto } from "@/types/clients";
import type {
  EnvaseClienteSaldoDto,
  EnvasePhysicalBalanceDto,
  MovimientoEnvaseDto,
  TipoMovimientoEnvase,
} from "@/types/envases";
import type { ProductDto } from "@/types/products";

type FormState = {
  tipoMovimiento: TipoMovimientoEnvase;
  idInventarioItem: string;
  idCliente: string;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "DANADO";
  ubicacionEnvase: "PLANTA" | "RUTA" | "CUARENTENA";
  idRutaSesion: string;
  observaciones: string;
};

const EMPTY_FORM: FormState = {
  tipoMovimiento: "PRESTAMO",
  idInventarioItem: "",
  idCliente: "",
  cantidad: "",
  estadoEnvase: "VACIO",
  ubicacionEnvase: "PLANTA",
  idRutaSesion: "",
  observaciones: "",
};

export default function EnvasesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "envases", "create");
  const canUpdate = hasModulePermission(user, "envases", "update");
  const canDelete = hasModulePermission(user, "envases", "delete");

  const [movimientos, setMovimientos] = useState<MovimientoEnvaseDto[]>([]);
  const [movimientosAnulados, setMovimientosAnulados] = useState<MovimientoEnvaseDto[]>([]);
  const [saldos, setSaldos] = useState<EnvaseClienteSaldoDto[]>([]);
  const [clientes, setClientes] = useState<ClientDto[]>([]);
  const [envaseItems, setEnvaseItems] = useState<ProductDto[]>([]);
  const [physicalBalances, setPhysicalBalances] = useState<EnvasePhysicalBalanceDto[]>([]);
  const [reconcileForm, setReconcileForm] = useState({
    idInventarioItem: "",
    cantidadVacia: "",
    cantidadLlena: "",
    cantidadDanada: "",
  });
  const [physicalCountForm, setPhysicalCountForm] = useState({
    idInventarioItem: "",
    ubicacionEnvase: "PLANTA" as "PLANTA" | "RUTA" | "CUARENTENA",
    idRutaSesion: "",
    cantidadVacia: "",
    cantidadLlena: "",
    cantidadDanada: "",
    observaciones: "",
  });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [anulateCandidate, setAnulateCandidate] = useState<MovimientoEnvaseDto | null>(null);

  async function loadData() {
    try {
      const [activos, anulados, saldosList, physicalList, clientesList, firstProductsPage] = await Promise.all([
        listMovimientosEnvase({ anulado: false }),
        listMovimientosEnvase({ anulado: true }),
        listEnvaseSaldos({ soloConSaldo: true }),
        listEnvasePhysicalBalances(),
        listClients(),
        listProducts({ anulado: false, page: 1, limit: 100 }),
      ]);
      const products = firstProductsPage.pagination.totalPages > 1
        ? [
            ...firstProductsPage.items,
            ...(await Promise.all(
              Array.from({ length: firstProductsPage.pagination.totalPages - 1 }, (_, index) =>
                listProducts({ anulado: false, page: index + 2, limit: 100 }),
              ),
            )).flatMap((page) => page.items),
          ]
        : firstProductsPage.items;
      setMovimientos(activos);
      setMovimientosAnulados(anulados);
      setSaldos(saldosList);
      setPhysicalBalances(physicalList);
      setClientes(clientesList);
      setEnvaseItems(products.filter((item) => item.esEnvaseRetornable));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el módulo de envases"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const filteredMovimientos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return movimientos.filter((item) => {
      if (!normalized) return true;
      const cliente = item.cliente?.nombre ?? "";
      const envase = item.inventarioItem?.nombre ?? "";
      return (
        cliente.toLowerCase().includes(normalized) || envase.toLowerCase().includes(normalized)
      );
    });
  }, [movimientos, query]);

  const metrics = useMemo(() => {
    const totalPrestado = saldos.reduce((sum, item) => sum + item.cantidadPrestada, 0);
    return {
      movimientos: movimientos.length,
      clientesConSaldo: saldos.length,
      totalPrestado,
    };
  }, [movimientos, saldos]);

  const pendingBalances = useMemo(
    () => physicalBalances.filter(
      (balance) => balance.ubicacion === "PLANTA" && balance.estado === "PENDIENTE_CONTEO" && balance.cantidad > 0,
    ),
    [physicalBalances],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function submitPhysicalReconciliation() {
    const idInventarioItem = Number(reconcileForm.idInventarioItem);
    const pending = pendingBalances.find((item) => item.idInventarioItem === idInventarioItem);
    const counts = {
      cantidadVacia: Number(reconcileForm.cantidadVacia || 0),
      cantidadLlena: Number(reconcileForm.cantidadLlena || 0),
      cantidadDanada: Number(reconcileForm.cantidadDanada || 0),
    };
    if (!pending) {
      toast.error("Selecciona una existencia pendiente de conteo");
      return;
    }
    if (
      Object.values(counts).some((count) => !Number.isInteger(count) || count < 0) ||
      counts.cantidadVacia + counts.cantidadLlena + counts.cantidadDanada !== pending.cantidad
    ) {
      toast.error(`La clasificación debe sumar exactamente ${pending.cantidad} unidades`);
      return;
    }

    try {
      setIsSaving(true);
      await reconcileEnvasePhysicalStock({ idInventarioItem, ...counts });
      toast.success("Existencia física conciliada; los dañados quedaron segregados");
      setReconcileForm({ idInventarioItem: "", cantidadVacia: "", cantidadLlena: "", cantidadDanada: "" });
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo conciliar la existencia física"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPhysicalCount(regularize: boolean) {
    const idInventarioItem = Number(physicalCountForm.idInventarioItem);
    const idRutaSesion = Number(physicalCountForm.idRutaSesion);
    if (
      !idInventarioItem ||
      (physicalCountForm.ubicacionEnvase === "RUTA" && !idRutaSesion) ||
      !physicalCountForm.observaciones.trim()
    ) {
      toast.error("Selecciona el envase, completa la ubicación y registra observaciones");
      return;
    }

    const payload = {
      idInventarioItem,
      ubicacionEnvase: physicalCountForm.ubicacionEnvase,
      ...(physicalCountForm.ubicacionEnvase === "RUTA" ? { idRutaSesion } : {}),
      cantidadVacia: Number(physicalCountForm.cantidadVacia || 0),
      cantidadLlena: Number(physicalCountForm.cantidadLlena || 0),
      cantidadDanada: Number(physicalCountForm.cantidadDanada || 0),
      observaciones: physicalCountForm.observaciones.trim(),
    };
    if (
      [payload.cantidadVacia, payload.cantidadLlena, payload.cantidadDanada]
        .some((quantity) => !Number.isInteger(quantity) || quantity < 0)
    ) {
      toast.error("Las cantidades deben ser enteros no negativos");
      return;
    }

    try {
      setIsSaving(true);
      await registerEnvasePhysicalCount(payload, regularize);
      toast.success(
        regularize
          ? "Conteo registrado y diferencia regularizada con autorización"
          : "Conteo físico registrado",
      );
      setPhysicalCountForm({
        idInventarioItem: "",
        ubicacionEnvase: "PLANTA",
        idRutaSesion: "",
        cantidadVacia: "",
        cantidadLlena: "",
        cantidadDanada: "",
        observaciones: "",
      });
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el conteo físico"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitMovimiento() {
    if (
      !form.idInventarioItem ||
      !form.cantidad ||
      (["PERDIDA", "BAJA"].includes(form.tipoMovimiento) && !form.observaciones.trim()) ||
      (form.tipoMovimiento !== "BAJA" && !form.idCliente) ||
      (form.tipoMovimiento === "BAJA" && form.ubicacionEnvase === "RUTA" && !form.idRutaSesion)
    ) {
      toast.error("Completa los datos requeridos para el movimiento");
      return;
    }

    try {
      setIsSaving(true);
      const basePayload = {
        idInventarioItem: Number(form.idInventarioItem),
        cantidad: Number(form.cantidad),
        observaciones: form.observaciones || undefined,
      };
      let created: MovimientoEnvaseDto;
      if (form.tipoMovimiento === "PRESTAMO") {
        created = await registrarPrestamoEnvase({
          ...basePayload,
          idCliente: Number(form.idCliente),
          estadoEnvase: form.estadoEnvase === "DANADO" ? "VACIO" : form.estadoEnvase,
        });
      } else if (form.tipoMovimiento === "DEVOLUCION") {
        created = await registrarDevolucionEnvase({
          ...basePayload,
          idCliente: Number(form.idCliente),
          estadoEnvase: form.estadoEnvase,
        });
      } else if (form.tipoMovimiento === "PERDIDA") {
        created = await registrarPerdidaEnvase({
          ...basePayload,
          idCliente: Number(form.idCliente),
        });
      } else {
        created = await registrarBajaEnvase({
          ...basePayload,
          estadoEnvase: form.estadoEnvase,
          ubicacionEnvase: form.ubicacionEnvase,
          ...(form.ubicacionEnvase === "RUTA" ? { idRutaSesion: Number(form.idRutaSesion) } : {}),
        });
      }

      setMovimientos((prev) => [created, ...prev]);
      const labels: Record<TipoMovimientoEnvase, string> = {
        PRESTAMO: "Préstamo registrado correctamente",
        DEVOLUCION: "Devolución registrada correctamente",
        DEVOLUCION_DANADA: "Devolución registrada correctamente",
        PERDIDA: "Pérdida registrada correctamente",
        BAJA: "Baja registrada correctamente",
      };
      toast.success(labels[form.tipoMovimiento]);
      resetForm();
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el movimiento"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmAnulate() {
    if (!anulateCandidate) return;

    try {
      await anulateMovimientoEnvase(anulateCandidate.id, { idUsuarioAnulador: user?.id ?? 0 });
      setMovimientos((prev) => prev.filter((item) => item.id !== anulateCandidate.id));
      setMovimientosAnulados((prev) => [{ ...anulateCandidate, anulado: true }, ...prev]);
      toast.success("Movimiento anulado correctamente");
      setAnulateCandidate(null);
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el movimiento"));
    }
  }

  async function restoreFromTrash(item: MovimientoEnvaseDto) {
    try {
      const restored = await restoreMovimientoEnvase(item.id, { idUsuarioModificador: user?.id ?? 0 });
      setMovimientosAnulados((prev) => prev.filter((row) => row.id !== item.id));
      setMovimientos((prev) => [restored, ...prev]);
      toast.success("Movimiento restaurado correctamente");
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el movimiento"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Envases Retornables"
        description="Control de préstamos y devoluciones de envases a clientes."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <EnvasesCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 transition-opacity duration-300">
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Movimientos activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.movimientos}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Clientes con saldo</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.clientesConSaldo}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total envases prestados</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.totalPrestado}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="env-tipo">Tipo de movimiento</Label>
                  <select
                    id="env-tipo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.tipoMovimiento}
                    onChange={(event) => {
                      const tipoMovimiento = event.target.value as TipoMovimientoEnvase;
                      setForm((prev) => ({
                        ...prev,
                        tipoMovimiento,
                        estadoEnvase: tipoMovimiento === "PRESTAMO" && prev.estadoEnvase === "DANADO"
                          ? "VACIO"
                          : prev.estadoEnvase,
                      }));
                    }}
                  >
                    <option value="PRESTAMO">Préstamo</option>
                    <option value="DEVOLUCION">Devolución</option>
                    <option value="PERDIDA">Pérdida del cliente</option>
                    <option value="BAJA">Baja física</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="env-item">Envase</Label>
                  <select
                    id="env-item"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idInventarioItem}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, idInventarioItem: event.target.value }))
                    }
                  >
                    <option value="">Selecciona un envase</option>
                    {envaseItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {form.tipoMovimiento !== "BAJA" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="env-cliente">Cliente</Label>
                  <select
                    id="env-cliente"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idCliente}
                    onChange={(event) => setForm((prev) => ({ ...prev, idCliente: event.target.value }))}
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.entidad.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="env-cantidad">Cantidad</Label>
                  <Input
                    id="env-cantidad"
                    type="number"
                    min="1"
                    value={form.cantidad}
                    onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                  />
                </div>
                {form.tipoMovimiento !== "PERDIDA" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="env-estado">Estado físico</Label>
                  <select
                    id="env-estado"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.estadoEnvase}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        estadoEnvase: event.target.value as FormState["estadoEnvase"],
                      }))
                    }
                  >
                    <option value="VACIO">Vacío</option>
                    <option value="LLENO">Lleno</option>
                    {form.tipoMovimiento === "DEVOLUCION" || form.tipoMovimiento === "BAJA" ? (
                      <option value="DANADO">Dañado</option>
                    ) : null}
                  </select>
                </div>
                ) : null}
                {form.tipoMovimiento === "BAJA" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="env-ubicacion">Ubicación</Label>
                      <select
                        id="env-ubicacion"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.ubicacionEnvase}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            ubicacionEnvase: event.target.value as FormState["ubicacionEnvase"],
                          }))
                        }
                      >
                        <option value="PLANTA">Planta</option>
                        <option value="RUTA">Vehículo / ruta</option>
                        <option value="CUARENTENA">Cuarentena</option>
                      </select>
                    </div>
                    {form.ubicacionEnvase === "RUTA" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="env-ruta">ID de sesión de ruta</Label>
                        <Input
                          id="env-ruta"
                          type="number"
                          min="1"
                          value={form.idRutaSesion}
                          onChange={(event) => setForm((prev) => ({ ...prev, idRutaSesion: event.target.value }))}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="space-y-1.5 lg:col-span-4">
                  <Label htmlFor="env-observaciones">
                    Observaciones{["PERDIDA", "BAJA"].includes(form.tipoMovimiento) ? " (motivo obligatorio)" : ""}
                  </Label>
                  <Input
                    id="env-observaciones"
                    value={form.observaciones}
                    onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={submitMovimiento}
                  disabled={
                    (["PERDIDA", "BAJA"].includes(form.tipoMovimiento) ? !canDelete : !canCreate) ||
                    isSaving
                  }
                  className="bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : form.tipoMovimiento === "PRESTAMO" ? (
                    <PackageOpen className="size-4" />
                  ) : form.tipoMovimiento === "BAJA" ? (
                    <Trash2 className="size-4" />
                  ) : (
                    <PackageMinus className="size-4" />
                  )}
                  {{
                    PRESTAMO: "Registrar préstamo",
                    DEVOLUCION: "Registrar devolución",
                    DEVOLUCION_DANADA: "Registrar devolución",
                    PERDIDA: "Registrar pérdida",
                    BAJA: "Registrar baja",
                  }[form.tipoMovimiento]}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsLoading(true);
                    void loadData();
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="text-lg font-semibold">Existencia física por estado y ubicación</h2>
                <p className="text-sm text-muted-foreground">
                  Los envases en custodia de clientes se muestran únicamente en sus saldos, no como stock de planta o ruta.
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="physical-count-item">Envase contado</Label>
                  <select
                    id="physical-count-item"
                    value={physicalCountForm.idInventarioItem}
                    onChange={(event) => setPhysicalCountForm((prev) => ({ ...prev, idInventarioItem: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona un envase</option>
                    {envaseItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="physical-count-location">Ubicación del conteo</Label>
                  <select
                    id="physical-count-location"
                    value={physicalCountForm.ubicacionEnvase}
                    onChange={(event) => setPhysicalCountForm((prev) => ({
                      ...prev,
                      ubicacionEnvase: event.target.value as typeof prev.ubicacionEnvase,
                    }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PLANTA">Planta</option>
                    <option value="RUTA">Vehículo / ruta</option>
                    <option value="CUARENTENA">Cuarentena</option>
                  </select>
                </div>
                {physicalCountForm.ubicacionEnvase === "RUTA" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="physical-count-route">ID de sesión de ruta</Label>
                    <Input
                      id="physical-count-route"
                      type="number"
                      min={1}
                      value={physicalCountForm.idRutaSesion}
                      onChange={(event) => setPhysicalCountForm((prev) => ({ ...prev, idRutaSesion: event.target.value }))}
                    />
                  </div>
                ) : null}
                {(["cantidadVacia", "cantidadLlena", "cantidadDanada"] as const)
                  .filter((field) => physicalCountForm.ubicacionEnvase === "RUTA" || (
                    physicalCountForm.ubicacionEnvase === "PLANTA" ? field !== "cantidadDanada" : field === "cantidadDanada"
                  ))
                  .map((field) => (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={`physical-${field}`}>
                        {field === "cantidadVacia" ? "Garrafones vacíos" : field === "cantidadLlena" ? "Garrafones llenos" : "Garrafones dañados"}
                      </Label>
                      <Input
                        id={`physical-${field}`}
                        type="number"
                        min={0}
                        step={1}
                        value={physicalCountForm[field]}
                        onChange={(event) => setPhysicalCountForm((prev) => ({ ...prev, [field]: event.target.value }))}
                      />
                    </div>
                  ))}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                  <Label htmlFor="physical-count-observations">Observaciones y referencia del conteo</Label>
                  <Input
                    id="physical-count-observations"
                    maxLength={200}
                    value={physicalCountForm.observaciones}
                    onChange={(event) => setPhysicalCountForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
                  <Button
                    onClick={() => void submitPhysicalCount(false)}
                    disabled={!canUpdate || isSaving}
                    variant="outline"
                  >
                    Registrar conteo
                  </Button>
                  <Button
                    onClick={() => void submitPhysicalCount(true)}
                    disabled={!canDelete || isSaving}
                    variant="destructive"
                  >
                    Regularizar diferencia (autorizado)
                  </Button>
                </div>
              </div>
              {pendingBalances.length > 0 ? (
                <div className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="reconcile-envase">Envase pendiente de conteo</Label>
                    <select
                      id="reconcile-envase"
                      value={reconcileForm.idInventarioItem}
                      onChange={(event) => setReconcileForm((prev) => ({ ...prev, idInventarioItem: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecciona saldo</option>
                      {pendingBalances.map((balance) => (
                        <option key={balance.idInventarioItem} value={balance.idInventarioItem}>
                          {balance.nombre}: {balance.cantidad} por contar
                        </option>
                      ))}
                    </select>
                  </div>
                  {(["cantidadVacia", "cantidadLlena", "cantidadDanada"] as const).map((field) => (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={`reconcile-${field}`}>
                        {field === "cantidadVacia" ? "Garrafones vacíos" : field === "cantidadLlena" ? "Garrafones llenos" : "Dañados / cuarentena"}
                      </Label>
                      <Input
                        id={`reconcile-${field}`}
                        type="number"
                        min={0}
                        step={1}
                        value={reconcileForm[field]}
                        onChange={(event) => setReconcileForm((prev) => ({ ...prev, [field]: event.target.value }))}
                      />
                    </div>
                  ))}
                  <Button
                    onClick={() => void submitPhysicalReconciliation()}
                    disabled={!canUpdate || isSaving || !reconcileForm.idInventarioItem}
                    className="md:col-span-2"
                  >
                    Conciliar conteo físico
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay existencias pendientes de clasificación.</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Envase</TableHead><TableHead>Ubicación</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Ruta</TableHead><TableHead className="text-right">Cantidad física</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {physicalBalances.map((balance, index) => (
                    <TableRow key={`${balance.idInventarioItem}-${balance.ubicacion}-${balance.estado}-${balance.idRutaSesion ?? "none"}-${index}`}>
                      <TableCell>{balance.nombre}</TableCell>
                      <TableCell>{balance.ubicacion}</TableCell>
                      <TableCell>{balance.estado}</TableCell>
                      <TableCell>{balance.idRutaSesion ?? "—"}</TableCell>
                      <TableCell className="text-right">{balance.cantidad}</TableCell>
                    </TableRow>
                  ))}
                  {physicalBalances.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin movimientos físicos dimensionales.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="search-envases">Búsqueda</Label>
                <Input
                  id="search-envases"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por cliente o envase"
                />
              </div>

              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando movimientos...</p>
              ) : null}

              <Tabs defaultValue="movimientos">
                <TabsList>
                  <TabsTrigger value="movimientos">Movimientos ({filteredMovimientos.length})</TabsTrigger>
                  <TabsTrigger value="saldos">Saldos por cliente ({saldos.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({movimientosAnulados.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="movimientos" className="space-y-4">
                  {isLoading && !hasLoadedOnce ? (
                    <EnvasesTableSkeleton rows={6} />
                  ) : filteredMovimientos.length === 0 ? (
                    <EnvasesEmptyState
                      title="No hay movimientos de envases"
                      description="Registra un préstamo o devolución para comenzar a llevar el control."
                      actionLabel="Registrar movimiento"
                      onAction={() => document.getElementById("env-item")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Saldo nuevo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovimientos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.tipoMovimiento}</TableCell>
                            <TableCell>{item.cantidad}</TableCell>
                            <TableCell>{item.saldoNuevo}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setAnulateCandidate(item)}
                                disabled={!canDelete}
                              >
                                <Trash2 className="size-4" />
                                Anular
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="saldos">
                  {saldos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay clientes con saldo de envases.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Cantidad prestada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saldos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.cantidadPrestada}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="anulados">
                  {movimientosAnulados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay movimientos anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientosAnulados.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.tipoMovimiento}</TableCell>
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
          open={!!anulateCandidate}
          onOpenChange={(open) => !open && setAnulateCandidate(null)}
          title="Anular movimiento de envase"
          description="¿Deseas anular este movimiento? El saldo del cliente se recalculará automáticamente."
          confirmLabel="Anular"
          onConfirm={confirmAnulate}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
