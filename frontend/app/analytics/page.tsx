"use client";

import Link from "next/link";
import { BarChart3, LockKeyhole } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";
import { hasModulePermission } from "@/lib/rbac";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const canReadSales = hasModulePermission(user, "ventas", "read");

  return (
    <RequireAuth>
      <DashboardShell
        title="Dashboard analítico"
        description="Indicadores comerciales y operativos basados en las ventas registradas."
      >
        {canReadSales ? (
          <AnalyticsDashboard />
        ) : (
          <Card className="mx-auto max-w-2xl">
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <CardTitle>No tienes acceso a los indicadores de ventas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
              <p>Solicita el permiso de lectura de ventas a un administrador para consultar este dashboard.</p>
              <Button asChild variant="outline">
                <Link href="/">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Volver al inicio
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </DashboardShell>
    </RequireAuth>
  );
}
