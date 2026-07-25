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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import {
  changeUserPassword,
  deleteUser,
  listRoles,
  listUsers,
  resetUserPassword,
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
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([listUsers(), listRoles()]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de usuarios."));
    } finally {
      setLoading(false);
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

    return users.filter((item) => {
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
  }, [users, query, roleFilter, roleById]);

  const metrics = useMemo(() => {
    const total = users.length;
    const activos = users.filter((item) => !item.anulado).length;
    const inactivos = users.filter((item) => item.anulado).length;
    const conRol = users.filter((item) => item.idRol !== null).length;
    return { total, activos, inactivos, conRol };
  }, [users]);

  async function handleDelete(item: UserDto) {
    const ok = window.confirm(`Anular usuario ${item.nombre}?`);
    if (!ok) return;

    try {
      await deleteUser(item.id, user?.id ? { idUsuarioAnulador: user.id } : undefined);
      toast.success("Usuario eliminado correctamente.");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el usuario."));
    }
  }

  async function handleResetPassword(item: UserDto) {
    const nuevaClave = window.prompt(
      `Nueva clave para ${item.nombre} (minimo 8 caracteres):`,
      "",
    );
    if (!nuevaClave) return;

    if (nuevaClave.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    try {
      await resetUserPassword(item.id, {
        nuevaClave,
        ...(user?.id ? { idUsuarioModificador: user.id } : {}),
      });
      toast.success("Clave restablecida correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restablecer la clave."));
    }
  }

  async function handleChangeOwnPassword() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    const claveActual = window.prompt("Ingresa tu clave actual:", "");
    if (!claveActual) return;

    const nuevaClave = window.prompt("Ingresa tu nueva clave (minimo 8 caracteres):", "");
    if (!nuevaClave) return;

    if (nuevaClave.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    try {
      await changeUserPassword(user.id, {
        claveActual,
        nuevaClave,
        idUsuarioModificador: user.id,
      });
      toast.success("Tu clave fue actualizada correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cambiar tu clave."));
    }
  }

  return (
    <RequireAuth>
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
              <UsersTable
                users={filteredUsers}
                roles={roles}
                query={query}
                roleFilter={roleFilter}
                loading={loading}
                onQueryChange={setQuery}
                onRoleFilterChange={setRoleFilter}
                onReload={loadData}
                onDelete={handleDelete}
                onResetPassword={handleResetPassword}
                roleNameByUser={(item) =>
                  item.idRol ? roleById.get(item.idRol)?.nombre ?? `Rol ${item.idRol}` : "Sin rol"
                }
                formatDate={formatDate}
              />
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
                    onClick={handleChangeOwnPassword}
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
      </DashboardShell>
    </RequireAuth>
  );
}
