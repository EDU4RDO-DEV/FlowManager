import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";

export default function SalesLoading() {
  return (
    <DashboardShell
      title="Administración de Ventas"
      description="Cargando información de ventas..."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
