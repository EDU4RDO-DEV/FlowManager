"use client";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdjustmentOperationDetailDto,
  AdjustmentOperationDto,
} from "@/types/adjustments";

interface AdjustmentOperationDetailProps {
  operation: AdjustmentOperationDto;
  details: AdjustmentOperationDetailDto | null;
  isLoading: boolean;
  onBack: () => void;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQuantity(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("es-GT", { maximumFractionDigits: 2 });
}

export function AdjustmentOperationDetail({
  operation,
  details,
  isLoading,
  onBack,
}: AdjustmentOperationDetailProps) {
  return (
    <Card className="module-page-card">
      <CardContent className="p-0">
        <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div>
            <h2 className="font-heading text-base font-medium leading-none">
              Ajuste AJU-{String(operation.numeroAjuste).padStart(6, "0")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Información completa de la operación y el desglose de existencias.
            </p>
          </div>
          <Button variant="outline" onClick={onBack} className="shrink-0">
            <ArrowLeft className="mr-2 size-4" />
            Volver al listado
          </Button>
        </header>

        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            Cargando detalle…
          </p>
        ) : details ? (
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Fecha y hora</p>
                <p className="font-medium">{formatDateTime(details.fechaRegistro)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsable</p>
                <p className="font-medium">{details.responsable}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de operación</p>
                <p className="font-medium">{details.tiposAjuste.join(" / ") || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge
                  variant={
                    details.estado === "ACTIVO"
                      ? "default"
                      : details.estado === "ANULADO"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {details.estado}
                </Badge>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="font-medium">{details.nombreAjuste || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="font-medium">{details.observacion || "-"}</p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Detalle de inventario</h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Existencia anterior</TableHead>
                      <TableHead className="text-right">Existencia resultante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.inventarioItem.nombre}</TableCell>
                        <TableCell>{item.inventarioItem.categoria}</TableCell>
                        <TableCell>
                          <Badge
                            variant={item.tipoAjuste === "ENTRADA" ? "default" : "destructive"}
                          >
                            {item.tipoAjuste}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.tipoAjuste === "ENTRADA" ? "+" : "-"}
                          {formatQuantity(item.cantidadAjustada)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(item.existenciaAnterior)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(item.existenciaResultante)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {details.items.some(
              (item) => item.existenciaAnterior === null || item.existenciaResultante === null,
            ) && (
              <p className="text-xs text-muted-foreground">
                Algunos movimientos históricos no tienen snapshot de existencias en la bitácora.
              </p>
            )}

            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Productos ajustados</span>
                <span className="font-medium">{details.items.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Tipo de operación</span>
                <span className="text-lg font-bold">{details.tipoAjuste}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            No fue posible cargar los detalles de este ajuste.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
