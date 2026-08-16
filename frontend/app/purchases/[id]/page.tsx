"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
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
import { getApiErrorMessage } from "@/lib/api";
import { getPurchaseById } from "@/services/purchases.service";
import type { PurchaseDto } from "@/types/purchases";

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

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const backPath = useMemo(() => {
    if (!purchase) {
      return "/purchases";
    }
    return purchase.esGasto ? "/purchases/gastos" : "/purchases";
  }, [purchase]);

  useEffect(() => {
    async function loadPurchase() {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id <= 0) {
        toast.error("Id de compra invalido");
        router.push("/purchases");
        return;
      }

      setIsLoading(true);
      try {
        const data = await getPurchaseById(id);
        setPurchase(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el detalle"));
        router.push("/purchases");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPurchase();
  }, [params.id, router]);

  return (
    <RequireAuth moduleKey="compras" action="read">
      <DashboardShell
        title={purchase?.esGasto ? "Detalle de Gasto" : "Detalle de Compra"}
        description="Vista completa de cabecera, desglose y totales en pagina dedicada."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push(backPath)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Cargando detalle...</CardContent>
            </Card>
          ) : purchase ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Numero</p>
                  <p className="font-medium">#{purchase.numeroCompra}</p>
                </div>
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
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Categoria</TableHead>
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
                              <TableCell className="text-right">{formatMoney(detail.costoUnitario)}</TableCell>
                              <TableCell className="text-right font-medium">{formatMoney(detail.subtotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {purchase.detalleGasto.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripcion</TableHead>
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
                              <TableCell className="text-right">{formatMoney(detail.precioUnitario)}</TableCell>
                              <TableCell className="text-right font-medium">{formatMoney(detail.subtotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
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
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
