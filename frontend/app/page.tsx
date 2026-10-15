"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  Droplet,
  Factory,
  PackageOpen,
  PackageSearch,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasModulePermission, type AppModuleKey } from "@/lib/rbac";

const modulesCatalog: Array<{
  key: AppModuleKey;
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "inventario",
    title: "Inventario",
    description: "Stock, estructura BOM, ajustes y kardex.",
    path: "/inventory",
    icon: PackageSearch,
  },
  {
    key: "compras",
    title: "Compras",
    description: "Registro de compras y control de gastos.",
    path: "/purchases",
    icon: CreditCard,
  },
  {
    key: "produccion",
    title: "Producción",
    description: "Órdenes de fabricación, consumo de recetas y movimientos de inventario.",
    path: "/production",
    icon: Factory,
  },
  {
    key: "clientes",
    title: "Clientes",
    description: "Gestión de clientes y datos comerciales.",
    path: "/clients",
    icon: Building2,
  },
  {
    key: "ventas",
    title: "Ventas",
    description: "Operación comercial, pagos, FEL y trazabilidad.",
    path: "/sales",
    icon: CreditCard,
  },
  {
    key: "proveedores",
    title: "Proveedores",
    description: "Catálogo y relaciones de abastecimiento.",
    path: "/providers",
    icon: Boxes,
  },
  {
    key: "empleados",
    title: "Empleados",
    description: "Control de personal y estructura interna.",
    path: "/employees",
    icon: Users,
  },
  {
    key: "usuarios",
    title: "Usuarios",
    description: "Cuentas de acceso y vínculo operativo.",
    path: "/users",
    icon: UserCog,
  },
  {
    key: "envases",
    title: "Envases Retornables",
    description: "Préstamos y devoluciones de envases a clientes.",
    path: "/envases",
    icon: PackageOpen,
  },
  {
    key: "calidad",
    title: "Control de Calidad",
    description: "Registro diario de pH y cloro del agua.",
    path: "/quality",
    icon: Droplet,
  },
];

const dashboardModules: AppModuleKey[] = [
  "resumen",
  "usuarios",
  "roles",
  "empleados",
  "clientes",
  "ventas",
  "proveedores",
  "compras",
  "sesiones",
  "produccion",
  "inventario",
  "envases",
  "calidad",
];

export default function HomePage() {
  const { user } = useAuth();

  const readCount = dashboardModules.filter((key) => hasModulePermission(user, key, "read")).length;
  const createCount = dashboardModules.filter((key) => hasModulePermission(user, key, "create")).length;
  const updateCount = dashboardModules.filter((key) => hasModulePermission(user, key, "update")).length;

  const availableCards = modulesCatalog.filter((module) =>
    hasModulePermission(user, module.key, "read"),
  );

  const quickActions = modulesCatalog.filter((module) =>
    hasModulePermission(user, module.key, "create"),
  );

  const todayText = new Intl.DateTimeFormat("es-GT", {
    dateStyle: "full",
  }).format(new Date());

  return (
    <RequireAuth>
      <DashboardShell
        title="Resumen Operativo"
        description="Panel principal de control para la operacion diaria de la planta."
      >
        <div className="space-y-6">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <Badge className="w-fit border-white/30 bg-white/15 text-white hover:bg-white/20">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {todayText}
                  </Badge>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Bienvenido, {user?.nombre ?? "equipo"}
                  </h2>
                  <p className="max-w-2xl text-sm text-white/90 sm:text-base">
                    Rol activo: {user?.nombreRol ?? "Sin rol asignado"}. Usa este tablero como punto
                    de entrada para las operaciones de hoy.
                  </p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur">
                  <p className="text-white/85">Módulos disponibles</p>
                  <p className="text-2xl font-bold">{readCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Permisos de lectura</CardDescription>
                <CardTitle className="text-3xl">{readCount}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Módulos con acceso para consulta.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Permisos de creación</CardDescription>
                <CardTitle className="text-3xl">{createCount}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Módulos donde puedes registrar información nueva.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Permisos de actualización</CardDescription>
                <CardTitle className="text-3xl">{updateCount}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Módulos habilitados para edición de datos.
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Accesos rápidos
              </CardTitle>
              <CardDescription>
                Se muestran según los permisos de tu usuario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quickActions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={`quick-${action.key}`}
                        href={action.path}
                        className="group rounded-xl border bg-background p-4 transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{action.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                          </div>
                          <Icon className="h-5 w-5 text-emerald-700/80" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tienes módulos con permiso de creación por ahora.
                </p>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">Módulos habilitados para navegación</p>
                <div className="flex flex-wrap gap-2">
                  {availableCards.length > 0 ? (
                    availableCards.map((module) => (
                      <Badge key={`badge-${module.key}`} variant="secondary">
                        {module.title}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Sin módulos disponibles</Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button asChild>
                  <Link href="/sessions">
                    Ir a Sesiones
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
