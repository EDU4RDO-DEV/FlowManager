import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { DispatchProductDto, RouteInventoryDto } from "@/types/logistics";

import type { DispatchDraft } from "./shared";
import { formatDate } from "./shared";

interface DispatchTabProps {
  canOperate: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  isSaving: boolean;
  visibleInventory: RouteInventoryDto;
  dispatchList: Array<{ id: number; observaciones: string | null; fechaRegistro: string | null }>;
  dispatchCanBeCancelled: boolean;
  dispatchCancelReasonById: Record<number, string>;
  setDispatchCancelReasonById: (updater: (previous: Record<number, string>) => Record<number, string>) => void;
  requestDispatchCancellation: (candidate: { id: number; motivo: string }) => void;
  dispatchDraft: DispatchDraft[];
  setDispatchDraft: (updater: (previous: DispatchDraft[]) => DispatchDraft[]) => void;
  dispatchSearch: string;
  setDispatchSearch: (value: string) => void;
  dispatchProductId: string;
  setDispatchProductId: (value: string) => void;
  dispatchProductOptions: DispatchProductDto[];
  productById: Map<number, DispatchProductDto>;
  addDispatchProduct: () => void;
  dispatchNotes: string;
  setDispatchNotes: (value: string) => void;
  submitDispatch: () => void;
}

