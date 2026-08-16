"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPagination } from "@/components/ui/list-pagination";
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
import { RolesEmptyState } from "@/app/roles/_components/roles-empty-state";
import {
  RolesCardsSkeleton,
  RolesTableSkeleton,
} from "@/app/roles/_components/roles-skeletons";
import {
  deleteRole,
  listAnulatedRoles,
  listRoles,
  restoreRole,
} from "@/services/roles.service";
import type { RoleDto } from "@/types/roles";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function RolesPage() {
  const { user } = useAuth();
  const canCreateRoles = hasModulePermission(user, "roles", "create");
  const canUpdateRoles = hasModulePermission(user, "roles", "update");
  const canDeleteRoles = hasModulePermission(user, "roles", "delete");
  const [rolesActivos, setRolesActivos] = useState<RoleDto[]>([]);
  const [rolesAnulados, setRolesAnulados] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const [deleteCandidate, setDeleteCandidate] = useState<RoleDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 10;

  async function loadData() {
    setLoading(true);
    try {
      const [activos, anulados] = await Promise.all([listRoles(), listAnulatedRoles()]);
      setRolesActivos(activos);
      setRolesAnulados(anulados);
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

  const filteredRolesActivos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rolesActivos.filter((role) => {
      if (normalizedQuery.length === 0) return true;
      return (
        role.nombre.toLowerCase().includes(normalizedQuery) ||
        (role.descripcion ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rolesActivos, query]);

  const filteredRolesAnulados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rolesAnulados.filter((role) => {
      if (normalizedQuery.length === 0) return true;
      return (
        role.nombre.toLowerCase().includes(normalizedQuery) ||
        (role.descripcion ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rolesAnulados, query]);

  const paginatedActiveRoles = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredRolesActivos.slice(start, start + PAGE_SIZE);
  }, [activePage, filteredRolesActivos]);

  const paginatedTrashRoles = useMemo(() => {
    const start = (trashPage - 1) * PAGE_SIZE;
    return filteredRolesAnulados.slice(start, start + PAGE_SIZE);
  }, [filteredRolesAnulados, trashPage]);

  useEffect(() => {
    setActivePage(1);
    setTrashPage(1);
  }, [query]);

  const metrics = useMemo(() => {
    const total = rolesActivos.length + rolesAnulados.length;
    const activos = rolesActivos.length;
    const anulados = rolesAnulados.length;
    const conDescripcion = rolesActivos.filter(
      (item) => (item.descripcion ?? "").trim().length > 0,
    ).length;
    return { total, activos, anulados, conDescripcion };
  }, [rolesActivos, rolesAnulados]);

  async function confirmDeleteRole() {
    if (!canDeleteRoles) {
      toast.error("No tienes permisos para anular roles.");
      return;
    }

    if (!deleteCandidate) return;

    try {
      setIsDeleting(true);
      await deleteRole(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      const movedToTrash: RoleDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setRolesActivos((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setRolesAnulados((prev) => [movedToTrash, ...prev]);
      toast.success("Rol anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el rol."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreRoleFromTrash(role: RoleDto) {
    if (!canUpdateRoles) {
      toast.error("No tienes permisos para restaurar roles.");
      return;
    }

    try {
      const restored = await restoreRole(
        role.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );
      setRolesAnulados((prev) => prev.filter((item) => item.id !== role.id));
      setRolesActivos((prev) => [restored, ...prev]);
      toast.success("Rol restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el rol."));
    }
  }

  return (
    <RequireAuth moduleKey="roles" action="read">
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

            <Card className="rounded-xl border border-border bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Con descripción</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.conDescripcion}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Anulados</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.anulados}</p>
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
                {canCreateRoles ? (
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
                ) : null}
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

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">
                    Activos ({filteredRolesActivos.length})
                  </TabsTrigger>
                  <TabsTrigger value="anulados">
                    Anulados ({filteredRolesAnulados.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {loading && !hasLoadedOnce ? (
                    <RolesTableSkeleton rows={8} />
                  ) : filteredRolesActivos.length === 0 ? (
                    <RolesEmptyState mode="activos" onReload={loadData} />
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
                            {paginatedActiveRoles.map((role) => (
                              <TableRow key={role.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{role.id}</TableCell>
                                <TableCell className="font-medium">{role.nombre}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {role.descripcion?.trim() || "Sin descripcion"}
                                </TableCell>
                                <TableCell>{formatDate(role.fechaRegistro)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {canUpdateRoles ? (
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
                                    ) : null}
                                    {canDeleteRoles ? (
                                      <Button
                                        size="xs"
                                        variant="destructive"
                                        onClick={() => setDeleteCandidate(role)}
                                      >
                                        <Trash2 className="size-3.5" />
                                        Anular
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={activePage}
                          totalItems={filteredRolesActivos.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setActivePage}
                          itemLabel="roles"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  {loading && !hasLoadedOnce ? (
                    <RolesTableSkeleton rows={8} />
                  ) : filteredRolesAnulados.length === 0 ? (
                    <RolesEmptyState mode="anulados" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", loading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Descripcion</TableHead>
                              <TableHead>Fecha anulacion</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedTrashRoles.map((role) => (
                              <TableRow key={role.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{role.id}</TableCell>
                                <TableCell className="font-medium">{role.nombre}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {role.descripcion?.trim() || "Sin descripcion"}
                                </TableCell>
                                <TableCell>{formatDate(role.fechaAnulacion)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreRoleFromTrash(role)}
                                    disabled={!canUpdateRoles}
                                  >
                                    <RotateCcw className="size-3.5" />
                                    Restaurar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={trashPage}
                          totalItems={filteredRolesAnulados.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setTrashPage}
                          itemLabel="roles"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de rol"
          description={`Esta acción anulará el rol ${deleteCandidate?.nombre ?? "seleccionado"}.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={confirmDeleteRole}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
