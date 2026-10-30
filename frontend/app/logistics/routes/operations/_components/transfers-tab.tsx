import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { DispatchProductDto, RutaSesionDto, TransferenciaVehiculoDto } from "@/types/logistics";

import type { TransferDraft } from "./shared";

interface TransfersTabProps {
  canOperate: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  isSavingTransfer: boolean;
  selectedSession: RutaSesionDto;
  transferDestinoOptions: RutaSesionDto[];
  transferDestinoId: string;
  setTransferDestinoId: (value: string) => void;
  transferProductOptions: DispatchProductDto[];
  transferProductId: string;
  setTransferProductId: (value: string) => void;
  addTransferProduct: () => void;
  transferDraft: TransferDraft[];
  setTransferDraft: (updater: (previous: TransferDraft[]) => TransferDraft[]) => void;
  productById: Map<number, DispatchProductDto>;
  transferMotivo: string;
  setTransferMotivo: (value: string) => void;
  submitTransfer: () => void;
  transfers: TransferenciaVehiculoDto[];
  sessionLabelById: Map<number, string>;
  transferRejectReason: Record<number, string>;
  setTransferRejectReason: (updater: (previous: Record<number, string>) => Record<number, string>) => void;
  submitRejectTransfer: (transfer: TransferenciaVehiculoDto) => void;
  transferCancelReason: Record<number, string>;
  setTransferCancelReason: (updater: (previous: Record<number, string>) => Record<number, string>) => void;
  submitCancelTransfer: (transfer: TransferenciaVehiculoDto) => void;
  submitConfirmTransfer: (transfer: TransferenciaVehiculoDto) => void;
}

