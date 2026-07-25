import { Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoleDto, UserDto } from "@/types/users";

type UsersTableProps = {
  users: UserDto[];
  roles: RoleDto[];
  query: string;
  roleFilter: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onReload: () => void;
  onDelete: (user: UserDto) => void;
  onResetPassword: (user: UserDto) => void;
  roleNameByUser: (user: UserDto) => string;
  formatDate: (value: string | null) => string;
};

export function UsersTable({
  users,
  roles,
  query,
  roleFilter,
  loading,
  onQueryChange,
  onRoleFilterChange,
  onReload,
  onDelete,
  onResetPassword,
  roleNameByUser,
  formatDate,
}: UsersTableProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base tracking-tight">Listado de usuarios</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReload} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recargar
          </Button>
          <Button size="sm" asChild>
            <Link href="/users/create">
              <Plus className="size-4" />
              Crear usuario
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="search-users">Busqueda</Label>
            <Input
              id="search-users"
              placeholder="Nombre, correo o rol"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-role">Filtro por rol</Label>
            <select
              id="filter-role"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={roleFilter}
              onChange={(event) => onRoleFilterChange(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="none">Sin rol</option>
              {roles.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full min-w-190 text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Registro</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id} className="border-t border-border/70 align-top">
                    <td className="px-3 py-2">{item.id}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{item.nombre}</td>
                    <td className="px-3 py-2">{item.correo}</td>
                    <td className="px-3 py-2">{roleNameByUser(item)}</td>
                    <td className="px-3 py-2">{formatDate(item.fechaRegistro)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="xs" variant="outline" asChild>
                          <Link href={`/users/edit/${item.id}`}>Editar</Link>
                        </Button>
                        <Button size="xs" variant="destructive" onClick={() => onDelete(item)}>
                          Eliminar
                        </Button>
                        <Button size="xs" variant="secondary" onClick={() => onResetPassword(item)}>
                          Reset clave
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
