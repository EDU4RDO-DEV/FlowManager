"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MapPinned, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { LogisticsEmptyState } from "@/app/logistics/_components/logistics-empty-state";
import {
  LogisticsCardsSkeleton,
  LogisticsTableSkeleton,
} from "@/app/logistics/_components/logistics-skeletons";
import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getApiErrorMessage } from "@/lib/api";
import { getLogisticsEmployeeOptions } from "@/lib/logistics-employee-options";
import { hasModulePermission } from "@/lib/rbac";
import { listEmployees } from "@/services/employees.service";
import {
  createRuta,
  createRutaSesion,
  deleteRuta,
  deleteRutaSesion,
  listRutas,
  listRutaSesiones,
  listVehiculos,
  restoreRuta,
  restoreRutaSesion,
  updateRuta,
  updateRutaSesion,
  closeJornada,
  createJornada,
  listJornadas,
} from "@/services/logistics.service";
import type { JornadaDto, RutaDto, RutaSesionDto, RutaSesionEstado, VehiculoDto } from "@/types/logistics";

const SESSION_STATES: RutaSesionEstado[] = ["PROGRAMADA", "EN_CURSO", "CERRADA"];

type RouteFormState = {
  nombre: string;
  descripcion: string;
};

type SessionFormState = {
  idRuta: string;
  idVehiculo: string;
  idEmpleadoChofer: string;
  idEmpleadoVendedor: string;
  idJornada: string;
  fechaSesion: string;
  kmInicial: string;
  kmFinal: string;
  estado: RutaSesionEstado;
};

type JornadaFormState = {
  fecha: string;
  idUsuarioResponsable: string;
  observaciones: string;
};

const EMPTY_ROUTE_FORM: RouteFormState = {
  nombre: "",
  descripcion: "",
};

const EMPTY_SESSION_FORM: SessionFormState = {
  idRuta: "",
  idVehiculo: "",
  idEmpleadoChofer: "",
  idEmpleadoVendedor: "",
  idJornada: "",
  fechaSesion: "",
  kmInicial: "",
  kmFinal: "",
  estado: "PROGRAMADA",
};

const EMPTY_JORNADA_FORM: JornadaFormState = {
  fecha: "",
  idUsuarioResponsable: "",
  observaciones: "",
};

