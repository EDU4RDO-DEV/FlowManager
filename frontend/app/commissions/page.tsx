"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  listCommissionCategories,
  restoreCommissionConfig,
  restoreCommissionRule,
  updateCommissionRule,
  setCommissionCategorySchedule,
} from "@/services/commissions.service";
import { listProducts } from "@/services/products.service";
import type {
  CommissionCategoryDto,
  CommissionConfigDto,
  CommissionCategorySchedulePayload,
  CommissionRuleDto,
  CommissionRuleType,
} from "@/types/commissions";

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

type CategoryRateRuleDraft = {
  id: string;
  montoMinimoVenta: string;
  porcentaje: string;
};

type CategoryRateValue = {
  montoMinimoVenta: number;
  porcentaje: number;
};

type SavedCategorySchedule = {
  fechaInicioVigencia: string;
  reglas: CategoryRateValue[];
};

type CategoryRateFieldErrors = {
  montoMinimoVenta?: string;
  porcentaje?: string;
};

type CategoryScheduleValidation = {
  fechaInicioVigencia?: string;
  general?: string;
  categorias: Record<number, { mensaje?: string; reglas: Record<string, CategoryRateFieldErrors> }>;
};

const MAX_CATEGORY_THRESHOLD = 9_999_999_999.99;

const REFERENCE_CATEGORY_RATES: Record<string, CategoryRateValue[]> = {
  GARRAFONES: [{ montoMinimoVenta: 0, porcentaje: 3 }],
  OTROS: [
    { montoMinimoVenta: 0, porcentaje: 3.09 },
    { montoMinimoVenta: 30000, porcentaje: 3.1 },
    ...Array.from({ length: 12 }, (_, index) => ({
      montoMinimoVenta: 35000 + index * 5000,
      porcentaje: Number((3.11 + index * 0.01).toFixed(2)),
    })),
  ],
};

let categoryRateDraftSequence = 0;

function createCategoryRateDraft(
  categoryId: number,
  index: number,
  rule: CategoryRateValue,
  source: string,
): CategoryRateRuleDraft {
  return {
    id: `${source}-${categoryId}-${index}-${categoryRateDraftSequence++}`,
    montoMinimoVenta: String(rule.montoMinimoVenta),
    porcentaje: rule.porcentaje.toFixed(2),
  };
}

function sortCategoryRateDrafts(rules: CategoryRateRuleDraft[]) {
  return [...rules].sort((left, right) => {
    const leftParsed = Number(left.montoMinimoVenta);
    const rightParsed = Number(right.montoMinimoVenta);
    const leftValue = left.montoMinimoVenta.trim() && Number.isFinite(leftParsed)
      ? leftParsed
      : Number.POSITIVE_INFINITY;
    const rightValue = right.montoMinimoVenta.trim() && Number.isFinite(rightParsed)
      ? rightParsed
      : Number.POSITIVE_INFINITY;
    return leftValue - rightValue;
  });
}

