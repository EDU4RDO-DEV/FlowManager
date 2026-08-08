"use client";

import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { RolesEmptyState } from "@/app/roles/_components/roles-empty-state";
import {
  RolesCardsSkeleton,
  RolesTableSkeleton,
} from "@/app/roles/_components/roles-skeletons";
import { deleteRole, listRoles } from "@/services/roles.service";
import type { RoleDto } from "@/types/roles";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
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
      setHasLoadedOnce(true);
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
          {loading && !hasLoadedOnce ? (
            <RolesCardsSkeleton />
          ) : (
            <section
              className={cn(
                "grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 transition-opacity duration-300",
                loading ? "opacity-75" : "opacity-100",
              )}
            >
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
          )}

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
                  asChild
                  className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors"
                >
                  <Link href="/roles/create">
                    <Plus className="size-4" />
                    Nuevo rol
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando roles...</p>
              ) : null}

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

              {loading && !hasLoadedOnce ? (
                <RolesTableSkeleton rows={8} />
              ) : filteredRoles.length === 0 ? (
                <RolesEmptyState onReload={loadData} />
              ) : (
                <div className={cn("transition-opacity duration-300", loading ? "opacity-75" : "opacity-100")}>
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
                        {filteredRoles.map((role) => (
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
                                  asChild
                                  className="hover:bg-muted/50 transition-colors"
                                >
                                  <Link href={`/roles/edit/${role.id}`}>
                                    <Pencil className="size-3.5" />
                                    Editar
                                  </Link>
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
