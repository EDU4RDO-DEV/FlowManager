"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { UsersTable } from "@/app/users/_components/users-table";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  changeUserPassword,
  deleteUser,
  listAnulatedUsers,
  listRoles,
  listUsers,
  resetUserPassword,
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
  const { user } = useAuth();
  const canCreateUsers = hasModulePermission(user?.nombreRol, "usuarios", "create");
  const canUpdateUsers = hasModulePermission(user?.nombreRol, "usuarios", "update");
  const canDeleteUsers = hasModulePermission(user?.nombreRol, "usuarios", "delete");
  const [activeUsers, setActiveUsers] = useState<UserDto[]>([]);
  const [anulatedUsers, setAnulatedUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteCandidate, setDeleteCandidate] = useState<UserDto | null>(null);
  const [resetCandidate, setResetCandidate] = useState<UserDto | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showOwnPasswordModal, setShowOwnPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

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

  async function confirmResetPassword() {
    if (!canUpdateUsers) {
      toast.error("No tienes permisos para restablecer claves.");
      return;
    }

    if (!resetCandidate) return;

    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    setActionLoading(true);
    try {
      await resetUserPassword(resetCandidate.id, {
        nuevaClave: resetPasswordValue,
        ...(user?.id ? { idUsuarioModificador: user.id } : {}),
      });
      toast.success("Clave restablecida correctamente.");
      setResetCandidate(null);
      setResetPasswordValue("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restablecer la clave."));
    } finally {
      setActionLoading(false);
    }
  }

  async function submitOwnPasswordChange() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!currentPassword) {
      toast.error("Ingresa tu clave actual.");
      return;
    }

    if (!nextPassword || nextPassword.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    setActionLoading(true);
    try {
      await changeUserPassword(user.id, {
        claveActual: currentPassword,
        nuevaClave: nextPassword,
        idUsuarioModificador: user.id,
      });
      toast.success("Tu clave fue actualizada correctamente.");
      setShowOwnPasswordModal(false);
      setCurrentPassword("");
      setNextPassword("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cambiar tu clave."));
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
                    onResetPassword={setResetCandidate}
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
                    onClick={() => setShowOwnPasswordModal(true)}
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

        {deleteCandidate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Confirmar eliminacion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta accion anulara al usuario <span className="font-medium text-foreground">{deleteCandidate.nombre}</span>.
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteCandidate(null)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={actionLoading}
                >
                  Confirmar
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {resetCandidate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Restablecer clave</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define una nueva clave para <span className="font-medium text-foreground">{resetCandidate.nombre}</span>.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">Nueva clave</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetPasswordValue}
                    onChange={(event) => setResetPasswordValue(event.target.value)}
                    placeholder="Minimo 8 caracteres"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetCandidate(null);
                      setResetPasswordValue("");
                    }}
                    disabled={actionLoading}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={confirmResetPassword} disabled={actionLoading}>
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {showOwnPasswordModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Cambiar mi clave</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Actualiza tu contraseña de acceso de forma segura.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Clave actual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Ingresa clave actual"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="next-password">Nueva clave</Label>
                  <Input
                    id="next-password"
                    type="password"
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    placeholder="Minimo 8 caracteres"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowOwnPasswordModal(false);
                      setCurrentPassword("");
                      setNextPassword("");
                    }}
                    disabled={actionLoading}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={submitOwnPasswordChange} disabled={actionLoading}>
                    Actualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DashboardShell>
    </RequireAuth>
  );
}
