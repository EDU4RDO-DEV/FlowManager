"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Eye, FileCheck2, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
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
import { listEmployees } from "@/services/employees.service";
import {
  closePayroll,
  deletePayroll,
  generatePayroll,
  getPayrollById,
  listPayrolls,
  previewPayroll,
  restorePayroll,
} from "@/services/payroll.service";
import type { PayrollAdjustmentPayload, PayrollDto, PayrollPreviewResult } from "@/types/payroll";

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

export default function PayrollPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "planilla", "create");
  const canUpdate = hasModulePermission(user, "planilla", "update");
  const canDelete = hasModulePermission(user, "planilla", "delete");

  const [payrolls, setPayrolls] = useState<PayrollDto[]>([]);
  const [trashPayrolls, setTrashPayrolls] = useState<PayrollDto[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; nombre: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [mes, setMes] = useState(String(currentMonth()));
  const [anio, setAnio] = useState(String(currentYear()));
  const [idEmpleado, setIdEmpleado] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<PayrollAdjustmentPayload["tipoAjuste"]>("BONO_META");
  const [ajusteDescripcion, setAjusteDescripcion] = useState("");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajustes, setAjustes] = useState<PayrollAdjustmentPayload[]>([]);
  const [preview, setPreview] = useState<PayrollPreviewResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPayrollId, setSelectedPayrollId] = useState<number | null>(null);
  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<any | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PayrollDto | null>(null);

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
      setEmployees(employeeList.map((item) => ({ id: item.id, nombre: item.entidad.nombreCompleto })));
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

    return {
      ...period,
      ...(idEmpleado ? { idEmpleado: Number(idEmpleado) } : {}),
      ...(ajustes.length > 0 ? { ajustes } : {}),
    };
  }

  function addAjuste() {
    const monto = Number(ajusteMonto);
    if (!ajusteDescripcion.trim() || !Number.isFinite(monto) || monto < 0) {
      toast.error("Completa correctamente el ajuste");
      return;
    }

    setAjustes((prev) => [
      ...prev,
      {
        tipoAjuste: ajusteTipo,
        descripcion: ajusteDescripcion.trim(),
        monto,
      },
    ]);
    setAjusteDescripcion("");
    setAjusteMonto("");
  }

  async function handlePreview() {
    const payload = currentPayload();
    if (!payload) return;

    setIsPreviewing(true);
    try {
      const result = await previewPayroll(payload);
      setPreview(result);
      toast.success("Previsualización calculada");
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

    setIsGenerating(true);
    try {
      await generatePayroll(payload);
      setPreview(null);
      toast.success("Planilla generada correctamente");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo generar la planilla"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleClosePayroll(id: number) {
    try {
      await closePayroll(id, { idUsuarioModificador: user?.id });
      toast.success("Planilla cerrada");
      await loadData();
      setSelectedPayrollId(id);
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Mes</Label>
                  <Input type="number" min={1} max={12} value={mes} onChange={(e) => setMes(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Año</Label>
                  <Input type="number" min={2000} value={anio} onChange={(e) => setAnio(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empleado (opcional)</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={idEmpleado}
                    onChange={(e) => setIdEmpleado(e.target.value)}
                  >
                    <option value="">Todos los empleados</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={String(employee.id)}>{employee.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium">Ajustes del período</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value as PayrollAdjustmentPayload["tipoAjuste"])}
                  >
                    <option value="BONO_META">Bono meta</option>
                    <option value="VIATICO">Viático</option>
                    <option value="DESCUENTO">Descuento</option>
                  </select>
                  <Input
                    placeholder="Descripción"
                    value={ajusteDescripcion}
                    onChange={(e) => setAjusteDescripcion(e.target.value)}
                    className="md:col-span-2"
                  />
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={ajusteMonto}
                    onChange={(e) => setAjusteMonto(e.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={addAjuste}>Agregar ajuste</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void handlePreview()} disabled={isPreviewing}>
                      {isPreviewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                      Previsualizar
                    </Button>
                    {canCreate ? (
                      <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                        Generar
                      </Button>
                    ) : null}
                  </div>
                </div>

                {ajustes.length > 0 ? (
                  <div className="space-y-1 text-sm">
                    {ajustes.map((item, idx) => (
                      <div key={`ajuste-${idx}`} className="flex justify-between rounded-md border bg-background px-3 py-2">
                        <span>{item.tipoAjuste} · {item.descripcion}</span>
                        <span>{money(item.monto)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {preview ? (
                <div className="rounded-xl border bg-sky-50/60 p-4">
                  <p className="text-sm font-semibold text-sky-800">Previsualización {preview.mes}/{preview.anio}</p>
                  <p className="text-xs text-slate-700">Empleados calculados: {preview.planillas.length}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {preview.planillas.slice(0, 4).map((item) => (
                      <div key={item.idEmpleado} className="flex justify-between rounded bg-white px-3 py-2">
                        <span>{item.nombreEmpleado}</span>
                        <span className="font-medium">{money(item.sueldoLiquido)}</span>
                      </div>
                    ))}
                  </div>
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
                              <TableCell className="font-medium">{item.mes}/{item.anio}</TableCell>
                              <TableCell>{item.empleado?.entidad.nombreCompleto ?? `Empleado #${item.idEmpleado}`}</TableCell>
                              <TableCell>{item.estado}</TableCell>
                              <TableCell>{money(item.sueldoLiquido)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="xs" onClick={() => setSelectedPayrollId(item.id)}>
                                    <CalendarDays className="size-4" />
                                  </Button>
                                  {canUpdate && item.estado === "BORRADOR" ? (
                                    <Button variant="outline" size="xs" onClick={() => void handleClosePayroll(item.id)}>
                                      <FileCheck2 className="size-4" />
                                    </Button>
                                  ) : null}
                                  {canDelete ? (
                                    <Button variant="ghost" size="xs" onClick={() => setDeleteCandidate(item)}>
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
                          <p className="font-medium">{item.mes}/{item.anio} · {item.empleado?.entidad.nombreCompleto ?? `Empleado #${item.idEmpleado}`}</p>
                          <p className="text-xs text-muted-foreground">Líquido {money(item.sueldoLiquido)}</p>
                        </div>
                        {canUpdate ? (
                          <Button variant="outline" size="xs" onClick={() => void handleRestore(item.id)}>
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
                      <p>Viáticos: {money(selectedPayrollDetail.totalViaticos)}</p>
                      <p>Descuentos: {money(selectedPayrollDetail.totalDescuentos)}</p>
                      <p className="font-semibold">Líquido: {money(selectedPayrollDetail.sueldoLiquido)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Comisiones por producto</p>
                      {selectedPayrollDetail.detalleComisiones.map((item: any) => (
                        <div key={item.id} className="rounded border px-3 py-2 flex justify-between">
                          <span>{item.nombreProducto}</span>
                          <span>{money(item.montoComision)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmActionDialog
          open={!!deleteCandidate}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Anular planilla"
          description="Se anulará la planilla para permitir una nueva generación del período."
          confirmLabel="Anular"
          onConfirm={handleDeletePayroll}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
