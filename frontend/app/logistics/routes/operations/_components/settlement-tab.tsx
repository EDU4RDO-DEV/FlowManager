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
import type { RouteInventoryDto, RouteInventoryLineDto, RutaSesionDto } from "@/types/logistics";

import { formatDate } from "./shared";

interface SettlementTabProps {
  canOperate: boolean;
  canUpdate: boolean;
  isSaving: boolean;
  selectedSession: RutaSesionDto;
  visibleInventory: RouteInventoryDto;
  selectedPendingLine: RouteInventoryLineDto | undefined;
  setAdjustmentItemId: (value: string) => void;
  adjustmentClass: "FALTANTE" | "DANADO" | "OTRO";
  setAdjustmentClass: (value: "FALTANTE" | "DANADO" | "OTRO") => void;
  adjustmentAmount: string;
  setAdjustmentAmount: (value: string) => void;
  adjustmentReason: string;
  setAdjustmentReason: (value: string) => void;
  submitAdjustment: () => void;
  closingKilometers: string;
  setClosingKilometers: (value: string) => void;
  closeRoute: () => void;
}

// Pestaña "Liquidación": consolidación de ventas, devoluciones y diferencias por
// producto, autorización de diferencias pendientes, y cierre operativo del vehículo.
export function SettlementTab({
  canOperate,
  canUpdate,
  isSaving,
  selectedSession,
  visibleInventory,
  selectedPendingLine,
  setAdjustmentItemId,
  adjustmentClass,
  setAdjustmentClass,
  adjustmentAmount,
  setAdjustmentAmount,
  adjustmentReason,
  setAdjustmentReason,
  submitAdjustment,
  closingKilometers,
  setClosingKilometers,
  closeRoute,
}: SettlementTabProps) {
  return (
    <div className="space-y-4">
      {visibleInventory.productos.length > 0 ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-3 p-4">
            <div>
              <h2 className="text-lg font-semibold">Inventario y liquidación por producto</h2>
              <p className="text-sm text-muted-foreground">Las devoluciones vendibles aumentan el saldo del vehículo; las no vendibles se concilian físicamente, pero no quedan disponibles para reventa. &quot;Transferido&quot; refleja la custodia actual frente a otros vehículos (D-DIST-02/03/04).</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead><TableHead>Despachado</TableHead><TableHead>Vendido</TableHead>
                  <TableHead>Dev. comercial</TableHead><TableHead>No vendible</TableHead>
                  <TableHead>Devuelto</TableHead><TableHead>Dañado</TableHead><TableHead>Ajustado</TableHead>
                  <TableHead>Reservado</TableHead>
                  <TableHead>Transferido (salida)</TableHead><TableHead>Transferido (entrada)</TableHead>
                  <TableHead>Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleInventory.productos.map((line) => (
                  <TableRow key={line.idInventarioItem}>
                    <TableCell>{line.nombre}<span className="block text-xs text-muted-foreground">{line.unidadMedida ?? ""}</span></TableCell>
                    <TableCell>{line.despachado}</TableCell><TableCell>{line.vendido}</TableCell>
                    <TableCell>{line.devolucionComercial}</TableCell><TableCell>{line.noVendibleComercial}</TableCell>
                    <TableCell>{line.devuelto}</TableCell><TableCell>{line.danado}</TableCell>
                    <TableCell>{line.ajustado}</TableCell>
                    <TableCell>{line.reservado}</TableCell>
                    <TableCell>{line.transferidoSaliente ?? 0}</TableCell>
                    <TableCell>{line.transferidoRecibido ?? 0}</TableCell>
                    <TableCell className={line.disponible > 0.009 ? "font-semibold text-amber-700" : ""}>{line.disponible}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {visibleInventory.devolucion && (visibleInventory.diferenciasPendientes?.length ?? 0) > 0 && canOperate ? (
        <Card className="rounded-xl">
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Autorizar diferencias</h2>
              <p className="text-sm text-muted-foreground">
                La clasificación y el motivo quedan auditados con el usuario autenticado que autoriza.
                {!canUpdate ? " Tu rol no tiene permiso para autorizar diferencias." : ""}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Producto con diferencia</Label>
                <Select
                  value={selectedPendingLine ? String(selectedPendingLine.idInventarioItem) : ""}
                  onValueChange={setAdjustmentItemId}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                  <SelectContent>
                    {visibleInventory.diferenciasPendientes?.map((line) => (
                      <SelectItem key={line.idInventarioItem} value={String(line.idInventarioItem)}>
                        {line.nombre} · pendiente {Number(Math.max(0, line.pendienteConciliacion - line.reservado).toFixed(2))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Clasificación</Label>
                <Select value={adjustmentClass} onValueChange={(value) => setAdjustmentClass(value as typeof adjustmentClass)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FALTANTE">Faltante</SelectItem>
                    <SelectItem value="DANADO">Dañado no recibido</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustmentAmount}
                  placeholder={selectedPendingLine ? String(Number(Math.max(0, selectedPendingLine.pendienteConciliacion - selectedPendingLine.reservado).toFixed(2))) : ""}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo obligatorio</Label>
                <Input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={255} />
              </div>
            </div>
            <Button variant="outline" onClick={() => void submitAdjustment()} disabled={!canUpdate || isSaving}>
              Registrar autorización de diferencia
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {selectedSession.estado === "EN_CURSO" ? (
        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="closing-km">Kilometraje final</Label>
              <Input id="closing-km" type="number" min={selectedSession.kmInicial ?? 0} value={closingKilometers} onChange={(event) => setClosingKilometers(event.target.value)} />
              <p className="text-xs text-muted-foreground">El backend rechazará el cierre si quedan cantidades sin conciliar.</p>
              {!canUpdate ? <p className="text-xs text-muted-foreground">Tu rol no tiene permiso para cerrar rutas.</p> : null}
            </div>
            <Button onClick={() => void closeRoute()} disabled={!canUpdate || !visibleInventory.conciliada || isSaving}>
              Cerrar y liquidar ruta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Sesión {selectedSession.estado.toLowerCase()}. Cierre registrado: {formatDate(selectedSession.fechaCierre ?? null)}.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
