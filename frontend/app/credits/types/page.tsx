"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CreditCard, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { createCreditType, listCreditTypes, updateCreditType } from "@/services/credits.service";
import type { CreditTypeDto } from "@/types/credits";

export default function CreditTypesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "ventas", "create");
  const canUpdate = hasModulePermission(user, "ventas", "update");
  const [types, setTypes] = useState<CreditTypeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingTypeId, setSavingTypeId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<CreditTypeDto | null>(null);
  const [nombre, setNombre] = useState("");
  const [plazoDias, setPlazoDias] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [activo, setActivo] = useState(true);

  const loadTypes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setTypes(await listCreditTypes());
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudieron cargar los tipos de crédito");
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => void loadTypes(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadTypes]);

  const resetForm = () => {
    setEditingType(null);
    setNombre("");
    setPlazoDias("");
    setCondiciones("");
    setActivo(true);
    setIsFormOpen(false);
  };

  const startEditing = (type: CreditTypeDto) => {
    setEditingType(type);
    setNombre(type.nombre);
    setPlazoDias(type.plazoDias?.toString() ?? "");
    setCondiciones(type.condiciones ?? "");
    setActivo(type.activo);
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const cleanName = nombre.trim();
    const cleanConditions = condiciones.trim();
    const parsedTerm = plazoDias.trim() ? Number(plazoDias) : undefined;
    if (!cleanName) {
      toast.error("El nombre del tipo de crédito es obligatorio");
      return;
    }
    if (
      parsedTerm !== undefined &&
      (!Number.isSafeInteger(parsedTerm) || parsedTerm <= 0)
    ) {
      toast.error("El plazo debe ser un número entero mayor a cero");
      return;
    }

    setIsSaving(true);
    try {
      if (editingType) {
        await updateCreditType(editingType.id, {
          idUsuarioModificador: user.id,
          nombre: cleanName,
          plazoDias: parsedTerm ?? null,
          condiciones: cleanConditions || null,
          activo,
        });
        toast.success("Tipo de crédito actualizado");
      } else {
        await createCreditType({
          idUsuario: user.id,
          nombre: cleanName,
          ...(parsedTerm !== undefined ? { plazoDias: parsedTerm } : {}),
          ...(cleanConditions ? { condiciones: cleanConditions } : {}),
          activo,
        });
        toast.success("Tipo de crédito creado");
      }
      resetForm();
      await loadTypes();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el tipo de crédito"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (type: CreditTypeDto) => {
    if (!user) return;
    setSavingTypeId(type.id);
    try {
      await updateCreditType(type.id, {
        idUsuarioModificador: user.id,
        activo: !type.activo,
      });
      toast.success(type.activo ? "Tipo de crédito desactivado" : "Tipo de crédito activado");
      await loadTypes();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cambiar el estado del tipo de crédito"));
    } finally {
      setSavingTypeId(null);
    }
  };

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Tipos de crédito"
        description="Administra los plazos y condiciones comerciales disponibles para clientes."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="outline">
              <Link href="/credits">
                <ArrowLeft className="mr-2 size-4" />
                Volver a Créditos y Abonos
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              {canCreate ? (
                <Button
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  disabled={isLoading}
                >
                  <Plus className="mr-2 size-4" />
                  Crear tipo de crédito
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void loadTypes()} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Actualizar
              </Button>
            </div>
          </div>

          {isFormOpen && (canCreate || editingType !== null) ? (
            <Card>
              <CardHeader>
                <CardTitle>{editingType ? "Editar tipo de crédito" : "Nuevo tipo de crédito"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-type-name">Nombre</Label>
                      <Input
                        id="credit-type-name"
                        value={nombre}
                        onChange={(event) => setNombre(event.target.value)}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-type-term">Plazo en días (opcional)</Label>
                      <Input
                        id="credit-type-term"
                        type="number"
                        min={1}
                        step={1}
                        value={plazoDias}
                        onChange={(event) => setPlazoDias(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="credit-type-conditions">Condiciones comerciales (opcional)</Label>
                      <Textarea
                        id="credit-type-conditions"
                        value={condiciones}
                        onChange={(event) => setCondiciones(event.target.value)}
                        maxLength={500}
                        rows={3}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(event) => setActivo(event.target.checked)}
                        className="size-4 accent-primary"
                      />
                      Tipo de crédito activo
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    El incremento porcentual de los tipos no modifica los precios ni los totales de venta.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {editingType ? "Guardar cambios" : "Crear tipo"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <CardTitle>Tipos configurados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-3 font-medium">Tipo</th>
                      <th className="p-3 font-medium">Plazo</th>
                      <th className="p-3 font-medium">Condiciones</th>
                      <th className="p-3 font-medium">Estado</th>
                      {canUpdate ? <th className="p-3 text-right font-medium">Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={canUpdate ? 5 : 4} className="p-8 text-center text-muted-foreground">
                          <Loader2 className="mr-2 inline size-4 animate-spin" />
                          Cargando tipos de crédito...
                        </td>
                      </tr>
                    ) : loadError ? (
                      <tr>
                        <td colSpan={canUpdate ? 5 : 4} className="p-8 text-center text-destructive">
                          {loadError}
                        </td>
                      </tr>
                    ) : types.length === 0 ? (
                      <tr>
                        <td colSpan={canUpdate ? 5 : 4} className="p-8 text-center text-muted-foreground">
                          No hay tipos de crédito configurados.
                        </td>
                      </tr>
                    ) : (
                      types.map((type) => (
                        <tr key={type.id} className="border-b last:border-0">
                          <td className="p-3 font-medium">{type.nombre}</td>
                          <td className="p-3">{type.plazoDias === null ? "Sin plazo" : `${type.plazoDias} días`}</td>
                          <td className="max-w-md p-3 whitespace-pre-wrap">{type.condiciones || "-"}</td>
                          <td className="p-3">
                            <Badge variant={type.activo ? "default" : "secondary"}>
                              {type.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          {canUpdate ? (
                            <td className="p-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditing(type)}
                                  aria-label={`Editar ${type.nombre}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void toggleActive(type)}
                                  disabled={savingTypeId === type.id}
                                >
                                  {savingTypeId === type.id ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                  ) : null}
                                  {type.activo ? "Desactivar" : "Activar"}
                                </Button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
