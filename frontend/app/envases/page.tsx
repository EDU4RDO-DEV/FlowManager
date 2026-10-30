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
  reconcileEnvasePhysicalStock,
  registrarBajaEnvase,
  registrarDevolucionEnvase,
  registrarPerdidaEnvase,
  registrarPrestamoEnvase,
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

type ClassificationCandidate = {
  item: ProductDto;
  pending: number;
  cantidadLlena: number;
  cantidadVacia: number;
  cantidadDanada: number;
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
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [anulateCandidate, setAnulateCandidate] = useState<MovimientoEnvaseDto | null>(null);
  const [classificationItemId, setClassificationItemId] = useState("");
  const [classificationFull, setClassificationFull] = useState("");
  const [classificationEmpty, setClassificationEmpty] = useState("");
  const [classificationDamaged, setClassificationDamaged] = useState("0");
  const [classificationCandidate, setClassificationCandidate] =
    useState<ClassificationCandidate | null>(null);

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

  const pendingPlantBalances = useMemo(() => {
    const pendingByItem = new Map<number, number>();
    for (const balance of physicalBalances) {
      if (
        balance.ubicacion === "PLANTA" &&
        balance.estado === "PENDIENTE_CONTEO" &&
        balance.cantidad > 0
      ) {
        pendingByItem.set(
          balance.idInventarioItem,
          (pendingByItem.get(balance.idInventarioItem) ?? 0) + balance.cantidad,
        );
      }
    }
    return [...pendingByItem.entries()]
      .map(([id, pending]) => ({
        item: envaseItems.find((item) => item.id === id),
        pending,
      }))
      .filter((entry): entry is { item: ProductDto; pending: number } => Boolean(entry.item));
  }, [envaseItems, physicalBalances]);

  const effectiveClassificationItemId = pendingPlantBalances.some(
    (balance) => String(balance.item.id) === classificationItemId,
  )
    ? classificationItemId
    : pendingPlantBalances[0]
      ? String(pendingPlantBalances[0].item.id)
      : "";
  const selectedClassification = pendingPlantBalances.find(
    (balance) => String(balance.item.id) === effectiveClassificationItemId,
  );

  function requestClassificationConfirmation() {
    if (!selectedClassification) return;
    const cantidadLlena = Number(classificationFull);
    const cantidadVacia = Number(classificationEmpty);
    const cantidadDanada = Number(classificationDamaged);
    if ([cantidadLlena, cantidadVacia, cantidadDanada].some((quantity) =>
      !Number.isInteger(quantity) || quantity < 0
    )) {
      toast.error("Las cantidades deben ser enteros no negativos.");
      return;
    }
    if (cantidadLlena + cantidadVacia + cantidadDanada !== selectedClassification.pending) {
      toast.error(
        `La clasificación debe sumar exactamente ${selectedClassification.pending} unidades pendientes.`,
      );
      return;
    }
    setClassificationCandidate({
      ...selectedClassification,
      cantidadLlena,
      cantidadVacia,
      cantidadDanada,
    });
  }

  async function confirmClassification() {
    if (!classificationCandidate) return;
    try {
      setIsSaving(true);
      await reconcileEnvasePhysicalStock({
        idInventarioItem: classificationCandidate.item.id,
        cantidadLlena: classificationCandidate.cantidadLlena,
        cantidadVacia: classificationCandidate.cantidadVacia,
        cantidadDanada: classificationCandidate.cantidadDanada,
        observaciones: "Clasificación inicial de saldo físico legado confirmada por el operador",
      });
      toast.success("Clasificación registrada. La existencia del catálogo no se volvió a incrementar.");
      setClassificationCandidate(null);
      setClassificationFull("");
      setClassificationEmpty("");
      setClassificationDamaged("0");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo clasificar el saldo pendiente."));
    } finally {
      setIsSaving(false);
    }
  }

  const selectedItemStock = useMemo(() => {
    const item = envaseItems.find((candidate) => String(candidate.id) === form.idInventarioItem);
    if (!item || form.tipoMovimiento === "PERDIDA") return null;

    const location = form.tipoMovimiento === "BAJA"
      ? form.ubicacionEnvase
      : form.estadoEnvase === "DANADO"
        ? "CUARENTENA"
        : "PLANTA";
    const routeId = location === "RUTA" && form.idRutaSesion ? Number(form.idRutaSesion) : null;
    const balance = physicalBalances.find((candidate) =>
      candidate.idInventarioItem === item.id &&
      candidate.ubicacion === location &&
      candidate.estado === form.estadoEnvase &&
      candidate.idRutaSesion === routeId,
    );
    const pending = physicalBalances.find((candidate) =>
      candidate.idInventarioItem === item.id &&
      candidate.ubicacion === "PLANTA" &&
      candidate.estado === "PENDIENTE_CONTEO" &&
      candidate.idRutaSesion === null,
    )?.cantidad ?? 0;
    const fullAndPendingTracked = physicalBalances
      .filter((candidate) =>
        candidate.idInventarioItem === item.id &&
        candidate.ubicacion === "PLANTA" &&
      ["LLENO", "VACIO", "PENDIENTE_CONTEO"].includes(candidate.estado),
      )
      .reduce((sum, candidate) => sum + candidate.cantidad, 0);
    const unclassifiedFull = location === "PLANTA" && form.estadoEnvase === "LLENO"
      ? Math.max(0, item.existencia - fullAndPendingTracked)
      : 0;

    return {
      item,
      location,
      quantity: (balance?.cantidad ?? 0) + (location === "PLANTA" ? pending : 0) + unclassifiedFull,
      classifiedQuantity: balance?.cantidad ?? 0,
      pending,
      unclassified: unclassifiedFull,
    };
  }, [envaseItems, form, physicalBalances]);

  function resetForm() {
    setForm(EMPTY_FORM);
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

    const requestedQuantity = Number(form.cantidad);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      toast.error("La cantidad de envases debe ser un entero mayor que cero");
      return;
    }
    if (
      selectedItemStock &&
      ["PRESTAMO", "BAJA"].includes(form.tipoMovimiento) &&
      requestedQuantity > selectedItemStock.quantity
    ) {
      toast.error(
        `Stock físico insuficiente para ${selectedItemStock.item.nombre} (${form.estadoEnvase}/${selectedItemStock.location}): disponible ${selectedItemStock.quantity}, solicitado ${requestedQuantity}`,
      );
      return;
    }
    if (
      selectedItemStock &&
      ["PRESTAMO", "BAJA"].includes(form.tipoMovimiento) &&
      selectedItemStock.location === "PLANTA" &&
      form.estadoEnvase === "LLENO" &&
      requestedQuantity > selectedItemStock.item.existencia
    ) {
      toast.error(
        `Stock de catálogo insuficiente para ${selectedItemStock.item.nombre}: disponible ${selectedItemStock.item.existencia}, solicitado ${requestedQuantity}`,
      );
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

              {selectedItemStock ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p>
                    Saldo ya clasificado en {selectedItemStock.location}/{form.estadoEnvase}:{" "}
                    <strong>{selectedItemStock.classifiedQuantity}</strong>. Existencia vendible del catálogo:{" "}
                    <strong>{selectedItemStock.item.existencia}</strong>.
                  </p>
                  {selectedItemStock.pending > 0 || selectedItemStock.unclassified > 0 ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      Pendiente de clasificar: {selectedItemStock.pending + selectedItemStock.unclassified}. Una operación
                      explícita en el estado seleccionado podrá clasificar solo las unidades solicitadas; no representa
                      saldo ya confirmado como {form.estadoEnvase}.
                    </p>
                  ) : null}
                </div>
              ) : null}

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
              {pendingPlantBalances.length > 0 ? (
                <section className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Clasificar saldo pendiente de planta</h2>
                    <p className="text-sm text-muted-foreground">
                      La clasificación mueve el saldo pendiente a sus estados físicos sin crear existencias nuevas.
                      Las cantidades deben coincidir exactamente con el saldo pendiente.
                    </p>
                    {!canUpdate ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tu rol necesita permiso de actualización de envases para clasificar saldos.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="classification-item">Producto y saldo pendiente</Label>
                      <select
                        id="classification-item"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={effectiveClassificationItemId}
                        onChange={(event) => {
                          setClassificationItemId(event.target.value);
                          setClassificationFull("");
                          setClassificationEmpty("");
                          setClassificationDamaged("0");
                        }}
                        disabled={isSaving}
                      >
                        {pendingPlantBalances.map(({ item, pending }) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre} · pendiente {pending}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="classification-full">Llenos en planta</Label>
                      <Input
                        id="classification-full"
                        type="number"
                        min="0"
                        step="1"
                        value={classificationFull}
                        onChange={(event) => setClassificationFull(event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="classification-empty">Vacíos en planta</Label>
                      <Input
                        id="classification-empty"
                        type="number"
                        min="0"
                        step="1"
                        value={classificationEmpty}
                        onChange={(event) => setClassificationEmpty(event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="classification-damaged">Dañados a cuarentena</Label>
                      <Input
                        id="classification-damaged"
                        type="number"
                        min="0"
                        step="1"
                        value={classificationDamaged}
                        onChange={(event) => setClassificationDamaged(event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Existencia vendible actual: {selectedClassification?.item.existencia ?? 0}. Los llenos se sincronizan
                    con esa existencia; los vacíos no la modifican y los dañados se separan de ella.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={requestClassificationConfirmation}
                    disabled={!canUpdate || isSaving || !selectedClassification}
                  >
                    Revisar y confirmar clasificación
                  </Button>
                </section>
              ) : null}
              <div>
                <h2 className="text-lg font-semibold">Existencia física por estado y ubicación</h2>
                <p className="text-sm text-muted-foreground">
                  Los envases en custodia de clientes se muestran únicamente en sus saldos, no como stock de planta o ruta.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Los saldos por ubicación y estado se actualizan con producción, despacho, devoluciones, ajustes y movimientos de custodia. Los saldos heredados se clasifican al usarse y no requieren una conciliación previa.
              </p>
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
                      <TableCell>
                        {balance.estado}
                        {balance.esSaldoLegadoPendiente ? " (incluye saldo legado)" : ""}
                      </TableCell>
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
        <ConfirmActionDialog
          open={classificationCandidate !== null}
          onOpenChange={(open) => !open && setClassificationCandidate(null)}
          title="Confirmar clasificación física"
          description={classificationCandidate
            ? `Se clasificarán ${classificationCandidate.pending} unidades de ${classificationCandidate.item.nombre}: ${classificationCandidate.cantidadLlena} llenos, ${classificationCandidate.cantidadVacia} vacíos y ${classificationCandidate.cantidadDanada} dañados. No se agregará inventario al saldo de catálogo.`
            : ""}
          confirmLabel="Clasificar sin sumar"
          loading={isSaving}
          onConfirm={confirmClassification}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