function validateCategorySchedule(
  categories: CommissionCategoryDto[],
  drafts: Record<number, CategoryRateRuleDraft[]>,
  effectiveDate: string,
): CategoryScheduleValidation {
  const result: CategoryScheduleValidation = { categorias: {} };
  if (!effectiveDate.trim()) {
    result.fechaInicioVigencia = "La fecha de inicio de vigencia es obligatoria.";
  }
  if (categories.length === 0) {
    result.general = "No hay categorías activas para configurar.";
  }

  for (const category of categories) {
    const rules = drafts[category.id] ?? [];
    const categoryErrors: CategoryScheduleValidation["categorias"][number] = { reglas: {} };
    result.categorias[category.id] = categoryErrors;

    if (category.clave === "GARRAFONES") {
      const rate = rules[0]?.porcentaje.trim() ?? "";
      const value = Number(rate);
      if (!rate || !Number.isFinite(value) || value <= 0 || value > 100) {
        categoryErrors.reglas[rules[0]?.id ?? "garrafones"] = {
          porcentaje: "Ingresa un porcentaje mayor que 0 y máximo de 100.",
        };
      }
      continue;
    }

    if (rules.length === 0) {
      categoryErrors.mensaje = "Agrega al menos una regla, comenzando en Q0.";
      continue;
    }

    const thresholds = new Map<number, string[]>();
    const validThresholds: number[] = [];
    for (const rule of rules) {
      const thresholdText = rule.montoMinimoVenta.trim();
      const rateText = rule.porcentaje.trim();
      const threshold = Number(thresholdText);
      const rate = Number(rateText);
      const errors: CategoryRateFieldErrors = {};

      if (
        !thresholdText ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > MAX_CATEGORY_THRESHOLD
      ) {
        errors.montoMinimoVenta = `Ingresa un monto entre Q0 y Q${MAX_CATEGORY_THRESHOLD.toLocaleString("es-GT")}.`;
      } else {
        validThresholds.push(threshold);
        thresholds.set(threshold, [...(thresholds.get(threshold) ?? []), rule.id]);
      }

      if (!rateText || !Number.isFinite(rate) || rate <= 0 || rate > 100) {
        errors.porcentaje = "Ingresa un porcentaje mayor que 0 y máximo de 100.";
      }
      if (Object.keys(errors).length > 0) {
        categoryErrors.reglas[rule.id] = errors;
      }
    }

    for (const [threshold, ruleIds] of thresholds) {
      if (ruleIds.length > 1) {
        for (const ruleId of ruleIds) {
          categoryErrors.reglas[ruleId] = {
            ...categoryErrors.reglas[ruleId],
            montoMinimoVenta: `El umbral Q${threshold.toLocaleString("es-GT")} está duplicado.`,
          };
        }
      }
    }

    if (!validThresholds.includes(0)) {
      categoryErrors.mensaje = "Debe existir una regla inicial aplicable desde Q0.";
    }

  }

  return result;
}

