"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UsersTable } from "@/app/users/_components/users-table";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  deleteUser,
  listAnulatedUsers,
  listRoles,
  listUsers,
  restoreUser,
} from "@/services/users.service";
import type { RoleDto, UserDto } from "@/types/users";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreateUsers = hasModulePermission(user, "usuarios", "create");
  const canUpdateUsers = hasModulePermission(user, "usuarios", "update");
  const canDeleteUsers = hasModulePermission(user, "usuarios", "delete");
  const [activeUsers, setActiveUsers] = useState<UserDto[]>([]);
  const [anulatedUsers, setAnulatedUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteCandidate, setDeleteCandidate] = useState<UserDto | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, anulatedUsersData, rolesData] = await Promise.all([
        listUsers(),
        listAnulatedUsers(),
        listRoles(),
      ]);
      setActiveUsers(usersData);
      setAnulatedUsers(anulatedUsersData);
      setRoles(rolesData);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de usuarios."));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const roleById = useMemo(() => {
    return new Map<number, RoleDto>(roles.map((role) => [role.id, role]));
  }, [roles]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeUsers.filter((item) => {
      const roleName = item.idRol ? roleById.get(item.idRol)?.nombre ?? "" : "";
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.nombre.toLowerCase().includes(normalizedQuery) ||
        item.correo.toLowerCase().includes(normalizedQuery) ||
        roleName.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;

      if (roleFilter === "all") return true;
      if (roleFilter === "none") return item.idRol === null;
      return String(item.idRol) === roleFilter;
    });
  }, [activeUsers, query, roleFilter, roleById]);

  const filteredAnulatedUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return anulatedUsers.filter((item) => {
      const roleName = item.idRol ? roleById.get(item.idRol)?.nombre ?? "" : "";
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.nombre.toLowerCase().includes(normalizedQuery) ||
        item.correo.toLowerCase().includes(normalizedQuery) ||
        roleName.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;

      if (roleFilter === "all") return true;
      if (roleFilter === "none") return item.idRol === null;
      return String(item.idRol) === roleFilter;
    });
  }, [anulatedUsers, query, roleFilter, roleById]);

  const metrics = useMemo(() => {
    const total = activeUsers.length + anulatedUsers.length;
    const activos = activeUsers.length;
    const inactivos = anulatedUsers.length;
    const conRol = activeUsers.filter((item) => item.idRol !== null).length;
    return { total, activos, inactivos, conRol };
  }, [activeUsers, anulatedUsers]);

  async function confirmDelete() {
    if (!canDeleteUsers) {
      toast.error("No tienes permisos para anular usuarios.");
      return;
    }

    if (!deleteCandidate) return;

    setActionLoading(true);
    try {
      await deleteUser(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: UserDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setActiveUsers((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedUsers((prev) => [movedToTrash, ...prev]);
      toast.success("Usuario anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el usuario."));
    } finally {
      setActionLoading(false);
    }
  }

  async function restoreUserFromTrash(candidate: UserDto) {
    if (!canUpdateUsers) {
      toast.error("No tienes permisos para restaurar usuarios.");
      return;
    }

    setActionLoading(true);
    try {
      const restored = await restoreUser(
        candidate.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );
      setAnulatedUsers((prev) => prev.filter((item) => item.id !== candidate.id));
      setActiveUsers((prev) => [restored, ...prev]);
      toast.success("Usuario restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el usuario."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <RequireAuth moduleKey="usuarios" action="read">
      <DashboardShell
        title="Administracion de Usuarios"
        description="Panel corporativo Basan para gestionar acceso, roles y ciclo de vida de usuarios."
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Usuarios totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </div>
                <Users className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                </div>
                <UserCheck className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Con rol asignado</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.conRol}</p>
                </div>
                <ShieldCheck className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Estado operativo</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="destructive">Inactivos: {metrics.inactivos}</Badge>
                  <Badge variant="secondary">Basan IAM</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <Tabs defaultValue="listado">
            <TabsList>
              <TabsTrigger value="listado">Listado</TabsTrigger>
              <TabsTrigger value="seguridad">Seguridad personal</TabsTrigger>
            </TabsList>

            <TabsContent value="listado" className="mt-4">
              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredUsers.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulatedUsers.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  <UsersTable
                    users={filteredUsers}
                    roles={roles}
                    mode="activos"
                    query={query}
                    roleFilter={roleFilter}
                    loading={loading}
                    hasLoadedOnce={hasLoadedOnce}
                    onQueryChange={setQuery}
                    onRoleFilterChange={setRoleFilter}
                    onReload={loadData}
                    onDelete={setDeleteCandidate}
                    onResetPassword={(candidate) => router.push(`/users/${candidate.id}/reset-password`)}
                    canCreate={canCreateUsers}
                    canUpdate={canUpdateUsers}
                    canDelete={canDeleteUsers}
                    roleNameByUser={(item) =>
                      item.idRol ? roleById.get(item.idRol)?.nombre ?? `Rol ${item.idRol}` : "Sin rol"
                    }
                    formatDate={formatDate}
                  />
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  <UsersTable
                    users={filteredAnulatedUsers}
                    roles={roles}
                    mode="anulados"
                    query={query}
                    roleFilter={roleFilter}
                    loading={loading}
                    hasLoadedOnce={hasLoadedOnce}
                    onQueryChange={setQuery}
                    onRoleFilterChange={setRoleFilter}
                    onReload={loadData}
                    onDelete={() => undefined}
                    onRestore={restoreUserFromTrash}
                    onResetPassword={() => undefined}
                    canCreate={canCreateUsers}
                    canUpdate={canUpdateUsers}
                    canDelete={canDeleteUsers}
                    roleNameByUser={(item) =>
                      item.idRol ? roleById.get(item.idRol)?.nombre ?? `Rol ${item.idRol}` : "Sin rol"
                    }
                    formatDate={formatDate}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="seguridad" className="mt-4">
              <Card className="rounded-xl border border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold tracking-tight">Seguridad personal</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Actualiza tu propia clave de acceso sin salir del sistema.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border bg-muted/50 p-4">
                    Mantener tu contraseña actualizada reduce riesgos operativos.
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/users/change-password")}
                    disabled={!canUpdateUsers}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <KeyRound className="size-4" />
                    Cambiar mi clave
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de usuario"
          description={`Esta acción anulará a ${deleteCandidate?.nombre ?? "este usuario"}.`}
          confirmLabel={actionLoading ? "Anulando..." : "Anular"}
          loading={actionLoading}
          onConfirm={confirmDelete}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
