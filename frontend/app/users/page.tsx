"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { UsersTable } from "@/app/users/_components/users-table";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        description="Gestiona altas, cambios, anulaciones y seguridad de acceso."
      >
        <div className="space-y-6">
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

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base tracking-tight">Seguridad personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Actualiza tu propia clave de acceso sin salir del sistema.</p>
              <Button variant="outline" onClick={handleChangeOwnPassword}>
                Cambiar mi clave
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
