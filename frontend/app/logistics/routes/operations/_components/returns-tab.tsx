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
import type { RouteInventoryDto } from "@/types/logistics";

import type { ReturnDraft } from "./shared";
import { formatDate } from "./shared";

interface ReturnsTabProps {
  canOperate: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  isSaving: boolean;
  visibleInventory: RouteInventoryDto;
  returnList: Array<{ id: number; observaciones: string | null; fechaRegistro: string | null }>;
  returnCanBeCancelled: boolean;
  returnCancelReasonById: Record<number, string>;
  setReturnCancelReasonById: (updater: (previous: Record<number, string>) => Record<number, string>) => void;
  requestReturnCancellation: (candidate: { id: number; motivo: string }) => void;
  returnDraft: Record<number, ReturnDraft>;
  setReturnDraft: (updater: (previous: Record<number, ReturnDraft>) => Record<number, ReturnDraft>) => void;
  returnNotes: string;
  setReturnNotes: (value: string) => void;
  submitReturn: () => void;
}

// Pestaña "Devoluciones": historial de recepciones activas con anulación individual
// por Id, historial de recepciones anuladas, y el formulario de captura de una nueva
// recepción física. Misma lógica y endpoints que antes, reorganizados visualmente.
export function ReturnsTab({
  canOperate,
  canCreate,
  canUpdate,
  isSaving,
  visibleInventory,
  returnList,
  returnCanBeCancelled,
  returnCancelReasonById,
  setReturnCancelReasonById,
  requestReturnCancellation,
  returnDraft,
  setReturnDraft,
  returnNotes,
  setReturnNotes,
  submitReturn,
}: ReturnsTabProps) {
  // Para envases retornables, "Recibido" debe ser exactamente vacío + lleno + dañado
  // (el backend lo exige). Se calcula automáticamente al editar cualquiera de los tres
  // campos físicos, para que el usuario no tenga que mantenerlos sincronizados a mano
  // (causa raíz de bloqueos al registrar devoluciones con unidades dañadas).
  function updateContainerQuantity(
    idInventarioItem: number,
    field: "cantidadEnvaseVacio" | "cantidadEnvaseLleno" | "cantidadDanada",
    value: string,
  ) {
    setReturnDraft((previous) => {
      const current = previous[idInventarioItem];
      const next = { ...current, [field]: value };
      const vacio = Number(next.cantidadEnvaseVacio || 0);
      const lleno = Number(next.cantidadEnvaseLleno || 0);
      const danada = Number(next.cantidadDanada || 0);
      const sum = vacio + lleno + danada;
      next.cantidadRecibida = Number.isFinite(sum) ? String(sum) : next.cantidadRecibida;
      return { ...previous, [idInventarioItem]: next };
    });
  }

  return (
    <div className="space-y-4">
      {(returnList.length > 0 && canOperate) || (visibleInventory.devolucionesAnuladas?.length ?? 0) > 0 ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-2 p-4">
            {visibleInventory.devolucionesAnuladas?.map((routeReturn) => (
              <p key={routeReturn.id} className="text-xs text-muted-foreground">
                Recepción anterior anulada {formatDate(routeReturn.fechaAnulacion)} · {routeReturn.motivoAnulacion}
                {routeReturn.usuarioAnulador ? ` · ${routeReturn.usuarioAnulador.nombre}` : ""}
              </p>
            ))}
            {returnList.length > 0 && canOperate ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Devoluciones activas ({returnList.length}) — anulación individual por Id
                </p>
                {returnCanBeCancelled ? (
                  <>
                    {returnList.map((routeReturn) => (
                      <div key={routeReturn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                        <div className="text-xs">
                          <p className="font-medium">Devolución #{routeReturn.id}</p>
                          <p className="text-muted-foreground">
                            {formatDate(routeReturn.fechaRegistro)}
                            {routeReturn.observaciones ? ` · ${routeReturn.observaciones}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 max-w-48 text-xs"
                            placeholder="Motivo de anulación"
                            value={returnCancelReasonById[routeReturn.id] ?? ""}
                            onChange={(event) =>
                              setReturnCancelReasonById((previous) => ({ ...previous, [routeReturn.id]: event.target.value }))
                            }
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!canUpdate || isSaving || (returnCancelReasonById[routeReturn.id] ?? "").trim().length < 3}
                            onClick={() =>
                              requestReturnCancellation({ id: routeReturn.id, motivo: (returnCancelReasonById[routeReturn.id] ?? "").trim() })
                            }
                          >
                            Anular #{routeReturn.id}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!canUpdate ? (
                      <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para corregir recepciones.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        La recepción anterior queda en el historial. Solo puede corregirse antes de autorizar diferencias o cerrar la ruta.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No se puede corregir ninguna recepción después de autorizar diferencias o cerrar la ruta.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {visibleInventory.despacho && canOperate ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Recepción de devolución</h2>
              <p className="text-sm text-muted-foreground">
                Puedes registrar varias devoluciones por sesión (por ejemplo, un conteo intermedio seguido de
                reabastecimiento y la devolución final del día). Solo lo vendible se traslada a planta al
                cerrar la sesión.
                {!canCreate ? " Tu rol no tiene permiso para registrar devoluciones." : ""}
              </p>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Producto / saldo físico</TableHead><TableHead>Recibido</TableHead><TableHead>Vacíos</TableHead><TableHead>Llenos</TableHead><TableHead>Dañado</TableHead><TableHead>Estado antes de daño</TableHead><TableHead>Ubicación no vendible</TableHead><TableHead>Observaciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleInventory.productos.filter((line) => line.pendienteConciliacion - line.reservado > 0.009).map((line) => {
                  const isReturnableContainer = line.estadoEnvaseDespachado != null;
                  return (
                  <TableRow key={line.idInventarioItem}>
                    <TableCell>{line.nombre}<span className="block text-xs text-muted-foreground">Saldo físico: {Number(Math.max(0, line.pendienteConciliacion - line.reservado).toFixed(2))}</span></TableCell>
                    <TableCell>
                      {isReturnableContainer ? (
                        <span className="font-medium" title="Se calcula automáticamente como vacíos + llenos + dañado">
                          {returnDraft[line.idInventarioItem]?.cantidadRecibida ?? "0"}
                        </span>
                      ) : (
                        <Input type="number" min="0" step="0.01" value={returnDraft[line.idInventarioItem]?.cantidadRecibida ?? "0"} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadRecibida: event.target.value } }))} className="max-w-28" />
                      )}
                    </TableCell>
                    <TableCell>{isReturnableContainer ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseVacio ?? "0"} onChange={(event) => updateContainerQuantity(line.idInventarioItem, "cantidadEnvaseVacio", event.target.value)} className="max-w-24" /> : "—"}</TableCell>
                    <TableCell>{isReturnableContainer ? <Input type="number" min="0" step="1" value={returnDraft[line.idInventarioItem]?.cantidadEnvaseLleno ?? "0"} onChange={(event) => updateContainerQuantity(line.idInventarioItem, "cantidadEnvaseLleno", event.target.value)} className="max-w-24" /> : "—"}</TableCell>
                    <TableCell><Input type="number" min="0" step={isReturnableContainer ? "1" : "0.01"} value={returnDraft[line.idInventarioItem]?.cantidadDanada ?? "0"} onChange={(event) => isReturnableContainer ? updateContainerQuantity(line.idInventarioItem, "cantidadDanada", event.target.value) : setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], cantidadDanada: event.target.value } }))} className="max-w-28" /></TableCell>
                    <TableCell>{isReturnableContainer ? <Select value={returnDraft[line.idInventarioItem]?.estadoEnvaseDanado ?? ""} onValueChange={(value) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], estadoEnvaseDanado: value as "VACIO" | "LLENO" } }))}><SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="VACIO">Vacío</SelectItem><SelectItem value="LLENO">Lleno</SelectItem></SelectContent></Select> : "—"}</TableCell>
                    <TableCell>
                      <div className="min-w-44 space-y-1">
                        <Select
                          value={returnDraft[line.idInventarioItem]?.ubicacionDanada ?? ""}
                          onValueChange={(value) =>
                            setReturnDraft((previous) => ({
                              ...previous,
                              [line.idInventarioItem]: {
                                ...previous[line.idInventarioItem],
                                ubicacionDanada: value as "CUARENTENA" | "OTRA",
                              },
                            }))
                          }
                          disabled={
                            isSaving ||
                            Number(returnDraft[line.idInventarioItem]?.cantidadDanada ?? 0) <= 0
                          }
                        >
                          <SelectTrigger aria-label={`Ubicación no vendible de ${line.nombre}`}>
                            <SelectValue placeholder="Selecciona ubicación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CUARENTENA">Cuarentena</SelectItem>
                            <SelectItem value="OTRA">Otra ubicación</SelectItem>
                          </SelectContent>
                        </Select>
                        {returnDraft[line.idInventarioItem]?.ubicacionDanada === "OTRA" ? (
                          <Input
                            value={returnDraft[line.idInventarioItem]?.ubicacionDanadaDetalle ?? ""}
                            onChange={(event) =>
                              setReturnDraft((previous) => ({
                                ...previous,
                                [line.idInventarioItem]: {
                                  ...previous[line.idInventarioItem],
                                  ubicacionDanadaDetalle: event.target.value,
                                },
                              }))
                            }
                            maxLength={255}
                            placeholder="Especifica el lugar"
                            aria-label={`Detalle de ubicación no vendible de ${line.nombre}`}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell><Input value={returnDraft[line.idInventarioItem]?.observaciones ?? ""} onChange={(event) => setReturnDraft((previous) => ({ ...previous, [line.idInventarioItem]: { ...previous[line.idInventarioItem], observaciones: event.target.value } }))} maxLength={255} /></TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} maxLength={255} placeholder="Observaciones de recepción" />
            {!canCreate ? <p className="text-sm text-muted-foreground">Tu rol no tiene permiso para registrar devoluciones.</p> : null}
            <Button onClick={() => void submitReturn()} disabled={!canCreate || isSaving || visibleInventory.productos.every((line) => line.pendienteConciliacion - line.reservado <= 0.009)}>
              Confirmar recepción
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
