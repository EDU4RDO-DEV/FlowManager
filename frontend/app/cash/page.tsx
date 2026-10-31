"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { hasModulePermission } from "@/lib/rbac";
import { getApiErrorMessage } from "@/lib/api";
import {
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
  type CashSessionDto,
} from "@/services/cash.service";

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value ?? 0);

export default function CashPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<CashSessionDto | null>(null);
  const [history, setHistory] = useState<CashSessionDto[]>([]);
  const [initialBalance, setInitialBalance] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canRead = hasModulePermission(user, "caja", "read");
  const canOpen = hasModulePermission(user, "caja", "create");
  const canClose = hasModulePermission(user, "caja", "update");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [activeSession, sessions] = await Promise.all([
        getCurrentCashSession(),
        listCashSessions(),
      ]);
      setCurrent(activeSession);
      setHistory(sessions);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el módulo de caja."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void refresh();
    else setLoading(false);
  }, [canRead, refresh]);

  async function handleOpen() {
    const amount = Number(initialBalance);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Ingresa un saldo inicial válido.");
      return;
    }
    setSaving(true);
    try {
      await openCashSession(amount);
      setInitialBalance("");
      toast.success("Caja abierta.");
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo abrir la caja."));
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!current) return;
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Ingresa el efectivo contado.");
      return;
    }
    setSaving(true);
    try {
      await closeCashSession(current.Id, { efectivoContado: amount, observaciones: observations });
      setCountedCash("");
      setObservations("");
      toast.success("Caja cerrada.");
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cerrar la caja."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Caja" description="Apertura, movimientos y cierre de caja">
      {!canRead ? (
        <Card><CardContent className="p-6">No tienes permiso para consultar la caja.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {loading ? <p>Cargando caja...</p> : null}
          {!loading && !current ? (
            <Card>
              <CardHeader><CardTitle>Apertura de caja</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="initial-balance">Saldo inicial en efectivo</Label>
                  <Input
                    id="initial-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialBalance}
                    onChange={(event) => setInitialBalance(event.target.value)}
                    disabled={!canOpen || saving}
                  />
                </div>
                {canOpen ? <Button onClick={handleOpen} disabled={saving}>Abrir caja</Button> : null}
                {!canOpen ? <span className="text-sm text-muted-foreground">No tienes permiso para abrir caja.</span> : null}
              </CardContent>
            </Card>
          ) : null}

          {current ? (
            <Card>
              <CardHeader>
                <CardTitle>Caja abierta #{current.Id}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Responsable: {current.UsuarioApertura.Nombre} · Apertura: {new Date(current.FechaApertura).toLocaleString("es-GT")}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Summary label="Saldo inicial" value={money(current.SaldoInicial)} />
                  <Summary label="Ingresos en efectivo" value={money(current.Totales.efectivoIngresos)} />
                  <Summary label="Egresos en efectivo" value={money(current.Totales.efectivoEgresos)} />
                  <Summary label="Transferencias recibidas" value={money(current.Totales.transferenciasIngresos)} />
                  <Summary label="Transferencias pagadas" value={money(current.Totales.transferenciasEgresos)} />
                  <Summary label="Otros medios recibidos" value={money(current.Totales.otrosIngresos)} />
                  <Summary label="Otros medios pagados" value={money(current.Totales.otrosEgresos)} />
                  <Summary label="Efectivo esperado" value={money(current.EfectivoEsperado)} />
                </div>
                {canClose ? (
                  <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="counted-cash">Efectivo contado</Label>
                      <Input
                        id="counted-cash"
                        type="number"
                        min="0"
                        step="0.01"
                        value={countedCash}
                        onChange={(event) => setCountedCash(event.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="min-w-60 flex-1 space-y-2">
                      <Label htmlFor="cash-notes">Observaciones</Label>
                      <Input
                        id="cash-notes"
                        value={observations}
                        onChange={(event) => setObservations(event.target.value)}
                        maxLength={500}
                        disabled={saving}
                      />
                    </div>
                    <Button variant="destructive" onClick={handleClose} disabled={saving}>Cerrar caja</Button>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No tienes permiso para cerrar caja.</p>}
                <MovementList session={current} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Historial de aperturas y cierres</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No hay sesiones registradas.</p> : null}
              {history.map((session) => (
                <details key={session.Id} className="rounded-md border p-3">
                  <summary className="cursor-pointer">
                    Caja #{session.Id} · {session.Estado} · {new Date(session.FechaApertura).toLocaleString("es-GT")} · Efectivo esperado {money(session.EfectivoEsperado)}
                  </summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>Apertura: {session.UsuarioApertura.Nombre} · Saldo inicial: {money(session.SaldoInicial)}</p>
                    {session.FechaCierre ? <p>Cierre: {session.UsuarioCierre?.Nombre} · Contado: {money(session.EfectivoContado)} · Diferencia: {money(session.DiferenciaEfectivo)}</p> : null}
                    {session.ObservacionesCierre ? <p>Observaciones: {session.ObservacionesCierre}</p> : null}
                    <MovementList session={session} />
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function MovementList({ session }: { session: CashSessionDto }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Movimientos de la sesión</h3>
      {session.Movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
      ) : session.Movimientos.map((movement) => (
        <div key={movement.Id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
          <span>
            {new Date(movement.FechaMovimiento).toLocaleString("es-GT")} · {movement.Concepto} · {movement.MetodoPago} · {movement.Usuario.Nombre}
          </span>
          <span className={movement.Tipo === "EGRESO" ? "text-destructive" : ""}>
            {movement.Tipo === "EGRESO" ? "−" : "+"}{money(movement.Monto)}
          </span>
        </div>
      ))}
    </div>
  );
}
