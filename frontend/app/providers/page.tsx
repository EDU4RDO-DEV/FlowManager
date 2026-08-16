"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
import { ProvidersEmptyState } from "@/app/providers/_components/providers-empty-state";
import {
  ProvidersCardsSkeleton,
  ProvidersTableSkeleton,
} from "@/app/providers/_components/providers-skeletons";
import { getApiErrorMessage } from "@/lib/api";
import {
  deleteProvider,
  listAnulatedProviders,
  listProviders,
  restoreProvider,
} from "@/services/providers.service";
import type { ProviderDto } from "@/types/providers";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ProvidersPage() {
  const { user } = useAuth();
  const [activeProviders, setActiveProviders] = useState<ProviderDto[]>([]);
  const [anulatedProviders, setAnulatedProviders] = useState<ProviderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ProviderDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activos, anulados] = await Promise.all([listProviders(), listAnulatedProviders()]);
      setActiveProviders(activos);
      setAnulatedProviders(anulados);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el modulo de proveedores."));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeProviders.filter((provider) => {
      if (normalizedQuery.length === 0) return true;
      return (
        provider.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        (provider.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeProviders, query]);

  const filteredAnulatedProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return anulatedProviders.filter((provider) => {
      if (normalizedQuery.length === 0) return true;
      return (
        provider.entidad.nombreCompleto.toLowerCase().includes(normalizedQuery) ||
        (provider.entidad.correoElectronico ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [anulatedProviders, query]);

  const metrics = useMemo(() => {
    const total = activeProviders.length + anulatedProviders.length;
    const activos = activeProviders.length;
    const anulados = anulatedProviders.length;
    const conCorreo = activeProviders.filter((item) => (item.entidad.correoElectronico ?? "").trim().length > 0).length;
    return { total, activos, anulados, conCorreo };
  }, [activeProviders, anulatedProviders]);

  async function confirmDeleteProvider() {
    if (!deleteCandidate) return;

    try {
      setIsDeleting(true);
      await deleteProvider(
        deleteCandidate.id,
        user?.id ? { idUsuarioAnulador: user.id } : undefined,
      );

      const movedToTrash: ProviderDto = {
        ...deleteCandidate,
        anulado: true,
        idUsuarioAnulador: user?.id ?? deleteCandidate.idUsuarioAnulador,
        fechaAnulacion: new Date().toISOString(),
      };

      setActiveProviders((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
      setAnulatedProviders((prev) => [movedToTrash, ...prev]);
      toast.success("Proveedor anulado correctamente.");
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el proveedor."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function restoreProviderFromTrash(candidate: ProviderDto) {
    try {
      const restored = await restoreProvider(
        candidate.id,
        user?.id ? { idUsuarioModificador: user.id } : undefined,
      );
      setAnulatedProviders((prev) => prev.filter((item) => item.id !== candidate.id));
      setActiveProviders((prev) => [restored, ...prev]);
      toast.success("Proveedor restaurado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el proveedor."));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Proveedores"
        description="Gestion de abastecimiento, contactos comerciales y cartera de proveedores."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <ProvidersCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 transition-opacity duration-300">
              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Proveedores totales</p>
                    <p className="text-2xl font-bold tracking-tight">{metrics.total}</p>
                  </div>
                  <Truck className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-background">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Activos</p>
                    <p className="text-2xl font-bold tracking-tight">{metrics.activos}</p>
                  </div>
                  <BadgeCheck className="size-5 text-sky-600" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Con correo</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.conCorreo}</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-border bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Anulados</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{metrics.anulados}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl border border-border bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Catalogo de proveedores</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra datos comerciales, contactos y relacion de abastecimiento.
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
                  <Link href="/providers/create">
                    <Plus className="size-4" />
                    Nuevo proveedor
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando proveedores...</p>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search-providers">Busqueda</Label>
                  <Input
                    id="search-providers"
                    placeholder="Nombre o correo"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <Tabs defaultValue="activos">
                <TabsList>
                  <TabsTrigger value="activos">Activos ({filteredProviders.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({filteredAnulatedProviders.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="activos" className="mt-4">
                  {isLoading && !hasLoadedOnce ? (
                    <ProvidersTableSkeleton rows={8} />
                  ) : filteredProviders.length === 0 ? (
                    <ProvidersEmptyState mode="activos" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Telefono</TableHead>
                              <TableHead>Registro</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProviders.map((provider) => (
                              <TableRow key={provider.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{provider.id}</TableCell>
                                <TableCell className="font-medium">{provider.entidad.nombreCompleto}</TableCell>
                                <TableCell>{provider.entidad.telefono1?.trim() || "-"}</TableCell>
                                <TableCell>{formatDate(provider.fechaRegistro)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      asChild
                                      className="hover:bg-muted/50 transition-colors"
                                    >
                                      <Link href={`/providers/edit/${provider.id}`}>
                                        <Pencil className="size-3.5" />
                                        Editar
                                      </Link>
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="destructive"
                                      onClick={() => setDeleteCandidate(provider)}
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
                    <ProvidersTableSkeleton rows={8} />
                  ) : filteredAnulatedProviders.length === 0 ? (
                    <ProvidersEmptyState mode="anulados" onReload={loadData} />
                  ) : (
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-75" : "opacity-100")}>
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <Table className="min-w-full">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Telefono</TableHead>
                              <TableHead>Anulacion</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAnulatedProviders.map((provider) => (
                              <TableRow key={provider.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">#{provider.id}</TableCell>
                                <TableCell className="font-medium">{provider.entidad.nombreCompleto}</TableCell>
                                <TableCell>{provider.entidad.telefono1?.trim() || "-"}</TableCell>
                                <TableCell>{formatDate(provider.fechaAnulacion)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => restoreProviderFromTrash(provider)}
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

        <ConfirmActionDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteCandidate(null);
            }
          }}
          title="Confirmar anulación de proveedor"
          description={`Esta acción anulará a ${deleteCandidate?.entidad.nombreCompleto ?? "este proveedor"}.`}
          confirmLabel={isDeleting ? "Anulando..." : "Anular"}
          loading={isDeleting}
          onConfirm={confirmDeleteProvider}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
