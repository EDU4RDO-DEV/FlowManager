"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  createCustomerCreditCondition,
  listCreditTypes,
  listCustomerCreditConditions,
  updateCustomerCreditCondition,
} from "@/services/credits.service";
import type {
  CustomerCreditAuthorization,
  CustomerCreditConditionDto,
  CreditTypeDto,
} from "@/types/credits";

interface CreditConditionManagerProps {
  customerId: number;
  authorization: CustomerCreditAuthorization | null;
  onUpdated: () => void;
}

function localDateInputValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha final";
  const date = new Date(`${dateInputValue(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getConditionStatus(
  condition: CustomerCreditConditionDto,
  currentConditionId: number | undefined,
): string {
  if (condition.anulado) return "Anulada";
  if (condition.id === currentConditionId) return "Vigente para ventas";
  if (!condition.habilitadoCredito) return "Deshabilitada";

  const today = localDateInputValue();
  const start = dateInputValue(condition.fechaInicioVigencia);
  const end = dateInputValue(condition.fechaFinVigencia);
  if (start > today) return "Programada";
  if (end && end < today) return "Vencida";
  return "Sin autorización actual";
}

export function CreditConditionManager({
  customerId,
  authorization,
  onUpdated,
}: CreditConditionManagerProps) {
  const { user } = useAuth();
  const canRead = hasModulePermission(user, "clientes", "read");
  const canCreate = hasModulePermission(user, "clientes", "create");
  const canUpdate = hasModulePermission(user, "clientes", "update");
  const canManageTypes =
    hasModulePermission(user, "ventas", "create") ||
    hasModulePermission(user, "ventas", "update");
  const [conditions, setConditions] = useState<CustomerCreditConditionDto[]>([]);
  const [activeTypes, setActiveTypes] = useState<CreditTypeDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<CustomerCreditConditionDto | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(localDateInputValue);
  const [fechaFin, setFechaFin] = useState("");
  const [habilitado, setHabilitado] = useState(true);
  const [observaciones, setObservaciones] = useState("");

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [customerConditions, types] = await Promise.all([
        listCustomerCreditConditions(customerId),
        listCreditTypes(true),
      ]);
      setConditions(customerConditions);
      setActiveTypes(types);
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudieron cargar las condiciones de crédito");
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [canRead, customerId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  const resetForm = () => {
    setEditingCondition(null);
    setSelectedTypeId("");
    setFechaInicio(localDateInputValue());
    setFechaFin("");
    setHabilitado(true);
    setObservaciones("");
    setIsFormOpen(false);
  };

  const startEditing = (condition: CustomerCreditConditionDto) => {
    setEditingCondition(condition);
    setSelectedTypeId(String(condition.idTipoCredito));
    setFechaInicio(dateInputValue(condition.fechaInicioVigencia));
    setFechaFin(dateInputValue(condition.fechaFinVigencia));
    setHabilitado(condition.habilitadoCredito);
    setObservaciones(condition.observaciones ?? "");
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const parsedTypeId = Number(selectedTypeId);
    if (!Number.isSafeInteger(parsedTypeId) || parsedTypeId <= 0) {
      toast.error("Selecciona un tipo de crédito activo");
      return;
    }
    if (!fechaInicio) {
      toast.error("La fecha inicial de vigencia es obligatoria");
      return;
    }
    if (fechaFin && fechaFin < fechaInicio) {
      toast.error("La fecha final no puede ser anterior a la fecha inicial");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCondition) {
        await updateCustomerCreditCondition(editingCondition.id, {
          idUsuarioModificador: user.id,
          habilitadoCredito: habilitado,
          fechaInicioVigencia: fechaInicio,
          fechaFinVigencia: fechaFin || null,
          observaciones: observaciones.trim() || null,
        });
        toast.success("Condición de crédito actualizada");
      } else {
        await createCustomerCreditCondition({
          idUsuario: user.id,
          idCliente: customerId,
          idTipoCredito: parsedTypeId,
          habilitadoCredito: habilitado,
          fechaInicioVigencia: fechaInicio,
          ...(fechaFin ? { fechaFinVigencia: fechaFin } : {}),
          ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        });
        toast.success("Condición de crédito asignada");
      }
      resetForm();
      await loadData();
      onUpdated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la condición de crédito"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Se requiere permiso de lectura de clientes para consultar el historial de condiciones.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Condiciones de crédito</CardTitle>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              disabled={isLoading || activeTypes.length === 0}
            >
              <Plus className="mr-2 size-4" />
              Asignar tipo
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm">
            Habilitación general del cliente:{" "}
            <Badge variant={authorization?.habilitadoCredito ? "default" : "secondary"}>
              {authorization?.habilitadoCredito ? "Habilitada" : "Deshabilitada"}
            </Badge>
          </p>
          <p className="text-sm">
            Tipo vigente para ventas:{" "}
            <span className="font-medium">
              {authorization?.condicionVigente?.nombreTipoCredito ?? "Sin condición autorizada"}
            </span>
          </p>
        </div>

        {activeTypes.length === 0 && !isLoading ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            No hay tipos de crédito activos.{" "}
            {canManageTypes ? (
              <Link className="font-medium underline" href="/credits/types">
                Configurar tipos de crédito
              </Link>
            ) : (
              "Solicita a un usuario con permisos de ventas que configure un tipo."
            )}
          </div>
        ) : null}

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

        {isFormOpen && (canCreate || editingCondition !== null) ? (
          <form className="space-y-4 rounded-md border p-4" onSubmit={(event) => void handleSubmit(event)}>
            <h3 className="font-semibold">
              {editingCondition ? "Editar condición" : "Asignar condición al cliente"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`credit-condition-type-${customerId}`}>Tipo de crédito</Label>
                {editingCondition ? (
                  <p className="flex h-10 items-center rounded-md border px-3 text-sm">
                    {editingCondition.tipoCredito?.nombre ?? `Tipo #${editingCondition.idTipoCredito}`} (histórico)
                  </p>
                ) : (
                  <select
                    id={`credit-condition-type-${customerId}`}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedTypeId}
                    onChange={(event) => setSelectedTypeId(event.target.value)}
                    required
                  >
                    <option value="">Selecciona un tipo activo</option>
                    {activeTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`credit-condition-start-${customerId}`}>Inicio de vigencia</Label>
                <Input
                  id={`credit-condition-start-${customerId}`}
                  type="date"
                  value={fechaInicio}
                  onChange={(event) => setFechaInicio(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`credit-condition-end-${customerId}`}>Fin de vigencia (opcional)</Label>
                <Input
                  id={`credit-condition-end-${customerId}`}
                  type="date"
                  value={fechaFin}
                  onChange={(event) => setFechaFin(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={habilitado}
                  onChange={(event) => setHabilitado(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Condición habilitada para ventas
              </label>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`credit-condition-notes-${customerId}`}>Observaciones (opcional)</Label>
                <Textarea
                  id={`credit-condition-notes-${customerId}`}
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  maxLength={255}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={isSaving || (!editingCondition && activeTypes.length === 0)}
              >
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {editingCondition ? "Guardar cambios" : "Asignar condición"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de crédito</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Habilitación</TableHead>
                <TableHead>Observaciones</TableHead>
                {canUpdate ? <TableHead className="text-right">Acciones</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && conditions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canUpdate ? 6 : 5} className="h-20 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Cargando condiciones...
                  </TableCell>
                </TableRow>
              ) : conditions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canUpdate ? 6 : 5} className="h-20 text-center text-muted-foreground">
                    No hay condiciones registradas para este cliente.
                  </TableCell>
                </TableRow>
              ) : (
                conditions.map((condition) => {
                  const status = getConditionStatus(condition, authorization?.condicionVigente?.id);
                  return (
                    <TableRow key={condition.id}>
                      <TableCell className="font-medium">
                        {condition.tipoCredito?.nombre ?? `Tipo #${condition.idTipoCredito}`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(condition.fechaInicioVigencia)} – {formatDate(condition.fechaFinVigencia)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status === "Vigente para ventas" ? "default" : "secondary"}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={condition.habilitadoCredito ? "default" : "secondary"}>
                          {condition.habilitadoCredito ? "Habilitada" : "Deshabilitada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm whitespace-pre-wrap">
                        {condition.observaciones || "-"}
                      </TableCell>
                      {canUpdate ? (
                        <TableCell className="text-right">
                          {!condition.anulado ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(condition)}
                              aria-label={`Editar condición ${condition.id}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          El historial incluye condiciones vigentes, vencidas, deshabilitadas y anuladas. Las fechas inicial y final
          son inclusivas; al asignar un nuevo tipo, la condición habilitada anterior finaliza el día previo.
        </p>
      </CardContent>
    </Card>
  );
}
