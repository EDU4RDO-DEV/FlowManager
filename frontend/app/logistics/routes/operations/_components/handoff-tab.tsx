import { Loader2 } from "lucide-react";
import Link from "next/link";

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
import type { DispatchProductDto, RutaDto, RutaSesionDto, VehicleHandoffResultDto, VehiculoDto } from "@/types/logistics";

import type { HandoffFormState, TransferDraft } from "./shared";

interface HandoffTabProps {
  canOperate: boolean;
  canCreate: boolean;
  isSavingHandoff: boolean;
  handoffForm: HandoffFormState;
  setHandoffForm: (updater: (previous: HandoffFormState) => HandoffFormState) => void;
  routesCatalog: RutaDto[];
  handoffVehicleOptions: VehiculoDto[];
  // Historial de sesiones, usado únicamente para sugerir el chofer/vendedor habitual
  // del vehículo entrante seleccionado (no obliga a usarlo).
  sessionsHistory: RutaSesionDto[];
  employeeOptions: Array<{ userId: number; nombre: string }>;
  handoffProductOptions: DispatchProductDto[];
  handoffProductId: string;
  setHandoffProductId: (value: string) => void;
  addHandoffProduct: () => void;
  handoffDraft: TransferDraft[];
  setHandoffDraft: (updater: (previous: TransferDraft[]) => TransferDraft[]) => void;
  productById: Map<number, DispatchProductDto>;
  submitHandoff: () => void;
  handoffResult: VehicleHandoffResultDto | null;
}

