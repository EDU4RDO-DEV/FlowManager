"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import { listTalonarios } from "@/services/sales.service";
import type { TalonarioDto } from "@/types/sales";

export default function SalesTalonariosPage() {
  const [items, setItems] = useState<TalonarioDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTalonarios();
      setItems(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar los talonarios"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <RequireAuth moduleKey="ventas" action="read">
      <DashboardShell
        title="Talonarios"
        description="Control de correlativos físicos para ventas"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-sky-600" />
              Talonarios activos
            </CardTitle>
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recargar
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !isLoading ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay talonarios registrados.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-5 md:items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="font-medium">{item.nombre}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rango</p>
                      <p className="font-medium">{item.correlativoInicial} - {item.correlativoFinal}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Último usado</p>
                      <p className="font-medium">{item.ultimoUtilizado ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Siguiente</p>
                      <p className="font-medium">{item.siguienteCorrelativo ?? "Sin disponibilidad"}</p>
                    </div>
                    <div>
                      <Badge className={item.disponible ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                        {item.disponible ? "Disponible" : "Agotado"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardShell>
    </RequireAuth>
  );
}
