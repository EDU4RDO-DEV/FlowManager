"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPagination } from "@/components/ui/list-pagination";
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
import { ClientsEmptyState } from "@/app/clients/_components/clients-empty-state";
import {
  ClientsCardsSkeleton,
  ClientsTableSkeleton,
} from "@/app/clients/_components/clients-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteClient,
  listAnulatedClients,
  listClients,
  restoreClient,
} from "@/services/clients.service";
import type { ClientDto } from "@/types/clients";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [activeClients, setActiveClients] = useState<ClientDto[]>([]);
  const [anulatedClients, setAnulatedClients] = useState<ClientDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const [deleteCandidate, setDeleteCandidate] = useState<ClientDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 10;

  async function loadData() {
    setIsLoading(true);
    try {
      const [activos, anulados] = await Promise.all([listClients(), listAnulatedClients()]);
      setActiveClients(activos);
      setAnulatedClients(anulados);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de clientes."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeClients.filter((client) => {
      if (normalizedQuery.length === 0) return true;
      return (
        client.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        (client.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery) ||
        (client.entidad.telefono1 ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeClients, query]);

  const filteredAnulatedClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return anulatedClients.filter((client) => {
      if (normalizedQuery.length === 0) return true;
      return (
        client.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        (client.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery) ||
        (client.entidad.telefono1 ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [anulatedClients, query]);

  const paginatedActiveClients = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredClients.slice(start, start + PAGE_SIZE);
  }, [activePage, filteredClients]);

  const paginatedTrashClients = useMemo(() => {
    const start = (trashPage - 1) * PAGE_SIZE;
    return filteredAnulatedClients.slice(start, start + PAGE_SIZE);
  }, [filteredAnulatedClients, trashPage]);

  useEffect(() => {
    setActivePage(1);
    setTrashPage(1);
  }, [query]);

  const metrics = useMemo(() => {
    const total = activeClients.length + anulatedClients.length;
    const activos = activeClients.length;
    const anulados = anulatedClients.length;
    const conCorreo = activeClients.filter((item) => (item.entidad.correoElectronico ?? "").trim().length > 0).length;
    return { total, activos, anulados, conCorreo };
  }, [activeClients, anulatedClients]);

  async function confirmDeleteClient() {
    if (!deleteCandidate) return;

    try {
      setIsDeleting(true);
      await deleteClient(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: ClientDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setActiveClients((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedClients((prev) => [movedToTrash, ...prev]);
      toast.success("Cliente anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el cliente."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreClientFromTrash(candidate: ClientDto) {
    try {
      const restored = await restoreClient(
        candidate.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );
      setAnulatedClients((prev) => prev.filter((item) => item.id !== candidate.id));
      setActiveClients((prev) => [restored, ...prev]);
      toast.success("Cliente restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el cliente."));
    }
  }

  return (
    <RequireAuth moduleKey="clientes" action="read">
      <DashboardShell
        title="Clientes"
        description="Gestion de cartera, contacto y relacion comercial con clientes."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <ClientsCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 transition-opacity duration-300">
              <Card className="metric-card metric-card-primary rounded-xl bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Clientes totales</p>
                    <p className="metric-number-primary text-2xl font-bold tracking-tight">{metrics.total}</p>
                  </div>
                  <Building2 className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="metric-card metric-card-success rounded-xl bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Activos</p>
                    <p className="metric-number-success text-2xl font-bold tracking-tight">{metrics.activos}</p>
                  </div>
                  <BadgeCheck className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="metric-card metric-card-warning rounded-xl bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Con correo</p>
                  <p className="metric-number-warning mt-1 text-2xl font-bold tracking-tight">{metrics.conCorreo}</p>
                </CardContent>
              </Card>

              <Card className="metric-card metric-card-danger rounded-xl bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Anulados</p>
                  <p className="metric-number-danger mt-1 text-2xl font-bold tracking-tight">{metrics.anulados}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="module-page-card rounded-xl bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de clientes</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra informacion principal y seguimiento de cartera.
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
                  <Link href="/clients/create">
                    <Plus className="size-4" />
                    Nuevo cliente
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando clientes...</p>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-clients">Busqueda</Label>
                  <Input
                    id="search-clients"
                    placeholder="Nombre, correo o telefono"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredClients.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulatedClients.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <ClientsTableSkeleton rows={8} />
                  ) : filteredClients.length === 0 ? (
                    <ClientsEmptyState mode="activos" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Correo</TableHead>
                              <TableHead>Telefono</TableHead>
                              <TableHead>Registro</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedActiveClients.map((client) => (
                              <TableRow key={client.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{client.id}</TableCell>
                                <TableCell className="font-medium">{client.entidad.nombreCompleto}</TableCell>
                                <TableCell>{client.entidad.correoElectronico?.trim() || "-"}</TableCell>
                                <TableCell>{client.entidad.telefono1?.trim() || "-"}</TableCell>
                                <TableCell>{formatDate(client.fechaRegistro)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      asChild
                                      className="hover:bg-muted/50 transition-colors"
                                    >
                                      <Link href={`/clients/edit/${client.id}`}>
                                        <Pencil className="size-3.5" />
                                        Editar
                                      </Link>
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="destructive"
                                      onClick={() => setDeleteCandidate(client)}
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
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={activePage}
                          totalItems={filteredClients.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setActivePage}
                          itemLabel="clientes"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="anulados" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <ClientsTableSkeleton rows={8} />
                  ) : filteredAnulatedClients.length === 0 ? (
                    <ClientsEmptyState mode="anulados" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Correo</TableHead>
                              <TableHead>Telefono</TableHead>
                              <TableHead>Anulacion</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedTrashClients.map((client) => (
                              <TableRow key={client.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{client.id}</TableCell>
                                <TableCell className="font-medium">{client.entidad.nombreCompleto}</TableCell>
                                <TableCell>{client.entidad.correoElectronico?.trim() || "-"}</TableCell>
                                <TableCell>{client.entidad.telefono1?.trim() || "-"}</TableCell>
                                <TableCell>{formatDate(client.fechaAnulacion)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreClientFromTrash(client)}
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
                      <div className="px-4 pb-4 pt-2">
                        <ListPagination
                          page={trashPage}
                          totalItems={filteredAnulatedClients.length}
                          pageSize={PAGE_SIZE}
                          onPageChange={setTrashPage}
                          itemLabel="clientes"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de cliente"
          description={`Esta acción anulará a ${deleteCandidate?.entidad.nombreCompleto ?? "este cliente"}.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={confirmDeleteClient}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
