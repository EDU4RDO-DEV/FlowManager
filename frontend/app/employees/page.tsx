"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
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
import { deleteEmployee, listEmployees } from "@/services/employees.service";
import type { EmployeeDto } from "@/types/employees";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<EmployeeDto | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await listEmployees();
      setEmployees(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de empleados."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return employees.filter((employee) => {
      if (normalizedQuery.length === 0) return true;
      return (
        employee.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        employee.puestoTrabajo.toLowerCase().includes(normalizedQuery) ||
        (employee.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [employees, query]);

  const metrics = useMemo(() => {
    const total = employees.length;
    const activos = employees.filter((item) => !item.anulado).length;
    const nominaBase = employees.reduce((sum, item) => sum + item.sueldoBase, 0);
    return { total, activos, nominaBase };
  }, [employees]);

  async function confirmDeleteEmployee() {
    if (!deleteCandidate) return;

    try {
      await deleteEmployee(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );
      toast.success("Empleado eliminado correctamente.");
      setDeleteCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el empleado."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Empleados"
        description="Gestion de personal, estructura salarial y control operativo por puesto."
      >
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Empleados totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </div>
                <Users className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-background">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Empleados activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                </div>
                <BriefcaseBusiness className="size-5 text-sky-600" />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border bg-muted/50 md:col-span-1 lg:col-span-2">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Nomina base estimada</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">{formatCurrency(metrics.nominaBase)}</Badge>
                  <Badge variant="outline">RRHH Basan</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de empleados</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra personal, datos de contacto y trazabilidad laboral.
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
                  <Link href="/employees/create">
                    <Plus className="size-4" />
                    Nuevo empleado
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-employees">Busqueda</Label>
                  <Input
                    id="search-employees"
                    placeholder="Nombre, puesto o correo"
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
                      <TableHead>Puesto</TableHead>
                      <TableHead>Sueldo base</TableHead>
                      <TableHead>Contratacion</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No hay empleados para mostrar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{employee.id}</TableCell>
                          <TableCell className="font-medium">{employee.entidad.nombreCompleto}</TableCell>
                          <TableCell>{employee.puestoTrabajo}</TableCell>
                          <TableCell>{formatCurrency(employee.sueldoBase)}</TableCell>
                          <TableCell>{formatDate(employee.fechaContratacion)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                asChild
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <Link href={`/employees/edit/${employee.id}`}>
                                  <Pencil className="size-3.5" />
                                  Editar
                                </Link>
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => setDeleteCandidate(employee)}
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

        {deleteCandidate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-xl border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Confirmar eliminacion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta accion anulara al empleado <span className="font-medium text-foreground">{deleteCandidate.entidad.nombreCompleto}</span>.
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteEmployee}>
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