// Pestaña "Despachos": historial de despachos activos con anulación individual por Id,
// y el formulario de captura de un nuevo despacho (o reabastecimiento). Reutiliza
// exactamente la misma lógica y endpoints que antes; solo cambia dónde se presenta.
export function DispatchTab({
  canOperate,
  canCreate,
  canUpdate,
  isSaving,
  visibleInventory,
  dispatchList,
  dispatchCanBeCancelled,
  dispatchCancelReasonById,
  setDispatchCancelReasonById,
  requestDispatchCancellation,
  dispatchDraft,
  setDispatchDraft,
  dispatchSearch,
  setDispatchSearch,
  dispatchProductId,
  setDispatchProductId,
  dispatchProductOptions,
  productById,
  addDispatchProduct,
  dispatchNotes,
  setDispatchNotes,
  submitDispatch,
}: DispatchTabProps) {
  return (
    <div className="space-y-4">
      {dispatchList.length > 0 && canOperate ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">
              Despachos activos ({dispatchList.length}) — anulación individual por Id
            </p>
            {dispatchCanBeCancelled ? (
              <>
                {dispatchList.map((dispatch) => (
                  <div key={dispatch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                    <div className="text-xs">
                      <p className="font-medium">Despacho #{dispatch.id}</p>
                      <p className="text-muted-foreground">
                        {formatDate(dispatch.fechaRegistro)}
                        {dispatch.observaciones ? ` · ${dispatch.observaciones}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 max-w-48 text-xs"
                        placeholder="Motivo de anulación"
                        value={dispatchCancelReasonById[dispatch.id] ?? ""}
                        onChange={(event) =>
                          setDispatchCancelReasonById((previous) => ({ ...previous, [dispatch.id]: event.target.value }))
                        }
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!canUpdate || isSaving || (dispatchCancelReasonById[dispatch.id] ?? "").trim().length < 3}
                        onClick={() =>
                          requestDispatchCancellation({ id: dispatch.id, motivo: (dispatchCancelReasonById[dispatch.id] ?? "").trim() })
                        }
                      >
                        Anular #{dispatch.id}
                      </Button>
                    </div>
                  </div>
                ))}
                {!canUpdate ? (
                  <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para anular despachos.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Solo se permite antes de ventas, devoluciones, ajustes, transferencias o cierre. La reversión queda auditada.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                La sesión ya tiene movimientos posteriores; no se puede anular ningún despacho para proteger ventas, devoluciones y liquidaciones.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canOperate ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">{visibleInventory.despacho ? "Nuevo despacho (reabastecimiento)" : "Despacho inicial"}</h2>
              <p className="text-sm text-muted-foreground">
                Puedes confirmar más de un despacho por sesión (reabastecimiento tras regresar a planta); se
                suman al disponible del vehículo. El servidor valida y descuenta la existencia de planta en
                una transacción.
                {!canCreate ? " Tu rol no tiene permiso para crear despachos." : ""}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                value={dispatchSearch}
                onChange={(event) => setDispatchSearch(event.target.value)}
                placeholder="Filtrar por nombre o presentación"
                className="md:col-span-2"
              />
              <Select value={dispatchProductId} onValueChange={setDispatchProductId}>
                <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                <SelectContent>
                  {dispatchProductOptions.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.nombre} · {product.unidadMedida ?? "sin unidad"} · Catálogo: {product.existencia}
                      {product.esEnvaseRetornable
                        ? ` · Físico planta: vacío ${product.stockEnvasePlanta?.vacio ?? 0}, lleno ${product.stockEnvasePlanta?.lleno ?? 0}, pendiente ${product.stockEnvasePlanta?.pendienteClasificacion ?? 0}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addDispatchProduct} disabled={!dispatchProductId}>Agregar producto</Button>
            </div>
            {dispatchDraft.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Existencia planta</TableHead><TableHead>Cantidad</TableHead><TableHead>Estado envase</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {dispatchDraft.map((line) => {
                    const product = productById.get(line.idInventarioItem);
                    return (
                      <TableRow key={line.idInventarioItem}>
                        <TableCell>{product?.nombre ?? `Producto ${line.idInventarioItem}`}</TableCell>
                        <TableCell>
                          {product?.existencia ?? "-"}
                          {product?.esEnvaseRetornable ? (
                            <>
                              <p className="text-xs text-muted-foreground">
                                Físico verificado: vacío {product.stockEnvasePlanta?.vacio ?? 0}, lleno {product.stockEnvasePlanta?.lleno ?? 0}, pendiente de clasificar {product.stockEnvasePlanta?.pendienteClasificacion ?? 0}
                              </p>
                              {product.stockEnvasePlanta?.diferenciaCatalogo !== undefined &&
                              product.stockEnvasePlanta.diferenciaCatalogo < -0.009 ? (
                                <p className="text-xs text-destructive">
                                  El saldo físico supera el catálogo por {Math.abs(product.stockEnvasePlanta.diferenciaCatalogo)}.
                                </p>
                              ) : null}
                            </>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.cantidad}
                            onChange={(event) => setDispatchDraft((previous) => previous.map((item) =>
                              item.idInventarioItem === line.idInventarioItem ? { ...item, cantidad: event.target.value } : item,
                            ))}
                            className="max-w-32"
                          />
                        </TableCell>
                        <TableCell>
                          {product?.esEnvaseRetornable ? (
                            <>
                              <Select
                                value={line.estadoEnvase}
                                onValueChange={(value) => setDispatchDraft((previous) => previous.map((item) =>
                                  item.idInventarioItem === line.idInventarioItem
                                    ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" }
                                    : item,
                                ))}
                              >
                                <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VACIO">Vacío</SelectItem>
                                  <SelectItem value="LLENO">Lleno</SelectItem>
                                </SelectContent>
                              </Select>
                              {line.estadoEnvase ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Disponible verificado: {line.estadoEnvase === "VACIO"
                                    ? product.stockEnvasePlanta?.vacio ?? 0
                                    : product.stockEnvasePlanta?.lleno ?? 0}
                                </p>
                              ) : null}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setDispatchDraft((previous) => previous.filter((item) => item.idInventarioItem !== line.idInventarioItem))}>Quitar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">Agrega los productos que se cargarán al vehículo.</p>}
            <Textarea value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} maxLength={255} placeholder="Observaciones del despacho" />
            <Button onClick={() => void submitDispatch()} disabled={!canCreate || isSaving || dispatchDraft.length === 0}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null} Confirmar despacho
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
