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
  closeRouteSession,
  cancelRouteDispatch,
  cancelRouteReturn,
  cancelVehicleTransfer,
  confirmVehicleTransfer,
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  createVehicleHandoff,
  createVehicleTransfer,
  getRouteSettlement,
  listDispatchProducts,
  listDispatchRutaSesiones,
  listRutas,
  listVehicleTransfers,
  listVehiculos,
  rejectVehicleTransfer,
} from "@/services/logistics.service";
import { getLogisticsEmployeeOptions } from "@/lib/logistics-employee-options";
import { listEmployees } from "@/services/employees.service";
import type {
  DispatchProductDto,
  RouteInventoryDto,
  RutaDto,
  RutaSesionDto,
  TransferenciaVehiculoDto,
  TransferDetailLineInput,
  VehicleHandoffResultDto,
  VehiculoDto,
} from "@/types/logistics";

type DispatchDraft = {
  idInventarioItem: number;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "";
};
type TransferDraft = {
  idInventarioItem: number;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "";
};
type HandoffFormState = {
  idRuta: string;
  idVehiculo: string;
  idUsuarioChofer: string;
  idUsuarioVendedor: string;
  kmInicialEntrante: string;
  motivo: string;
};
type ReturnDraft = {
  cantidadRecibida: string;
  cantidadDanada: string;
  cantidadEnvaseVacio: string;
  cantidadEnvaseLleno: string;
  estadoEnvaseDanado: "VACIO" | "LLENO" | "";
  observaciones: string;
  ubicacionDanada: "" | "CUARENTENA" | "OTRA";
  ubicacionDanadaDetalle: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

async function loadAllDispatchProducts() {
  const products: DispatchProductDto[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await listDispatchProducts({ page, limit: 100 });
    products.push(...result.items);
    totalPages = result.pagination.totalPages;
    page += 1;
  }

  return products;
}

export default function RouteOperationsPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "despacho", "create");
  const canUpdate = hasModulePermission(user, "despacho", "update");
  const [sessions, setSessions] = useState<RutaSesionDto[]>([]);
  const [products, setProducts] = useState<DispatchProductDto[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [inventory, setInventory] = useState<RouteInventoryDto | null>(null);
  const [dispatchDraft, setDispatchDraft] = useState<DispatchDraft[]>([]);
  const [dispatchCancellationReason, setDispatchCancellationReason] = useState("");
  const [dispatchProductId, setDispatchProductId] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [returnDraft, setReturnDraft] = useState<Record<number, ReturnDraft>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [returnCancellationReason, setReturnCancellationReason] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentClass, setAdjustmentClass] = useState<"FALTANTE" | "DANADO" | "OTRO">("FALTANTE");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [closingKilometers, setClosingKilometers] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fase 2 - Distribución: transferencias parciales y relevo con custodia compartida.
  const [transfers, setTransfers] = useState<TransferenciaVehiculoDto[]>([]);
  const [transferDestinoId, setTransferDestinoId] = useState("");
  const [transferDraft, setTransferDraft] = useState<TransferDraft[]>([]);
  const [transferProductId, setTransferProductId] = useState("");
  const [transferMotivo, setTransferMotivo] = useState("");
  const [transferRejectReason, setTransferRejectReason] = useState<Record<number, string>>({});
  const [transferCancelReason, setTransferCancelReason] = useState<Record<number, string>>({});
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [routesCatalog, setRoutesCatalog] = useState<RutaDto[]>([]);
  const [vehiclesCatalog, setVehiclesCatalog] = useState<VehiculoDto[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ userId: number; nombre: string }>>([]);
  const [handoffForm, setHandoffForm] = useState<HandoffFormState>({
    idRuta: "",
    idVehiculo: "",
    idUsuarioChofer: "",
    idUsuarioVendedor: "",
    kmInicialEntrante: "",
    motivo: "",
  });
  const [handoffDraft, setHandoffDraft] = useState<TransferDraft[]>([]);
  const [handoffProductId, setHandoffProductId] = useState("");
  const [isSavingHandoff, setIsSavingHandoff] = useState(false);
  const [handoffResult, setHandoffResult] = useState<VehicleHandoffResultDto | null>(null);

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
      const [loadedSessions, productResult, loadedRoutes, loadedVehicles, employeeList] = await Promise.all([
        listDispatchRutaSesiones({ anulado: false }),
        loadAllDispatchProducts(),
        listRutas({ anulado: false }),
        listVehiculos({ anulado: false }),
        listEmployees(),
      ]);
      setSessions(loadedSessions);
      setProducts(productResult);
      setRoutesCatalog(loadedRoutes);
      setVehiclesCatalog(loadedVehicles);
      setEmployeeOptions(getLogisticsEmployeeOptions(employeeList));
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

  const loadTransfers = useCallback(async (idRutaSesion: number) => {
    try {
      const loaded = await listVehicleTransfers({ idRutaSesion });
      setTransfers(loaded);
    } catch (error) {
      setTransfers([]);
      toast.error(getApiErrorMessage(error, "No se pudo consultar las transferencias de la sesión"));
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

  useEffect(() => {
    if (!selectedSessionId) return;
    const timer = window.setTimeout(() => void loadTransfers(Number(selectedSessionId)), 0);
    return () => window.clearTimeout(timer);
  }, [selectedSessionId, loadTransfers]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const dispatchProductOptions = useMemo(() => {
    const query = dispatchSearch.trim().toLocaleLowerCase();
    return products.filter((product) => {
      if (!product.esVendible) return false;
      const notAdded = !dispatchDraft.some((line) => line.idInventarioItem === product.id);
      const searchable = `${product.nombre} ${product.unidadMedida ?? ""} ${product.categoria}`.toLocaleLowerCase();
      return notAdded && (!query || searchable.includes(query));
    });
  }, [dispatchDraft, dispatchSearch, products]);

  const transferDestinoOptions = useMemo(
    () => sessions.filter((session) => session.estado === "EN_CURSO" && session.id !== selectedSession?.id),
    [sessions, selectedSession],
  );
  const transferProductOptions = useMemo(
    () => products.filter((product) => !transferDraft.some((line) => line.idInventarioItem === product.id)),
    [products, transferDraft],
  );
  const handoffProductOptions = useMemo(
    () => products.filter((product) => !handoffDraft.some((line) => line.idInventarioItem === product.id)),
    [products, handoffDraft],
  );
  const handoffVehicleOptions = useMemo(
    () => vehiclesCatalog.filter((vehicle) => vehicle.id !== selectedSession?.idVehiculo),
    [vehiclesCatalog, selectedSession],
  );
  const sessionLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const session of sessions) {
      map.set(session.id, `${session.vehiculo?.placa ?? `Vehículo ${session.idVehiculo}`} · ${formatDate(session.fechaSesion)}`);
    }
    return map;
  }, [sessions]);

  async function refreshCurrentRoute() {
    setIsLoading(true);
    await loadSessionsAndProducts();
    if (selectedSessionId) {
      await loadInventory(Number(selectedSessionId));
      await loadTransfers(Number(selectedSessionId));
    }
  }

  function selectRouteSession(id: string) {
    setSelectedSessionId(id);
    setInventory(null);
    setTransfers([]);
    setReturnDraft({});
    setDispatchCancellationReason("");
    setReturnCancellationReason("");
    setAdjustmentItemId("");
    setDispatchDraft([]);
    setDispatchNotes("");
    setReturnNotes("");
    setTransferDraft([]);
    setTransferDestinoId("");
    setTransferMotivo("");
    setHandoffDraft([]);
    setHandoffForm({
      idRuta: "",
      idVehiculo: "",
      idUsuarioChofer: "",
      idUsuarioVendedor: "",
      kmInicialEntrante: "",
      motivo: "",
    });
    setHandoffResult(null);
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
    if (dispatchDraft.some((line) => productById.get(line.idInventarioItem)?.esVendible !== true)) {
      toast.error("Solo puedes despachar productos habilitados para la venta. Actualiza el catálogo e inténtalo de nuevo.");
      return;
    }
    if (detail.some((line) => !Number.isFinite(line.cantidad) || line.cantidad <= 0)) {
      toast.error("Ingresa una cantidad mayor que cero para cada producto");
      return;
    }
    if (dispatchDraft.some((line) =>
      productById.get(line.idInventarioItem)?.esEnvaseRetornable && !line.estadoEnvase,
    )) {
      toast.error("Selecciona si cada envase retornable se despacha vacío o lleno");
      return;
    }
    for (const line of dispatchDraft) {
      const product = productById.get(line.idInventarioItem);
      const quantity = Number(line.cantidad);
      if (!product) continue;
      if (quantity > product.existencia) {
        toast.error(`Stock de catálogo insuficiente para ${product.nombre}: disponible ${product.existencia}, solicitado ${quantity}`);
        return;
      }
      if (product.esEnvaseRetornable) {
        if (!Number.isInteger(quantity)) {
          toast.error(`La cantidad de envases debe ser entera (${product.nombre})`);
          return;
        }
        const available = line.estadoEnvase === "VACIO"
          ? product.stockEnvasePlanta?.vacio ?? 0
          : product.stockEnvasePlanta?.lleno ?? 0;
        if (quantity > available) {
          const pending = product.stockEnvasePlanta?.pendienteClasificacion ?? 0;
          toast.error(
            `Stock físico insuficiente para ${product.nombre} (${line.estadoEnvase}): disponible ${available}, solicitado ${quantity}.${pending > 0 ? ` Hay ${pending} pendiente(s) de clasificación en Envases.` : ""}`,
          );
          return;
        }
      }
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
      const routeLine = inventory?.productos.find((item) => item.idInventarioItem === Number(id));
      const isReturnableContainer = routeLine?.estadoEnvaseDespachado != null;
      return (
        !Number.isFinite(received) ||
        !Number.isFinite(damaged) ||
        !Number.isFinite(empty) ||
        !Number.isFinite(full) ||
        received < 0 ||
        damaged < 0 ||
        damaged > received ||
        (damaged > 0 &&
          (!line.ubicacionDanada ||
            (line.ubicacionDanada === "OTRA" && !line.ubicacionDanadaDetalle?.trim()))) ||
        (received > 0 && isReturnableContainer &&
          (!Number.isInteger(received) ||
            !Number.isInteger(damaged) ||
            !Number.isInteger(empty) ||
            !Number.isInteger(full) ||
            empty + full + damaged !== received ||
            (damaged > 0 && !line.estadoEnvaseDanado))) ||
        (!isReturnableContainer && (empty > 0 || full > 0 || line.estadoEnvaseDanado))
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
        observaciones: line.observaciones?.trim() || undefined,
        ...(Number(line.cantidadDanada) > 0
          ? {
              ubicacionDanada:
                line.ubicacionDanada === "CUARENTENA"
                  ? "Cuarentena"
                  : line.ubicacionDanadaDetalle?.trim() ?? "",
            }
          : {}),
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

  async function submitDispatchCancellation() {
    if (!selectedSession || !inventory?.despacho) return;
    const motivo = dispatchCancellationReason.trim();
    if (motivo.length < 3) {
      toast.error("Indica el motivo de anulación (mínimo 3 caracteres)");
      return;
    }

    setIsSaving(true);
    try {
      await cancelRouteDispatch(selectedSession.id, { motivo });
      toast.success("Despacho anulado y existencias restauradas con trazabilidad; puedes capturarlo nuevamente");
      setDispatchCancellationReason("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el despacho"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitReturnCancellation() {
    if (!selectedSession || !inventory?.devolucion) return;
    const motivo = returnCancellationReason.trim();
    if (motivo.length < 3) {
      toast.error("Indica el motivo de anulación (mínimo 3 caracteres)");
      return;
    }

    setIsSaving(true);
    try {
      await cancelRouteReturn(selectedSession.id, { motivo });
      toast.success("Recepción anulada con trazabilidad; puedes volver a capturar las cantidades físicas correctas");
      setReturnCancellationReason("");
      setReturnDraft({});
      setReturnNotes("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la devolución"));
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

  // Fase 2 - Distribución: transferencias parciales entre vehículos (D-DIST-04).
  // El backend valida disponibilidad dentro de una transacción SERIALIZABLE; aquí solo
  // se capturan los datos, sin duplicar esa regla de negocio.
  function addTransferProduct() {
    const id = Number(transferProductId);
    if (!id || transferDraft.some((line) => line.idInventarioItem === id)) return;
    setTransferDraft((previous) => [...previous, { idInventarioItem: id, cantidad: "", estadoEnvase: "" }]);
    setTransferProductId("");
  }

  function buildTransferDetail(draft: TransferDraft[]): TransferDetailLineInput[] {
    return draft.map((line) => ({
      idInventarioItem: line.idInventarioItem,
      cantidad: Number(line.cantidad),
      ...(line.estadoEnvase ? { estadoEnvase: line.estadoEnvase } : {}),
    }));
  }

  async function submitTransfer() {
    if (!selectedSession) return;
    const destinoId = Number(transferDestinoId);
    if (!destinoId) {
      toast.error("Selecciona la sesión de vehículo destino");
      return;
    }
    if (transferDraft.length === 0 || transferDraft.some((line) => !Number(line.cantidad) || Number(line.cantidad) <= 0)) {
      toast.error("Agrega al menos un producto con cantidad mayor a cero");
      return;
    }
    if (transferMotivo.trim().length < 3) {
      toast.error("Indica el motivo de la transferencia (mínimo 3 caracteres)");
      return;
    }

    setIsSavingTransfer(true);
    try {
      await createVehicleTransfer({
        idRutaSesionOrigen: selectedSession.id,
        idRutaSesionDestino: destinoId,
        motivo: transferMotivo.trim(),
        detalle: buildTransferDetail(transferDraft),
      });
      toast.success("Transferencia registrada en estado PENDIENTE; el destino debe confirmarla");
      setTransferDraft([]);
      setTransferDestinoId("");
      setTransferMotivo("");
      await loadTransfers(selectedSession.id);
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la transferencia"));
    } finally {
      setIsSavingTransfer(false);
    }
  }

  async function submitConfirmTransfer(transfer: TransferenciaVehiculoDto) {
    if (!selectedSession) return;
    setIsSavingTransfer(true);
    try {
      await confirmVehicleTransfer(transfer.id);
      toast.success("Transferencia confirmada; el inventario ya está disponible en este vehículo");
      await loadTransfers(selectedSession.id);
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo confirmar la transferencia"));
    } finally {
      setIsSavingTransfer(false);
    }
  }

  async function submitRejectTransfer(transfer: TransferenciaVehiculoDto) {
    if (!selectedSession) return;
    setIsSavingTransfer(true);
    try {
      await rejectVehicleTransfer(transfer.id, { motivo: transferRejectReason[transfer.id]?.trim() || undefined });
      toast.success("Transferencia rechazada; el inventario permanece en el vehículo de origen");
      setTransferRejectReason((previous) => ({ ...previous, [transfer.id]: "" }));
      await loadTransfers(selectedSession.id);
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo rechazar la transferencia"));
    } finally {
      setIsSavingTransfer(false);
    }
  }

  async function submitCancelTransfer(transfer: TransferenciaVehiculoDto) {
    if (!selectedSession) return;
    const motivo = transferCancelReason[transfer.id]?.trim() ?? "";
    if (motivo.length < 3) {
      toast.error("Indica el motivo de anulación (mínimo 3 caracteres)");
      return;
    }
    setIsSavingTransfer(true);
    try {
      await cancelVehicleTransfer(transfer.id, { motivo });
      toast.success("Transferencia anulada");
      setTransferCancelReason((previous) => ({ ...previous, [transfer.id]: "" }));
      await loadTransfers(selectedSession.id);
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la transferencia"));
    } finally {
      setIsSavingTransfer(false);
    }
  }

  // Fase 2 - Distribución: relevo de vehículo con custodia compartida (D-DIST-02/03).
  // La sesión saliente NO se cierra desde aquí; sigue operando hasta que su inventario
  // pendiente llegue a cero y se cierre por el flujo normal.
  function addHandoffProduct() {
    const id = Number(handoffProductId);
    if (!id || handoffDraft.some((line) => line.idInventarioItem === id)) return;
    setHandoffDraft((previous) => [...previous, { idInventarioItem: id, cantidad: "", estadoEnvase: "" }]);
    setHandoffProductId("");
  }

  async function submitHandoff() {
    if (!selectedSession) return;
    if (!handoffForm.idRuta || !handoffForm.idVehiculo || !handoffForm.idUsuarioChofer || !handoffForm.idUsuarioVendedor) {
      toast.error("Completa ruta, vehículo, chofer y vendedor de la sesión entrante");
      return;
    }
    if (handoffForm.motivo.trim().length < 3) {
      toast.error("Indica el motivo del relevo (mínimo 3 caracteres)");
      return;
    }
    if (handoffDraft.some((line) => !Number(line.cantidad) || Number(line.cantidad) <= 0)) {
      toast.error("Cada producto a transferir debe tener una cantidad mayor a cero");
      return;
    }

    setIsSavingHandoff(true);
    try {
      const result = await createVehicleHandoff(selectedSession.id, {
        motivo: handoffForm.motivo.trim(),
        idRuta: Number(handoffForm.idRuta),
        idVehiculo: Number(handoffForm.idVehiculo),
        idUsuarioChofer: Number(handoffForm.idUsuarioChofer),
        idUsuarioVendedor: Number(handoffForm.idUsuarioVendedor),
        kmInicialEntrante: Number(handoffForm.kmInicialEntrante || 0),
        ...(handoffDraft.length > 0 ? { detalle: buildTransferDetail(handoffDraft) } : {}),
      });
      setHandoffResult(result);
      toast.success(`Relevo registrado; nueva sesión #${result.sesionEntrante.id} EN_CURSO`);
      setHandoffDraft([]);
      setHandoffForm({
        idRuta: "",
        idVehiculo: "",
        idUsuarioChofer: "",
        idUsuarioVendedor: "",
        kmInicialEntrante: "",
        motivo: "",
      });
      await loadSessionsAndProducts();
      await loadInventory(selectedSession.id);
      await loadTransfers(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el relevo"));
    } finally {
      setIsSavingHandoff(false);
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
      await closeRouteSession(selectedSession.id, { kmFinal });
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
  const dispatchCanBeCancelled = Boolean(
    visibleInventory?.despacho &&
      selectedSession?.estado === "EN_CURSO" &&
      !visibleInventory.devolucion &&
      visibleInventory.productos.every((line) =>
        line.vendido <= 0.009 &&
        line.devolucionComercial <= 0.009 &&
        line.noVendibleComercial <= 0.009 &&
        line.devuelto <= 0.009 &&
        line.ajustado <= 0.009 &&
        line.reservado <= 0.009 &&
        (line.envasePrestado ?? 0) <= 0.009 &&
        (line.envaseDevuelto ?? 0) <= 0.009 &&
        (line.envaseBaja ?? 0) <= 0.009,
      ),
  );
  const returnCanBeCancelled = Boolean(
    visibleInventory?.devolucion &&
      selectedSession?.estado === "EN_CURSO" &&
      visibleInventory.productos.every((line) => line.ajustado <= 0.009),
  );
  const selectedPendingLine =
    visibleInventory?.diferenciasPendientes?.find((line) => String(line.idInventarioItem) === adjustmentItemId) ??
    visibleInventory?.diferenciasPendientes?.[0];

  return (
    <RequireAuth moduleKey="despacho" action="read">
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
              {selectedSession.estado === "PROGRAMADA" ? (
                <Card className="rounded-xl border-amber-500/50">
                  <CardContent className="p-4 text-sm">
                    El despacho, la devolución y el cierre están disponibles únicamente cuando la sesión está EN_CURSO.
                  </CardContent>
                </Card>
              ) : null}
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
                    {visibleInventory.devolucionesAnuladas?.map((routeReturn) => (
                      <p key={routeReturn.id} className="text-xs text-muted-foreground">
                        Recepción anterior anulada {formatDate(routeReturn.fechaAnulacion)} · {routeReturn.motivoAnulacion}
                        {routeReturn.usuarioAnulador ? ` · ${routeReturn.usuarioAnulador.nombre}` : ""}
                      </p>
                    ))}
                    {visibleInventory.despacho && canOperate ? (
                      <div className="space-y-2 border-t pt-3">
                        {dispatchCanBeCancelled ? (
                          <>
                            <Label htmlFor="dispatch-cancellation-reason">Motivo obligatorio para anular</Label>
                            <Input
                              id="dispatch-cancellation-reason"
                              value={dispatchCancellationReason}
                              onChange={(event) => setDispatchCancellationReason(event.target.value)}
                              maxLength={255}
                              placeholder="Ej. Estado del envase capturado incorrectamente"
                            />
                            <Button
                              variant="destructive"
                              onClick={() => void submitDispatchCancellation()}
                              disabled={!canUpdate || isSaving || dispatchCancellationReason.trim().length < 3}
                            >
                              Anular despacho y volver a capturar
                            </Button>
                            {!canUpdate ? (
                              <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para anular despachos.</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Solo se permite antes de ventas, devoluciones, ajustes o cierre. La reversión queda auditada.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            El despacho ya tiene movimientos posteriores; no se puede anular para proteger ventas, devoluciones y liquidaciones.
                          </p>
                        )}
                      </div>
                    ) : null}
                    {visibleInventory.devolucion && canOperate ? (
                      <div className="space-y-2 border-t pt-3">
                        {returnCanBeCancelled ? (
                          <>
                            <Label htmlFor="return-cancellation-reason">Motivo obligatorio para corregir la recepción</Label>
                            <Input
                              id="return-cancellation-reason"
                              value={returnCancellationReason}
                              onChange={(event) => setReturnCancellationReason(event.target.value)}
                              maxLength={255}
                              placeholder="Ej. Se clasificaron mal los envases vacíos y llenos"
                            />
                            <Button
                              variant="destructive"
                              onClick={() => void submitReturnCancellation()}
                              disabled={!canUpdate || isSaving || returnCancellationReason.trim().length < 3}
                            >
                              Anular recepción y volver a capturar
                            </Button>
                            {!canUpdate ? (
                              <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para corregir recepciones.</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                La recepción anterior queda en el historial. Solo puede corregirse antes de autorizar diferencias o cerrar la ruta.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No se puede corregir la recepción después de autorizar diferencias o cerrar la ruta.
                          </p>
                        )}
                      </div>
                    ) : null}
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

              {canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">{visibleInventory.despacho ? "Nuevo despacho (reabastecimiento)" : "Despacho inicial"}</h2>
                      <p className="text-sm text-muted-foreground">
                        Puedes confirmar más de un despacho por sesión (reabastecimiento tras regresar a planta); se
                        suman al disponible del vehículo. El servidor valida y descuenta la existencia de planta en
                        una transacción.
                        {!canCreate ? " Tu rol no tiene permiso para crear despachos." : ""}
                      </p>
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
                              {product.nombre} · {product.unidadMedida ?? "sin unidad"} · Catálogo: {product.existencia}
                              {product.esEnvaseRetornable
                                ? ` · Físico planta: vacío ${product.stockEnvasePlanta?.vacio ?? 0}, lleno ${product.stockEnvasePlanta?.lleno ?? 0}, pendiente ${product.stockEnvasePlanta?.pendienteClasificacion ?? 0}`
                                : ""}
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
                                <TableCell>
                                  {product?.existencia ?? "-"}
                                  {product?.esEnvaseRetornable ? (
                                    <>
                                      <p className="text-xs text-muted-foreground">
                                        Físico verificado: vacío {product.stockEnvasePlanta?.vacio ?? 0}, lleno {product.stockEnvasePlanta?.lleno ?? 0}, pendiente de clasificar {product.stockEnvasePlanta?.pendienteClasificacion ?? 0}
                                      </p>
                                      {product.stockEnvasePlanta?.diferenciaCatalogo !== undefined &&
                                      product.stockEnvasePlanta.diferenciaCatalogo < -0.009 ? (
                                        <p className="text-xs text-destructive">
                                          El saldo físico supera el catálogo por {Math.abs(product.stockEnvasePlanta.diferenciaCatalogo)}.
                                        </p>
                                      ) : null}
                                    </>
                                  ) : null}
                                </TableCell>
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
                                    <>
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
                                      {line.estadoEnvase ? (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          Disponible verificado: {line.estadoEnvase === "VACIO"
                                            ? product.stockEnvasePlanta?.vacio ?? 0
                                            : product.stockEnvasePlanta?.lleno ?? 0}
                                        </p>
                                      ) : null}
                                    </>
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
                      <p className="text-sm text-muted-foreground">Las devoluciones vendibles aumentan el saldo del vehículo; las no vendibles se concilian físicamente, pero no quedan disponibles para reventa. &quot;Transferido&quot; refleja la custodia actual frente a otros vehículos (D-DIST-02/03/04).</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead><TableHead>Despachado</TableHead><TableHead>Vendido</TableHead>
                          <TableHead>Dev. comercial</TableHead><TableHead>No vendible</TableHead>
                          <TableHead>Devuelto</TableHead><TableHead>Dañado</TableHead><TableHead>Ajustado</TableHead>
                          <TableHead>Reservado</TableHead>
                          <TableHead>Transferido (salida)</TableHead><TableHead>Transferido (entrada)</TableHead>
                          <TableHead>Disponible</TableHead>
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
                            <TableCell>{line.transferidoSaliente ?? 0}</TableCell>
                            <TableCell>{line.transferidoRecibido ?? 0}</TableCell>
                            <TableCell className={line.disponible > 0.009 ? "font-semibold text-amber-700" : ""}>{line.disponible}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}

              {canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Transferencias parciales entre vehículos</h2>
                      <p className="text-sm text-muted-foreground">
                        Mueve parte del inventario disponible de este vehículo a otra sesión EN_CURSO. Queda PENDIENTE
                        hasta que el vehículo destino la confirme; mientras tanto ya no está disponible en el origen.
                        {!canCreate ? " Tu rol no tiene permiso para crear transferencias." : ""}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Sesión destino (vehículo)</Label>
                        <Select value={transferDestinoId} onValueChange={setTransferDestinoId}>
                          <SelectTrigger><SelectValue placeholder="Selecciona un vehículo EN_CURSO" /></SelectTrigger>
                          <SelectContent>
                            {transferDestinoOptions.map((session) => (
                              <SelectItem key={session.id} value={String(session.id)}>
                                {session.vehiculo?.placa ?? `Vehículo ${session.idVehiculo}`} · {session.ruta?.nombre ?? `Ruta ${session.idRuta}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Producto a transferir</Label>
                        <div className="flex gap-2">
                          <Select value={transferProductId} onValueChange={setTransferProductId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                            <SelectContent>
                              {transferProductOptions.map((product) => (
                                <SelectItem key={product.id} value={String(product.id)}>{product.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" onClick={addTransferProduct} disabled={!transferProductId}>
                            Agregar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {transferDraft.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Estado envase</TableHead>
                            <TableHead className="text-right">Quitar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transferDraft.map((line, index) => {
                            const product = productById.get(line.idInventarioItem);
                            return (
                              <TableRow key={line.idInventarioItem}>
                                <TableCell>{product?.nombre ?? line.idInventarioItem}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number" min="0" step="0.01" className="max-w-28"
                                    value={line.cantidad}
                                    onChange={(event) => setTransferDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, cantidad: event.target.value } : item))}
                                  />
                                </TableCell>
                                <TableCell>
                                  {product?.esEnvaseRetornable ? (
                                    <Select
                                      value={line.estadoEnvase}
                                      onValueChange={(value) => setTransferDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" } : item))}
                                    >
                                      <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="VACIO">Vacío</SelectItem>
                                        <SelectItem value="LLENO">Lleno</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => setTransferDraft((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                                    Quitar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : <p className="text-sm text-muted-foreground">Agrega los productos que se transferirán.</p>}

                    <Textarea value={transferMotivo} onChange={(event) => setTransferMotivo(event.target.value)} maxLength={255} placeholder="Motivo de la transferencia" />
                    <Button onClick={() => void submitTransfer()} disabled={!canCreate || isSavingTransfer || transferDraft.length === 0 || !transferDestinoId}>
                      {isSavingTransfer ? <Loader2 className="size-4 animate-spin" /> : null} Registrar transferencia
                    </Button>

                    {transfers.length > 0 ? (
                      <div className="space-y-2 border-t pt-3">
                        <h3 className="text-sm font-semibold">Transferencias de esta sesión</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Origen</TableHead><TableHead>Destino</TableHead><TableHead>Estado</TableHead>
                              <TableHead>Detalle</TableHead><TableHead>Motivo</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transfers.map((transfer) => {
                              const isDestino = transfer.idRutaSesionDestino === selectedSession.id;
                              const isOrigen = transfer.idRutaSesionOrigen === selectedSession.id;
                              const isPending = transfer.estadoConfirmacion === "PENDIENTE";
                              return (
                                <TableRow key={transfer.id}>
                                  <TableCell>{sessionLabelById.get(transfer.idRutaSesionOrigen) ?? `#${transfer.idRutaSesionOrigen}`}</TableCell>
                                  <TableCell>{sessionLabelById.get(transfer.idRutaSesionDestino) ?? `#${transfer.idRutaSesionDestino}`}</TableCell>
                                  <TableCell>
                                    <Badge variant={transfer.estadoConfirmacion === "CONFIRMADA" ? "default" : transfer.estadoConfirmacion === "RECHAZADA" ? "destructive" : "secondary"}>
                                      {transfer.estadoConfirmacion}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <ul className="text-xs text-muted-foreground">
                                      {transfer.detalle.map((item) => (
                                        <li key={item.idInventarioItem}>{item.nombre}: {item.cantidad}{item.estadoEnvase ? ` (${item.estadoEnvase})` : ""}</li>
                                      ))}
                                    </ul>
                                  </TableCell>
                                  <TableCell className="max-w-56 text-xs text-muted-foreground">{transfer.motivo}</TableCell>
                                  <TableCell className="text-right">
                                    {isPending && isDestino ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <Button size="sm" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitConfirmTransfer(transfer)}>
                                          Confirmar recepción
                                        </Button>
                                        <div className="flex gap-1">
                                          <Input
                                            className="h-8 max-w-40 text-xs"
                                            placeholder="Motivo de rechazo"
                                            value={transferRejectReason[transfer.id] ?? ""}
                                            onChange={(event) => setTransferRejectReason((previous) => ({ ...previous, [transfer.id]: event.target.value }))}
                                          />
                                          <Button size="sm" variant="destructive" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitRejectTransfer(transfer)}>
                                            Rechazar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : null}
                                    {isPending && isOrigen ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <Input
                                          className="h-8 max-w-40 text-xs"
                                          placeholder="Motivo de anulación"
                                          value={transferCancelReason[transfer.id] ?? ""}
                                          onChange={(event) => setTransferCancelReason((previous) => ({ ...previous, [transfer.id]: event.target.value }))}
                                        />
                                        <Button size="sm" variant="outline" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitCancelTransfer(transfer)}>
                                          Anular transferencia
                                        </Button>
                                      </div>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Relevo de vehículo (custodia compartida)</h2>
                      <p className="text-sm text-muted-foreground">
                        Sustituye este vehículo por otro sin cerrar la sesión actual: ambos pueden seguir operando.
                        Indica solo lo que se transfiera ahora; el resto permanece bajo custodia de este vehículo
                        hasta transferirse después o hasta cerrar esta sesión por el flujo normal.
                        {!canCreate ? " Tu rol no tiene permiso para registrar relevos." : ""}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label>Ruta de la sesión entrante</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={handoffForm.idRuta}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, idRuta: event.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {routesCatalog.map((item) => (
                            <option key={item.id} value={item.id}>{item.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Vehículo entrante</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={handoffForm.idVehiculo}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, idVehiculo: event.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {handoffVehicleOptions.map((item) => (
                            <option key={item.id} value={item.id}>{item.placa} - {item.marca}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Chofer entrante</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={handoffForm.idUsuarioChofer}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, idUsuarioChofer: event.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {employeeOptions.map((item) => (
                            <option key={item.userId} value={item.userId}>{item.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Vendedor entrante</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={handoffForm.idUsuarioVendedor}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, idUsuarioVendedor: event.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {employeeOptions.map((item) => (
                            <option key={item.userId} value={item.userId}>{item.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Km inicial entrante</Label>
                        <Input
                          type="number" min="0"
                          value={handoffForm.kmInicialEntrante}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, kmInicialEntrante: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                        <Label>Motivo del relevo</Label>
                        <Input
                          value={handoffForm.motivo} maxLength={255}
                          onChange={(event) => setHandoffForm((prev) => ({ ...prev, motivo: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Inventario a transferir ahora (opcional; el resto queda en este vehículo)</Label>
                      <div className="flex gap-2">
                        <Select value={handoffProductId} onValueChange={setHandoffProductId}>
                          <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                          <SelectContent>
                            {handoffProductOptions.map((product) => (
                              <SelectItem key={product.id} value={String(product.id)}>{product.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={addHandoffProduct} disabled={!handoffProductId}>
                          Agregar
                        </Button>
                      </div>
                      {handoffDraft.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producto</TableHead><TableHead>Cantidad</TableHead>
                              <TableHead>Estado envase</TableHead><TableHead className="text-right">Quitar</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {handoffDraft.map((line, index) => {
                              const product = productById.get(line.idInventarioItem);
                              return (
                                <TableRow key={line.idInventarioItem}>
                                  <TableCell>{product?.nombre ?? line.idInventarioItem}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number" min="0" step="0.01" className="max-w-28"
                                      value={line.cantidad}
                                      onChange={(event) => setHandoffDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, cantidad: event.target.value } : item))}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {product?.esEnvaseRetornable ? (
                                      <Select
                                        value={line.estadoEnvase}
                                        onValueChange={(value) => setHandoffDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" } : item))}
                                      >
                                        <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="VACIO">Vacío</SelectItem>
                                          <SelectItem value="LLENO">Lleno</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => setHandoffDraft((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                                      Quitar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : null}
                    </div>

                    <Button onClick={() => void submitHandoff()} disabled={!canCreate || isSavingHandoff}>
                      {isSavingHandoff ? <Loader2 className="size-4 animate-spin" /> : null} Registrar relevo
                    </Button>

                    {handoffResult ? (
                      <div className="space-y-3 border-t pt-3">
                        <h3 className="text-sm font-semibold">
                          Resultado: nueva sesión #{handoffResult.sesionEntrante.id} ({handoffResult.sesionEntrante.estado})
                        </h3>
                        {handoffResult.transferenciaInventario ? (
                          <p className="text-xs text-muted-foreground">
                            Transferencia #{handoffResult.transferenciaInventario.id} ({handoffResult.transferenciaInventario.estadoConfirmacion}):{" "}
                            {handoffResult.transferenciaInventario.detalle.map((item) => `${item.nombre}: ${item.cantidad}`).join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No se transfirió inventario de inmediato; todo permanece en el vehículo saliente.</p>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Custodia vehículo saliente (sesión #{handoffResult.custodia.saliente.idRutaSesion})</p>
                            <ul className="text-xs text-muted-foreground">
                              {handoffResult.custodia.saliente.productos.map((line) => (
                                <li key={line.idInventarioItem}>{line.nombre}: disponible {line.disponible}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Custodia vehículo entrante (sesión #{handoffResult.custodia.entrante.idRutaSesion})</p>
                            <ul className="text-xs text-muted-foreground">
                              {handoffResult.custodia.entrante.productos.map((line) => (
                                <li key={line.idInventarioItem}>{line.nombre}: disponible {line.disponible}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {visibleInventory.despacho && canOperate ? (
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Recepción de devolución</h2>
                      <p className="text-sm text-muted-foreground">
                        Puedes registrar varias devoluciones por sesión (por ejemplo, un conteo intermedio seguido de
                        reabastecimiento y la devolución final del día). Solo lo vendible se traslada a planta al
                        cerrar la sesión.
                        {!canCreate ? " Tu rol no tiene permiso para registrar devoluciones." : ""}
                      </p>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Producto / saldo físico</TableHead><TableHead>Recibido</TableHead><TableHead>Vacíos</TableHead><TableHead>Llenos</TableHead><TableHead>Dañado</TableHead><TableHead>Estado antes de daño</TableHead><TableHead>Ubicación no vendible</TableHead><TableHead>Observaciones</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {visibleInventory.productos.filter((line) => line.pendienteConciliacion - line.reservado > 0.009).map((line) => {
                          const isReturnableContainer = line.estadoEnvaseDespachado != null;
                          return (
                          <TableRow key={line.idInventarioItem}>
                            <TableCell>{line.nombre}<span className="block text-xs text-muted-foreground">Saldo físico: {Number(Math.max(0, line.pendienteConciliacion - line.reservado).toFixed(2))}</span></TableCell>
                            <TableCell><Input type="number" min="0" step="0.01" value={returnDraft[line.idInventarioItem]?.cantidadRecibida ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadRecibida: event.target.value } }))} className="max-w-28" /></TableCell>
                            <TableCell>{isReturnableContainer ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseVacio ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadEnvaseVacio: event.target.value } }))} className="max-w-24" /> : "—"}</TableCell>
                            <TableCell>{isReturnableContainer ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseLleno ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadEnvaseLleno: event.target.value } }))} className="max-w-24" /> : "—"}</TableCell>
                            <TableCell><Input type="number" min="0" step={isReturnableContainer ? "1" : "0.01"} value={returnDraft[line.idInventarioItem]?.cantidadDanada ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadDanada: event.target.value } }))} className="max-w-28" /></TableCell>
                            <TableCell>{isReturnableContainer ? <Select value={returnDraft[line.idInventarioItem]?.estadoEnvaseDanado ?? ""} onValueChange={(value) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], estadoEnvaseDanado: value as "VACIO" | "LLENO" } }))}><SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="VACIO">Vacío</SelectItem><SelectItem value="LLENO">Lleno</SelectItem></SelectContent></Select> : "—"}</TableCell>
                            <TableCell>
                              <div className="min-w-44 space-y-1">
                                <Select
                                  value={returnDraft[line.idInventarioItem]?.ubicacionDanada ?? ""}
                                  onValueChange={(value) =>
                                    setReturnDraft((previous) => ({
                                      ...previous,
                                      [line.idInventarioItem]: {
                                        ...previous[line.idInventarioItem],
                                        ubicacionDanada: value as "CUARENTENA" | "OTRA",
                                      },
                                    }))
                                  }
                                  disabled={
                                    isSaving ||
                                    Number(returnDraft[line.idInventarioItem]?.cantidadDanada ?? 0) <= 0
                                  }
                                >
                                  <SelectTrigger aria-label={`Ubicación no vendible de ${line.nombre}`}>
                                    <SelectValue placeholder="Selecciona ubicación" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="CUARENTENA">Cuarentena</SelectItem>
                                    <SelectItem value="OTRA">Otra ubicación</SelectItem>
                                  </SelectContent>
                                </Select>
                                {returnDraft[line.idInventarioItem]?.ubicacionDanada === "OTRA" ? (
                                  <Input
                                    value={returnDraft[line.idInventarioItem]?.ubicacionDanadaDetalle ?? ""}
                                    onChange={(event) =>
                                      setReturnDraft((previous) => ({
                                        ...previous,
                                        [line.idInventarioItem]: {
                                          ...previous[line.idInventarioItem],
                                          ubicacionDanadaDetalle: event.target.value,
                                        },
                                      }))
                                    }
                                    maxLength={255}
                                    placeholder="Especifica el lugar"
                                    aria-label={`Detalle de ubicación no vendible de ${line.nombre}`}
                                  />
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell><Input value={returnDraft[line.idInventarioItem]?.observaciones ?? ""} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], observaciones: event.target.value } }))} maxLength={255} /></TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <Textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} maxLength={255} placeholder="Observaciones de recepción" />
                    {!canCreate ? <p className="text-sm text-muted-foreground">Tu rol no tiene permiso para registrar devoluciones.</p> : null}
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
                      <p className="text-sm text-muted-foreground">
                        La clasificación y el motivo quedan auditados con el usuario autenticado que autoriza.
                        {!canUpdate ? " Tu rol no tiene permiso para autorizar diferencias." : ""}
                      </p>
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
                      {!canUpdate ? <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para cerrar rutas.</p> : null}
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