// Fecha (Jornada) y FechaSesion (RutaSesion) son columnas @db.Date: representan un
// día calendario, no un instante. El valor llega como medianoche UTC; formatear en
// hora local retrocede un día en husos horarios detrás de UTC (p. ej. Guatemala).
// Se fuerza timeZone: "UTC" para mostrar el día calendario tal como se guardó.
function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default function LogisticsRoutesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "logistica", "create");
  const canUpdate = hasModulePermission(user, "logistica", "update");
  const canDelete = hasModulePermission(user, "logistica", "delete");

  const [routes, setRoutes] = useState<RutaDto[]>([]);
  const [trashRoutes, setTrashRoutes] = useState<RutaDto[]>([]);
  const [sessions, setSessions] = useState<RutaSesionDto[]>([]);
  const [trashSessions, setTrashSessions] = useState<RutaSesionDto[]>([]);
  const [vehicles, setVehicles] = useState<VehiculoDto[]>([]);
  const [employees, setEmployees] = useState<Array<{ employeeId: number; userId: number | null; nombre: string }>>([]);
  const [jornadas, setJornadas] = useState<JornadaDto[]>([]);
  const [routeForm, setRouteForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(EMPTY_SESSION_FORM);
  const [jornadaForm, setJornadaForm] = useState<JornadaFormState>(EMPTY_JORNADA_FORM);
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingJornada, setIsSavingJornada] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [routeDeleteCandidate, setRouteDeleteCandidate] = useState<RutaDto | null>(null);
  const [sessionDeleteCandidate, setSessionDeleteCandidate] = useState<RutaSesionDto | null>(null);
  const [jornadaCloseCandidate, setJornadaCloseCandidate] = useState<JornadaDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activeRoutes, removedRoutes, activeSessions, removedSessions, availableVehicles, employeeList, loadedJornadas] = await Promise.all([
        listRutas({ anulado: false }),
        listRutas({ anulado: true }),
        listRutaSesiones({ anulado: false }),
        listRutaSesiones({ anulado: true }),
        listVehiculos({ anulado: false }),
        listEmployees(),
        listJornadas({ anulado: false }),
      ]);

      setRoutes(activeRoutes);
      setTrashRoutes(removedRoutes);
      setSessions(activeSessions);
      setTrashSessions(removedSessions);
      setJornadas(loadedJornadas);
      setVehicles(availableVehicles);
      setEmployees(getLogisticsEmployeeOptions(employeeList));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar logística de rutas"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const metrics = useMemo(() => {
    return {
      rutasActivas: routes.length,
      sesionesActivas: sessions.length,
      sesionesEnCurso: sessions.filter((item) => item.estado === "EN_CURSO").length,
    };
  }, [routes, sessions]);

  // Sugerencia de personal habitual: busca la sesión más reciente del vehículo
  // seleccionado para proponer su chofer/vendedor frecuente (no obliga a usarlo).
  function findHabitualCrew(idVehiculo: string) {
    if (!idVehiculo) return null;
    const matches = sessions
      .filter((item) => String(item.idVehiculo) === idVehiculo)
      .sort((a, b) => new Date(b.fechaSesion).getTime() - new Date(a.fechaSesion).getTime());
    return matches[0] ?? null;
  }

  function handleVehicleChange(idVehiculo: string) {
    const habitual = findHabitualCrew(idVehiculo);
    setSessionForm((prev) => ({
      ...prev,
      idVehiculo,
      idEmpleadoChofer: !prev.idEmpleadoChofer && habitual
        ? String(habitual.idEmpleadoChofer ?? employees.find((item) => item.userId === habitual.idUsuarioChofer)?.employeeId ?? "")
        : prev.idEmpleadoChofer,
      idEmpleadoVendedor: !prev.idEmpleadoVendedor && habitual
        ? String(habitual.idEmpleadoVendedor ?? employees.find((item) => item.userId === habitual.idUsuarioVendedor)?.employeeId ?? "")
        : prev.idEmpleadoVendedor,
    }));
    if (habitual && (!sessionForm.idEmpleadoChofer || !sessionForm.idEmpleadoVendedor)) {
      toast.info("Se sugirió el chofer/vendedor habitual de este vehículo; puedes cambiarlos si corresponde.");
    }
  }

  function resetRouteForm() {
    setRouteForm(EMPTY_ROUTE_FORM);
    setEditingRouteId(null);
  }

  function resetSessionForm() {
    setSessionForm(EMPTY_SESSION_FORM);
    setEditingSessionId(null);
  }

  function startEditRoute(item: RutaDto) {
    setEditingRouteId(item.id);
    setRouteForm({
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
    });
  }

  function startEditSession(item: RutaSesionDto) {
    setEditingSessionId(item.id);
    setSessionForm({
      idRuta: String(item.idRuta),
      idVehiculo: String(item.idVehiculo),
      idEmpleadoChofer: String(item.idEmpleadoChofer ?? employees.find((employee) => employee.userId === item.idUsuarioChofer)?.employeeId ?? ""),
      idEmpleadoVendedor: String(item.idEmpleadoVendedor ?? employees.find((employee) => employee.userId === item.idUsuarioVendedor)?.employeeId ?? ""),
      idJornada: item.idJornada === null ? "" : String(item.idJornada),
      fechaSesion: item.fechaSesion.slice(0, 10),
      kmInicial: item.kmInicial === null ? "" : String(item.kmInicial),
      kmFinal: item.kmFinal === null ? "" : String(item.kmFinal),
      estado: item.estado,
    });
  }

  function resetJornadaForm() {
    setJornadaForm(EMPTY_JORNADA_FORM);
  }

  async function saveJornada() {
    if (!jornadaForm.fecha) {
      toast.error("Selecciona la fecha de la jornada");
      return;
    }
    setIsSavingJornada(true);
    try {
      const created = await createJornada({
        fecha: jornadaForm.fecha,
        idUsuarioResponsable: jornadaForm.idUsuarioResponsable ? Number(jornadaForm.idUsuarioResponsable) : undefined,
        observaciones: jornadaForm.observaciones || undefined,
      });
      setJornadas((prev) => [created, ...prev]);
      toast.success("Jornada creada correctamente");
      resetJornadaForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la jornada"));
    } finally {
      setIsSavingJornada(false);
    }
  }

  async function confirmCloseJornada() {
    if (!jornadaCloseCandidate) return;
    try {
      const closed = await closeJornada(jornadaCloseCandidate.id);
      setJornadas((prev) => prev.map((item) => (item.id === closed.id ? closed : item)));
      toast.success("Jornada cerrada correctamente");
      setJornadaCloseCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cerrar la jornada"));
    }
  }

  async function saveRoute() {
    try {
      if (editingRouteId) {
        const updated = await updateRuta(editingRouteId, {
          nombre: routeForm.nombre,
          descripcion: routeForm.descripcion || undefined,
        });
        setRoutes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Ruta actualizada correctamente");
      } else {
        const created = await createRuta({
          nombre: routeForm.nombre,
          descripcion: routeForm.descripcion || undefined,
        });
        setRoutes((prev) => [created, ...prev]);
        toast.success("Ruta creada correctamente");
      }

      resetRouteForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la ruta"));
    }
  }

  async function saveSession() {
    try {
      if (!sessionForm.idEmpleadoChofer || !sessionForm.idEmpleadoVendedor) {
        toast.error("Selecciona el empleado chofer y el empleado vendedor");
        return;
      }
      if (editingSessionId) {
        const updated = await updateRutaSesion(Number(sessionForm.idRuta), editingSessionId, {
          idRuta: Number(sessionForm.idRuta),
          idVehiculo: Number(sessionForm.idVehiculo),
          idEmpleadoChofer: Number(sessionForm.idEmpleadoChofer),
          idEmpleadoVendedor: Number(sessionForm.idEmpleadoVendedor),
          idJornada: sessionForm.idJornada ? Number(sessionForm.idJornada) : null,
          fechaSesion: sessionForm.fechaSesion,
          kmInicial: sessionForm.kmInicial ? Number(sessionForm.kmInicial) : null,
          kmFinal: sessionForm.kmFinal ? Number(sessionForm.kmFinal) : null,
          estado: sessionForm.estado,
          idUsuarioModificador: user?.id,
        });

        setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Sesión actualizada correctamente");
      } else {
        const created = await createRutaSesion({
          idRuta: Number(sessionForm.idRuta),
          idVehiculo: Number(sessionForm.idVehiculo),
          idEmpleadoChofer: Number(sessionForm.idEmpleadoChofer),
          idEmpleadoVendedor: Number(sessionForm.idEmpleadoVendedor),
          idJornada: sessionForm.idJornada ? Number(sessionForm.idJornada) : undefined,
          fechaSesion: sessionForm.fechaSesion,
          kmInicial: sessionForm.kmInicial ? Number(sessionForm.kmInicial) : undefined,
          kmFinal: sessionForm.kmFinal ? Number(sessionForm.kmFinal) : undefined,
          estado: sessionForm.estado,
        });

        setSessions((prev) => [created, ...prev]);
        toast.success("Sesión creada correctamente");
      }

      resetSessionForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la sesión de ruta"));
    }
  }

  async function confirmDeleteRoute() {
    if (!routeDeleteCandidate || !user?.id) return;

    try {
      await deleteRuta(routeDeleteCandidate.id, { idUsuarioAnulador: user.id });
      setRoutes((prev) => prev.filter((item) => item.id !== routeDeleteCandidate.id));
      setTrashRoutes((prev) => [{ ...routeDeleteCandidate, anulado: true }, ...prev]);
      toast.success("Ruta anulada correctamente");
      setRouteDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la ruta"));
    }
  }

  async function confirmDeleteSession() {
    if (!sessionDeleteCandidate || !user?.id) return;

    try {
      await deleteRutaSesion(sessionDeleteCandidate.idRuta, sessionDeleteCandidate.id, { idUsuarioAnulador: user.id });
      setSessions((prev) => prev.filter((item) => item.id !== sessionDeleteCandidate.id));
      setTrashSessions((prev) => [{ ...sessionDeleteCandidate, anulado: true }, ...prev]);
      toast.success("Sesión anulada correctamente");
      setSessionDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la sesión"));
    }
  }

  async function restoreRouteFromTrash(item: RutaDto) {
    if (!user?.id) return;

    try {
      const restored = await restoreRuta(item.id, { idUsuarioModificador: user.id });
      setTrashRoutes((prev) => prev.filter((row) => row.id !== item.id));
      setRoutes((prev) => [restored, ...prev]);
      toast.success("Ruta restaurada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar la ruta"));
    }
  }

  async function restoreSessionFromTrash(item: RutaSesionDto) {
    if (!user?.id) return;

    try {
      const restored = await restoreRutaSesion(item.idRuta, item.id, { idUsuarioModificador: user.id });
      setTrashSessions((prev) => prev.filter((row) => row.id !== item.id));
      setSessions((prev) => [restored, ...prev]);
      toast.success("Sesión restaurada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar la sesión"));
    }
  }

  return (
    <RequireAuth moduleKey="logistica" action="read">
      <DashboardShell
        title="Rutas y Distribución"
        description="Gestión de rutas, sesiones operativas y asignación de chofer, vendedor y vehículo."
      >
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href="/logistics/routes/operations">
                <MapPinned className="size-4" />
                Despacho y liquidación
              </Link>
            </Button>
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recargar
            </Button>
          </div>

          <Tabs defaultValue="vista-general">
            <div className="space-y-4">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="vista-general">Vista general</TabsTrigger>
                <TabsTrigger value="rutas">Rutas ({routes.length})</TabsTrigger>
                <TabsTrigger value="sesiones">Sesiones ({sessions.length})</TabsTrigger>
                <TabsTrigger value="jornadas">Jornadas ({jornadas.length})</TabsTrigger>
              </TabsList>

            <TabsContent value="vista-general" className="space-y-4">
              {isLoading && !hasLoadedOnce ? (
                <LogisticsCardsSkeleton />
              ) : (
                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Rutas activas</p>
                      <p className="text-2xl font-bold tracking-tight">{metrics.rutasActivas}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Sesiones activas</p>
                      <p className="text-2xl font-bold tracking-tight">{metrics.sesionesActivas}</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Sesiones en curso</p>
                      <p className="text-2xl font-bold tracking-tight">{metrics.sesionesEnCurso}</p>
                    </CardContent>
                  </Card>
                </section>
              )}

              <Card className="rounded-xl">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">Flujo recomendado</p>
                  <p className="text-sm text-muted-foreground">1) Crea o valida rutas.</p>
                  <p className="text-sm text-muted-foreground">2) Crea sesiones en estado PROGRAMADA o EN_CURSO.</p>
                  <p className="text-sm text-muted-foreground">3) Usa esas sesiones desde Nueva venta.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rutas">
              <Card className="rounded-xl">
                <CardContent className="space-y-4 p-4">
                  <h2 className="text-lg font-semibold">Administrar rutas</h2>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="route-name">Nombre de ruta</Label>
                      <Input
                        id="route-name"
                        value={routeForm.nombre}
                        onChange={(event) => setRouteForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="route-description">Descripción</Label>
                      <Input
                        id="route-description"
                        value={routeForm.descripcion}
                        onChange={(event) => setRouteForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={saveRoute}
                      disabled={!canCreate && !editingRouteId ? true : !canUpdate && !!editingRouteId ? true : false}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {editingRouteId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                      {editingRouteId ? "Guardar cambios" : "Crear ruta"}
                    </Button>
                    {editingRouteId ? (
                      <Button variant="outline" onClick={resetRouteForm}>
                        Cancelar edición
                      </Button>
                    ) : null}
                  </div>

                  <Tabs defaultValue="rutas-activas">
                    <TabsList>
                      <TabsTrigger value="rutas-activas">Rutas activas ({routes.length})</TabsTrigger>
                      <TabsTrigger value="rutas-anuladas">Rutas anuladas ({trashRoutes.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="rutas-activas">
                      {routes.length === 0 ? (
                        <LogisticsEmptyState
                          title="Sin rutas registradas"
                          description="Crea una ruta para habilitar sesiones de distribución."
                          actionLabel="Crear ruta"
                          onAction={() => document.getElementById("route-name")?.focus()}
                        />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {routes.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.nombre}</TableCell>
                                <TableCell>{item.descripcion ?? "-"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => startEditRoute(item)} disabled={!canUpdate}>
                                      <Pencil className="size-4" />
                                      Editar
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => setRouteDeleteCandidate(item)} disabled={!canDelete}>
                                      <Trash2 className="size-4" />
                                      Anular
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>

                    <TabsContent value="rutas-anuladas">
                      {trashRoutes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay rutas anuladas.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trashRoutes.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.nombre}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => restoreRouteFromTrash(item)} disabled={!canUpdate}>
                                    <RotateCcw className="size-4" />
                                    Restaurar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

              <TabsContent value="sesiones">
              <Card className="rounded-xl">
                <CardContent className="space-y-4 p-4">
                  <h2 className="text-lg font-semibold">Administrar sesiones de ruta</h2>
                  {isLoading && !hasLoadedOnce ? <LogisticsTableSkeleton rows={4} /> : null}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="session-route">Ruta</Label>
                      <select
                        id="session-route"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.idRuta}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, idRuta: event.target.value }))}
                      >
                        <option value="">Seleccionar</option>
                        {routes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-vehicle">Vehículo</Label>
                      <select
                        id="session-vehicle"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.idVehiculo}
                        onChange={(event) => handleVehicleChange(event.target.value)}
                      >
                        <option value="">Seleccionar</option>
                        {vehicles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.placa} - {item.marca}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-driver">Chofer</Label>
                      <select
                        id="session-driver"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.idEmpleadoChofer}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, idEmpleadoChofer: event.target.value }))}
                      >
                        <option value="">Seleccionar</option>
                        {employees.map((item) => (
                          <option key={item.employeeId} value={item.employeeId}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                      {employees.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No hay empleados activos disponibles para asignar.{" "}
                          <Link href="/employees" target="_blank" className="underline">
                            Revisar empleados
                          </Link>
                          .
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-seller">Vendedor</Label>
                      <select
                        id="session-seller"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.idEmpleadoVendedor}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, idEmpleadoVendedor: event.target.value }))}
                      >
                        <option value="">Seleccionar</option>
                        {employees.map((item) => (
                          <option key={item.employeeId} value={item.employeeId}>
                            {item.nombre}
                          </option>
                        ))}
                      </select>
                      {employees.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Selecciona un empleado; no necesita cuenta de usuario.
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-date">Fecha</Label>
                      <Input
                        id="session-date"
                        type="date"
                        value={sessionForm.fechaSesion}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, fechaSesion: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-km-initial">Km inicial</Label>
                      <Input
                        id="session-km-initial"
                        type="number"
                        min="0"
                        value={sessionForm.kmInicial}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, kmInicial: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-km-final">Km final</Label>
                      <Input
                        id="session-km-final"
                        type="number"
                        min="0"
                        value={sessionForm.kmFinal}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, kmFinal: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-status">Estado</Label>
                      <select
                        id="session-status"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.estado}
                        onChange={(event) =>
                          setSessionForm((prev) => ({ ...prev, estado: event.target.value as RutaSesionEstado }))
                        }
                      >
                        {SESSION_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="session-jornada">Jornada (opcional)</Label>
                      <select
                        id="session-jornada"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sessionForm.idJornada}
                        onChange={(event) => setSessionForm((prev) => ({ ...prev, idJornada: event.target.value }))}
                      >
                        <option value="">Sin jornada</option>
                        {jornadas
                          .filter((item) => item.estado === "ABIERTA")
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {formatDate(item.fecha)} ({item.rutaSesiones.length} sesiones)
                            </option>
                          ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Agrupa esta sesión con otros vehículos de la misma jornada operativa.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={saveSession}
                      disabled={!canCreate && !editingSessionId ? true : !canUpdate && !!editingSessionId ? true : false}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {editingSessionId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                      {editingSessionId ? "Guardar cambios" : "Crear sesión"}
                    </Button>
                    {editingSessionId ? (
                      <Button variant="outline" onClick={resetSessionForm}>
                        Cancelar edición
                      </Button>
                    ) : null}
                  </div>

                  <Tabs defaultValue="sesiones-activas">
                    <TabsList>
                      <TabsTrigger value="sesiones-activas">Sesiones activas ({sessions.length})</TabsTrigger>
                      <TabsTrigger value="sesiones-anuladas">Sesiones anuladas ({trashSessions.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sesiones-activas">
                      {sessions.length === 0 ? (
                        <LogisticsEmptyState
                          title="Sin sesiones de ruta"
                          description="Crea la primera sesión para asignar personal y vehículo a una fecha de distribución."
                          actionLabel="Crear sesión"
                          onAction={() => document.getElementById("session-route")?.focus()}
                        />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ruta</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Vehículo</TableHead>
                              <TableHead>Chofer</TableHead>
                              <TableHead>Vendedor</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessions.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.ruta?.nombre ?? `#${item.idRuta}`}</TableCell>
                                <TableCell>{formatDate(item.fechaSesion)}</TableCell>
                                <TableCell>{item.vehiculo?.placa ?? `#${item.idVehiculo}`}</TableCell>
                                <TableCell>{item.chofer?.nombre ?? `#${item.idEmpleadoChofer ?? item.idUsuarioChofer}`}</TableCell>
                                <TableCell>{item.vendedor?.nombre ?? `#${item.idEmpleadoVendedor ?? item.idUsuarioVendedor}`}</TableCell>
                                <TableCell>{item.estado}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => startEditSession(item)} disabled={!canUpdate}>
                                      <Pencil className="size-4" />
                                      Editar
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => setSessionDeleteCandidate(item)} disabled={!canDelete}>
                                      <Trash2 className="size-4" />
                                      Anular
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>

                    <TabsContent value="sesiones-anuladas">
                      {trashSessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay sesiones anuladas.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ruta</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Vehículo</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trashSessions.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.ruta?.nombre ?? `#${item.idRuta}`}</TableCell>
                                <TableCell>{formatDate(item.fechaSesion)}</TableCell>
                                <TableCell>{item.vehiculo?.placa ?? `#${item.idVehiculo}`}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => restoreSessionFromTrash(item)}
                                    disabled={!canUpdate}
                                  >
                                    <RotateCcw className="size-4" />
                                    Restaurar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
              </TabsContent>

              <TabsContent value="jornadas">
                <Card className="rounded-xl">
                  <CardContent className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-semibold">Jornadas de distribución</h2>
                      <p className="text-sm text-muted-foreground">
                        Agrupa varias sesiones de ruta (vehículos) de un mismo día operativo. No modifica sesiones
                        históricas; solo las sesiones nuevas o editadas pueden vincularse.
                      </p>
                    </div>
                    {isLoading && !hasLoadedOnce ? <LogisticsTableSkeleton rows={3} /> : null}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="jornada-fecha">Fecha</Label>
                        <Input
                          id="jornada-fecha"
                          type="date"
                          value={jornadaForm.fecha}
                          onChange={(event) => setJornadaForm((prev) => ({ ...prev, fecha: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="jornada-responsable">Responsable (opcional)</Label>
                        <select
                          id="jornada-responsable"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={jornadaForm.idUsuarioResponsable}
                          onChange={(event) =>
                            setJornadaForm((prev) => ({ ...prev, idUsuarioResponsable: event.target.value }))
                          }
                        >
                          <option value="">Sin asignar</option>
                          {employees.filter((item) => item.userId !== null).map((item) => (
                            <option key={item.userId} value={String(item.userId)}>
                              {item.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="jornada-observaciones">Observaciones (opcional)</Label>
                        <Input
                          id="jornada-observaciones"
                          value={jornadaForm.observaciones}
                          maxLength={255}
                          onChange={(event) =>
                            setJornadaForm((prev) => ({ ...prev, observaciones: event.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => void saveJornada()}
                      disabled={!canCreate || isSavingJornada || !jornadaForm.fecha}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {isSavingJornada ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Crear jornada
                    </Button>
                    {!canCreate ? (
                      <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para crear jornadas.</p>
                    ) : null}

                    {jornadas.length === 0 ? (
                      <LogisticsEmptyState
                        title="Sin jornadas registradas"
                        description="Crea la primera jornada para agrupar los vehículos que operan el mismo día."
                        actionLabel="Crear jornada"
                        onAction={() => document.getElementById("jornada-fecha")?.focus()}
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Sesiones vinculadas</TableHead>
                            <TableHead>Responsable</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jornadas.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{formatDate(item.fecha)}</TableCell>
                              <TableCell>{item.estado}</TableCell>
                              <TableCell>
                                {item.rutaSesiones.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">Sin sesiones vinculadas</span>
                                ) : (
                                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                                    {item.rutaSesiones.map((sesion) => {
                                      const vehiculo = vehicles.find((vehicle) => vehicle.id === sesion.idVehiculo);
                                      return (
                                        <li key={sesion.id}>
                                          {vehiculo?.placa ?? `Vehículo ${sesion.idVehiculo}`} · {sesion.estado}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </TableCell>
                              <TableCell>
                                {employees.find((emp) => emp.userId === item.idUsuarioResponsable)?.nombre ?? "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!canUpdate || item.estado !== "ABIERTA"}
                                  onClick={() => setJornadaCloseCandidate(item)}
                                >
                                  Cerrar jornada
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DashboardShell>

      <ConfirmActionDialog
        open={Boolean(routeDeleteCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setRouteDeleteCandidate(null);
          }
        }}
        onConfirm={confirmDeleteRoute}
        title="Anular ruta"
        description="La ruta no podrá usarse para nuevas sesiones hasta restaurarla."
        confirmLabel="Anular"
        cancelLabel="Cancelar"
        loading={false}
      />

      <ConfirmActionDialog
        open={Boolean(sessionDeleteCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setSessionDeleteCandidate(null);
          }
        }}
        onConfirm={confirmDeleteSession}
        title="Anular sesión de ruta"
        description="Se retirará la sesión del flujo operativo y liberará disponibilidad según corresponda."
        confirmLabel="Anular"
        cancelLabel="Cancelar"
        loading={false}
      />

      <ConfirmActionDialog
        open={Boolean(jornadaCloseCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setJornadaCloseCandidate(null);
          }
        }}
        onConfirm={confirmCloseJornada}
        title="Cerrar jornada"
        description="Solo puede cerrarse si todas sus sesiones vinculadas ya están CERRADA. No afecta sesiones históricas."
        confirmLabel="Cerrar jornada"
        cancelLabel="Cancelar"
        loading={false}
      />
    </RequireAuth>
  );
}
