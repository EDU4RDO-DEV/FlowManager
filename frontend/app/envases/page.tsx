"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PackageOpen, PackageMinus, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EnvasesEmptyState } from "@/app/envases/_components/envases-empty-state";
import {
  EnvasesCardsSkeleton,
  EnvasesTableSkeleton,
} from "@/app/envases/_components/envases-skeletons";
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
import { hasModulePermission } from "@/lib/rbac";
import { listClients } from "@/services/clients.service";
import {
  anulateMovimientoEnvase,
  listEnvaseSaldos,
  listMovimientosEnvase,
  registrarDevolucionEnvase,
  registrarPrestamoEnvase,
  restoreMovimientoEnvase,
} from "@/services/envases.service";
import { listProducts } from "@/services/products.service";
import type { ClientDto } from "@/types/clients";
import type { EnvaseClienteSaldoDto, MovimientoEnvaseDto, TipoMovimientoEnvase } from "@/types/envases";
import type { ProductDto } from "@/types/products";

type FormState = {
  tipoMovimiento: TipoMovimientoEnvase;
  idInventarioItem: string;
  idCliente: string;
  cantidad: string;
  observaciones: string;
};

const EMPTY_FORM: FormState = {
  tipoMovimiento: "PRESTAMO",
  idInventarioItem: "",
  idCliente: "",
  cantidad: "",
  observaciones: "",
};

