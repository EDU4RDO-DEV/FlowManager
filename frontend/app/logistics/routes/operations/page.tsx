"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Printer, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  getRouteSettlement,
  listRutaSesiones,
  updateRutaSesion,
} from "@/services/logistics.service";
import { listProducts } from "@/services/products.service";
import type { RouteInventoryDto, RutaSesionDto } from "@/types/logistics";
import type { ProductDto } from "@/types/products";

type DispatchDraft = {
  idInventarioItem: number;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "";
};
type ReturnDraft = {
  cantidadRecibida: string;
  cantidadDanada: string;
  cantidadEnvaseVacio: string;
  cantidadEnvaseLleno: string;
  estadoEnvaseDanado: "VACIO" | "LLENO" | "";
  observaciones: string;
  ubicacionDanada: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function RouteOperationsPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "logistica", "create");
  const canUpdate = hasModulePermission(user, "logistica", "update");
  const [sessions, setSessions] = useState<RutaSesionDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [inventory, setInventory] = useState<RouteInventoryDto | null>(null);
  const [dispatchDraft, setDispatchDraft] = useState<DispatchDraft[]>([]);
  const [dispatchProductId, setDispatchProductId] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [returnDraft, setReturnDraft] = useState<Record<number, ReturnDraft>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentClass, setAdjustmentClass] = useState<"FALTANTE" | "DANADO" | "OTRO">("FALTANTE");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [closingKilometers, setClosingKilometers] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => String(session.id) === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );
  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLocaleLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      [
        session.fechaSesion,
        session.ruta?.nombre,
        session.vehiculo?.placa,
        session.chofer?.nombre,
        session.vendedor?.nombre,
        session.estado,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query)),
    );
  }, [sessionSearch, sessions]);

  const loadSessionsAndProducts = useCallback(async () => {
    try {
      const [loadedSessions, productResult] = await Promise.all([
        listRutaSesiones({ anulado: false }),
        listProducts({ page: 1, limit: 100, anulado: false }),
      ]);
      setSessions(loadedSessions);
      setProducts(productResult.items);
      setSelectedSessionId((previous) =>
        previous && loadedSessions.some((session) => String(session.id) === previous)
          ? previous
          : String(loadedSessions[0]?.id ?? ""),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar la información de rutas"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async (idRutaSesion: number) => {
    try {
      const loaded = await getRouteSettlement(idRutaSesion);
      setInventory(loaded);
      setClosingKilometers((previous) => previous || String(
        sessions.find((session) => session.id === idRutaSesion)?.kmFinal ?? "",
      ));
    } catch (error) {
      setInventory(null);
      toast.error(getApiErrorMessage(error, "No se pudo consultar la liquidación de la ruta"));
    }
  }, [sessions]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessionsAndProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessionsAndProducts]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const timer = window.setTimeout(() => void loadInventory(Number(selectedSessionId)), 0);
    return () => window.clearTimeout(timer);
  }, [selectedSessionId, loadInventory]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const dispatchProductOptions = useMemo(() => {
    const query = dispatchSearch.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const notAdded = !dispatchDraft.some((line) => line.idInventarioItem === product.id);
      const searchable = `${product.nombre} ${product.unidadMedida ?? ""} ${product.categoria}`.toLocaleLowerCase();
      return notAdded && (!query || searchable.includes(query));
    });
  }, [dispatchDraft, dispatchSearch, products]);

  async function refreshCurrentRoute() {
    setIsLoading(true);
    await loadSessionsAndProducts();
    if (selectedSessionId) await loadInventory(Number(selectedSessionId));
  }

  function selectRouteSession(id: string) {
    setSelectedSessionId(id);
    setInventory(null);
    setReturnDraft({});
    setAdjustmentItemId("");
    setDispatchDraft([]);
    setDispatchNotes("");
    setReturnNotes("");
  }

  function addDispatchProduct() {
    const id = Number(dispatchProductId);
    if (!id || dispatchDraft.some((line) => line.idInventarioItem === id)) return;
    setDispatchDraft((previous) => [
      ...previous,
      { idInventarioItem: id, cantidad: "", estadoEnvase: "" },
    ]);
    setDispatchProductId("");
  }

  async function submitDispatch() {
    if (!selectedSession || !user?.id) return;
    const detail = dispatchDraft.map((line) => ({
      idInventarioItem: line.idInventarioItem,
      cantidad: Number(line.cantidad),
      ...(line.estadoEnvase ? { estadoEnvase: line.estadoEnvase } : {}),
    }));
    if (
      detail.some((line) => !Number.isFinite(line.cantidad) || line.cantidad <= 0) ||
      dispatchDraft.some((line) =>
        productById.get(line.idInventarioItem)?.esEnvaseRetornable && !line.estadoEnvase,
      )
    ) {
      toast.error("Ingresa una cantidad mayor que cero para cada producto");
      return;
    }

    setIsSaving(true);
    try {
      await createRouteDispatch(selectedSession.id, { observaciones: dispatchNotes, detalle: detail });
      toast.success("Despacho confirmado; existencias de planta actualizadas");
      setDispatchDraft([]);
      setDispatchNotes("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo confirmar el despacho"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitReturn() {
    if (!selectedSession) return;
    const invalidQuantities = Object.entries(returnDraft).some(([id, line]) => {
      const received = Number(line.cantidadRecibida || 0);
      const damaged = Number(line.cantidadDanada || 0);
      const empty = Number(line.cantidadEnvaseVacio || 0);
      const full = Number(line.cantidadEnvaseLleno || 0);
      const product = productById.get(Number(id));
      return (
        !Number.isFinite(received) ||
        !Number.isFinite(damaged) ||
        !Number.isFinite(empty) ||
        !Number.isFinite(full) ||
        received < 0 ||
        damaged < 0 ||
        damaged > received ||
        (damaged > 0 && !line.ubicacionDanada.trim()) ||
        (received > 0 && product?.esEnvaseRetornable &&
          (!Number.isInteger(received) ||
            !Number.isInteger(damaged) ||
            !Number.isInteger(empty) ||
            !Number.isInteger(full) ||
            empty + full + damaged !== received ||
            (damaged > 0 && !line.estadoEnvaseDanado))) ||
        (product?.esEnvaseRetornable === false && (empty > 0 || full > 0 || line.estadoEnvaseDanado))
      );
    });
    if (invalidQuantities) {
      toast.error("Verifica las cantidades y registra la ubicación de todo producto dañado");
      return;
    }
    const detail = Object.entries(returnDraft)
      .map(([id, line]) => ({
        idInventarioItem: Number(id),
        cantidadRecibida: Number(line.cantidadRecibida),
        cantidadDanada: Number(line.cantidadDanada),
        cantidadEnvaseVacio: Number(line.cantidadEnvaseVacio || 0),
        cantidadEnvaseLleno: Number(line.cantidadEnvaseLleno || 0),
        ...(line.estadoEnvaseDanado ? { estadoEnvaseDanado: line.estadoEnvaseDanado } : {}),
        observaciones: line.observaciones.trim() || undefined,
        ubicacionDanada: line.ubicacionDanada.trim() || undefined,
      }))
      .filter((line) => line.cantidadRecibida > 0);

    setIsSaving(true);
    try {
      await createRouteReturn(selectedSession.id, { observaciones: returnNotes, detalle: detail });
      toast.success("Recepción física registrada; el producto apto pasará a planta al cerrar la ruta");
      setReturnNotes("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la devolución"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitAdjustment() {
    const selectedPendingLine =
      inventory?.diferenciasPendientes?.find((line) => String(line.idInventarioItem) === adjustmentItemId) ??
      inventory?.diferenciasPendientes?.[0];
    if (!selectedSession || !selectedPendingLine) return;
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || adjustmentReason.trim().length < 3) {
      toast.error("Registra una cantidad válida y el motivo de la diferencia");
      return;
    }

    setIsSaving(true);
    try {
      await createRouteAdjustment(selectedSession.id, {
        idInventarioItem: selectedPendingLine.idInventarioItem,
        clasificacion: adjustmentClass,
        cantidad: amount,
        motivo: adjustmentReason.trim(),
      });
      toast.success("Diferencia autorizada y auditada");
      setAdjustmentAmount("");
      setAdjustmentReason("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo autorizar la diferencia"));
    } finally {
      setIsSaving(false);
    }
  }

  async function closeRoute() {
    if (!selectedSession || inventory?.idRutaSesion !== selectedSession.id || !inventory.conciliada) return;
    const kmFinal = Number(closingKilometers);
    if (!Number.isFinite(kmFinal) || kmFinal < (selectedSession.kmInicial ?? 0)) {
      toast.error("El kilometraje final debe ser válido y no menor al inicial");
      return;
    }

    setIsSaving(true);
    try {
      await updateRutaSesion(selectedSession.idRuta, selectedSession.id, {
        estado: "CERRADA",
        kmFinal,
      });
      toast.success("Ruta cerrada y liquidada");
      await loadSessionsAndProducts();
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cerrar la ruta"));
    } finally {
      setIsSaving(false);
    }
  }

  const canOperate = selectedSession?.estado === "EN_CURSO";
  const visibleInventory =
    selectedSession && inventory?.idRutaSesion === selectedSession.id ? inventory : null;
  const selectedPendingLine =
    visibleInventory?.diferenciasPendientes?.find((line) => String(line.idInventarioItem) === adjustmentItemId) ??
    visibleInventory?.diferenciasPendientes?.[0];

  return (
    <RequireAuth>
      <DashboardShell
        title="Despacho y liquidación de rutas"
        description="Control transaccional de carga, ventas, devoluciones, diferencias y cierre de cada vehículo."
        printContentOnly
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-72 space-y-1.5">
              <Label htmlFor="route-session-search">Filtrar historial por fecha, ruta, vehículo, personal o estado</Label>
              <Input
                id="route-session-search"
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder="Fecha, ruta, placa, chofer, vendedor o estado"
              />
              <Label htmlFor="route-session">Sesión seleccionada</Label>
              <Select value={selectedSessionId} onValueChange={selectRouteSession}>
                <SelectTrigger id="route-session">
                  <SelectValue placeholder="Selecciona una sesión" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSessions.map((session) => (
                    <SelectItem key={session.id} value={String(session.id)}>
                      {session.ruta?.nombre ?? `Ruta ${session.idRuta}`} · {session.vehiculo?.placa ?? `Vehículo ${session.idVehiculo}`} · {session.estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refreshCurrentRoute()} disabled={isLoading || isSaving}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Actualizar
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!visibleInventory}>
                <Printer className="size-4" />
                Imprimir liquidación
              </Button>
            </div>
          </div>

          {!selectedSession && !isLoading ? (
            <Card className="rounded-xl">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No hay sesiones de ruta disponibles. Crea una sesión en logística y ponla en curso para operar.
              </CardContent>
            </Card>
          ) : null}

          {isLoading && !visibleInventory ? (
            <Card className="rounded-xl">
              <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Cargando inventario de ruta…
              </CardContent>
            </Card>
          ) : null}

          {selectedSession && visibleInventory ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-xl">
                  <CardContent className="space-y-1 p-4">
                    <p className="text-sm text-muted-foreground">Vehículo / sesión</p>
                    <p className="flex items-center gap-2 font-semibold">
                      <Truck className="size-4" />
                      {selectedSession.vehiculo?.placa ?? `Vehículo ${selectedSession.idVehiculo}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedSession.ruta?.nombre ?? `Ruta ${selectedSession.idRuta}`} · {formatDate(selectedSession.fechaSesion)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chofer: {selectedSession.chofer?.nombre ?? "-"} · Vendedor: {selectedSession.vendedor?.nombre ?? "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="space-y-1 p-4">
                    <p className="text-sm text-muted-foreground">Despacho / devolución</p>
                    <p className="font-semibold">
                      {visibleInventory.despacho ? `Despachado ${formatDate(visibleInventory.despacho.fechaRegistro)}` : "Pendiente de despacho"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {visibleInventory.devolucion ? `Recibido ${formatDate(visibleInventory.devolucion.fechaRegistro)}` : "Devolución aún no registrada"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="space-y-1 p-4">
                    <p className="text-sm text-muted-foreground">Estado de conciliación</p>
                    <Badge variant={visibleInventory.conciliada ? "default" : "destructive"}>
                      {visibleInventory.conciliada ? "Conciliada" : `${visibleInventory.diferenciasPendientes?.length ?? 0} diferencias pendientes`}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Las cantidades se calculan desde movimientos confirmados.</p>
                  </CardContent>
                </Card>
              </section>

              {!visibleInventory.despacho && canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Despacho inicial</h2>
                      <p className="text-sm text-muted-foreground">Confirma una sola carga por sesión. El servidor valida y descuenta la existencia de planta en una transacción.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        value={dispatchSearch}
                        onChange={(event) => setDispatchSearch(event.target.value)}
                        placeholder="Filtrar por nombre o presentación"
                        className="md:col-span-2"
                      />
                      <Select value={dispatchProductId} onValueChange={setDispatchProductId}>
                        <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                        <SelectContent>
                          {dispatchProductOptions.map((product) => (
                            <SelectItem key={product.id} value={String(product.id)}>
                              {product.nombre} · {product.unidadMedida ?? "sin unidad"} · Planta: {product.existencia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={addDispatchProduct} disabled={!dispatchProductId}>Agregar producto</Button>
                    </div>
                    {dispatchDraft.length ? (
                      <Table>
                        <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Existencia planta</TableHead><TableHead>Cantidad</TableHead><TableHead>Estado envase</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>
                          {dispatchDraft.map((line) => {
                            const product = productById.get(line.idInventarioItem);
                            return (
                              <TableRow key={line.idInventarioItem}>
                                <TableCell>{product?.nombre ?? `Producto ${line.idInventarioItem}`}</TableCell>
                                <TableCell>{product?.existencia ?? "-"}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={line.cantidad}
                                    onChange={(event) => setDispatchDraft((previous) => previous.map((item) =>
                                      item.idInventarioItem === line.idInventarioItem ? { ...item, cantidad: event.target.value } : item,
                                    ))}
                                    className="max-w-32"
                                  />
                                </TableCell>
                                <TableCell>
                                  {product?.esEnvaseRetornable ? (
                                    <Select
                                      value={line.estadoEnvase}
                                      onValueChange={(value) => setDispatchDraft((previous) => previous.map((item) =>
                                        item.idInventarioItem === line.idInventarioItem
                                          ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" }
                                          : item,
                                      ))}
                                    >
                                      <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="VACIO">Vacío</SelectItem>
                                        <SelectItem value="LLENO">Lleno</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : "—"}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => setDispatchDraft((previous) => previous.filter((item) => item.idInventarioItem !== line.idInventarioItem))}>Quitar</Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : <p className="text-sm text-muted-foreground">Agrega los productos que se cargarán al vehículo.</p>}
                    <Textarea value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} maxLength={255} placeholder="Observaciones del despacho" />
                    <Button onClick={() => void submitDispatch()} disabled={!canCreate || isSaving || dispatchDraft.length === 0}>
                      {isSaving ? <Loader2 className="size-4 animate-spin" /> : null} Confirmar despacho
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {visibleInventory.productos.length > 0 ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Inventario y liquidación por producto</h2>
                      <p className="text-sm text-muted-foreground">Las devoluciones vendibles aumentan el saldo del vehículo; las no vendibles se concilian físicamente, pero no quedan disponibles para reventa.</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead><TableHead>Despachado</TableHead><TableHead>Vendido</TableHead>
                          <TableHead>Dev. comercial</TableHead><TableHead>No vendible</TableHead>
                          <TableHead>Devuelto</TableHead><TableHead>Dañado</TableHead><TableHead>Ajustado</TableHead>
                          <TableHead>Reservado</TableHead><TableHead>Disponible</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleInventory.productos.map((line) => (
                          <TableRow key={line.idInventarioItem}>
                            <TableCell>{line.nombre}<span className="block text-xs text-muted-foreground">{line.unidadMedida ?? ""}</span></TableCell>
                            <TableCell>{line.despachado}</TableCell><TableCell>{line.vendido}</TableCell>
                            <TableCell>{line.devolucionComercial}</TableCell><TableCell>{line.noVendibleComercial}</TableCell>
                            <TableCell>{line.devuelto}</TableCell><TableCell>{line.danado}</TableCell>
                            <TableCell>{line.ajustado}</TableCell>
                            <TableCell>{line.reservado}</TableCell>
                            <TableCell className={line.disponible > 0.009 ? "font-semibold text-amber-700" : ""}>{line.disponible}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}

              {visibleInventory.despacho && !visibleInventory.devolucion && canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Recepción de devolución</h2>
                      <p className="text-sm text-muted-foreground">Registra lo recibido físicamente, incluidos los productos devueltos por clientes que permanecen en el vehículo. Solo lo vendible se traslada a planta al cerrar.</p>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Producto / saldo físico</TableHead><TableHead>Recibido</TableHead><TableHead>Vacíos</TableHead><TableHead>Llenos</TableHead><TableHead>Dañado</TableHead><TableHead>Estado antes de daño</TableHead><TableHead>Ubicación no vendible</TableHead><TableHead>Observaciones</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {visibleInventory.productos.filter((line) => line.pendienteConciliacion - line.reservado > 0.009).map((line) => (
                          <TableRow key={line.idInventarioItem}>
                            <TableCell>{line.nombre}<span className="block text-xs text-muted-foreground">Saldo físico: {Number(Math.max(0, line.pendienteConciliacion - line.reservado).toFixed(2))}</span></TableCell>
                            <TableCell><Input type="number" min="0" step="0.01" value={returnDraft[line.idInventarioItem]?.cantidadRecibida ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadRecibida: event.target.value } }))} className="max-w-28" /></TableCell>
                            <TableCell>{productById.get(line.idInventarioItem)?.esEnvaseRetornable ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseVacio ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadEnvaseVacio: event.target.value } }))} className="max-w-24" /> : "—"}</TableCell>
                            <TableCell>{productById.get(line.idInventarioItem)?.esEnvaseRetornable ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseLleno ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadEnvaseLleno: event.target.value } }))} className="max-w-24" /> : "—"}</TableCell>
                            <TableCell><Input type="number" min="0" step={productById.get(line.idInventarioItem)?.esEnvaseRetornable ? "1" : "0.01"} value={returnDraft[line.idInventarioItem]?.cantidadDanada ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadDanada: event.target.value } }))} className="max-w-28" /></TableCell>
                            <TableCell>{productById.get(line.idInventarioItem)?.esEnvaseRetornable ? <Select value={returnDraft[line.idInventarioItem]?.estadoEnvaseDanado ?? ""} onValueChange={(value) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], estadoEnvaseDanado: value as "VACIO" | "LLENO" } }))}><SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="VACIO">Vacío</SelectItem><SelectItem value="LLENO">Lleno</SelectItem></SelectContent></Select> : "—"}</TableCell>
                            <TableCell><Input value={returnDraft[line.idInventarioItem]?.ubicacionDanada ?? ""} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], ubicacionDanada: event.target.value } }))} maxLength={255} placeholder="Obligatorio si hay unidades dañadas" /></TableCell>
                            <TableCell><Input value={returnDraft[line.idInventarioItem]?.observaciones ?? ""} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], observaciones: event.target.value } }))} maxLength={255} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} maxLength={255} placeholder="Observaciones de recepción" />
                    <Button onClick={() => void submitReturn()} disabled={!canCreate || isSaving || visibleInventory.productos.every((line) => line.pendienteConciliacion - line.reservado <= 0.009)}>
                      Confirmar recepción
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {visibleInventory.devolucion && (visibleInventory.diferenciasPendientes?.length ?? 0) > 0 && canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Autorizar diferencias</h2>
                      <p className="text-sm text-muted-foreground">La clasificación y el motivo quedan auditados con el usuario autenticado que autoriza.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Producto con diferencia</Label>
                        <Select
                          value={selectedPendingLine ? String(selectedPendingLine.idInventarioItem) : ""}
                          onValueChange={setAdjustmentItemId}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                          <SelectContent>
                            {visibleInventory.diferenciasPendientes?.map((line) => (
                              <SelectItem key={line.idInventarioItem} value={String(line.idInventarioItem)}>
                                {line.nombre} · pendiente {Number(Math.max(0, line.pendienteConciliacion - line.reservado).toFixed(2))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Clasificación</Label>
                        <Select value={adjustmentClass} onValueChange={(value) => setAdjustmentClass(value as typeof adjustmentClass)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FALTANTE">Faltante</SelectItem>
                            <SelectItem value="DANADO">Dañado no recibido</SelectItem>
                            <SelectItem value="OTRO">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={adjustmentAmount}
                          placeholder={selectedPendingLine ? String(Number(Math.max(0, selectedPendingLine.pendienteConciliacion - selectedPendingLine.reservado).toFixed(2))) : ""}
                          onChange={(event) => setAdjustmentAmount(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Motivo obligatorio</Label>
                        <Input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={255} />
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void submitAdjustment()} disabled={!canUpdate || isSaving}>
                      Registrar autorización de diferencia
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {selectedSession.estado === "EN_CURSO" ? (
                <Card className="rounded-xl">
                  <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
                    <div className="max-w-sm space-y-1.5">
                      <Label htmlFor="closing-km">Kilometraje final</Label>
                      <Input id="closing-km" type="number" min={selectedSession.kmInicial ?? 0} value={closingKilometers} onChange={(event) => setClosingKilometers(event.target.value)} />
                      <p className="text-xs text-muted-foreground">El backend rechazará el cierre si quedan cantidades sin conciliar.</p>
                    </div>
                    <Button onClick={() => void closeRoute()} disabled={!canUpdate || !visibleInventory.conciliada || isSaving}>
                      Cerrar y liquidar ruta
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-xl">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    Sesión {selectedSession.estado.toLowerCase()}. Cierre registrado: {formatDate(selectedSession.fechaCierre ?? null)}.
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
