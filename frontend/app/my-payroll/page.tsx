"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { downloadMyPayrollReceipt, listMyPayrolls } from "@/services/payroll.service";
import type { PayrollDto } from "@/types/payroll";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function money(value: number) {
  return `Q${value.toFixed(2)}`;
}

export default function MyPayrollPage() {
  const [payrolls, setPayrolls] = useState<PayrollDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  async function loadPayrolls() {
    setIsLoading(true);
    try {
      setPayrolls(await listMyPayrolls());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar tus planillas"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    listMyPayrolls()
      .then((data) => {
        if (mounted) setPayrolls(data);
      })
      .catch((error) => {
        if (mounted) {
          toast.error(getApiErrorMessage(error, "No se pudieron cargar tus planillas"));
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleDownload(id: number) {
    setDownloadingId(id);
    try {
      await downloadMyPayrollReceipt(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo descargar el recibo"));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Mis recibos de planilla"
        description="Consulta tus planillas y descarga el recibo de cada período."
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Histórico de planillas</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void loadPayrolls()} disabled={isLoading}>
              {isLoading
                ? <Loader2 className="size-4 animate-spin" />
                : <RefreshCw className="size-4" />}
              Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Sueldo base</TableHead>
                    <TableHead className="text-right">Comisiones</TableHead>
                    <TableHead className="text-right">Bonos</TableHead>
                    <TableHead className="text-right">Viáticos separados</TableHead>
                    <TableHead className="text-right">Descuentos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Recibo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        Cargando planillas…
                      </TableCell>
                    </TableRow>
                  ) : payrolls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        No hay planillas disponibles.
                      </TableCell>
                    </TableRow>
                  ) : payrolls.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {MONTH_NAMES[item.mes - 1]} {item.anio}
                      </TableCell>
                      <TableCell>{item.estado === "CERRADA" ? "Cerrada" : "Borrador"}</TableCell>
                      <TableCell className="text-right">{money(item.sueldoBase)}</TableCell>
                      <TableCell className="text-right">{money(item.totalComisiones)}</TableCell>
                      <TableCell className="text-right">{money(item.totalBonosMetas)}</TableCell>
                      <TableCell className="text-right">{money(item.totalViaticos)}</TableCell>
                      <TableCell className="text-right">{money(item.totalDescuentos)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(item.sueldoLiquido)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownload(item.id)}
                          disabled={downloadingId === item.id}
                          aria-label={`Descargar recibo de ${MONTH_NAMES[item.mes - 1]} ${item.anio}`}
                        >
                          {downloadingId === item.id
                            ? <Loader2 className="size-4 animate-spin" />
                            : <Download className="size-4" />}
                          Descargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Los viáticos se muestran aparte y no forman parte del sueldo líquido.
            </p>
          </CardContent>
        </Card>
      </DashboardShell>
    </RequireAuth>
  );
}