export default function EnvasesPage() {
  const { user } = useAuth();
  const canCreate = hasModulePermission(user, "envases", "create");
  const canUpdate = hasModulePermission(user, "envases", "update");
  const canDelete = hasModulePermission(user, "envases", "delete");

  const [movimientos, setMovimientos] = useState<MovimientoEnvaseDto[]>([]);
  const [movimientosAnulados, setMovimientosAnulados] = useState<MovimientoEnvaseDto[]>([]);
  const [saldos, setSaldos] = useState<EnvaseClienteSaldoDto[]>([]);
  const [clientes, setClientes] = useState<ClientDto[]>([]);
  const [envaseItems, setEnvaseItems] = useState<ProductDto[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [anulateCandidate, setAnulateCandidate] = useState<MovimientoEnvaseDto | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [activos, anulados, saldosList, clientesList, productos] = await Promise.all([
        listMovimientosEnvase({ anulado: false }),
        listMovimientosEnvase({ anulado: true }),
        listEnvaseSaldos({ soloConSaldo: true }),
        listClients(),
        listProducts({ categoria: "ENVASE", anulado: false, limit: 100 }),
      ]);
      setMovimientos(activos);
      setMovimientosAnulados(anulados);
      setSaldos(saldosList);
      setClientes(clientesList);
      setEnvaseItems(productos.items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el módulo de envases"));
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredMovimientos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return movimientos.filter((item) => {
      if (!normalized) return true;
      const cliente = item.cliente?.nombre ?? "";
      const envase = item.inventarioItem?.nombre ?? "";
      return (
        cliente.toLowerCase().includes(normalized) || envase.toLowerCase().includes(normalized)
      );
    });
  }, [movimientos, query]);

  const metrics = useMemo(() => {
    const totalPrestado = saldos.reduce((sum, item) => sum + item.cantidadPrestada, 0);
    return {
      movimientos: movimientos.length,
      clientesConSaldo: saldos.length,
      totalPrestado,
    };
  }, [movimientos, saldos]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function submitMovimiento() {
    if (!form.idInventarioItem || !form.idCliente || !form.cantidad) {
      toast.error("Completa envase, cliente y cantidad");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        idInventarioItem: Number(form.idInventarioItem),
        idCliente: Number(form.idCliente),
        cantidad: Number(form.cantidad),
        observaciones: form.observaciones || undefined,
      };

      const created =
        form.tipoMovimiento === "PRESTAMO"
          ? await registrarPrestamoEnvase(payload)
          : await registrarDevolucionEnvase(payload);

      setMovimientos((prev) => [created, ...prev]);
      toast.success(
        form.tipoMovimiento === "PRESTAMO"
          ? "Préstamo registrado correctamente"
          : "Devolución registrada correctamente",
      );
      resetForm();
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el movimiento"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmAnulate() {
    if (!anulateCandidate) return;

    try {
      await anulateMovimientoEnvase(anulateCandidate.id, { idUsuarioAnulador: user?.id ?? 0 });
      setMovimientos((prev) => prev.filter((item) => item.id !== anulateCandidate.id));
      setMovimientosAnulados((prev) => [{ ...anulateCandidate, anulado: true }, ...prev]);
      toast.success("Movimiento anulado correctamente");
      setAnulateCandidate(null);
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular el movimiento"));
    }
  }

  async function restoreFromTrash(item: MovimientoEnvaseDto) {
    try {
      const restored = await restoreMovimientoEnvase(item.id, { idUsuarioModificador: user?.id ?? 0 });
      setMovimientosAnulados((prev) => prev.filter((row) => row.id !== item.id));
      setMovimientos((prev) => [restored, ...prev]);
      toast.success("Movimiento restaurado correctamente");
      void loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restaurar el movimiento"));
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Envases Retornables"
        description="Control de préstamos y devoluciones de envases a clientes."
      >
        <div className="space-y-6">
          {isLoading && !hasLoadedOnce ? (
            <EnvasesCardsSkeleton />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3 transition-opacity duration-300">
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Movimientos activos</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.movimientos}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Clientes con saldo</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.clientesConSaldo}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total envases prestados</p>
                  <p className="text-2xl font-bold tracking-tight">{metrics.totalPrestado}</p>
                </CardContent>
              </Card>
            </section>
          )}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="env-tipo">Tipo de movimiento</Label>
                  <select
                    id="env-tipo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.tipoMovimiento}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tipoMovimiento: event.target.value as TipoMovimientoEnvase }))
                    }
                  >
                    <option value="PRESTAMO">Préstamo</option>
                    <option value="DEVOLUCION">Devolución</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="env-item">Envase</Label>
                  <select
                    id="env-item"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idInventarioItem}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, idInventarioItem: event.target.value }))
                    }
                  >
                    <option value="">Selecciona un envase</option>
                    {envaseItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="env-cliente">Cliente</Label>
                  <select
                    id="env-cliente"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.idCliente}
                    onChange={(event) => setForm((prev) => ({ ...prev, idCliente: event.target.value }))}
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.entidad.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="env-cantidad">Cantidad</Label>
                  <Input
                    id="env-cantidad"
                    type="number"
                    min="1"
                    value={form.cantidad}
                    onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-4">
                  <Label htmlFor="env-observaciones">Observaciones</Label>
                  <Input
                    id="env-observaciones"
                    value={form.observaciones}
                    onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={submitMovimiento}
                  disabled={!canCreate || isSaving}
                  className="bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : form.tipoMovimiento === "PRESTAMO" ? (
                    <PackageOpen className="size-4" />
                  ) : (
                    <PackageMinus className="size-4" />
                  )}
                  {form.tipoMovimiento === "PRESTAMO" ? "Registrar préstamo" : "Registrar devolución"}
                </Button>
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Recargar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="search-envases">Búsqueda</Label>
                <Input
                  id="search-envases"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por cliente o envase"
                />
              </div>

              {isLoading && hasLoadedOnce ? (
                <p className="text-xs text-muted-foreground">Actualizando movimientos...</p>
              ) : null}

              <Tabs defaultValue="movimientos">
                <TabsList>
                  <TabsTrigger value="movimientos">Movimientos ({filteredMovimientos.length})</TabsTrigger>
                  <TabsTrigger value="saldos">Saldos por cliente ({saldos.length})</TabsTrigger>
                  <TabsTrigger value="anulados">Anulados ({movimientosAnulados.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="movimientos" className="space-y-4">
                  {isLoading && !hasLoadedOnce ? (
                    <EnvasesTableSkeleton rows={6} />
                  ) : filteredMovimientos.length === 0 ? (
                    <EnvasesEmptyState
                      title="No hay movimientos de envases"
                      description="Registra un préstamo o devolución para comenzar a llevar el control."
                      actionLabel="Registrar movimiento"
                      onAction={() => document.getElementById("env-item")?.focus()}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Saldo nuevo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovimientos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.tipoMovimiento}</TableCell>
                            <TableCell>{item.cantidad}</TableCell>
                            <TableCell>{item.saldoNuevo}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setAnulateCandidate(item)}
                                disabled={!canDelete}
                              >
                                <Trash2 className="size-4" />
                                Anular
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="saldos">
                  {saldos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay clientes con saldo de envases.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Cantidad prestada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saldos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.cantidadPrestada}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="anulados">
                  {movimientosAnulados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay movimientos anulados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Envase</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientosAnulados.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.cliente?.nombre ?? item.idCliente}</TableCell>
                            <TableCell>{item.inventarioItem?.nombre ?? item.idInventarioItem}</TableCell>
                            <TableCell>{item.tipoMovimiento}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => restoreFromTrash(item)}
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
        </div>

        <ConfirmActionDialog
          open={!!anulateCandidate}
          onOpenChange={(open) => !open && setAnulateCandidate(null)}
          title="Anular movimiento de envase"
          description="¿Deseas anular este movimiento? El saldo del cliente se recalculará automáticamente."
          confirmLabel="Anular"
          onConfirm={confirmAnulate}
        />
      </DashboardShell>
    </RequireAuth>
  );
}
