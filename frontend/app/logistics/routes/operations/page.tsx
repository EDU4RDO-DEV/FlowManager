"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { DispatchTab } from "./_components/dispatch-tab";
import { HandoffTab } from "./_components/handoff-tab";
import { ReturnsTab } from "./_components/returns-tab";
import { SettlementTab } from "./_components/settlement-tab";
import type { DispatchDraft, HandoffFormState, ReturnDraft, TransferDraft } from "./_components/shared";
import { formatDate } from "./_components/shared";
import { SummaryTab } from "./_components/summary-tab";
import { TransfersTab } from "./_components/transfers-tab";
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
  const [dispatchCancelReasonById, setDispatchCancelReasonById] = useState<Record<number, string>>({});
  const [dispatchCancelCandidate, setDispatchCancelCandidate] = useState<{ id: number; motivo: string } | null>(null);
  const [dispatchProductId, setDispatchProductId] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [returnDraft, setReturnDraft] = useState<Record<number, ReturnDraft>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [returnCancelReasonById, setReturnCancelReasonById] = useState<Record<number, string>>({});
  const [returnCancelCandidate, setReturnCancelCandidate] = useState<{ id: number; motivo: string } | null>(null);
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
    setDispatchCancelReasonById({});
    setReturnCancelReasonById({});
    setDispatchCancelCandidate(null);
    setReturnCancelCandidate(null);
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

  // Anulación individual de despacho: identificada por Id, requiere confirmación explícita
  // (se ejecuta solo tras aceptar el ConfirmActionDialog) y motivo de al menos 3 caracteres.
  async function submitDispatchCancellation() {
    if (!selectedSession || !dispatchCancelCandidate) return;
    const { id, motivo } = dispatchCancelCandidate;

    setIsSaving(true);
    try {
      await cancelRouteDispatch(selectedSession.id, { motivo, idDespacho: id });
      toast.success(`Despacho #${id} anulado y existencias restauradas con trazabilidad; puedes capturarlo nuevamente`);
      setDispatchCancelReasonById((previous) => ({ ...previous, [id]: "" }));
      setDispatchCancelCandidate(null);
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `No se pudo anular el despacho #${id}`));
    } finally {
      setIsSaving(false);
    }
  }

  // Anulación individual de devolución: mismo patrón (Id + confirmación + motivo).
  async function submitReturnCancellation() {
    if (!selectedSession || !returnCancelCandidate) return;
    const { id, motivo } = returnCancelCandidate;

    setIsSaving(true);
    try {
      await cancelRouteReturn(selectedSession.id, { motivo, idDevolucion: id });
      toast.success(`Recepción #${id} anulada con trazabilidad; puedes volver a capturar las cantidades físicas correctas`);
      setReturnCancelReasonById((previous) => ({ ...previous, [id]: "" }));
      setReturnCancelCandidate(null);
      setReturnDraft({});
      setReturnNotes("");
      await loadInventory(selectedSession.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `No se pudo anular la devolución #${id}`));
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
  // Lista de despachos/devoluciones activos identificables por Id, para anulación individual
  // (T-F2-DIST reabastecimiento: puede haber más de uno por sesión).
  const dispatchList = visibleInventory?.despachos ?? (visibleInventory?.despacho ? [visibleInventory.despacho] : []);
  const returnList = visibleInventory?.devoluciones ?? (visibleInventory?.devolucion ? [visibleInventory.devolucion] : []);

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
              <Tabs defaultValue="resumen">
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
                  <TabsTrigger value="despachos">Despachos ({dispatchList.length})</TabsTrigger>
                  <TabsTrigger value="devoluciones">Devoluciones ({returnList.length})</TabsTrigger>
                  <TabsTrigger value="transferencias">Transferencias ({transfers.length})</TabsTrigger>
                  <TabsTrigger value="relevos">Relevos</TabsTrigger>
                  <TabsTrigger value="liquidacion">Liquidación</TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-4">
                  <SummaryTab
                    selectedSession={selectedSession}
                    visibleInventory={visibleInventory}
                    transfers={transfers}
                    handoffPending={Boolean(handoffResult)}
                  />
                </TabsContent>

                <TabsContent value="despachos" className="space-y-4">
                  <DispatchTab
                    canOperate={canOperate}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    isSaving={isSaving}
                    visibleInventory={visibleInventory}
                    dispatchList={dispatchList}
                    dispatchCanBeCancelled={dispatchCanBeCancelled}
                    dispatchCancelReasonById={dispatchCancelReasonById}
                    setDispatchCancelReasonById={setDispatchCancelReasonById}
                    requestDispatchCancellation={setDispatchCancelCandidate}
                    dispatchDraft={dispatchDraft}
                    setDispatchDraft={setDispatchDraft}
                    dispatchSearch={dispatchSearch}
                    setDispatchSearch={setDispatchSearch}
                    dispatchProductId={dispatchProductId}
                    setDispatchProductId={setDispatchProductId}
                    dispatchProductOptions={dispatchProductOptions}
                    productById={productById}
                    addDispatchProduct={addDispatchProduct}
                    dispatchNotes={dispatchNotes}
                    setDispatchNotes={setDispatchNotes}
                    submitDispatch={submitDispatch}
                  />
                </TabsContent>

                <TabsContent value="devoluciones" className="space-y-4">
                  <ReturnsTab
                    canOperate={canOperate}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    isSaving={isSaving}
                    visibleInventory={visibleInventory}
                    returnList={returnList}
                    returnCanBeCancelled={returnCanBeCancelled}
                    returnCancelReasonById={returnCancelReasonById}
                    setReturnCancelReasonById={setReturnCancelReasonById}
                    requestReturnCancellation={setReturnCancelCandidate}
                    returnDraft={returnDraft}
                    setReturnDraft={setReturnDraft}
                    returnNotes={returnNotes}
                    setReturnNotes={setReturnNotes}
                    submitReturn={submitReturn}
                  />
                </TabsContent>

                <TabsContent value="transferencias" className="space-y-4">
                  <TransfersTab
                    canOperate={canOperate}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    isSavingTransfer={isSavingTransfer}
                    selectedSession={selectedSession}
                    transferDestinoOptions={transferDestinoOptions}
                    transferDestinoId={transferDestinoId}
                    setTransferDestinoId={setTransferDestinoId}
                    transferProductOptions={transferProductOptions}
                    transferProductId={transferProductId}
                    setTransferProductId={setTransferProductId}
                    addTransferProduct={addTransferProduct}
                    transferDraft={transferDraft}
                    setTransferDraft={setTransferDraft}
                    productById={productById}
                    transferMotivo={transferMotivo}
                    setTransferMotivo={setTransferMotivo}
                    submitTransfer={submitTransfer}
                    transfers={transfers}
                    sessionLabelById={sessionLabelById}
                    transferRejectReason={transferRejectReason}
                    setTransferRejectReason={setTransferRejectReason}
                    submitRejectTransfer={submitRejectTransfer}
                    transferCancelReason={transferCancelReason}
                    setTransferCancelReason={setTransferCancelReason}
                    submitCancelTransfer={submitCancelTransfer}
                    submitConfirmTransfer={submitConfirmTransfer}
                  />
                </TabsContent>

                <TabsContent value="relevos" className="space-y-4">
                  <HandoffTab
                    canOperate={canOperate}
                    canCreate={canCreate}
                    isSavingHandoff={isSavingHandoff}
                    handoffForm={handoffForm}
                    setHandoffForm={setHandoffForm}
                    routesCatalog={routesCatalog}
                    handoffVehicleOptions={handoffVehicleOptions}
                    sessionsHistory={sessions}
                    employeeOptions={employeeOptions}
                    handoffProductOptions={handoffProductOptions}
                    handoffProductId={handoffProductId}
                    setHandoffProductId={setHandoffProductId}
                    addHandoffProduct={addHandoffProduct}
                    handoffDraft={handoffDraft}
                    setHandoffDraft={setHandoffDraft}
                    productById={productById}
                    submitHandoff={submitHandoff}
                    handoffResult={handoffResult}
                  />
                </TabsContent>

                <TabsContent value="liquidacion" className="space-y-4">
                  <SettlementTab
                    canOperate={canOperate}
                    canUpdate={canUpdate}
                    isSaving={isSaving}
                    selectedSession={selectedSession}
                    visibleInventory={visibleInventory}
                    selectedPendingLine={selectedPendingLine}
                    setAdjustmentItemId={setAdjustmentItemId}
                    adjustmentClass={adjustmentClass}
                    setAdjustmentClass={setAdjustmentClass}
                    adjustmentAmount={adjustmentAmount}
                    setAdjustmentAmount={setAdjustmentAmount}
                    adjustmentReason={adjustmentReason}
                    setAdjustmentReason={setAdjustmentReason}
                    submitAdjustment={submitAdjustment}
                    closingKilometers={closingKilometers}
                    setClosingKilometers={setClosingKilometers}
                    closeRoute={closeRoute}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </DashboardShell>

      <ConfirmActionDialog
        open={Boolean(dispatchCancelCandidate)}
        onOpenChange={(open) => {
          if (!open) setDispatchCancelCandidate(null);
        }}
        onConfirm={() => void submitDispatchCancellation()}
        title={`Anular despacho #${dispatchCancelCandidate?.id ?? ""}`}
        description={`Se restaurarán las existencias de planta y envases de este despacho. Motivo: "${dispatchCancelCandidate?.motivo ?? ""}". Esta acción queda auditada.`}
        confirmLabel="Anular despacho"
        cancelLabel="Cancelar"
        loading={isSaving}
      />

      <ConfirmActionDialog
        open={Boolean(returnCancelCandidate)}
        onOpenChange={(open) => {
          if (!open) setReturnCancelCandidate(null);
        }}
        onConfirm={() => void submitReturnCancellation()}
        title={`Anular devolución #${returnCancelCandidate?.id ?? ""}`}
        description={`La recepción anterior quedará en el historial como anulada. Motivo: "${returnCancelCandidate?.motivo ?? ""}". Esta acción queda auditada.`}
        confirmLabel="Anular devolución"
        cancelLabel="Cancelar"
        loading={isSaving}
      />
    </RequireAuth>
  );
}
