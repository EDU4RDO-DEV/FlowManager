"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { createEmployeeAdvance, listEmployeeAdvances, type EmployeeAdvanceDto } from "@/services/employee-advances.service";
import { listEmployees } from "@/services/employees.service";
import type { EmployeeDto } from "@/types/employees";

const money = (value: number) => new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
}).format(value);

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function EmployeeAdvancesPage() {
  const { user } = useAuth();
  const canRead = hasModulePermission(user, "planilla", "read");
  const canCreate = hasModulePermission(user, "planilla", "create");
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvanceDto[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [employeeList, advanceList] = await Promise.all([
        listEmployees(),
        listEmployeeAdvances(filterEmployeeId ? Number(filterEmployeeId) : undefined),
      ]);
      setEmployees(employeeList);
      setAdvances(advanceList);
      if (employeeList.length > 0) setEmployeeId((current) => current || String(employeeList[0].id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar los anticipos."));
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId]);

  useEffect(() => {
    if (canRead) void loadData();
    else setLoading(false);
  }, [canRead, loadData]);

  const totalOutstanding = useMemo(
    () => advances.reduce((sum, item) => sum + item.saldoPendiente, 0),
    [advances],
  );

  async function submitAdvance() {
    const parsedAmount = Number(amount);
    if (!employeeId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Selecciona un empleado e ingresa un monto válido.");
      return;
    }
    if (method === "TRANSFERENCIA" && !reference.trim()) {
      toast.error("La referencia es obligatoria para transferencias.");
      return;
    }
    setSaving(true);
    try {
      const updated = await createEmployeeAdvance({
        idEmpleado: Number(employeeId),
        monto: parsedAmount,
        fecha: date,
        metodoPago: method,
        numeroReferencia: reference.trim() || undefined,
        banco: bank.trim() || undefined,
        observacion: observation.trim() || undefined,
      });
      setAdvances(updated);
      setAmount("");
      setReference("");
      setBank("");
      setObservation("");
      toast.success("Anticipo registrado. Su saldo podrá aplicarse a planillas futuras.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el anticipo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Anticipos de empleados" description="Saldos, desembolsos y aplicaciones a planillas">
      {!canRead ? (
        <Card><CardContent className="p-6">No tienes permiso para consultar anticipos.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {canCreate ? (
            <Card>
              <CardHeader><CardTitle>Registrar anticipo</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="advance-employee">Empleado</Label>
                  <select
                    id="advance-employee"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={employeeId}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    disabled={saving}
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.entidad.nombreCompleto}</option>
                    ))}
                  </select>
                </div>
                <Field label="Monto" id="advance-amount">
                  <Input id="advance-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </Field>
                <Field label="Fecha" id="advance-date">
                  <Input id="advance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </Field>
                <div className="space-y-2">
                  <Label htmlFor="advance-method">Medio de entrega</Label>
                  <select
                    id="advance-method"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as "EFECTIVO" | "TRANSFERENCIA")}
                    disabled={saving}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia bancaria</option>
                  </select>
                </div>
                {method === "TRANSFERENCIA" ? (
                  <>
                    <Field label="Referencia bancaria" id="advance-reference">
                      <Input id="advance-reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} />
                    </Field>
                    <Field label="Banco" id="advance-bank">
                      <Input id="advance-bank" value={bank} onChange={(event) => setBank(event.target.value)} maxLength={100} />
                    </Field>
                  </>
                ) : null}
                <Field label="Observaciones" id="advance-observation">
                  <Input id="advance-observation" value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={255} />
                </Field>
                <div className="flex items-end">
                  <Button onClick={() => void submitAdvance()} disabled={saving || employees.length === 0}>
                    {saving ? "Registrando..." : "Registrar anticipo"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Saldo pendiente: {money(totalOutstanding)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm space-y-2">
                <Label htmlFor="advance-filter">Filtrar por empleado</Label>
                <select
                  id="advance-filter"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={filterEmployeeId}
                  onChange={(event) => setFilterEmployeeId(event.target.value)}
                >
                  <option value="">Todos los empleados</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.entidad.nombreCompleto}</option>
                  ))}
                </select>
              </div>
              {loading ? <p>Cargando anticipos...</p> : null}
              {!loading && advances.length === 0 ? <p className="text-sm text-muted-foreground">No hay anticipos registrados.</p> : null}
              {!loading ? advances.map((advance) => (
                <details key={advance.id} className="rounded-md border p-3">
                  <summary className="cursor-pointer">
                    {advance.empleado} · {new Date(advance.fecha).toLocaleDateString("es-GT", { timeZone: "UTC" })} · Anticipo {money(advance.monto)} · Pendiente {money(advance.saldoPendiente)}
                  </summary>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>Registrado por {advance.registradoPor} · {advance.metodoPago ?? "medio histórico"}
                      {advance.numeroReferencia ? ` · Ref. ${advance.numeroReferencia}` : ""}
                      {advance.banco ? ` · ${advance.banco}` : ""}
                    </p>
                    <p>Aplicado a planillas: {money(advance.montoAplicado)}</p>
                    {advance.observacion ? <p>{advance.observacion}</p> : null}
                    {advance.aplicaciones.map((application) => (
                      <p key={application.id} className="text-xs text-muted-foreground">
                        {application.vigente ? "Aplicado" : "Liberado"} · Planilla {application.mes}/{application.anio} · {money(application.monto)}
                      </p>
                    ))}
                  </div>
                </details>
              )) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
