"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { SessionsEmptyState } from "@/app/sessions/_components/sessions-empty-state";
import {
  SessionsCardsSkeleton,
  SessionsTableSkeleton,
} from "@/app/sessions/_components/sessions-skeletons";
import {
  deleteSession,
  listAnulatedSessions,
  listSessions,
  restoreSession,
} from "@/services/sessions.service";
import type { SessionDto } from "@/types/sessions";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function SessionsPage() {
  const { user } = useAuth();
  const canDeleteSessions = hasModulePermission(user?.nombreRol, "sesiones", "delete");
  const canUpdateSessions = hasModulePermission(user?.nombreRol, "sesiones", "update");
  const [sessionsActivas, setSessionsActivas] = useState<SessionDto[]>([]);
  const [sessionsAnuladas, setSessionsAnuladas] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<SessionDto | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [activas, anuladas] = await Promise.all([listSessions(), listAnulatedSessions()]);
      setSessionsActivas(activas);
      setSessionsAnuladas(anuladas);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el panel de sesiones."));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredActivas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sessionsActivas.filter((item) => {
      if (normalizedQuery.length === 0) return true;
      return (
        item.nombreDispositivo.toLowerCase().includes(normalizedQuery) ||
        item.ip.toLowerCase().includes(normalizedQuery) ||
        String(item.idUsuario).includes(normalizedQuery)
      );
    });
  }, [sessionsActivas, query]);

  const filteredAnuladas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sessionsAnuladas.filter((item) => {
      if (normalizedQuery.length === 0) return true;
      return (
        item.nombreDispositivo.toLowerCase().includes(normalizedQuery) ||
        item.ip.toLowerCase().includes(normalizedQuery) ||
        String(item.idUsuario).includes(normalizedQuery)
      );
    });
  }, [sessionsAnuladas, query]);

  const metrics = useMemo(() => {
    const total = sessionsActivas.length + sessionsAnuladas.length;
    const activas = sessionsActivas.length;
    const anuladas = sessionsAnuladas.length;
    return { total, activas, anuladas };
  }, [sessionsActivas, sessionsAnuladas]);

  async function confirmDeleteSession() {
    if (!canDeleteSessions) {
      toast.error("No tienes permisos para anular sesiones.");
      return;
    }

    if (!deleteCandidate) return;
    try {
      await deleteSession(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: SessionDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setSessionsActivas((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setSessionsAnuladas((prev) => [movedToTrash, ...prev]);
      setDeleteCandidate(null);
      toast.success("Sesion anulada correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la sesion."));
    }
  }

  async function restoreSessionFromTrash(item: SessionDto) {
    if (!canUpdateSessions) {
      toast.error("No tienes permisos para restaurar sesiones.");
      return;
    }

    try {
      const restored = await restoreSession(
        item.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );

      setSessionsAnuladas((prev) => prev.filter((session) => session.id !== item.id));
      setSessionsActivas((prev) => [restored, ...prev]);
      toast.success("Sesion restaurada correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar la sesion."));
    }
  }

  return (
    <RequireAuth moduleKey="sesiones" action="read">
      <DashboardShell
        title="Sesiones de Ruta y Caja"
        description="Controla apertura, cierre y trazabilidad de sesiones operativas."
      >
        <div className="space-y-6">
          {loading && !hasLoadedOnce ? (
            <SessionsCardsSkeleton />
          ) : (
            <section
              className={cn(
                "grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 transition-opacity duration-300",
                loading ? "opacity-75" : "opacity-100",
              )}
            >
              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Sesiones totales</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Sesiones activas</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.activas}</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-muted/50 md:col-span-1 lg:col-span-2">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Cobertura de auditoria</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">Anuladas: {metrics.anuladas}</Badge>
                    <Badge variant="outline">
                      <ShieldCheck className="mr-1 size-3.5" />
                      Borrado logico
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de sesiones</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visualiza sesiones activas, anuladas y restauraciones por usuario.
                </p>
              </div>
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
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando sesiones...</p>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-sessions">Busqueda</Label>
                  <Input
                    id="search-sessions"
                    placeholder="Dispositivo, IP o ID de usuario"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <Tabs defaultValue="activas">
                <TabsList>
                  <TabsTrigger value="activas">Activas ({filteredActivas.length})</TabsTrigger>
                  <TabsTrigger value="anuladas">Anuladas ({filteredAnuladas.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activas" className="mt-4">
                  {loading && !hasLoadedOnce ? (
                    <SessionsTableSkeleton rows={8} />
                  ) : filteredActivas.length === 0 ? (
                    <SessionsEmptyState mode="activas" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", loading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Dispositivo</TableHead>
                              <TableHead>IP</TableHead>
                              <TableHead>Registro</TableHead>
                              <TableHead>Expira</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredActivas.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{item.id}</TableCell>
                                <TableCell>{item.idUsuario}</TableCell>
                                <TableCell className="font-medium">{item.nombreDispositivo}</TableCell>
                                <TableCell>{item.ip}</TableCell>
                                <TableCell>{formatDate(item.fechaRegistro)}</TableCell>
                                <TableCell>{formatDate(item.fechaExpiracionToken)}</TableCell>
                                <TableCell className="text-right">
                                  {canDeleteSessions ? (
                                    <Button
                                      size="xs"
                                      variant="destructive"
                                      onClick={() => setDeleteCandidate(item)}
                                    >
                                      <Trash2 className="size-3.5" />
                                      Anular
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="anuladas" className="mt-4">
                  {loading && !hasLoadedOnce ? (
                    <SessionsTableSkeleton rows={8} />
                  ) : filteredAnuladas.length === 0 ? (
                    <SessionsEmptyState mode="anuladas" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", loading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Dispositivo</TableHead>
                              <TableHead>IP</TableHead>
                              <TableHead>Anulada</TableHead>
                              <TableHead>Anulador</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAnuladas.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{item.id}</TableCell>
                                <TableCell>{item.idUsuario}</TableCell>
                                <TableCell className="font-medium">{item.nombreDispositivo}</TableCell>
                                <TableCell>{item.ip}</TableCell>
                                <TableCell>{formatDate(item.fechaAnulacion)}</TableCell>
                                <TableCell>{item.idUsuarioAnulador ?? "-"}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreSessionFromTrash(item)}
                                    disabled={!canUpdateSessions}
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
                <CardTitle className="text-xl font-bold tracking-tight">Confirmar anulacion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta accion anulara la sesion <span className="font-medium text-foreground">#{deleteCandidate.id}</span>.
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteSession}>
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