function formatQuetzales(value: number) {
  return `Q${new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatCategoryRateValues(rules: CategoryRateValue[]) {
  return rules
    .map((rule) => `Q${rule.montoMinimoVenta.toLocaleString("es-GT")}: ${rule.porcentaje.toFixed(2)}%`)
    .join(" · ");
}

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
  const [categories, setCategories] = useState<CommissionCategoryDto[]>([]);
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigIsGeneral, setNewConfigIsGeneral] = useState(false);
  const [categoryEffectiveDate, setCategoryEffectiveDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [categoryRateDrafts, setCategoryRateDrafts] = useState<Record<number, CategoryRateRuleDraft[]>>({});
  const [savedCategorySchedules, setSavedCategorySchedules] = useState<
    Record<number, SavedCategorySchedule | null>
  >({});
  const [scheduleVersionInfo, setScheduleVersionInfo] = useState<{
    latestDate: string | null;
    activeDates: string[];
  }>({ latestDate: null, activeDates: [] });
  const [scheduleApiError, setScheduleApiError] = useState<string | null>(null);
  const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{
    configId: number;
    payload: CommissionCategorySchedulePayload;
    summary: string[];
  } | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [deleteDraftCandidate, setDeleteDraftCandidate] = useState<{
    categoryId: number;
    categoryName: string;
    rule: CategoryRateRuleDraft;
  } | null>(null);
  const [previewSalesAmount, setPreviewSalesAmount] = useState("25000");
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [deleteConfigCandidate, setDeleteConfigCandidate] = useState<CommissionConfigDto | null>(null);
  const [deleteRuleCandidate, setDeleteRuleCandidate] = useState<CommissionRuleDto | null>(null);

  const selectedConfig = useMemo(
    () => configs.find((item) => item.id === selectedConfigId) ?? null,
    [configs, selectedConfigId],
  );
  const otherCommissionCategories = useMemo(
    () => categories.filter((category) => category.clave !== "GARRAFONES"),
    [categories],
  );
  const previewCategory = useMemo(
    () => otherCommissionCategories.find((category) => category.clave === "OTROS") ?? otherCommissionCategories[0] ?? null,
    [otherCommissionCategories],
  );
  const scheduleValidation = useMemo(
    () => validateCategorySchedule(categories, categoryRateDrafts, categoryEffectiveDate),
    [categories, categoryRateDrafts, categoryEffectiveDate],
  );
  const hasScheduleValidationErrors = Boolean(scheduleValidation.fechaInicioVigencia || scheduleValidation.general) ||
    Object.values(scheduleValidation.categorias).some((category) =>
      Boolean(category.mensaje) ||
      Object.values(category.reglas).some((rule) =>
        Boolean(rule.montoMinimoVenta || rule.porcentaje),
      ),
    );
  const previewResult = useMemo(() => {
    const amountText = previewSalesAmount.trim();
    const salesAmount = Number(amountText);
    if (!amountText || !Number.isFinite(salesAmount) || salesAmount < 0) {
      return { error: "Ingresa un monto de ventas igual o mayor que Q0." } as const;
    }
    if (!previewCategory) {
      return { error: "No hay una categoría de otros productos disponible para previsualizar." } as const;
    }
    const applicableRules = (categoryRateDrafts[previewCategory.id] ?? [])
      .map((rule) => ({
        montoMinimoVenta: Number(rule.montoMinimoVenta),
        porcentaje: Number(rule.porcentaje),
      }))
      .filter((rule) =>
        Number.isFinite(rule.montoMinimoVenta) &&
        Number.isFinite(rule.porcentaje) &&
        rule.montoMinimoVenta >= 0 &&
        rule.montoMinimoVenta <= MAX_CATEGORY_THRESHOLD &&
        rule.porcentaje > 0 &&
        rule.porcentaje <= 100
      )
      .sort((left, right) => right.montoMinimoVenta - left.montoMinimoVenta);
    const selectedRule = applicableRules.find((rule) => rule.montoMinimoVenta <= salesAmount);
    if (!selectedRule) {
      return { error: "No hay un umbral aplicable para este monto." } as const;
    }
    return {
      salesAmount,
      threshold: selectedRule.montoMinimoVenta,
      percentage: selectedRule.porcentaje,
      commission: Number(((salesAmount * selectedRule.porcentaje) / 100).toFixed(2)),
    } as const;
  }, [categoryRateDrafts, previewCategory, previewSalesAmount]);

  const loadAll = useCallback(async () => {
    try {
      const [active, trash, productsData, categoryData] = await Promise.all([
        listCommissionConfigs(),
        listAnulatedCommissionConfigs(),
        listProducts({ limit: 100 }),
        listCommissionCategories(),
      ]);
      setConfigs(active);
      setTrashConfigs(trash);
      setProducts(productsData.items.map((item) => ({ id: item.id, nombre: item.nombre })));
      setCategories(categoryData);
      setSelectedConfigId((prev) => prev ?? active[0]?.id ?? null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el módulo de comisiones"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  const loadRules = useCallback(async (configId: number) => {
    try {
      const [configDetail, anulatedRules] = await Promise.all([
        getCommissionConfigById(configId),
        listAnulatedCommissionRules(configId),
      ]);
      setActiveRules(configDetail.reglas);
      setTrashRules(anulatedRules);
      const allRules = configDetail.reglasPorCategoria;
      const latestDateByCategory = new Map<number, string>();
      for (const rule of allRules) {
        const date = rule.fechaInicioVigencia.slice(0, 10);
        const current = latestDateByCategory.get(rule.idCategoriaComision);
        if (!current || date > current) latestDateByCategory.set(rule.idCategoriaComision, date);
      }

      const nextDrafts: Record<number, CategoryRateRuleDraft[]> = {};
      const nextSavedSchedules: Record<number, SavedCategorySchedule | null> = {};
      for (const category of categories) {
        const latestDate = latestDateByCategory.get(category.id);
        const savedRules = latestDate
          ? allRules
              .filter((rule) =>
                rule.idCategoriaComision === category.id &&
                rule.fechaInicioVigencia.slice(0, 10) === latestDate,
              )
              .map((rule) => ({
                montoMinimoVenta: rule.montoMinimoVenta,
                porcentaje: rule.porcentaje,
              }))
              .sort((left, right) => left.montoMinimoVenta - right.montoMinimoVenta)
          : [];
        nextSavedSchedules[category.id] = latestDate
          ? { fechaInicioVigencia: latestDate, reglas: savedRules }
          : null;
        const initialRules = savedRules.length > 0
          ? savedRules
          : REFERENCE_CATEGORY_RATES[category.clave] ?? [];
        nextDrafts[category.id] = initialRules.map((rule, index) =>
          createCategoryRateDraft(
            category.id,
            index,
            rule,
            savedRules.length > 0 ? "saved" : "reference",
          ),
        );
      }

      const latestDates = [...latestDateByCategory.values()].sort();
      const today = new Date().toISOString().slice(0, 10);
      const activeDates = [...new Set(
        allRules
          .filter((rule) => {
            const start = rule.fechaInicioVigencia.slice(0, 10);
            const end = rule.fechaFinVigencia?.slice(0, 10) ?? null;
            return start <= today && (end === null || end >= today);
          })
          .map((rule) => rule.fechaInicioVigencia.slice(0, 10)),
      )].sort();

      setCategoryRateDrafts(nextDrafts);
      setSavedCategorySchedules(nextSavedSchedules);
      setScheduleVersionInfo({
        latestDate: latestDates.at(-1) ?? null,
        activeDates,
      });
      setScheduleApiError(null);
    } catch (error) {
      setActiveRules([]);
      setTrashRules([]);
      setCategoryRateDrafts({});
      setSavedCategorySchedules({});
      setScheduleVersionInfo({ latestDate: null, activeDates: [] });
      toast.error(getApiErrorMessage(error, "No se pudieron cargar las reglas"));
    } finally {
      setIsLoadingSchedule(false);
    }
  }, [categories]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedConfigId) return;
    void loadRules(selectedConfigId);
  }, [selectedConfigId, loadRules]);

  const metrics = useMemo(() => {
    return {
      totalConfigs: configs.length + trashConfigs.length,
      activos: configs.length,
      anulados: trashConfigs.length,
      reglasActivas: activeRules.length,
    };
  }, [configs, trashConfigs, activeRules.length]);

  function selectConfig(configId: number) {
    if (configId === selectedConfigId) return;
    setIsLoadingSchedule(true);
    setSelectedConfigId(configId);
  }

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
      const created = await createCommissionConfig({
        idUsuario: user.id,
        nombre,
        esGeneral: newConfigIsGeneral,
      });
      setConfigs((prev) => [created, ...prev]);
      setIsLoadingSchedule(true);
      setSelectedConfigId(created.id);
      setNewConfigName("");
      setNewConfigIsGeneral(false);
      toast.success("Configuración creada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la configuración"));
    } finally {
      setIsSavingConfig(false);
    }
  }

  function updateCategoryRateRule(
    categoryId: number,
    ruleId: string,
    field: "montoMinimoVenta" | "porcentaje",
    value: string,
  ) {
    setCategoryRateDrafts((current) => ({
      ...current,
      [categoryId]: (current[categoryId] ?? []).map((rule) =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule,
      ),
    }));
    setScheduleApiError(null);
  }

  function sortCategoryRules(categoryId: number) {
    setCategoryRateDrafts((current) => ({
      ...current,
      [categoryId]: sortCategoryRateDrafts(current[categoryId] ?? []),
    }));
  }

  function addCategoryRateRule(categoryId: number) {
    const id = `draft-${categoryId}-${categoryRateDraftSequence++}`;
    setCategoryRateDrafts((current) => ({
      ...current,
      [categoryId]: [
        ...(current[categoryId] ?? []),
        {
          id,
          montoMinimoVenta: "",
          porcentaje: "",
        },
      ],
    }));
    setScheduleApiError(null);
  }

  function updateGarrafonesRate(categoryId: number, value: string) {
    const id = `draft-${categoryId}-${categoryRateDraftSequence++}`;
    setCategoryRateDrafts((current) => {
      const rules = current[categoryId] ?? [];
      if (rules.length === 0) {
        return {
          ...current,
          [categoryId]: [{
            id,
            montoMinimoVenta: "0",
            porcentaje: value,
          }],
        };
      }
      return {
        ...current,
        [categoryId]: rules.map((rule, index) =>
          index === 0 ? { ...rule, montoMinimoVenta: "0", porcentaje: value } : rule,
        ),
      };
    });
    setScheduleApiError(null);
  }

  function handleRequestCategoryScheduleSave() {
    if (!selectedConfigId || !user?.id) {
      setScheduleApiError("Selecciona una configuración y verifica el usuario.");
      return;
    }
    if (!canUpdate) {
      setScheduleApiError("No tienes permisos para actualizar las escalas.");
      return;
    }
    const sortedDrafts = Object.fromEntries(categories.map((category) => [
      category.id,
      sortCategoryRateDrafts(categoryRateDrafts[category.id] ?? []),
    ]));
    setCategoryRateDrafts(sortedDrafts);
    const validation = validateCategorySchedule(categories, sortedDrafts, categoryEffectiveDate);
    const hasErrors =
      Boolean(validation.fechaInicioVigencia || validation.general) ||
      Object.values(validation.categorias).some((category) =>
        Boolean(category.mensaje) ||
        Object.values(category.reglas).some((rule) => Boolean(rule.montoMinimoVenta || rule.porcentaje)),
      );
    if (hasErrors) {
      const firstMessage =
        validation.fechaInicioVigencia ??
        validation.general ??
        Object.values(validation.categorias).flatMap((category) => [
          category.mensaje,
          ...Object.values(category.reglas).flatMap((rule) => [rule.montoMinimoVenta, rule.porcentaje]),
        ]).find(Boolean);
      setScheduleApiError(null);
      toast.error(firstMessage ?? "Corrige los errores antes de guardar la escala.");
      return;
    }

    const payload: CommissionCategorySchedulePayload = {
        idUsuario: user.id,
        fechaInicioVigencia: categoryEffectiveDate,
        categorias: categories.map((category) => ({
          idCategoriaComision: category.id,
          reglas: category.clave === "GARRAFONES"
            ? [{
                montoMinimoVenta: 0,
                porcentaje: Number(sortedDrafts[category.id]?.[0]?.porcentaje ?? ""),
              }]
            : (sortedDrafts[category.id] ?? []).map((rule) => ({
                montoMinimoVenta: Number(rule.montoMinimoVenta),
                porcentaje: Number(rule.porcentaje),
              })),
        })),
      };
    const summary = categories.map((category) => {
      const previous = savedCategorySchedules[category.id];
      const nextRules = payload.categorias.find((item) => item.idCategoriaComision === category.id)?.reglas ?? [];
      return `${category.nombre}: ${
        previous
          ? `${formatCategoryRateValues(previous.reglas)} → ${formatCategoryRateValues(nextRules)}`
          : `sin versión guardada → ${formatCategoryRateValues(nextRules)}`
      }`;
    });
    setScheduleApiError(null);
    setPendingSchedule({ configId: selectedConfigId, payload, summary });
    setIsScheduleConfirmOpen(true);
  }

  async function handleConfirmCategoryScheduleSave() {
    if (!pendingSchedule) return;
    setIsSavingSchedule(true);
    try {
      const resultMessage = await setCommissionCategorySchedule(
        pendingSchedule.configId,
        pendingSchedule.payload,
      );
      setIsScheduleConfirmOpen(false);
      setPendingSchedule(null);
      setIsLoadingSchedule(true);
      await loadRules(pendingSchedule.configId);
      toast.success(resultMessage || "Nueva versión de escalas guardada correctamente.");
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudieron guardar las escalas.");
      setScheduleApiError(message);
      setIsScheduleConfirmOpen(false);
      setPendingSchedule(null);
      toast.error(message);
    } finally {
      setIsSavingSchedule(false);
    }
  }

  function handleConfirmDeleteCategoryRateRule() {
    if (!deleteDraftCandidate) return;
    setCategoryRateDrafts((current) => ({
      ...current,
      [deleteDraftCandidate.categoryId]: (current[deleteDraftCandidate.categoryId] ?? [])
        .filter((rule) => rule.id !== deleteDraftCandidate.rule.id),
    }));
    setDeleteDraftCandidate(null);
    setScheduleApiError(null);
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
            <Button
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                void loadAll();
              }}
              disabled={isLoading}
            >
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
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newConfigIsGeneral}
                        onChange={(event) => setNewConfigIsGeneral(event.target.checked)}
                      />
                      Usar como configuración general de respaldo (incluye escalas iniciales)
                    </label>
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
                        role="button"
                        tabIndex={0}
                        onClick={() => selectConfig(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectConfig(item.id);
                          }
                        }}
                        className={`cursor-pointer rounded-lg border p-3 transition-colors ${selectedConfigId === item.id ? "border-sky-500 bg-sky-50/60" : "bg-background hover:bg-muted/40"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-left">
                            <p className="font-medium">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.esGeneral ? "General · " : ""}
                              {item.totalReglasActivas ?? 0} reglas por producto activas
                            </p>
                          </div>
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteConfigCandidate(item);
                              }}
                            >
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
                    <div className="space-y-5">
                      <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">A. Información de la versión</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Preparando una nueva versión para {selectedConfig.nombre}.
                            </p>
                          </div>
                          <span className="rounded-full border border-sky-300 px-3 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:text-sky-200">
                            Nueva versión
                          </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="max-w-sm space-y-1.5">
                            <Label htmlFor="category-effective-date">Fecha de inicio de vigencia</Label>
                            <Input
                              id="category-effective-date"
                              type="date"
                              required
                              value={categoryEffectiveDate}
                              aria-invalid={Boolean(scheduleValidation.fechaInicioVigencia)}
                              onChange={(event) => {
                                setCategoryEffectiveDate(event.target.value);
                                setScheduleApiError(null);
                              }}
                            />
                            {scheduleValidation.fechaInicioVigencia ? (
                              <p className="text-sm text-destructive" role="alert">
                                {scheduleValidation.fechaInicioVigencia}
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-lg border bg-background/80 p-3 text-sm">
                            <p className="font-medium">Escala guardada</p>
                            <p className="mt-1 text-muted-foreground">
                              Última versión: {scheduleVersionInfo.latestDate ?? "Aún no hay una versión guardada"}.
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              Vigente hoy: {scheduleVersionInfo.activeDates.length > 0
                                ? scheduleVersionInfo.activeDates.join(", ")
                                : "No hay una escala registrada para hoy"}.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          Guardar una nueva vigencia no recalcula las planillas ya generadas o cerradas; sus valores históricos conservan los snapshots calculados.
                        </div>
                        {scheduleApiError ? (
                          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                            {scheduleApiError}
                          </p>
                        ) : null}
                        {scheduleValidation.general ? (
                          <p className="text-sm text-destructive" role="alert">{scheduleValidation.general}</p>
                        ) : null}
                      </section>

                      <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                        <div>
                          <h3 className="font-semibold">B. Comisión de garrafones</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Tasa fija aplicada al total vendido de la categoría.
                          </p>
                        </div>
                        {categories.filter((category) => category.clave === "GARRAFONES").map((category) => {
                          const rules = categoryRateDrafts[category.id] ?? [];
                          const rateRuleId = rules[0]?.id ?? "garrafones";
                          const rateError = scheduleValidation.categorias[category.id]?.reglas[rateRuleId]?.porcentaje;
                          const savedRuleCount = savedCategorySchedules[category.id]?.reglas.length ?? 0;
                          return (
                            <div key={category.id} className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-end">
                              <div className="space-y-1.5">
                                <Label htmlFor={`garrafones-rate-${category.id}`}>{category.nombre} · Comisión (%)</Label>
                                <div className="relative">
                                  <Input
                                    id={`garrafones-rate-${category.id}`}
                                    type="number"
                                    inputMode="decimal"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={rules[0]?.porcentaje ?? ""}
                                    aria-invalid={Boolean(rateError)}
                                    onChange={(event) => updateGarrafonesRate(category.id, event.target.value)}
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                                </div>
                                {rateError ? <p className="text-sm text-destructive" role="alert">{rateError}</p> : null}
                              </div>
                              {!savedCategorySchedules[category.id] ? (
                                <p className="text-xs text-muted-foreground">Valor de referencia inicial; todavía no está guardado.</p>
                              ) : savedRuleCount > 1 ? (
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  La última versión guardada tiene {savedRuleCount} umbrales; esta nueva versión usará una tasa fija.
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                        {!categories.some((category) => category.clave === "GARRAFONES") ? (
                          <p className="text-sm text-destructive" role="alert">No se encontró la categoría activa de garrafones.</p>
                        ) : null}
                      </section>

                      <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                        <div>
                          <h3 className="font-semibold">C. Comisión de otros productos</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            La tasa del umbral alcanzado se aplica a toda la base de ventas de la categoría, no solo al excedente.
                          </p>
                        </div>

                        {otherCommissionCategories.map((category) => {
                          const rules = categoryRateDrafts[category.id] ?? [];
                          const categoryErrors = scheduleValidation.categorias[category.id];
                          return (
                            <div key={category.id} className="space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">{category.nombre}</p>
                                  {!savedCategorySchedules[category.id] ? (
                                    <p className="text-xs text-muted-foreground">Valores de referencia iniciales; todavía no están guardados.</p>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addCategoryRateRule(category.id)}
                                >
                                  <Plus className="size-4" />
                                  Agregar umbral
                                </Button>
                              </div>

                              <div className="overflow-hidden rounded-lg border bg-background">
                                <Table className="w-full table-fixed">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[42%] whitespace-normal px-2 text-xs sm:px-4 sm:text-sm">Venta desde (Q)</TableHead>
                                      <TableHead className="w-[36%] whitespace-normal px-2 text-xs sm:px-4 sm:text-sm">Comisión (%)</TableHead>
                                      <TableHead className="w-[22%] px-2 text-right text-xs sm:px-4 sm:text-sm">Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {rules.map((rule, index) => {
                                      const errors = categoryErrors?.reglas[rule.id];
                                      return (
                                        <TableRow
                                          key={rule.id}
                                          className={index === 0 ? "bg-sky-50/70 dark:bg-sky-950/20" : undefined}
                                        >
                                          <TableCell className="px-2 py-2 sm:px-4">
                                            <Label htmlFor={`threshold-${category.id}-${rule.id}`} className="mb-1 block text-xs font-normal text-muted-foreground sm:hidden">
                                              Venta desde (Q){index === 0 ? " · Regla inicial" : ""}
                                            </Label>
                                            {index === 0 ? (
                                              <span className="mb-1 hidden text-xs font-medium text-sky-800 dark:text-sky-200 sm:block">
                                                Regla inicial
                                              </span>
                                            ) : null}
                                            <Input
                                              id={`threshold-${category.id}-${rule.id}`}
                                              type="number"
                                              inputMode="decimal"
                                              min="0"
                                              step="0.01"
                                              value={rule.montoMinimoVenta}
                                              aria-invalid={Boolean(errors?.montoMinimoVenta)}
                                              onChange={(event) => updateCategoryRateRule(category.id, rule.id, "montoMinimoVenta", event.target.value)}
                                              onBlur={() => sortCategoryRules(category.id)}
                                              className="h-9 min-w-0 px-2"
                                            />
                                            {errors?.montoMinimoVenta ? (
                                              <p className="mt-1 text-xs text-destructive" role="alert">{errors.montoMinimoVenta}</p>
                                            ) : null}
                                          </TableCell>
                                          <TableCell className="px-2 py-2 sm:px-4">
                                            <Label htmlFor={`percentage-${category.id}-${rule.id}`} className="mb-1 block text-xs font-normal text-muted-foreground sm:hidden">
                                              Comisión (%)
                                            </Label>
                                            <Input
                                              id={`percentage-${category.id}-${rule.id}`}
                                              type="number"
                                              inputMode="decimal"
                                              min="0.01"
                                              max="100"
                                              step="0.01"
                                              value={rule.porcentaje}
                                              aria-invalid={Boolean(errors?.porcentaje)}
                                              onChange={(event) => updateCategoryRateRule(category.id, rule.id, "porcentaje", event.target.value)}
                                              className="h-9 min-w-0 px-2"
                                            />
                                            {errors?.porcentaje ? (
                                              <p className="mt-1 text-xs text-destructive" role="alert">{errors.porcentaje}</p>
                                            ) : null}
                                          </TableCell>
                                          <TableCell className="px-1 py-2 text-right sm:px-3">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="xs"
                                              aria-label={`Eliminar umbral de ${category.nombre}`}
                                              onClick={() => setDeleteDraftCandidate({
                                                categoryId: category.id,
                                                categoryName: category.nombre,
                                                rule,
                                              })}
                                            >
                                              <Trash2 className="size-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                              {categoryErrors?.mensaje ? (
                                <p className="text-sm text-destructive" role="alert">{categoryErrors.mensaje}</p>
                              ) : null}
                            </div>
                          );
                        })}
                        {otherCommissionCategories.length === 0 ? (
                          <p className="text-sm text-destructive" role="alert">
                            No se encontró una categoría activa de otros productos.
                          </p>
                        ) : null}
                      </section>

                      <section className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20 sm:p-5">
                        <div>
                          <h3 className="font-semibold">Vista previa de comisión</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Prueba la escala en edición. La vista previa no guarda datos ni genera movimientos de nómina.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[25000, 30000, 37500, 90000].map((amount) => (
                            <Button
                              key={amount}
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => setPreviewSalesAmount(String(amount))}
                            >
                              {formatQuetzales(amount)}
                            </Button>
                          ))}
                        </div>
                        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
                          <div className="space-y-1.5">
                            <Label htmlFor="commission-preview-amount">Monto de ventas de prueba (Q)</Label>
                            <Input
                              id="commission-preview-amount"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={previewSalesAmount}
                              onChange={(event) => setPreviewSalesAmount(event.target.value)}
                            />
                          </div>
                          <div className="rounded-lg border bg-background p-3">
                            {"error" in previewResult ? (
                              <p className="text-sm text-muted-foreground">{previewResult.error}</p>
                            ) : (
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">Ventas introducidas</dt>
                                <dd className="text-right font-medium">{formatQuetzales(previewResult.salesAmount)}</dd>
                                <dt className="text-muted-foreground">Umbral alcanzado</dt>
                                <dd className="text-right font-medium">{formatQuetzales(previewResult.threshold)}</dd>
                                <dt className="text-muted-foreground">Porcentaje aplicado</dt>
                                <dd className="text-right font-medium">{previewResult.percentage.toFixed(2)}%</dd>
                                <dt className="font-semibold">Comisión estimada</dt>
                                <dd className="text-right font-semibold">{formatQuetzales(previewResult.commission)}</dd>
                              </dl>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cálculo de referencia: ventas de la categoría × porcentaje alcanzado, redondeado a centavos.
                        </p>
                      </section>

                      {canUpdate ? (
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          {hasScheduleValidationErrors ? (
                            <p className="text-sm text-destructive" role="status">
                              Corrige los errores de la escala antes de guardar.
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            onClick={handleRequestCategoryScheduleSave}
                            disabled={isLoading || isLoadingSchedule || isSavingSchedule || hasScheduleValidationErrors}
                          >
                            Guardar nueva versión de escalas
                          </Button>
                        </div>
                      ) : null}
                    </div>

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
                              <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
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

        <Dialog
          open={isScheduleConfirmOpen}
          onOpenChange={(open) => {
            setIsScheduleConfirmOpen(open);
            if (!open) setPendingSchedule(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirmar nueva versión de escalas</DialogTitle>
              <DialogDescription>
                Se guardará la configuración de {pendingSchedule?.payload.fechaInicioVigencia ?? categoryEffectiveDate}.
                Las planillas históricas no se recalcularán.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Resumen respecto a la última versión guardada</p>
              <ul className="space-y-2">
                {(pendingSchedule?.summary ?? []).map((item) => (
                  <li key={item} className="break-words">{item}</li>
                ))}
              </ul>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScheduleConfirmOpen(false)}
                disabled={isSavingSchedule}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmCategoryScheduleSave()}
                disabled={isSavingSchedule}
              >
                {isSavingSchedule ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirmar y guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(deleteDraftCandidate)}
          onOpenChange={(open) => !open && setDeleteDraftCandidate(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar umbral de la nueva versión</DialogTitle>
              <DialogDescription>
                {deleteDraftCandidate
                  ? `¿Eliminar el umbral Q${deleteDraftCandidate.rule.montoMinimoVenta || "—"} de ${deleteDraftCandidate.categoryName}? Este cambio solo afecta el borrador.`
                  : "Este cambio solo afecta el borrador."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteDraftCandidate(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmDeleteCategoryRateRule}>
                Eliminar umbral
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
