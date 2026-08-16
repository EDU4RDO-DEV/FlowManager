"use client";

import { KeyRound, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RoleDto, UserDto } from "@/types/users";
import { UsersEmptyState } from "@/app/users/_components/users-empty-state";
import { UsersTableSkeleton } from "@/app/users/_components/users-skeletons";

type UsersTableProps = {
  users: UserDto[];
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  roles: RoleDto[];
  mode?: "activos" | "anulados";
  query: string;
  roleFilter: string;
  loading: boolean;
  hasLoadedOnce: boolean;
  onQueryChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onReload: () => void;
  onDelete: (user: UserDto) => void;
  onRestore?: (user: UserDto) => void;
  onResetPassword: (user: UserDto) => void;
  roleNameByUser: (user: UserDto) => string;
  formatDate: (value: string | null) => string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function UsersTable({
  users,
  totalItems,
  page,
  pageSize,
  onPageChange,
  roles,
  mode = "activos",
  query,
  roleFilter,
  loading,
  hasLoadedOnce,
  onQueryChange,
  onRoleFilterChange,
  onReload,
  onDelete,
  onRestore,
  onResetPassword,
  roleNameByUser,
  formatDate,
  canCreate,
  canUpdate,
  canDelete,
}: UsersTableProps) {
  const router = useRouter();
  const isAnulatedMode = mode === "anulados";

  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isAnulatedMode ? "Usuarios anulados" : "Listado de usuarios"}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAnulatedMode
              ? "Recupere usuarios anulados y restaure su acceso cuando corresponda."
              : "Controla accesos, roles y seguridad operacional del equipo Basan."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReload} disabled={loading} className="hover:bg-muted/50 transition-colors">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recargar
          </Button>
          {!isAnulatedMode && canCreate ? (
            <Button size="sm" asChild className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors">
              <Link href="/users/create">
                <Plus className="size-4" />
                Crear usuario
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && hasLoadedOnce ? (
          <p className="text-xs text-muted-foreground">Actualizando usuarios...</p>
        ) : null}

        <div className="grid gap-3 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="search-users">Busqueda</Label>
            <Input
              id="search-users"
              placeholder="Nombre, correo o rol"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-role">Filtro por rol</Label>
            <select
              id="filter-role"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
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

        {loading && !hasLoadedOnce ? (
          <UsersTableSkeleton rows={8} />
        ) : users.length === 0 ? (
          <UsersEmptyState mode={mode} onReload={onReload} />
        ) : (
          <div className={cn("transition-opacity duration-300", loading ? "opacity-75" : "opacity-100")}>
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table className="min-w-full">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>{isAnulatedMode ? "Anulacion" : "Registro"}</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">#{item.id}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.nombre}</TableCell>
                      <TableCell>{item.correo}</TableCell>
                      <TableCell>{roleNameByUser(item)}</TableCell>
                      <TableCell>
                        <Badge variant={item.anulado ? "destructive" : "default"}>
                          {item.anulado ? "Inactivo" : "Activo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(isAnulatedMode ? item.fechaAnulacion : item.fechaRegistro)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isAnulatedMode ? (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onRestore?.(item)}
                              disabled={!canUpdate}
                              className="hover:bg-muted/50 transition-colors"
                            >
                              <RotateCcw className="size-3.5" />
                              Restaurar
                            </Button>
                          ) : (
                            <>
                              {canUpdate ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => router.push(`/users/edit/${item.id}`)}
                                  className="hover:bg-muted/50 transition-colors"
                                >
                                  <Pencil className="size-3.5" />
                                  Editar
                                </Button>
                              ) : null}
                              {canUpdate ? (
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  onClick={() => onResetPassword(item)}
                                  className="hover:bg-muted/50 transition-colors"
                                >
                                  <KeyRound className="size-3.5" />
                                  Reset clave
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  onClick={() => onDelete(item)}
                                  className="transition-colors"
                                >
                                  <Trash2 className="size-3.5" />
                                  Anular
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="px-4 pb-4 pt-2">
              <ListPagination
                page={page}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={onPageChange}
                itemLabel="usuarios"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
