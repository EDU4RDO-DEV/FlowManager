"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Loader2, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import { getLogisticsEmployeeOptions } from "@/lib/logistics-employee-options";
import { hasModulePermission } from "@/lib/rbac";
import { createClient, listClients } from "@/services/clients.service";
import { getCustomerCreditAuthorization } from "@/services/credits.service";
import { listEmployees } from "@/services/employees.service";
import { getRouteInventory } from "@/services/logistics.service";
import { listProducts } from "@/services/products.service";
import {
  createSale,
  getFelReceptorInfo,
  listAvailableRouteSessions,
  listTalonarios,
  previewSaleBonuses,
  resolveSalePrice,
  uploadSaleProofImage,
} from "@/services/sales.service";
import type { ClientDto } from "@/types/clients";
import type { CustomerCreditAuthorization } from "@/types/credits";
import type { RouteInventoryDto } from "@/types/logistics";
import type { ProductDto } from "@/types/products";
import type {
  BonusPreviewItem,
  CreateSalePayload,
  CreateSaleDetailPayload,
  RouteSessionOptionDto,
  SalePaymentPayload,
  TalonarioDto,
} from "@/types/sales";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "POS";

type DetailRow = {
  idInventarioItem: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  estadoEnvase: "VACIO" | "LLENO" | "";
  modoEnvase: "CLIENTE_PROPIO" | "PRESTAMO_EMPRESA" | "";
};

function toMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeNit(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function CreateSalePage() {
  const router = useRouter();
  const { user } = useAuth();
  const saleRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const isRouteSeller = user?.nombreRol?.trim().toLocaleLowerCase("es") === "vendedor";

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeSessionsError, setRouteSessionsError] = useState<string | null>(null);
  const [routeInventoryState, setRouteInventoryState] = useState<
    | { idRutaSesion: number; data: RouteInventoryDto }
    | { idRutaSesion: number; error: string }
    | null
  >(null);

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [talonarios, setTalonarios] = useState<TalonarioDto[]>([]);
  const [routeSessions, setRouteSessions] = useState<RouteSessionOptionDto[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ employeeId: number; userId: number | null; nombre: string }>>([]);
  const [bonusPreview, setBonusPreview] = useState<BonusPreviewItem[]>([]);

  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [creditAuthorizationState, setCreditAuthorizationState] = useState<{
    idCliente: number;
    data?: CustomerCreditAuthorization;
    error?: string;
  } | null>(null);
  const [idRutaSesion, setIdRutaSesion] = useState<number | null>(null);
  const [idEmpleadoVendedor, setIdEmpleadoVendedor] = useState<number | null>(null);
  const [idTalonario, setIdTalonario] = useState<number | null>(null);
  const [tipoRegistro, setTipoRegistro] = useState<"VENTA" | "PROFORMA">("VENTA");
  const [fechaExpiracionProforma, setFechaExpiracionProforma] = useState("");
  const [condicionPago, setCondicionPago] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [nitFacturado, setNitFacturado] = useState("");
  const [nombreFacturado, setNombreFacturado] = useState("");
  const [direccionFacturada, setDireccionFacturada] = useState("");
  const [isConsultingNit, setIsConsultingNit] = useState(false);
  const [nitConsultaError, setNitConsultaError] = useState("");
  const [clientMatchState, setClientMatchState] = useState<"idle" | "found" | "not-found">("idle");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    nombreCompleto: "",
    correoElectronico: "",
    telefono1: "",
  });
  const [lugarEntrega, setLugarEntrega] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const isAddingProductRef = useRef(false);
  const [detalle, setDetalle] = useState<DetailRow[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const [pagoMetodo, setPagoMetodo] = useState<PaymentMethod>("EFECTIVO");
  const [pagoMonto, setPagoMonto] = useState(0);
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoBanco, setPagoBanco] = useState("");
  const [rutaConstancia, setRutaConstancia] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  useEffect(() => {
    async function loadSources() {
      setIsLoading(true);
      try {
        const [clientsData, talonariosData, routeSessionsData, firstProductsPage, employeesData] = await Promise.all([
          listClients(),
          listTalonarios(),
          listAvailableRouteSessions().catch((error) => {
            setRouteSessions([]);
            setRouteSessionsError(getApiErrorMessage(error, "No se pudieron consultar las sesiones de ruta"));
            throw error;
          }),
          listProducts({ anulado: false, esVendible: true, page: 1, limit: 100 }),
          hasModulePermission(user, "empleados", "read") ? listEmployees() : Promise.resolve([]),
        ]);

        const pages = firstProductsPage.pagination.totalPages;
        let allProducts = firstProductsPage.items;

        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, idx) =>
              listProducts({ anulado: false, esVendible: true, page: idx + 2, limit: 100 }),
            ),
          );
          allProducts = [...allProducts, ...rest.flatMap((page) => page.items)];
        }

        setClients(clientsData.filter((client) => !client.anulado));
        setTalonarios(talonariosData.filter((talonario) => !talonario.anulado));
        setRouteSessions(routeSessionsData);
        setRouteSessionsError(null);
        if (user?.nombreRol?.trim().toLocaleLowerCase("es") === "vendedor") {
          const assignedActiveSessions = routeSessionsData.filter(
            (session) =>
              session.estado === "EN_CURSO",
          );
          if (assignedActiveSessions.length === 1) {
            setIdRutaSesion(assignedActiveSessions[0].id);
          } else {
            setIdRutaSesion((current) =>
              assignedActiveSessions.some((session) => session.id === current) ? current : null,
            );
          }
        }
        setEmployeeOptions(getLogisticsEmployeeOptions(employeesData));
        setProducts(allProducts.filter((product) => !product.anulado && product.esVendible));
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar catálogo comercial"));
      } finally {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    }

    void loadSources();
  }, [user]);

  const selectableRouteSessions = useMemo(
    () => routeSessions.filter((session) => session.estado === "EN_CURSO"),
    [routeSessions],
  );
  const selectedRouteSession = useMemo(
    () => selectableRouteSessions.find((session) => session.id === idRutaSesion) ?? null,
    [idRutaSesion, selectableRouteSessions],
  );
  const routeInventory =
    idRutaSesion !== null && routeInventoryState?.idRutaSesion === idRutaSesion && "data" in routeInventoryState
      ? routeInventoryState.data
      : null;
  const routeInventoryError =
    idRutaSesion !== null && routeInventoryState?.idRutaSesion === idRutaSesion && "error" in routeInventoryState
      ? routeInventoryState.error
      : null;
  const isLoadingRouteInventory =
    idRutaSesion !== null && routeInventory === null && routeInventoryError === null;
  const routeAvailabilityByItem = useMemo(
    () =>
      new Map(
        routeInventory?.idRutaSesion === idRutaSesion
          ? routeInventory.productos.map((item) => [item.idInventarioItem, item.disponible])
          : [],
      ),
    [idRutaSesion, routeInventory],
  );

  useEffect(() => {
    if (idRutaSesion === null) return;

    let cancelled = false;

    void getRouteInventory(idRutaSesion)
      .then((inventory) => {
        if (!cancelled) setRouteInventoryState({ idRutaSesion, data: inventory });
      })
      .catch((error) => {
        if (!cancelled) {
          setRouteInventoryState({
            idRutaSesion,
            error: getApiErrorMessage(error, "No se pudo consultar el inventario del vehículo"),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idRutaSesion]);

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === idCliente) ?? null,
    [clients, idCliente],
  );

  const currentCreditAuthorizationState =
    tipoRegistro === "VENTA" && creditAuthorizationState?.idCliente === idCliente
      ? creditAuthorizationState
      : null;
  const creditAuthorization = currentCreditAuthorizationState?.data ?? null;
  const creditAuthorizationError = currentCreditAuthorizationState?.error ?? "";
  const isLoadingCreditAuthorization = Boolean(
    idCliente && tipoRegistro === "VENTA" && !currentCreditAuthorizationState,
  );

  useEffect(() => {
    if (!idCliente || tipoRegistro === "PROFORMA") {
      return;
    }

    let active = true;
    void getCustomerCreditAuthorization(idCliente)
      .then((authorization) => {
        if (active) setCreditAuthorizationState({ idCliente, data: authorization });
      })
      .catch((error: unknown) => {
        if (active) {
          setCreditAuthorizationState({
            idCliente,
            error: getApiErrorMessage(error, "No se pudo consultar la autorización de crédito"),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [idCliente, tipoRegistro]);

  const selectedIds = useMemo(() => new Set(detalle.map((row) => row.idInventarioItem)), [detalle]);

  const selectableProducts = useMemo(
    () => products.filter((product) => !selectedIds.has(product.id)),
    [products, selectedIds],
  );

  const subtotal = useMemo(
    () => detalle.reduce((sum, row) => sum + row.cantidad * row.precioUnitario, 0),
    [detalle],
  );

  const total = Number(subtotal.toFixed(2));
  const creditConsumption = Number(Math.max(0, total - pagoMonto).toFixed(2));
  const exceedsCreditAvailable = Boolean(
    creditAuthorization && creditConsumption > creditAuthorization.creditoDisponible,
  );

  const cambio = useMemo(() => {
    if (condicionPago !== "CONTADO") {
      return 0;
    }
    return Number(Math.max(0, pagoMonto - total).toFixed(2));
  }, [condicionPago, pagoMonto, total]);

  async function addProductRow() {
    if (isAddingProductRef.current || !selectedProductId) {
      return;
    }

    if (!idCliente) {
      toast.error("Selecciona un cliente antes de agregar productos");
      return;
    }

    const found = products.find((item) => item.id === selectedProductId);
    if (!found) {
      return;
    }

    try {
      isAddingProductRef.current = true;
      setIsAddingProduct(true);

      let precioUnitario = found.precioVenta;
      try {
        const resolved = await resolveSalePrice(idCliente, found.id);
        precioUnitario = resolved.precioUnitario;
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo resolver el precio del cliente; se usará el precio base"));
      }

      setDetalle((prev) => {
        if (prev.some((row) => row.idInventarioItem === found.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            idInventarioItem: found.id,
            nombre: found.nombre,
            cantidad: 1,
            precioUnitario,
            estadoEnvase: "",
            modoEnvase: "",
          },
        ];
      });

      setSelectedProductId((current) => current === found.id ? null : current);
    } finally {
      isAddingProductRef.current = false;
      setIsAddingProduct(false);
    }
  }

  useEffect(() => {
    if (!idCliente || detalle.length === 0) {
      return;
    }

    let cancelled = false;

    async function recalcPrices() {
      try {
        const updated = await Promise.all(
          detalle.map(async (row) => {
            try {
              const resolved = await resolveSalePrice(idCliente as number, row.idInventarioItem);
              return { ...row, precioUnitario: resolved.precioUnitario };
            } catch {
              return row;
            }
          }),
        );

        if (!cancelled) {
          setDetalle(updated);
        }
      } catch {
        // Si falla la resolución masiva, se conservan los precios actuales.
      }
    }

    void recalcPrices();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCliente]);

  useEffect(() => {
    const sellRows = detalle.filter((row) => row.cantidad > 0);
    let cancelled = false;
    if (sellRows.length === 0) {
      const timeoutId = setTimeout(() => {
        if (!cancelled) setBonusPreview([]);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    const timeoutId = setTimeout(() => {
      void previewSaleBonuses(
        sellRows.map((row) => ({ idInventarioItem: row.idInventarioItem, cantidad: row.cantidad })),
      )
        .then((items) => {
          if (!cancelled) setBonusPreview(items);
        })
        .catch(() => {
          if (!cancelled) setBonusPreview([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [detalle]);

  useEffect(() => {
    if (!requiereFactura) {
      const resetTimeout = setTimeout(() => {
        setNitConsultaError("");
        setClientMatchState("idle");
        setIsConsultingNit(false);
      }, 0);
      return () => clearTimeout(resetTimeout);
    }

    const nit = nitFacturado.trim();
    if (!nit || nit.toUpperCase() === "CF" || nit.toUpperCase() === "C/F") {
      const resetTimeout = setTimeout(() => {
        setNitConsultaError("");
        setClientMatchState("idle");
        setIsConsultingNit(false);
      }, 0);
      return () => clearTimeout(resetTimeout);
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setIsConsultingNit(true);
      setNitConsultaError("");

      const normalized = normalizeNit(nit);
      const localMatch = clients.find((client) => normalizeNit(client.entidad.nit ?? "") === normalized);

      if (localMatch) {
        setClientMatchState("found");
        setIdCliente(localMatch.id);
      } else {
        setClientMatchState("not-found");
      }

      void getFelReceptorInfo(nit)
        .then((info) => {
          if (cancelled) return;
          setNombreFacturado(info.nombre);
          if (info.direccion) {
            setDireccionFacturada(info.direccion);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setNitConsultaError(getApiErrorMessage(error, "No se pudo consultar el NIT"));
        })
        .finally(() => {
          if (!cancelled) {
            setIsConsultingNit(false);
          }
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [nitFacturado, requiereFactura, clients]);

  async function handleCreateQuickClient() {
    if (!user) {
      return;
    }

    const nombreCompleto = quickClientForm.nombreCompleto.trim();
    if (!nombreCompleto) {
      toast.error("El nombre completo es obligatorio");
      return;
    }

    setIsCreatingClient(true);
    try {
      const created = await createClient({
        idUsuario: user.id,
        entidad: {
          nombreCompleto,
          correoElectronico: quickClientForm.correoElectronico.trim() || undefined,
          telefono1: quickClientForm.telefono1.trim() || undefined,
          nit: nitFacturado.trim() || undefined,
        },
      });

      setClients((prev) => [created, ...prev]);
      setIdCliente(created.id);
      setClientMatchState("found");
      setClientDialogOpen(false);
      setQuickClientForm({ nombreCompleto: "", correoElectronico: "", telefono1: "" });
      toast.success("Cliente creado y seleccionado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el cliente"));
    } finally {
      setIsCreatingClient(false);
    }
  }

  function removeRow(idInventarioItem: number) {
    setDetalle((prev) => prev.filter((row) => row.idInventarioItem !== idInventarioItem));
  }

  function updateRow(
    idInventarioItem: number,
    field: "cantidad" | "precioUnitario" | "estadoEnvase" | "modoEnvase",
    value: number | "VACIO" | "LLENO" | "CLIENTE_PROPIO" | "PRESTAMO_EMPRESA" | "",
  ) {
    setDetalle((prev) =>
      prev.map((row) =>
        row.idInventarioItem === idInventarioItem
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function validateBeforeSubmit(): string | null {
    if (!user) {
      return "Usuario no autenticado";
    }

    if (isRouteSeller && routeSessionsError) {
      return "No se pudo verificar tu sesión de ruta. Intenta actualizar antes de registrar la venta";
    }

    if (
      isRouteSeller &&
      selectableRouteSessions.length > 0 &&
      (!idRutaSesion || !selectableRouteSessions.some((session) => session.id === idRutaSesion))
    ) {
      return "Selecciona una de tus sesiones de ruta activas para evitar registrar la venta contra inventario de planta";
    }

    if (idRutaSesion !== null) {
      if (isLoadingRouteInventory) {
        return "Espera a que se consulte la existencia disponible del vehículo";
      }
      if (routeInventoryError) {
        return routeInventoryError;
      }
      if (routeInventory?.idRutaSesion !== idRutaSesion) {
        return "No se pudo verificar el inventario de la sesión seleccionada";
      }
    }

    if (!idCliente) {
      return "Selecciona un cliente";
    }

    if (tipoRegistro === "PROFORMA") {
      const expirationDate = new Date(fechaExpiracionProforma);
      if (!idRutaSesion) {
        return "Selecciona una sesión de ruta para reservar inventario en el vehículo";
      }
      if (
        !fechaExpiracionProforma ||
        Number.isNaN(expirationDate.getTime()) ||
        expirationDate <= new Date()
      ) {
        return "Indica una fecha y hora futura para liberar la reserva de la proforma";
      }
    }

    if (detalle.length === 0) {
      return "Agrega al menos un producto al detalle";
    }

    const invalidRow = detalle.find((row) => row.cantidad <= 0 || row.precioUnitario <= 0);
    if (invalidRow) {
      return "Cantidad y precio deben ser mayores a 0";
    }
    for (const row of detalle) {
      const product = products.find((item) => item.id === row.idInventarioItem);
      if (product?.esEnvaseRetornable && !row.estadoEnvase) {
        return `Indica si el envase que vendes (${row.nombre}) está vacío o lleno`;
      }
      if (
        tipoRegistro === "VENTA" &&
        product?.esEnvaseRetornable &&
        !row.modoEnvase
      ) {
        return `Indica si el envase de ${row.nombre} es propio del cliente o préstamo de la empresa`;
      }
    }

    if (condicionPago === "CONTADO" && pagoMonto <= 0) {
      return "Para contado debes registrar un pago inicial mayor a 0";
    }

    if (
      condicionPago === "CONTADO" &&
      Number(pagoMonto.toFixed(2)) !== Number(total.toFixed(2))
    ) {
      return "En contado el pago debe coincidir con el total";
    }

    if (condicionPago === "CREDITO") {
      if (pagoMonto < 0) {
        return "El abono inicial no puede ser negativo";
      }
      if (pagoMonto > total) {
        return "El abono inicial no puede superar el total de la venta";
      }
      if (tipoRegistro === "VENTA") {
        if (isLoadingCreditAuthorization) {
          return "Espera a que se consulte la autorización de crédito";
        }
        if (creditAuthorizationError) {
          return creditAuthorizationError;
        }
        if (!creditAuthorization) {
          return "No se pudo verificar la autorización de crédito del cliente";
        }
        if (creditAuthorization.motivoNoAutorizado) {
          return creditAuthorization.motivoNoAutorizado;
        }
        if (exceedsCreditAvailable) {
          return `Crédito insuficiente: consumo ${toMoney(creditConsumption)}; disponible ${toMoney(creditAuthorization.creditoDisponible)}`;
        }
      }
    }

    const hasInitialPayment = condicionPago === "CONTADO" || pagoMonto > 0;
    if (hasInitialPayment && (pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE" || pagoMetodo === "POS")) {
      if (!pagoReferencia.trim()) {
        return "La referencia es obligatoria para el método de pago seleccionado";
      }
    }

    if (hasInitialPayment && (pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE")) {
      if (!pagoBanco.trim()) {
        return "El banco es obligatorio para transferencia y cheque";
      }
    }

    if (requiereFactura && !nitFacturado.trim()) {
      return "Si requiere factura, el NIT facturado es obligatorio";
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!user || !idCliente) {
      return;
    }

    const detailPayload: CreateSaleDetailPayload[] = detalle.map((row) => {
      return {
        idInventarioItem: row.idInventarioItem,
        cantidad: Number(row.cantidad),
        precioUnitario: Number(row.precioUnitario.toFixed(2)),
        ...(row.estadoEnvase ? { estadoEnvase: row.estadoEnvase } : {}),
        ...(row.modoEnvase ? { modoEnvase: row.modoEnvase } : {}),
      };
    });

    const paymentPayload: SalePaymentPayload | undefined =
      condicionPago === "CONTADO" || pagoMonto > 0
        ? {
            monto: Number(pagoMonto.toFixed(2)),
            metodoPago: pagoMetodo,
            numeroReferencia: pagoReferencia.trim() || undefined,
            banco: pagoBanco.trim() || undefined,
            fechaPago: new Date().toISOString().slice(0, 10),
            rutaFirma: rutaConstancia || undefined,
          }
        : undefined;

    setIsSubmitting(true);
    try {
      const salePayload: CreateSalePayload = {
        idUsuario: user.id,
        idCliente,
        idRutaSesion: idRutaSesion ?? undefined,
        ...(!idRutaSesion && idEmpleadoVendedor !== null ? { idEmpleadoVendedor } : {}),
        idTalonario: idTalonario ?? undefined,
        tipoRegistro,
        ...(tipoRegistro === "PROFORMA"
          ? { fechaExpiracionProforma: new Date(fechaExpiracionProforma).toISOString() }
          : {}),
        estadoEntrega: "PENDIENTE",
        condicionPago,
        requiereFactura,
        nitFacturado: nitFacturado.trim() || undefined,
        nombreClienteFacturado: nombreFacturado.trim() || undefined,
        direccionClienteFacturado: direccionFacturada.trim() || undefined,
        lugarEntrega: lugarEntrega.trim() || undefined,
        detalle: detailPayload,
        pagoInicial: paymentPayload,
      };
      const fingerprint = JSON.stringify(salePayload);
      if (!saleRequest.current || saleRequest.current.fingerprint !== fingerprint) {
        saleRequest.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await createSale(salePayload, saleRequest.current.key);
      saleRequest.current = null;

      if (idRutaSesion !== null) {
        try {
          const updatedRouteInventory = await getRouteInventory(idRutaSesion);
          setRouteInventoryState({ idRutaSesion, data: updatedRouteInventory });
        } catch (error) {
          setRouteInventoryState({
            idRutaSesion,
            error: getApiErrorMessage(error, "Error de consulta"),
          });
          toast.error(
            `Venta registrada, pero no se pudo actualizar el disponible del vehículo: ${getApiErrorMessage(error, "Error de consulta")}`,
          );
        }
      }

      toast.success(`${tipoRegistro === "PROFORMA" ? "Proforma" : "Venta"} #${result.numeroVenta} registrada correctamente`);
      router.push(`/sales/${result.id}`);
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la venta"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsUploadingProof(true);
      const result = await uploadSaleProofImage(file);
      setRutaConstancia(result.rutaImagen);
      toast.success("Constancia del talonario cargada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la constancia"));
    } finally {
      setIsUploadingProof(false);
      event.target.value = "";
    }
  }

  return (
    <RequireAuth moduleKey="ventas" action="create">
      <DashboardShell
        title="Nueva Venta"
        description="Registro comercial tipo POS con detalle de productos y pago inicial"
      >
        <div className="space-y-5">
          <Button asChild variant="outline">
            <Link href="/sales">
              <ArrowLeft className="mr-2 size-4" />
              Volver a ventas
            </Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Encabezado de venta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={isLoading}
                    >
                      <span className="truncate">{selectedClient?.entidad.nombreCompleto ?? "Selecciona cliente"}</span>
                      <Search className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-md p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente por nombre o NIT..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.entidad.nombreCompleto} ${client.entidad.nit ?? ""}`}
                              onSelect={() => {
                                setIdCliente(client.id);
                                if (!client.habilitadoCredito && tipoRegistro === "VENTA") {
                                  setCondicionPago("CONTADO");
                                }
                                setClientPopoverOpen(false);
                              }}
                            >
                              <div className="flex w-full flex-col">
                                <span>{client.entidad.nombreCompleto}</span>
                                {client.entidad.nit ? (
                                  <span className="text-xs text-muted-foreground">NIT {client.entidad.nit}</span>
                                ) : null}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label>Condición de pago *</Label>
                <Select value={condicionPago} onValueChange={(value) => setCondicionPago(value as "CONTADO" | "CREDITO")}> 
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTADO">CONTADO</SelectItem>
                    <SelectItem
                      value="CREDITO"
                      disabled={
                        tipoRegistro === "VENTA" &&
                        (isLoadingCreditAuthorization ||
                          !creditAuthorization?.habilitadoCredito ||
                          !creditAuthorization.condicionVigente)
                      }
                    >
                      CREDITO
                    </SelectItem>
                  </SelectContent>
                </Select>
                {tipoRegistro === "VENTA" && creditAuthorizationError ? (
                  <p className="text-xs text-destructive">{creditAuthorizationError}</p>
                ) : null}
                {tipoRegistro === "VENTA" && creditAuthorization?.motivoNoAutorizado ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-amber-700">{creditAuthorization.motivoNoAutorizado}</p>
                    {idCliente && hasModulePermission(user, "ventas", "read") ? (
                      <Link
                        href={`/credits/customers/${idCliente}`}
                        target="_blank"
                        className="text-xs font-medium text-sky-600 underline hover:text-sky-700"
                      >
                        Configurar condición de crédito del cliente
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Talonario (opcional)</Label>
                <Select
                  value={idTalonario ? String(idTalonario) : "none"}
                  onValueChange={(value) => setIdTalonario(value === "none" ? null : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin talonario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin talonario</SelectItem>
                    {talonarios.map((talonario) => (
                      <SelectItem key={talonario.id} value={String(talonario.id)}>
                        {talonario.nombre} ({talonario.siguienteCorrelativo ?? "agotado"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>
                  Sesión de ruta
                  {isRouteSeller && selectableRouteSessions.length > 0 ? " (requerida)" : " (opcional)"}
                </Label>
                <Select
                  value={idRutaSesion ? String(idRutaSesion) : "none"}
                  disabled={
                    isLoading ||
                    (isRouteSeller && selectableRouteSessions.length === 1)
                  }
                  onValueChange={(value) => {
                    const selectedSession = value === "none" ? null : Number(value);
                    if (
                      selectedSession !== null &&
                      !selectableRouteSessions.some((session) => session.id === selectedSession)
                    ) {
                      return;
                    }
                    if (isRouteSeller && selectableRouteSessions.length > 0 && selectedSession === null) {
                      return;
                    }
                    setIdRutaSesion(selectedSession);
                    if (!selectedSession && tipoRegistro === "PROFORMA") {
                      setTipoRegistro("VENTA");
                      setFechaExpiracionProforma("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin sesión de ruta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(!isRouteSeller || selectableRouteSessions.length === 0) ? (
                      <SelectItem value="none">Venta desde planta (sin sesión de ruta)</SelectItem>
                    ) : null}
                    {selectableRouteSessions.map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        {session.ruta?.nombre ?? `Ruta ${session.idRuta}`} · {session.vendedor?.nombre ?? "Sin vendedor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Las ventas de ruta se atribuyen al empleado vendedor de la sesión, no al chofer.
                </p>
                {isRouteSeller && routeSessionsError ? (
                  <p role="alert" className="text-xs text-destructive">
                    No se pudo verificar tu sesión asignada; las ventas quedan bloqueadas hasta actualizar.
                  </p>
                ) : null}
                {isRouteSeller && !routeSessionsError && hasLoadedOnce && selectableRouteSessions.length === 0 ? (
                  <p role="status" className="text-xs text-amber-700">
                    No tienes una sesión EN_CURSO asignada. No puedes realizar ventas desde ruta; la opción de planta
                    permanece sujeta a tus permisos.
                  </p>
                ) : null}
                {idRutaSesion !== null ? (
                  <p
                    role={routeInventoryError ? "alert" : "status"}
                    className={routeInventoryError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                  >
                    {isLoadingRouteInventory
                      ? "Consultando existencias del vehículo..."
                      : routeInventoryError
                        ? routeInventoryError
                        : routeInventory?.idRutaSesion === idRutaSesion
                          ? `Existencias actualizadas para ${selectedRouteSession?.ruta?.nombre ?? "el vehículo asignado"}.`
                          : "No se pudo verificar el inventario del vehículo."}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Tipo de registro</Label>
                <Select
                  value={tipoRegistro}
                  onValueChange={(value) => setTipoRegistro(value as "VENTA" | "PROFORMA")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENTA">Venta confirmada</SelectItem>
                    <SelectItem value="PROFORMA" disabled={!idRutaSesion}>Proforma con reserva de ruta</SelectItem>
                  </SelectContent>
                </Select>
                {tipoRegistro === "PROFORMA" ? (
                  <p className="text-xs text-muted-foreground">
                    Las unidades se reservan en el vehículo hasta el vencimiento, cancelación o confirmación de la proforma.
                  </p>
                ) : null}
              </div>

              {idRutaSesion ? (
                <div className="space-y-1">
                  <Label>Vendedor responsable</Label>
                  <p className="text-sm text-muted-foreground">
                    {routeSessions.find((session) => session.id === idRutaSesion)?.vendedor?.nombre
                      ?? "La sesión de ruta no tiene vendedor laboral identificado."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Vendedor responsable (opcional)</Label>
                  <Select
                    value={idEmpleadoVendedor === null ? "none" : String(idEmpleadoVendedor)}
                    onValueChange={(value) => setIdEmpleadoVendedor(value === "none" ? null : Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vendedor asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin vendedor asignado</SelectItem>
                      {employeeOptions.map((employee) => (
                        <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>
                          {employee.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {tipoRegistro === "PROFORMA" ? (
                <div className="space-y-1">
                  <Label htmlFor="proforma-expiracion">Fecha y hora de expiración *</Label>
                  <Input
                    id="proforma-expiracion"
                    type="datetime-local"
                    value={fechaExpiracionProforma}
                    onChange={(event) => setFechaExpiracionProforma(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <Label htmlFor="lugar-entrega">Lugar de entrega</Label>
                <Input
                  id="lugar-entrega"
                  value={lugarEntrega}
                  onChange={(event) => setLugarEntrega(event.target.value)}
                  placeholder="Dirección de entrega"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requiereFactura}
                    onChange={(event) => setRequiereFactura(event.target.checked)}
                  />
                  Requiere factura FEL
                </label>
              </div>

              {requiereFactura ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="nit-facturado">NIT facturado *</Label>
                    <Input
                      id="nit-facturado"
                      value={nitFacturado}
                      onChange={(event) => setNitFacturado(event.target.value)}
                      placeholder="1268645K"
                    />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {isConsultingNit ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Consultando NIT en Ecofactura...</span>
                        </>
                      ) : nitConsultaError ? (
                        <span className="text-destructive">{nitConsultaError}</span>
                      ) : (
                        <span>El nombre se autocompleta al consultar el NIT.</span>
                      )}
                    </div>
                  </div>

                  {clientMatchState === "found" ? (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 md:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <BadgeCheck className="size-4 shrink-0" />
                      <span>
                        Cliente encontrado por NIT y seleccionado automáticamente
                        {selectedClient ? `: ${selectedClient.entidad.nombreCompleto}` : ""}.
                      </span>
                    </div>
                  ) : null}

                  {clientMatchState === "not-found" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 md:col-span-2 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      <span>No existe un cliente registrado con el NIT {nitFacturado.trim()}.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQuickClientForm({
                            nombreCompleto: nombreFacturado.trim(),
                            correoElectronico: "",
                            telefono1: "",
                          });
                          setClientDialogOpen(true);
                        }}
                      >
                        <UserPlus className="mr-1 size-3.5" />
                        Registrar cliente
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <Label htmlFor="nombre-facturado">Nombre facturado</Label>
                    <Input
                      id="nombre-facturado"
                      value={nombreFacturado}
                      onChange={(event) => setNombreFacturado(event.target.value)}
                      placeholder={selectedClient?.entidad.nombreCompleto ?? "Nombre de factura"}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="direccion-facturada">Dirección facturada</Label>
                    <Input
                      id="direccion-facturada"
                      value={direccionFacturada}
                      onChange={(event) => setDireccionFacturada(event.target.value)}
                      placeholder="Dirección de facturación"
                    />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-65 flex-1 space-y-1">
                  <Label>Producto</Label>
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        disabled={isLoading || selectableProducts.length === 0}
                      >
                        <span className="truncate">
                          {selectedProductId
                            ? (selectableProducts.find((product) => product.id === selectedProductId)?.nombre ??
                              "Selecciona producto")
                            : "Selecciona producto"}
                        </span>
                        <Search className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-md p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar producto terminado..." />
                        <CommandList>
                          <CommandEmpty>No hay productos disponibles</CommandEmpty>
                          <CommandGroup>
                            {selectableProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.nombre}
                                disabled={
                                  idRutaSesion !== null &&
                                  routeInventory?.idRutaSesion === idRutaSesion &&
                                  (routeAvailabilityByItem.get(product.id) ?? 0) <= 0
                                }
                                onSelect={() => {
                                  setSelectedProductId(product.id);
                                  setProductPopoverOpen(false);
                                }}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span>{product.nombre}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {idRutaSesion !== null
                                      ? isLoadingRouteInventory
                                        ? "Consultando vehículo..."
                                        : routeInventory?.idRutaSesion === idRutaSesion
                                          ? `Disponible vehículo ${(
                                              routeAvailabilityByItem.get(product.id) ?? 0
                                            ).toFixed(2)}`
                                          : "Disponible vehículo no verificado"
                                      : `Stock planta ${product.existencia.toFixed(2)}`}{" "}
                                    · {toMoney(product.precioVenta)}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  type="button"
                  onClick={addProductRow}
                  disabled={
                    !selectedProductId ||
                    isAddingProduct ||
                    Boolean(
                      idRutaSesion !== null &&
                        (isLoadingRouteInventory ||
                          routeInventoryError ||
                          routeInventory?.idRutaSesion !== idRutaSesion),
                    )
                  }
                >
                  {isAddingProduct ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 size-4" />
                  )}
                  {isAddingProduct ? "Agregando..." : "Agregar"}
                </Button>
              </div>

              {detalle.length === 0 && hasLoadedOnce ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No hay productos agregados. Selecciona un producto y pulsa Agregar.
                </div>
              ) : null}

              <div className="space-y-2">
                {detalle.map((row) => {
                  const product = products.find((item) => item.id === row.idInventarioItem);
                  return (
                  <div key={row.idInventarioItem} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[2fr_120px_140px_120px_auto] md:items-end">
                    <div>
                      <p className="text-xs text-muted-foreground">Producto</p>
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {idRutaSesion !== null
                          ? isLoadingRouteInventory
                            ? "Disponible en vehículo: consultando..."
                            : routeInventory?.idRutaSesion === idRutaSesion
                              ? `Disponible en vehículo: ${(
                                  routeAvailabilityByItem.get(row.idInventarioItem) ?? 0
                                ).toFixed(2)}`
                              : "Disponible en vehículo: no verificado"
                          : `Existencia en planta: ${(product?.existencia ?? 0).toFixed(2)}`}
                      </p>
                    </div>
                    {product?.esEnvaseRetornable ? (
                      <div className="space-y-1">
                        <Label>Estado del envase vendido</Label>
                        <Select
                          value={row.estadoEnvase}
                          onValueChange={(value) =>
                            updateRow(row.idInventarioItem, "estadoEnvase", value as "VACIO" | "LLENO")
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VACIO">Vacío</SelectItem>
                            <SelectItem value="LLENO">Lleno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {product?.esEnvaseRetornable && tipoRegistro === "VENTA" ? (
                      <div className="space-y-1">
                        <Label>Custodia del envase</Label>
                        <Select
                          value={row.modoEnvase}
                          onValueChange={(value) =>
                            updateRow(row.idInventarioItem, "modoEnvase", value as "CLIENTE_PROPIO" | "PRESTAMO_EMPRESA")
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Selecciona custodia" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESTAMO_EMPRESA">Préstamo de la empresa</SelectItem>
                            <SelectItem value="CLIENTE_PROPIO">Envase propio del cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={row.cantidad}
                        onChange={(event) =>
                          updateRow(row.idInventarioItem, "cantidad", Number(event.target.value || 0))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Precio unitario</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={row.precioUnitario}
                        onChange={(event) =>
                          updateRow(row.idInventarioItem, "precioUnitario", Number(event.target.value || 0))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="font-medium">{toMoney(row.cantidad * row.precioUnitario)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.idInventarioItem)}
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                  );
                })}
              </div>

              {bonusPreview.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-indigo-300 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    Bonificación estimada (se aplicará automáticamente al guardar)
                  </p>
                  {bonusPreview.map((bonus) => (
                    <div
                      key={bonus.idInventarioItem}
                      className="flex items-center justify-between text-sm text-indigo-700 dark:text-indigo-300"
                    >
                      <span>{bonus.nombre}</span>
                      <span>
                        {bonus.cantidad.toFixed(2)} unid. · {toMoney(0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle>Pago y cierre</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Método de pago</Label>
                <Select value={pagoMetodo} onValueChange={(value) => setPagoMetodo(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">EFECTIVO</SelectItem>
                    <SelectItem value="TRANSFERENCIA">TRANSFERENCIA</SelectItem>
                    <SelectItem value="CHEQUE">CHEQUE</SelectItem>
                    <SelectItem value="POS">POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pago-monto">{condicionPago === "CONTADO" ? "Pago inicial *" : "Abono inicial"}</Label>
                <Input
                  id="pago-monto"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagoMonto}
                  onChange={(event) => setPagoMonto(Number(event.target.value || 0))}
                />
              </div>

              {tipoRegistro === "PROFORMA" && condicionPago === "CREDITO" ? (
                <div className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 md:col-span-2">
                  La autorización y disponibilidad del crédito se validarán al convertir esta proforma en venta.
                </div>
              ) : null}

              {tipoRegistro === "VENTA" && condicionPago === "CREDITO" ? (
                <div className="rounded-lg border p-3 text-sm md:col-span-2">
                  {isLoadingCreditAuthorization ? (
                    <p className="text-muted-foreground">Consultando crédito autorizado...</p>
                  ) : creditAuthorizationError ? (
                    <p className="text-destructive">{creditAuthorizationError}</p>
                  ) : creditAuthorization ? (
                    <>
                      <p className="font-medium">
                        Límite: {toMoney(creditAuthorization.limiteCredito)} · Utilizado:{" "}
                        {toMoney(creditAuthorization.saldoPendiente)} · Disponible:{" "}
                        {toMoney(creditAuthorization.creditoDisponible)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo vencido: {toMoney(creditAuthorization.saldoVencido)}
                      </p>
                      {creditAuthorization.motivoNoAutorizado ? (
                        <p className="mt-1 text-destructive">{creditAuthorization.motivoNoAutorizado}</p>
                      ) : null}
                      <p className="mt-1">
                        Consumo de esta venta: {toMoney(creditConsumption)}
                        {pagoMonto > 0 ? ` · Abono inicial: ${toMoney(pagoMonto)}` : ""}
                      </p>
                      {pagoMonto > total ? (
                        <p className="mt-1 text-destructive">
                          El abono inicial no puede superar el total de la venta.
                        </p>
                      ) : exceedsCreditAvailable ? (
                        <p className="mt-1 text-destructive">
                          No se puede registrar: el consumo supera el crédito disponible de{" "}
                          {toMoney(creditAuthorization.creditoDisponible)}.
                        </p>
                      ) : null}
                      {creditAuthorization.condicionVigente ? (
                        <p className="mt-1 text-muted-foreground">
                          Condición: {creditAuthorization.condicionVigente.nombreTipoCredito}
                          {creditAuthorization.condicionVigente.plazoDias !== null
                            ? ` · Plazo ${creditAuthorization.condicionVigente.plazoDias} días`
                            : ""}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Selecciona un cliente para consultar su autorización de crédito.
                    </p>
                  )}
                </div>
              ) : null}

              {(pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE" || pagoMetodo === "POS") ? (
                <div className="space-y-1">
                  <Label htmlFor="pago-referencia">Referencia</Label>
                  <Input
                    id="pago-referencia"
                    value={pagoReferencia}
                    onChange={(event) => setPagoReferencia(event.target.value)}
                  />
                </div>
              ) : null}

              {(pagoMetodo === "TRANSFERENCIA" || pagoMetodo === "CHEQUE") ? (
                <div className="space-y-1">
                  <Label htmlFor="pago-banco">Banco</Label>
                  <Input id="pago-banco" value={pagoBanco} onChange={(event) => setPagoBanco(event.target.value)} />
                </div>
              ) : null}

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="constancia-talonario">Foto de talonario (constancia)</Label>
                <Input
                  id="constancia-talonario"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadProof}
                  disabled={isUploadingProof}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isUploadingProof ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {rutaConstancia ? (
                    <a className="underline" href={rutaConstancia} target="_blank" rel="noreferrer">
                      Ver constancia cargada
                    </a>
                  ) : (
                    <span>Opcional. Formatos permitidos: JPG, PNG, WEBP (máx. 5MB).</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-sm text-muted-foreground">Resumen</p>
                <p className="text-lg font-semibold">Total: {toMoney(total)}</p>
                <p className="text-sm">Pago inicial: {toMoney(pagoMonto)}</p>
                {condicionPago === "CREDITO" ? (
                  <p className="text-sm font-medium">
                    Consumo estimado del límite: {toMoney(creditConsumption)}
                  </p>
                ) : null}
                <p className="text-sm">Cambio: {toMoney(cambio)}</p>
              </div>

              <div className="md:col-span-2">
                <Button
                  className="w-full"
                  disabled={
                    isSubmitting ||
                    isLoading ||
                    Boolean(
                      isRouteSeller &&
                        (routeSessionsError ||
                          (selectableRouteSessions.length > 0 && idRutaSesion === null)),
                    ) ||
                    Boolean(
                      idRutaSesion !== null &&
                        (isLoadingRouteInventory ||
                          routeInventoryError ||
                          routeInventory?.idRutaSesion !== idRutaSesion),
                    )
                  }
                  onClick={handleSubmit}
                >
                  {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {tipoRegistro === "PROFORMA" ? "Registrar proforma" : "Registrar venta"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar cliente</DialogTitle>
              <DialogDescription>
                Se creará con el NIT {nitFacturado.trim() || "-"} y se seleccionará automáticamente en la venta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="quick-client-nombre">Nombre completo *</Label>
                <Input
                  id="quick-client-nombre"
                  value={quickClientForm.nombreCompleto}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, nombreCompleto: event.target.value }))
                  }
                  placeholder="Nombre o razón social"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-client-correo">Correo electrónico</Label>
                <Input
                  id="quick-client-correo"
                  value={quickClientForm.correoElectronico}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, correoElectronico: event.target.value }))
                  }
                  placeholder="correo@cliente.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quick-client-telefono">Teléfono</Label>
                <Input
                  id="quick-client-telefono"
                  value={quickClientForm.telefono1}
                  onChange={(event) =>
                    setQuickClientForm((prev) => ({ ...prev, telefono1: event.target.value }))
                  }
                  placeholder="5555-5555"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreateQuickClient} disabled={isCreatingClient}>
                {isCreatingClient ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Guardar y seleccionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardShell>
    </RequireAuth>
  );
}
