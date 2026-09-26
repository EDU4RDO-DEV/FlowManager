import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";

export default function SaleDetailLoading() {
  return (
    <DashboardShell title="Detalle de Venta" description="Cargando venta y pagos...">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
