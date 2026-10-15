"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  FileCheck2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  PayrollCardsSkeleton,
  PayrollTableSkeleton,
} from "@/app/payroll/_components/payroll-skeletons";
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
import { listEmployees } from "@/services/employees.service";
import {
  closePayroll,
  deletePayroll,
  downloadPayrollReceipt,
  generatePayroll,
  getPayrollById,
  listPayrolls,
  previewPayroll,
  reopenPayroll,
  restorePayroll,
} from "@/services/payroll.service";
import type {
  PayrollAdjustmentPayload,
  PayrollDetailDto,
  PayrollDto,
  PreviewPayrollPayload,
  PayrollPreviewResult,
} from "@/types/payroll";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function currentMonth() {
  const now = new Date();
  return now.getMonth() + 1;
}

function currentYear() {
  return new Date().getFullYear();
}

function money(value: number) {
  return `Q${value.toFixed(2)}`;
}

function previewPayloadKey(payload: PreviewPayrollPayload) {
  return JSON.stringify(payload);
}

export default function PayrollPage() {
  const { user } = useAuth();
  const canRead = hasModulePermission(user, "planilla", "read");
  const canCreate = hasModulePermission(user, "planilla", "create");
  const canUpdate = hasModulePermission(user, "planilla", "update");
  const canDelete = hasModulePermission(user, "planilla", "delete");

  const [payrolls, setPayrolls] = useState<PayrollDto[]>([]);
  const [trashPayrolls, setTrashPayrolls] = useState<PayrollDto[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; nombre: string; tipoTrabajador: string | null }>>([]);
  const [diasPorEmpleado, setDiasPorEmpleado] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [mes, setMes] = useState(String(currentMonth()));
  const [anio, setAnio] = useState(String(currentYear()));
  const [idEmpleado, setIdEmpleado] = useState("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [ajusteDescripcion, setAjusteDescripcion] = useState("");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajustes, setAjustes] = useState<PayrollAdjustmentPayload[]>([]);
  const [preview, setPreview] = useState<PayrollPreviewResult | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPayrollId, setSelectedPayrollId] = useState<number | null>(null);
  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<PayrollDetailDto | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PayrollDto | null>(null);
  const [closeCandidate, setCloseCandidate] = useState<PayrollDto | null>(null);
  const [reopenCandidate, setReopenCandidate] = useState<PayrollDto | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  async function loadData() {
    setIsLoading(true);
    try {
      const [active, trash, employeeList] = await Promise.all([
        listPayrolls({ anulado: false }),
        listPayrolls({ anulado: true }),
        listEmployees(),
      ]);
      setPayrolls(active);
      setTrashPayrolls(trash);
      setEmployees(employeeList.map((item) => ({
        id: item.id,
        nombre: item.entidad.nombreCompleto,
        tipoTrabajador: item.tipoTrabajador?.clave ?? null,
      })));
      setDiasPorEmpleado((current) => Object.fromEntries(employeeList.map((item) => [
        item.id,
        current[item.id] ?? "0",
      ])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar planillas"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedPayrollId) {
      setSelectedPayrollDetail(null);
      return;
    }

    void (async () => {
      try {
        const detail = await getPayrollById(selectedPayrollId);
        setSelectedPayrollDetail(detail);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el detalle"));
      }
    })();
  }, [selectedPayrollId]);

  const metrics = useMemo(() => {
    const totalLiquido = payrolls.reduce((acc, item) => acc + item.sueldoLiquido, 0);
    const cerradas = payrolls.filter((item) => item.estado === "CERRADA").length;
    return {
      activas: payrolls.length,
      anuladas: trashPayrolls.length,
      cerradas,
      totalLiquido,
    };
  }, [payrolls, trashPayrolls.length]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === idEmpleado) ?? null,
    [employees, idEmpleado],
  );

  function parsePeriod() {
    const mesNum = Number(mes);
    const anioNum = Number(anio);
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      toast.error("Mes inválido");
      return null;
    }
    if (!Number.isInteger(anioNum) || anioNum < 2000) {
      toast.error("Año inválido");
      return null;
    }
    return { mes: mesNum, anio: anioNum };
  }

  function currentPayload() {
    const period = parsePeriod();
    if (!period) return null;

    const selectedIds = idEmpleado ? new Set([Number(idEmpleado)]) : null;
    return {
      ...period,
      ...(idEmpleado ? { idEmpleado: Number(idEmpleado) } : {}),
      empleados: employees
        .filter((employee) => !selectedIds || selectedIds.has(employee.id))
        .map((employee) => ({
          idEmpleado: employee.id,
          diasTrabajados: employee.tipoTrabajador === "RUTA"
            ? Number(diasPorEmpleado[employee.id] ?? 0)
            : 0,
          ...(idEmpleado && ajustes.length > 0 ? { ajustes } : {}),
        })),
    };
  }

  function invalidatePreview() {
    setPreview(null);
    setPreviewKey(null);
  }

  function currentPreviewKey() {
    const payload: PreviewPayrollPayload = {
      mes: Number(mes),
      anio: Number(anio),
      ...(idEmpleado ? { idEmpleado: Number(idEmpleado) } : {}),
      empleados: employees
        .filter((employee) => !idEmpleado || employee.id === Number(idEmpleado))
        .map((employee) => ({
          idEmpleado: employee.id,
          diasTrabajados: employee.tipoTrabajador === "RUTA"
            ? Number(diasPorEmpleado[employee.id] ?? 0)
            : 0,
          ...(idEmpleado && ajustes.length > 0 ? { ajustes } : {}),
        })),
    };
    return previewPayloadKey(payload);
  }

  function addAjuste() {
    if (!idEmpleado) {
      toast.error("Selecciona un empleado para registrar un bono individual.");
      return;
    }
    const monto = Number(ajusteMonto);
    if (!ajusteDescripcion.trim() || !Number.isFinite(monto) || monto < 0) {
      toast.error("Completa correctamente el ajuste");
      return;
    }

    invalidatePreview();
    setAjustes((prev) => [
      ...prev,
      {
        tipoAjuste: "BONO_META",
        descripcion: ajusteDescripcion.trim(),
        monto,
      },
    ]);
    setAjusteDescripcion("");
    setAjusteMonto("");
  }

  function removeAjuste(index: number) {
    invalidatePreview();
    setAjustes((prev) => prev.filter((_, i) => i !== index));
  }


  async function handlePreview() {
    const payload = currentPayload();
    if (!payload) return;

    const requestKey = previewPayloadKey(payload);
    invalidatePreview();
    setIsPreviewing(true);
    try {
      const result = await previewPayroll(payload);
      if (requestKey !== currentPreviewKey()) {
        return;
      }
      setPreview(result);
      setPreviewKey(requestKey);
      if (result.validaciones.length > 0) {
        toast.warning("La previsualización contiene validaciones pendientes");
      } else {
        toast.success("Previsualización lista para revisión");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo previsualizar"));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleGenerate() {
    if (!canCreate) {
      toast.error("No tienes permisos para generar planillas");
      return;
    }

    const payload = currentPayload();
    if (!payload) return;
    if (!preview || previewKey !== previewPayloadKey(payload)) {
      toast.error("Previsualice y revise el período actual antes de generar");
      return;
    }
    if (preview.validaciones.length > 0) {
      toast.error("Corrija las validaciones de la previsualización antes de generar");
      return;
    }

    setIsGenerating(true);
    try {
      await generatePayroll({ ...payload, previewId: preview.previewId });
      invalidatePreview();
      toast.success("Planilla generada correctamente");
      await loadData();
    } catch (error) {
      invalidatePreview();
      toast.error(getApiErrorMessage(error, "No se pudo generar la planilla"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleClosePayroll() {
    if (!closeCandidate) return;
    try {
      await closePayroll(closeCandidate.id, { idUsuarioModificador: user?.id });
      toast.success("Planilla cerrada");
      await loadData();
      setSelectedPayrollId(closeCandidate.id);
      setCloseCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cerrar la planilla"));
    }
  }

  async function handleDeletePayroll() {
    if (!deleteCandidate) return;
    try {
      await deletePayroll(deleteCandidate.id, { idUsuarioAnulador: user?.id });
      setDeleteCandidate(null);
      toast.success("Planilla anulada");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular"));
    }
  }

  async function handleRestore(id: number) {
    try {
      await restorePayroll(id, { idUsuarioModificador: user?.id });
      toast.success("Planilla restaurada");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar"));
    }
  }

  async function handleReopenPayroll() {
    if (!reopenCandidate || reopenReason.trim().length < 5) {
      toast.error("Escribe un motivo de al menos 5 caracteres.");
      return;
    }
    try {
      await reopenPayroll(reopenCandidate.id, { motivo: reopenReason.trim() });
      setReopenCandidate(null);
      setReopenReason("");
      toast.success("Planilla reabierta; el motivo quedó registrado.");
      await loadData();
      setSelectedPayrollId(reopenCandidate.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo reabrir la planilla."));
    }
  }

  return (
    <RequireAuth moduleKey="planilla" action="read">
      <DashboardShell
        title="Planilla Mensual"
        description="Calcula sueldos con ventas pagadas, comisiones escalonadas y ajustes por período"
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <>
              <PayrollCardsSkeleton />
              <PayrollTableSkeleton rows={8} />
            </>
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Planillas activas</p><p className="text-2xl font-bold">{metrics.activas}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Planillas cerradas</p><p className="text-2xl font-bold">{metrics.cerradas}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Planillas anuladas</p><p className="text-2xl font-bold">{metrics.anuladas}</p></CardContent></Card>
              <Card className="rounded-xl border border-border bg-background"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total líquido activo</p><p className="text-2xl font-bold">{money(metrics.totalLiquido)}</p></CardContent></Card>
            </section>
          )}

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader>
              <CardTitle>Generación de planilla</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                1. Selecciona el período y el personal que vas a preparar.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                <Label htmlFor="payroll-month">Mes</Label>
                <select
                  id="payroll-month"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={mes}
                  onChange={(e) => {
                    invalidatePreview();
                    setMes(e.target.value);
                  }}
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payroll-year">Año</Label>
                <Input
                  id="payroll-year"
                  type="number"
                  min={2000}
                  value={anio}
                  onChange={(e) => {
                    invalidatePreview();
                    setAnio(e.target.value);
                  }}
                />
                </div>
                <div className="space-y-1.5">
                  <Label>Empleado (opcional)</Label>
                  <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedEmployee ? selectedEmployee.nombre : "Todos los empleados"}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                      <Command>
                        <CommandInput placeholder="Buscar empleado..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados</CommandEmpty>
                          <CommandItem
                            value="0 Todos los empleados"
                            onSelect={() => {
                              invalidatePreview();
                              setIdEmpleado("");
                              setAjustes([]);
                              setEmployeePickerOpen(false);
                            }}
                          >
                            <Check className={`mr-2 size-4 ${idEmpleado === "" ? "opacity-100" : "opacity-0"}`} />
                            Todos los empleados
                          </CommandItem>
                          {employees.map((employee) => (
                            <CommandItem
                              key={employee.id}
                              value={`${employee.id} ${employee.nombre}`}
                              onSelect={() => {
                                invalidatePreview();
                                setIdEmpleado(String(employee.id));
                                setAjustes([]);
                                setEmployeePickerOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 size-4 ${
                                  idEmpleado === String(employee.id) ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {employee.nombre}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Días de viático por empleado de ruta</p>
                  <p className="text-xs text-muted-foreground">
                    El viático se calcula con la tarifa diaria vigente y se presenta separado del líquido.
                    Los adelantos y faltantes aprobados se descuentan desde sus registros individuales.
                  </p>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {employees
                    .filter((employee) => employee.tipoTrabajador === "RUTA" &&
                      (!idEmpleado || employee.id === Number(idEmpleado)))
                    .map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                        <Label htmlFor={`payroll-days-${employee.id}`} className="text-sm">{employee.nombre}</Label>
                        <Input
                          id={`payroll-days-${employee.id}`}
                          type="number"
                          min="0"
                          max="31"
                          step="1"
                          className="w-28"
                          value={diasPorEmpleado[employee.id] ?? "0"}
                          onChange={(event) => {
                            invalidatePreview();
                            setDiasPorEmpleado((current) => ({
                              ...current,
                              [employee.id]: event.target.value,
                            }));
                          }}
                        />
                      </div>
                    ))}
                  {employees.every((employee) => employee.tipoTrabajador !== "RUTA") ? (
                    <p className="text-sm text-muted-foreground">No hay empleados de ruta en la selección.</p>
                  ) : null}
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">Bono individual (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona un empleado para agregar un bono; nunca se replica al resto de la planilla.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Descripción"
                    value={ajusteDescripcion}
                    onChange={(e) => setAjusteDescripcion(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={ajusteMonto}
                    onChange={(e) => setAjusteMonto(e.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={addAjuste} disabled={!idEmpleado}>Agregar bono individual</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void handlePreview()} disabled={isPreviewing || isGenerating}>
                      {isPreviewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                      Previsualizar
                    </Button>
                    {canCreate ? (
                      <Button
                        onClick={() => void handleGenerate()}
                        disabled={
                          isGenerating ||
                          isPreviewing ||
                          !preview ||
                          previewKey !== currentPreviewKey() ||
                          preview.validaciones.length > 0
                        }
                      >
                        {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                        Generar
                      </Button>
                    ) : null}
                  </div>
                </div>

                {ajustes.length > 0 ? (
                  <div className="space-y-1 text-sm">
                    {ajustes.map((item, idx) => (
                      <div key={`ajuste-${idx}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                        <span>{item.tipoAjuste} · {item.descripcion}</span>
                        <div className="flex items-center gap-2">
                          <span>{money(item.monto)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            title="Quitar ajuste"
                            aria-label="Quitar ajuste"
                            onClick={() => removeAjuste(idx)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {preview ? (
                <div className="rounded-xl border bg-background p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold">
                      2. Revisión: {MONTH_NAMES[preview.mes - 1]} {preview.anio}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {preview.planillas.length} empleados calculados · {preview.validaciones.length} validaciones · Estado al generar: BORRADOR
                    </p>
                  </div>
                  {preview.validaciones.length > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">Debe resolver estos puntos antes de generar</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                        {preview.validaciones.map((issue, index) => (
                          <li key={`${issue.codigo}-${issue.idEmpleado}-${issue.idInventarioItem ?? index}`}>
                            {issue.nombreEmpleado} — {issue.mensaje}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {preview.planillas.length > 0 ? (
                    <div className="max-h-[32rem] overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empleado / conceptos</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">Comisión</TableHead>
                            <TableHead className="text-right">Bonos</TableHead>
                            <TableHead className="text-right">Días</TableHead>
                            <TableHead className="text-right">Viáticos separados</TableHead>
                            <TableHead className="text-right">Descuentos</TableHead>
                            <TableHead className="text-right">Líquido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.planillas.map((item) => (
                            <TableRow key={item.idEmpleado}>
                              <TableCell className="min-w-56">
                                <p className="font-medium">{item.nombreEmpleado}</p>
                                <details className="mt-1 text-xs">
                                  <summary className="cursor-pointer text-primary">
                                    Ver comisiones ({item.detalleComisiones.length}) y ajustes ({item.detalleAjustes.length})
                                  </summary>
                                  <div className="mt-2 space-y-1">
                                    {item.detalleComisiones.map((commission) => (
                                      <p key={`${commission.idReglaComision ?? commission.idReglaComisionCategoria}-${commission.idInventarioItem}`}>
                                        {commission.nombreProducto}: {commission.cantidad} × base {money(commission.baseCalculo)}
                                        {commission.categoriaComisionSnapshot
                                          ? ` · ${commission.categoriaComisionSnapshot}, umbral sobre ${money(commission.baseCategoriaAplicada ?? 0)}`
                                          : ` · regla #${commission.idReglaComision}`}
                                        {" · "}{money(commission.montoComision)}
                                      </p>
                                    ))}
                                    {item.detalleAjustes.map((adjustment, index) => (
                                      <p key={`${adjustment.tipoAjuste}-${index}`}>
                                        {adjustment.tipoAjuste}: {adjustment.descripcion} · {money(adjustment.monto)}
                                      </p>
                                    ))}
                                  </div>
                                </details>
                              </TableCell>
                              <TableCell className="text-right">{money(item.sueldoBase)}</TableCell>
                              <TableCell className="text-right">{money(item.totalComisiones)}</TableCell>
                              <TableCell className="text-right">{money(item.totalBonosMetas)}</TableCell>
                              <TableCell className="text-right">{item.diasTrabajados}</TableCell>
                              <TableCell className="text-right">{money(item.totalViaticos)}</TableCell>
                              <TableCell className="text-right">{money(item.totalDescuentos)}</TableCell>
                              <TableCell className="text-right font-semibold">{money(item.sueldoLiquido)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                  {preview.validaciones.length === 0 ? (
                    <p className="text-sm text-green-700">
                      3. Revise todos los importes. La generación guardará estos cálculos como borradores; no ejecuta pagos ni cierra la planilla.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recargar
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
            <Card className="rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle>Histórico mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="activos">
                  <TabsList>
                    <TabsTrigger value="activos">Activas ({payrolls.length})</TabsTrigger>
                    <TabsTrigger value="anuladas">Anuladas ({trashPayrolls.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="activos">
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <Table className="min-w-full">
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead>Empleado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Líquido</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrolls.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{MONTH_NAMES[item.mes - 1]} {item.anio}</TableCell>
                              <TableCell>{item.empleado?.entidad.nombreCompleto ?? `Empleado #${item.idEmpleado}`}</TableCell>
                              <TableCell>{item.estado === "CERRADA" ? "Cerrada" : "Borrador"}</TableCell>
                              <TableCell>{money(item.sueldoLiquido)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    title="Ver detalle de planilla"
                                    aria-label="Ver detalle de planilla"
                                    onClick={() => setSelectedPayrollId(item.id)}
                                  >
                                    <CalendarDays className="size-4" />
                                  </Button>
                                  {canRead ? (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      title="Descargar recibo PDF"
                                      aria-label="Descargar recibo PDF"
                                      onClick={() => {
                                        void downloadPayrollReceipt(item.id).catch((error) => {
                                          toast.error(getApiErrorMessage(error, "No se pudo descargar el recibo"));
                                        });
                                      }}
                                    >
                                      <Download className="size-4" />
                                    </Button>
                                  ) : null}
                                  {canUpdate && item.estado === "BORRADOR" ? (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      title="Cerrar planilla"
                                      aria-label="Cerrar planilla"
                                      onClick={() => setCloseCandidate(item)}
                                    >
                                      <FileCheck2 className="size-4" />
                                    </Button>
                                  ) : null}
                                  {canUpdate && item.estado === "CERRADA" ? (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      title="Reabrir planilla"
                                      aria-label="Reabrir planilla"
                                      onClick={() => {
                                        setReopenCandidate(item);
                                        setReopenReason("");
                                      }}
                                    >
                                      <RotateCcw className="size-4" />
                                    </Button>
                                  ) : null}
                                  {canDelete && item.estado === "BORRADOR" ? (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      title="Anular planilla"
                                      aria-label="Anular planilla"
                                      onClick={() => setDeleteCandidate(item)}
                                    >
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

                  <TabsContent value="anuladas" className="space-y-2">
                    {trashPayrolls.map((item) => (
                      <div key={item.id} className="rounded-lg border border-dashed bg-muted/40 p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{MONTH_NAMES[item.mes - 1]} {item.anio} · {item.empleado?.entidad.nombreCompleto ?? `Empleado #${item.idEmpleado}`}</p>
                          <p className="text-xs text-muted-foreground">Líquido {money(item.sueldoLiquido)}</p>
                        </div>
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            size="xs"
                            title="Restaurar planilla"
                            aria-label="Restaurar planilla"
                            onClick={() => void handleRestore(item.id)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle>Detalle de planilla</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedPayrollDetail ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Selecciona una planilla para ver el desglose por comisiones y ajustes.
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="font-medium">{selectedPayrollDetail.empleado?.entidad.nombreCompleto}</p>
                      <p className="text-xs text-muted-foreground">Estado: {selectedPayrollDetail.estado}</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3 space-y-1">
                      <p>Sueldo base: {money(selectedPayrollDetail.sueldoBase)}</p>
                      <p>Comisiones: {money(selectedPayrollDetail.totalComisiones)}</p>
                      <p>Bonos metas: {money(selectedPayrollDetail.totalBonosMetas)}</p>
                      <p>Días trabajados: {selectedPayrollDetail.diasTrabajados}</p>
                      <p>Viáticos separados: {money(selectedPayrollDetail.totalViaticos)}
                        {selectedPayrollDetail.tarifaViaticoAplicada !== null
                          ? ` (${money(selectedPayrollDetail.tarifaViaticoAplicada)} / día)`
                          : ""}
                      </p>
                      <p>Descuentos: {money(selectedPayrollDetail.totalDescuentos)}</p>
                      <p className="font-semibold">Líquido: {money(selectedPayrollDetail.sueldoLiquido)}</p>
                      <p className="text-xs text-muted-foreground">Los viáticos se muestran por separado y no se incluyen en el total líquido.</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Comisiones por producto</p>
                      {selectedPayrollDetail.detalleComisiones.map((item) => (
                        <div key={item.id} className="rounded border px-3 py-2 space-y-1">
                          <div className="flex justify-between">
                            <span>{item.nombreProducto} · {item.cantidad} unidades · {item.tipoCalculo === "PORCENTAJE_VENTA" ? `${item.valorAplicado}% sobre ${money(item.baseCalculo)}` : `${money(item.valorAplicado)} por unidad`}</span>
                            <span>{money(item.montoComision)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.categoriaComisionSnapshot
                              ? `${item.categoriaComisionSnapshot} · base categoría ${money(item.baseCategoriaAplicada ?? 0)}`
                              : `Regla #${item.idReglaComision ?? "sin snapshot"} · rango ${item.cantidadMinimaAplicada ?? "—"}–${item.cantidadMaximaAplicada ?? "sin máximo"}`}
                            {" · "}Configuración #{item.idConfiguracionComision ?? "anterior"}
                          </p>
                          {item.fuentes.map((source) => (
                            <p key={source.idDetalleVenta} className="text-xs text-muted-foreground">
                              Venta #{source.idVenta} {source.estadoPago}, detalle #{source.idDetalleVenta}, sesión #{source.idRutaSesion} ({source.rolAtribucion}, {new Date(source.fechaSesion).toLocaleDateString("es-GT", { timeZone: "UTC" })}) · {source.cantidad} × {money(source.precioUnitario)}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Ajustes</p>
                      {selectedPayrollDetail.detalleAjustes.map((item) => (
                        <div key={item.id} className="rounded border px-3 py-2 flex justify-between">
                          <span>{item.tipoAjuste} · {item.descripcion}</span>
                          <span>{money(item.monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {reopenCandidate ? (
            <Card className="rounded-xl border border-amber-300 bg-amber-50/50">
              <CardHeader>
                <CardTitle>Reabrir planilla cerrada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {reopenCandidate.empleado?.entidad.nombreCompleto} · {MONTH_NAMES[reopenCandidate.mes - 1]} {reopenCandidate.anio}.
                  El motivo se guardará en la bitácora de la planilla.
                </p>
                <Input
                  value={reopenReason}
                  onChange={(event) => setReopenReason(event.target.value)}
                  maxLength={255}
                  placeholder="Motivo de reapertura"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReopenCandidate(null)}>Cancelar</Button>
                  <Button onClick={() => void handleReopenPayroll()}>Confirmar reapertura</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <ConfirmActionDialog
          open={!!deleteCandidate}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Anular planilla"
          description="Se anulará la planilla para permitir una nueva generación del período."
          confirmLabel="Anular"
          onConfirm={handleDeletePayroll}
        />
        <ConfirmActionDialog
          open={!!closeCandidate}
          onOpenChange={(open) => !open && setCloseCandidate(null)}
          title="Cerrar planilla"
          description="Al cerrar, la planilla quedará inmutable. Esta acción no aprueba ni ejecuta pagos."
          confirmLabel="Cerrar planilla"
          onConfirm={handleClosePayroll}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
