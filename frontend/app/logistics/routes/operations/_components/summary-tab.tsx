import { Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RouteInventoryDto, RutaSesionDto, TransferenciaVehiculoDto } from "@/types/logistics";

import { formatDate } from "./shared";

interface SummaryTabProps {
  selectedSession: RutaSesionDto;
  visibleInventory: RouteInventoryDto;
  transfers: TransferenciaVehiculoDto[];
  handoffPending: boolean;
}

// Pestaña "Resumen": panorama rápido de la sesión seleccionada (vehículo, estado
// de despacho/devolución, conciliación y operaciones pendientes). El detalle y las
// acciones de cada operación viven en su propia pestaña (Despachos, Devoluciones,
// Transferencias, Relevos, Liquidación).
export function SummaryTab({ selectedSession, visibleInventory, transfers, handoffPending }: SummaryTabProps) {
  const pendingTransfers = transfers.filter((transfer) => transfer.estadoConfirmacion === "PENDIENTE");
  const pendingDifferences = visibleInventory.diferenciasPendientes?.length ?? 0;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Vehículo / sesión</p>
            <p className="flex items-center gap-2 font-semibold">
              <Truck className="size-4" />
              {selectedSession.vehiculo?.placa ?? `Vehículo ${selectedSession.idVehiculo}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedSession.ruta?.nombre ?? `Ruta ${selectedSession.idRuta}`} · {formatDate(selectedSession.fechaSesion)}
            </p>
            <p className="text-xs text-muted-foreground">
              Chofer: {selectedSession.chofer?.nombre ?? "-"} · Vendedor: {selectedSession.vendedor?.nombre ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Despacho / devolución</p>
            <p className="font-semibold">
              {visibleInventory.despacho
                ? `Despachado ${formatDate(visibleInventory.despacho.fechaRegistro)}`
                : visibleInventory.productos.some((line) => (line.transferidoRecibido ?? 0) > 0)
                  ? "Carga recibida por transferencia"
                  : "Pendiente de despacho"}
            </p>
            <p className="text-xs text-muted-foreground">
              {visibleInventory.devolucion ? `Recibido ${formatDate(visibleInventory.devolucion.fechaRegistro)}` : "Devolución aún no registrada"}
            </p>
            <p className="text-xs text-muted-foreground">
              Consulta el historial completo y las anulaciones individuales en las pestañas Despachos y Devoluciones.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Estado de conciliación</p>
            <Badge variant={visibleInventory.conciliada ? "default" : "destructive"}>
              {visibleInventory.conciliada ? "Conciliada" : `${pendingDifferences} diferencias pendientes`}
            </Badge>
            <p className="text-xs text-muted-foreground">Las cantidades se calculan desde movimientos confirmados.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-xl">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Operaciones pendientes</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={pendingTransfers.length > 0 ? "secondary" : "outline"}>
              Transferencias pendientes: {pendingTransfers.length}
            </Badge>
            <Badge variant={pendingDifferences > 0 ? "secondary" : "outline"}>
              Diferencias por autorizar: {pendingDifferences}
            </Badge>
            {handoffPending ? <Badge variant="secondary">Relevo registrado en esta sesión</Badge> : null}
          </div>
          {pendingTransfers.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Revisa la pestaña Transferencias para confirmar o rechazar lo pendiente de recibir.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
