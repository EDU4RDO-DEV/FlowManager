"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmployeesEmptyState } from "@/app/employees/_components/employees-empty-state";
import {
  EmployeesCardsSkeleton,
  EmployeesTableSkeleton,
} from "@/app/employees/_components/employees-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteEmployee,
  listAnulatedEmployees,
  listEmployees,
  restoreEmployee,
} from "@/services/employees.service";
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
  const [activeEmployees, setActiveEmployees] = useState<EmployeeDto[]>([]);
  const [anulatedEmployees, setAnulatedEmployees] = useState<EmployeeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<EmployeeDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activos, anulados] = await Promise.all([listEmployees(), listAnulatedEmployees()]);
      setActiveEmployees(activos);
      setAnulatedEmployees(anulados);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de empleados."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeEmployees.filter((employee) => {
      if (normalizedQuery.length === 0) return true;
      return (
        employee.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        employee.puestoTrabajo.toLowerCase().includes(normalizedQuery) ||
        (employee.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeEmployees, query]);

  const filteredAnulatedEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return anulatedEmployees.filter((employee) => {
      if (normalizedQuery.length === 0) return true;
      return (
        employee.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        employee.puestoTrabajo.toLowerCase().includes(normalizedQuery) ||
        (employee.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [anulatedEmployees, query]);

  const metrics = useMemo(() => {
    const total = activeEmployees.length + anulatedEmployees.length;
    const activos = activeEmployees.length;
    const nominaBase = activeEmployees.reduce((sum, item) => sum + item.sueldoBase, 0);
    return { total, activos, nominaBase };
  }, [activeEmployees, anulatedEmployees]);

  async function confirmDeleteEmployee() {
    if (!deleteCandidate) return;

    try {
      await deleteEmployee(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: EmployeeDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setActiveEmployees((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedEmployees((prev) => [movedToTrash, ...prev]);
      toast.success("Empleado anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el empleado."));
    }
  }

  async function restoreEmployeeFromTrash(candidate: EmployeeDto) {
    try {
      const restored = await restoreEmployee(
        candidate.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );
      setAnulatedEmployees((prev) => prev.filter((item) => item.id !== candidate.id));
      setActiveEmployees((prev) => [restored, ...prev]);
      toast.success("Empleado restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el empleado."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Empleados"
        description="Gestion de personal, estructura salarial y control operativo por puesto."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <EmployeesCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 transition-opacity duration-300">
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
          )}

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
                  disabled={isLoading}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
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
              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando empleados...</p>
              ) : null}

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

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredEmployees.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulatedEmployees.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <EmployeesTableSkeleton rows={8} />
                  ) : filteredEmployees.length === 0 ? (
                    <EmployeesEmptyState mode="activos" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
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
                            {filteredEmployees.map((employee) => (
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
                                      Anular
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
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <EmployeesTableSkeleton rows={8} />
                  ) : filteredAnulatedEmployees.length === 0 ? (
                    <EmployeesEmptyState mode="anulados" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Puesto</TableHead>
                              <TableHead>Sueldo base</TableHead>
                              <TableHead>Anulacion</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAnulatedEmployees.map((employee) => (
                              <TableRow key={employee.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{employee.id}</TableCell>
                                <TableCell className="font-medium">{employee.entidad.nombreCompleto}</TableCell>
                                <TableCell>{employee.puestoTrabajo}</TableCell>
                                <TableCell>{formatCurrency(employee.sueldoBase)}</TableCell>
                                <TableCell>{formatDate(employee.fechaAnulacion)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreEmployeeFromTrash(employee)}
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
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
