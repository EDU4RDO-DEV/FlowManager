"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import {
  listCommissionAccruals,
  listCommissionReversalRequests,
  cancelCommissionReversalRequest,
  reviewCommissionReversalRequest,
  type CommissionAccrualDto,
  type CommissionReversalRequestDto,
} from "@/services/commission-accrual.service";

const money = (value: number) => new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
}).format(value);

export default function CommissionAccrualsPage() {
  const { user } = useAuth();
  const canRead = hasModulePermission(user, "planilla", "read");
  const canReview = hasModulePermission(user, "planilla", "update");
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [rows, setRows] = useState<CommissionAccrualDto[]>([]);
  const [reversals, setReversals] = useState<CommissionReversalRequestDto[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accruals, requests] = await Promise.all([
        listCommissionAccruals(Number(month), Number(year)),
        listCommissionReversalRequests(),
      ]);
      setRows(accruals);
      setReversals(requests);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo consultar el ledger de comisiones."));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.monto, 0), [rows]);

  async function review(requestId: number, decision: "APROBAR" | "RECHAZAR") {
    const observations = window.prompt(
      decision === "APROBAR" ? "Observaciones de aprobación:" : "Motivo del rechazo:",
    );
    if (observations === null) return;
    if (observations.trim().length < 3) {
      toast.error("Ingresa observaciones de al menos 3 caracteres.");
      return;
    }

    try {
      await reviewCommissionReversalRequest(requestId, decision, observations.trim());
      toast.success(decision === "APROBAR" ? "Solicitud aprobada." : "Solicitud rechazada.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo revisar la solicitud."));
    }
  }

  async function cancelRequest(requestId: number) {
    const observations = window.prompt("Motivo para anular la solicitud:");
    if (observations === null) return;
    if (observations.trim().length < 3) {
      toast.error("Ingresa observaciones de al menos 3 caracteres.");
      return;
    }
    try {
      await cancelCommissionReversalRequest(requestId, observations.trim());
      toast.success("Solicitud anulada.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la solicitud."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell title="Comisiones devengadas" description="Movimientos de comisión atribuidos a ventas confirmadas">
        {!canRead ? (
          <Card><CardContent className="p-6">No tienes permiso para consultar comisiones.</CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Período mensual</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission-month">Mes</Label>
                  <Input id="commission-month" type="number" min="1" max="12" value={month} onChange={(event) => setMonth(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission-year">Año</Label>
                  <Input id="commission-year" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
                </div>
                <Button onClick={() => void load()} disabled={loading || Number(month) < 1 || Number(month) > 12 || Number(year) < 2000}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">Neto de movimientos: <strong className="text-foreground">{money(total)}</strong></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Detalle de movimientos ({rows.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Empleado</TableHead><TableHead>Venta</TableHead>
                    <TableHead>Producto / categoría</TableHead><TableHead>Regla</TableHead><TableHead>Base</TableHead>
                    <TableHead>Cálculo</TableHead><TableHead>Movimiento</TableHead><TableHead className="text-right">Monto</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.fechaVenta).toLocaleDateString("es-GT")}</TableCell>
                        <TableCell>{row.empleado}</TableCell>
                        <TableCell>#{row.numeroVenta} · {row.condicionPago} · {row.estadoCobro}</TableCell>
                        <TableCell>{row.producto}{row.categoria ? ` · ${row.categoria}` : ""}</TableCell>
                        <TableCell>{row.regla ?? "—"}</TableCell>
                        <TableCell>{money(row.baseCalculo)}{row.baseCategoria !== null ? ` / categoría ${money(row.baseCategoria)}` : ""}</TableCell>
                        <TableCell>{row.tipoCalculo} · {row.valorAplicado}</TableCell>
                        <TableCell>{row.tipoMovimiento}</TableCell>
                        <TableCell className="text-right font-medium">{money(row.monto)}</TableCell>
                      </TableRow>
                    ))}
                    {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No hay movimientos de comisión para este período.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Solicitudes de reversión ({reversals.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Estado</TableHead><TableHead>Empleado</TableHead><TableHead>Venta / producto</TableHead>
                    <TableHead>Solicitada</TableHead><TableHead>Aplicada</TableHead><TableHead>Motivo</TableHead>
                    <TableHead>Solicitó</TableHead><TableHead>Revisó</TableHead><TableHead>Acciones</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reversals.map((request) => (
                      <TableRow key={request.Id}>
                        <TableCell>{request.Estado}</TableCell>
                        <TableCell>{request.Empleado.Entidad.NombreCompleto}</TableCell>
                        <TableCell>#{request.Venta.NumeroVenta} · {request.DetalleVenta.Nombre}{request.DevolucionComercial ? ` · devolución #${request.DevolucionComercial.Id}` : ""}</TableCell>
                        <TableCell>{money(Number(request.MontoSolicitado))}</TableCell>
                        <TableCell>{money(Number(request.MontoAplicado))}</TableCell>
                        <TableCell>{request.Motivo}</TableCell>
                        <TableCell>{request.Solicitante.Nombre}</TableCell>
                        <TableCell>{request.Revisor?.Nombre ?? "—"}</TableCell>
                        <TableCell>
                          {request.Estado === "PENDIENTE_REVISION" ? (
                            <div className="flex gap-2">
                              {canReview && request.Solicitante.Id !== user?.id && (
                                <>
                                  <Button size="sm" onClick={() => void review(request.Id, "APROBAR")}>Aprobar</Button>
                                  <Button size="sm" variant="outline" onClick={() => void review(request.Id, "RECHAZAR")}>Rechazar</Button>
                                </>
                              )}
                              {canReview && request.Solicitante.Id === user?.id && (
                                <Button size="sm" variant="outline" onClick={() => void cancelRequest(request.Id)}>Anular solicitud</Button>
                              )}
                              {!canReview && "—"}
                            </div>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && reversals.length === 0 && <TableRow><TableCell colSpan={9} className="h-20 text-center text-muted-foreground">No hay solicitudes de reversión.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DashboardShell>
    </RequireAuth>
  );
}
