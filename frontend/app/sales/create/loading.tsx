import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";

export default function CreateSaleLoading() {
  return (
    <DashboardShell title="Nueva Venta" description="Cargando catálogo comercial...">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