// Pestaña "Relevos": sustitución de vehículo con custodia compartida (D-DIST-02/03).
// La sesión saliente NO se cierra desde aquí; sigue operando hasta que su inventario
// pendiente llegue a cero y se cierre por el flujo normal.
export function HandoffTab({
  canOperate,
  canCreate,
  isSavingHandoff,
  handoffForm,
  setHandoffForm,
  routesCatalog,
  handoffVehicleOptions,
  sessionsHistory,
  employeeOptions,
  handoffProductOptions,
  handoffProductId,
  setHandoffProductId,
  addHandoffProduct,
  handoffDraft,
  setHandoffDraft,
  productById,
  submitHandoff,
  handoffResult,
}: HandoffTabProps) {
  if (!canOperate) {
    return (
      <Card className="rounded-xl">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Los relevos solo están disponibles cuando la sesión está EN_CURSO.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">Relevo de vehículo (custodia compartida)</h2>
          <p className="text-sm text-muted-foreground">
            Sustituye este vehículo por otro sin cerrar la sesión actual: ambos pueden seguir operando.
            Indica solo lo que se transfiera ahora; el resto permanece bajo custodia de este vehículo
            hasta transferirse después o hasta cerrar esta sesión por el flujo normal.
            {!canCreate ? " Tu rol no tiene permiso para registrar relevos." : ""}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Ruta de la sesión entrante</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={handoffForm.idRuta}
              onChange={(event) => setHandoffForm((prev) => ({ ...prev, idRuta: event.target.value }))}
            >
              <option value="">Seleccionar</option>
              {routesCatalog.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Vehículo entrante</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={handoffForm.idVehiculo}
              onChange={(event) => {
                const idVehiculo = event.target.value;
                const habitual = sessionsHistory
                  .filter((item) => String(item.idVehiculo) === idVehiculo)
                  .sort((a, b) => new Date(b.fechaSesion).getTime() - new Date(a.fechaSesion).getTime())[0];
                setHandoffForm((prev) => ({
                  ...prev,
                  idVehiculo,
                  idUsuarioChofer: !prev.idUsuarioChofer && habitual ? String(habitual.idUsuarioChofer) : prev.idUsuarioChofer,
                  idUsuarioVendedor: !prev.idUsuarioVendedor && habitual ? String(habitual.idUsuarioVendedor) : prev.idUsuarioVendedor,
                }));
              }}
            >
              <option value="">Seleccionar</option>
              {handoffVehicleOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.placa} - {item.marca}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Chofer entrante</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={handoffForm.idUsuarioChofer}
              onChange={(event) => setHandoffForm((prev) => ({ ...prev, idUsuarioChofer: event.target.value }))}
            >
              <option value="">Seleccionar</option>
              {employeeOptions.map((item) => (
                <option key={item.userId} value={item.userId}>{item.nombre}</option>
              ))}
            </select>
            {employeeOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay personal disponible. Solo aparecen empleados con cuenta de usuario vinculada.{" "}
                <Link href="/employees" target="_blank" className="underline">Revisar empleados</Link>.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Vendedor entrante</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={handoffForm.idUsuarioVendedor}
              onChange={(event) => setHandoffForm((prev) => ({ ...prev, idUsuarioVendedor: event.target.value }))}
            >
              <option value="">Seleccionar</option>
              {employeeOptions.map((item) => (
                <option key={item.userId} value={item.userId}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Km inicial entrante</Label>
            <Input
              type="number" min="0"
              value={handoffForm.kmInicialEntrante}
              onChange={(event) => setHandoffForm((prev) => ({ ...prev, kmInicialEntrante: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <Label>Motivo del relevo</Label>
            <Input
              value={handoffForm.motivo} maxLength={255}
              onChange={(event) => setHandoffForm((prev) => ({ ...prev, motivo: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Inventario a transferir ahora (opcional; el resto queda en este vehículo)</Label>
          <div className="flex gap-2">
            <Select value={handoffProductId} onValueChange={setHandoffProductId}>
              <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
              <SelectContent>
                {handoffProductOptions.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>{product.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addHandoffProduct} disabled={!handoffProductId}>
              Agregar
            </Button>
          </div>
          {handoffDraft.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead><TableHead>Cantidad</TableHead>
                  <TableHead>Estado envase</TableHead><TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handoffDraft.map((line, index) => {
                  const product = productById.get(line.idInventarioItem);
                  return (
                    <TableRow key={line.idInventarioItem}>
                      <TableCell>{product?.nombre ?? line.idInventarioItem}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min="0" step="0.01" className="max-w-28"
                          value={line.cantidad}
                          onChange={(event) => setHandoffDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, cantidad: event.target.value } : item))}
                        />
                      </TableCell>
                      <TableCell>
                        {product?.esEnvaseRetornable ? (
                          <Select
                            value={line.estadoEnvase}
                            onValueChange={(value) => setHandoffDraft((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, estadoEnvase: value as "VACIO" | "LLENO" } : item))}
                          >
                            <SelectTrigger className="min-w-28"><SelectValue placeholder="Estado" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VACIO">Vacío</SelectItem>
                              <SelectItem value="LLENO">Lleno</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setHandoffDraft((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                          Quitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </div>

        <Button onClick={() => void submitHandoff()} disabled={!canCreate || isSavingHandoff}>
          {isSavingHandoff ? <Loader2 className="size-4 animate-spin" /> : null} Registrar relevo
        </Button>

        {handoffResult ? (
          <div className="space-y-3 border-t pt-3">
            <h3 className="text-sm font-semibold">
              Resultado: nueva sesión #{handoffResult.sesionEntrante.id} ({handoffResult.sesionEntrante.estado})
            </h3>
            {handoffResult.transferenciaInventario ? (
              <p className="text-xs text-muted-foreground">
                Transferencia #{handoffResult.transferenciaInventario.id} ({handoffResult.transferenciaInventario.estadoConfirmacion}):{" "}
                {handoffResult.transferenciaInventario.detalle.map((item) => `${item.nombre}: ${item.cantidad}`).join(", ")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No se transfirió inventario de inmediato; todo permanece en el vehículo saliente.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Custodia vehículo saliente (sesión #{handoffResult.custodia.saliente.idRutaSesion})</p>
                <ul className="text-xs text-muted-foreground">
                  {handoffResult.custodia.saliente.productos.map((line) => (
                    <li key={line.idInventarioItem}>{line.nombre}: disponible {line.disponible}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Custodia vehículo entrante (sesión #{handoffResult.custodia.entrante.idRutaSesion})</p>
                <ul className="text-xs text-muted-foreground">
                  {handoffResult.custodia.entrante.productos.map((line) => (
                    <li key={line.idInventarioItem}>{line.nombre}: disponible {line.disponible}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
