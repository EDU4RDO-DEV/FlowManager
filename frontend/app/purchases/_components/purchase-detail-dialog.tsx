"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseDto } from "@/types/purchases";

interface PurchaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseDto | null;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PurchaseDetailDialog({
  open,
  onOpenChange,
  purchase,
}: PurchaseDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        <DialogHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>Detalle de compra #{purchase?.numeroCompra ?? "-"}</DialogTitle>
          <DialogDescription>
            Información completa de cabecera, desglose y totales.
          </DialogDescription>
        </DialogHeader>

        {purchase ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Factura</p>
                <p className="font-medium">{purchase.numeroFactura}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proveedor</p>
                <p className="font-medium">{purchase.proveedor.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <Badge variant={purchase.esGasto ? "secondary" : "default"}>
                  {purchase.esGasto ? "Gasto" : "Compra"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha factura</p>
                <p className="font-medium">{formatDate(purchase.fechaFactura)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usuario registro</p>
                <p className="font-medium">{purchase.usuario.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha registro</p>
                <p className="font-medium">{formatDate(purchase.fechaRegistro)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge variant={purchase.anulado ? "destructive" : "default"}>
                  {purchase.anulado ? "Anulado" : "Activo"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="font-medium">{purchase.observaciones || "-"}</p>
              </div>
            </div>

            {purchase.detalleCompra.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Detalle de inventario</h4>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.detalleCompra.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell>{detail.inventarioItem.nombre}</TableCell>
                          <TableCell>{detail.inventarioItem.categoria}</TableCell>
                          <TableCell className="text-right">{detail.cantidad.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(detail.costoUnitario)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(detail.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {purchase.detalleGasto.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Detalle de gastos</h4>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.detalleGasto.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell>{detail.descripcion}</TableCell>
                          <TableCell className="text-right">{detail.cantidad.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(detail.precioUnitario)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(detail.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="rounded-md border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total detalle compra</span>
                <span className="font-medium">{formatMoney(purchase.totalDetalleCompra)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total detalle gasto</span>
                <span className="font-medium">{formatMoney(purchase.totalDetalleGasto)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Total general</span>
                <span className="text-lg font-bold">{formatMoney(purchase.totalGeneral)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