// Pestaña "Transferencias": creación, consulta, confirmación, rechazo y anulación de
// transferencias parciales de inventario entre vehículos EN_CURSO (D-DIST-04).
export function TransfersTab({
  canOperate,
  canCreate,
  canUpdate,
  isSavingTransfer,
  selectedSession,
  transferDestinoOptions,
  transferDestinoId,
  setTransferDestinoId,
  transferProductOptions,
  transferProductId,
  setTransferProductId,
  addTransferProduct,
  transferDraft,
  setTransferDraft,
  productById,
  transferMotivo,
  setTransferMotivo,
  submitTransfer,
  transfers,
  sessionLabelById,
  transferRejectReason,
  setTransferRejectReason,
  submitRejectTransfer,
  transferCancelReason,
  setTransferCancelReason,
  submitCancelTransfer,
  submitConfirmTransfer,
}: TransfersTabProps) {
  if (!canOperate) {
    return (
      <Card className="rounded-xl">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Las transferencias solo están disponibles cuando la sesión está EN_CURSO.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Transferencias parciales entre vehículos</h2>
          <p className="text-sm text-muted-foreground">
            Mueve parte del inventario disponible de este vehículo a otra sesión EN_CURSO. Queda PENDIENTE
            hasta que el vehículo destino la confirme; mientras tanto ya no está disponible en el origen.
            {!canCreate ? " Tu rol no tiene permiso para crear transferencias." : ""}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sesión destino (vehículo)</Label>
            <Select value={transferDestinoId} onValueChange={setTransferDestinoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un vehículo EN_CURSO" /></SelectTrigger>
              <SelectContent>
                {transferDestinoOptions.map((session) => (
                  <SelectItem key={session.id} value={String(session.id)}>
                    {session.vehiculo?.placa ?? `Vehículo ${session.idVehiculo}`} · {session.ruta?.nombre ?? `Ruta ${session.idRuta}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Producto a transferir</Label>
            <div className="flex gap-2">
              <Select value={transferProductId} onValueChange={setTransferProductId}>
                <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                <SelectContent>
                  {transferProductOptions.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>{product.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addTransferProduct} disabled={!transferProductId}>
                Agregar
              </Button>
            </div>
          </div>
        </div>

        {transferDraft.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Estado envase</TableHead>
                <TableHead className="text-right">Quitar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferDraft.map((line, index) => {
                const product = productById.get(line.idInventarioItem);
                return (
                  <TableRow key={line.idInventarioItem}>
                    <TableCell>{product?.nombre ?? line.idInventarioItem}</TableCell>
                    <TableCell>
                      <Input
                        type="number" min="0" step="0.01" className="max-w-28"
                        value={line.cantidad}
                        onChange={(event) => setTransferDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, cantidad: event.target.value } : item))}
                      />
                    </TableCell>
                    <TableCell>
                      {product?.esEnvaseRetornable ? (
                        <Select
                          value={line.estadoEnvase}
                          onValueChange={(value) => setTransferDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" } : item))}
                        >
                          <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VACIO">Vacío</SelectItem>
                            <SelectItem value="LLENO">Lleno</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setTransferDraft((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-muted-foreground">Agrega los productos que se transferirán.</p>}

        <Textarea value={transferMotivo} onChange={(event) => setTransferMotivo(event.target.value)} maxLength={255} placeholder="Motivo de la transferencia" />
        <Button onClick={() => void submitTransfer()} disabled={!canCreate || isSavingTransfer || transferDraft.length === 0 || !transferDestinoId}>
          {isSavingTransfer ? <Loader2 className="size-4 animate-spin" /> : null} Registrar transferencia
        </Button>

        {transfers.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Transferencias de esta sesión</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origen</TableHead><TableHead>Destino</TableHead><TableHead>Estado</TableHead>
                  <TableHead>Detalle</TableHead><TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const isDestino = transfer.idRutaSesionDestino === selectedSession.id;
                  const isOrigen = transfer.idRutaSesionOrigen === selectedSession.id;
                  const isPending = transfer.estadoConfirmacion === "PENDIENTE";
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell>{sessionLabelById.get(transfer.idRutaSesionOrigen) ?? `#${transfer.idRutaSesionOrigen}`}</TableCell>
                      <TableCell>{sessionLabelById.get(transfer.idRutaSesionDestino) ?? `#${transfer.idRutaSesionDestino}`}</TableCell>
                      <TableCell>
                        <Badge variant={transfer.estadoConfirmacion === "CONFIRMADA" ? "default" : transfer.estadoConfirmacion === "RECHAZADA" ? "destructive" : "secondary"}>
                          {transfer.estadoConfirmacion}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ul className="text-xs text-muted-foreground">
                          {transfer.detalle.map((item) => (
                            <li key={item.idInventarioItem}>{item.nombre}: {item.cantidad}{item.estadoEnvase ? ` (${item.estadoEnvase})` : ""}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="max-w-56 text-xs text-muted-foreground">{transfer.motivo}</TableCell>
                      <TableCell className="text-right">
                        {isPending && isDestino ? (
                          <div className="flex flex-col items-end gap-1">
                            <Button size="sm" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitConfirmTransfer(transfer)}>
                              Confirmar recepción
                            </Button>
                            <div className="flex gap-1">
                              <Input
                                className="h-8 max-w-40 text-xs"
                                placeholder="Motivo de rechazo"
                                value={transferRejectReason[transfer.id] ?? ""}
                                onChange={(event) => setTransferRejectReason((previous) => ({ ...previous, [transfer.id]: event.target.value }))}
                              />
                              <Button size="sm" variant="destructive" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitRejectTransfer(transfer)}>
                                Rechazar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {isPending && isOrigen ? (
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              className="h-8 max-w-40 text-xs"
                              placeholder="Motivo de anulación"
                              value={transferCancelReason[transfer.id] ?? ""}
                              onChange={(event) => setTransferCancelReason((previous) => ({ ...previous, [transfer.id]: event.target.value }))}
                            />
                            <Button size="sm" variant="outline" disabled={!canUpdate || isSavingTransfer} onClick={() => void submitCancelTransfer(transfer)}>
                              Anular transferencia
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
