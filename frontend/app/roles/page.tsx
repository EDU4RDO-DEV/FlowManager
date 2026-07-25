"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
import { getApiErrorMessage } from "@/lib/api";
import { createRole, deleteRole, listRoles, updateRole } from "@/services/roles.service";
import type { RoleDto } from "@/types/roles";

type FormMode = "create" | "edit";

type RoleForm = {
  nombre: string;
  descripcion: string;
};

const EMPTY_FORM: RoleForm = {
  nombre: "",
  descripcion: "",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<RoleDto | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await listRoles();
      setRoles(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el panel de permisos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return roles.filter((role) => {
      if (normalizedQuery.length === 0) return true;
      return (
        role.nombre.toLowerCase().includes(normalizedQuery) ||
        (role.descripcion ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [roles, query]);

  const metrics = useMemo(() => {
    const total = roles.length;
    const activos = roles.filter((item) => !item.anulado).length;
    const conDescripcion = roles.filter((item) => (item.descripcion ?? "").trim().length > 0).length;
    return { total, activos, conDescripcion };
  }, [roles]);

  function openCreateForm() {
    setFormMode("create");
    setEditingRole(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(role: RoleDto) {
    setFormMode("edit");
    setEditingRole(role);
    setForm({
      nombre: role.nombre,
      descripcion: role.descripcion ?? "",
    });
    setFormOpen(true);
  }

  async function saveRole() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombre.trim()) {
      toast.error("El nombre del rol es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      if (formMode === "create") {
        await createRole({
          idUsuario: user.id,
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
        });
        toast.success("Rol creado correctamente.");
      } else if (editingRole) {
        await updateRole(editingRole.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          idUsuarioModificador: user.id,
        });
        toast.success("Rol actualizado correctamente.");
      }

      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingRole(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el rol."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRole() {
    if (!deleteCandidate) return;

    try {
      await deleteRole(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      toast.success("Rol eliminado correctamente.");
      setDeleteCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el rol."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Roles y Permisos"
        description="Configura acceso por perfil y politicas operativas por modulo."
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Roles totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </div>
                <ShieldCheck className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Roles activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                </div>
                <KeyRound className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50 md:col-span-1 lg:col-span-2">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Cobertura</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">Con descripcion: {metrics.conDescripcion}</Badge>
                  <Badge variant="outline">Basan RBAC</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de roles</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra nombres, descripcion y ciclo de vida de permisos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
                <Button
                  size="sm"
                  onClick={openCreateForm}
                  className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors"
                >
                  <Plus className="size-4" />
                  Nuevo rol
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-roles">Busqueda</Label>
                  <Input
                    id="search-roles"
                    placeholder="Nombre o descripcion"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <Table className="min-w-full">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No hay roles para mostrar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRoles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{role.id}</TableCell>
                          <TableCell className="font-medium">{role.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {role.descripcion?.trim() || "Sin descripcion"}
                          </TableCell>
                          <TableCell>{formatDate(role.fechaRegistro)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => openEditForm(role)}
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <Pencil className="size-3.5" />
                                Editar
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => setDeleteCandidate(role)}
                              >
                                <Trash2 className="size-3.5" />
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {formOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-xl rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {formMode === "create" ? "Nuevo rol" : "Editar rol"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define un nombre claro y una descripcion operativa para el permiso.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Nombre</Label>
                  <Input
                    id="role-name"
                    value={form.nombre}
                    onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    placeholder="Ej. Supervisor de produccion"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role-description">Descripcion</Label>
                  <textarea
                    id="role-description"
                    className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
                    value={form.descripcion}
                    onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    placeholder="Describe alcance y responsabilidad del rol"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormOpen(false);
                      setEditingRole(null);
                      setForm(EMPTY_FORM);
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={saveRole} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {deleteCandidate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Confirmar eliminacion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta accion anulara el rol <span className="font-medium text-foreground">{deleteCandidate.nombre}</span>.
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteRole}>
                  Confirmar
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DashboardShell>
    </RequireAuth>
  );
}
