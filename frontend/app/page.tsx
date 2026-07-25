"use client";

import {
  Building2,
  Droplet,
  Factory,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllowedModulesByRole, type AppModuleKey } from "@/lib/rbac";

const moduleCatalog: Record<
  AppModuleKey,
  { name: string; icon: typeof LayoutDashboard; active?: boolean }
> = {
  resumen: { name: "Resumen", icon: LayoutDashboard, active: true },
  usuarios: { name: "Usuarios", icon: Users },
  roles: { name: "Roles y Permisos", icon: ShieldCheck },
  clientes: { name: "Clientes", icon: Building2 },
  proveedores: { name: "Proveedores", icon: Truck },
  sesiones: { name: "Sesiones de Ruta/Caja", icon: ReceiptText },
  produccion: { name: "Producción", icon: Factory },
  inventario: { name: "Inventario", icon: PackageSearch },
};

function Dashboard() {
  const { user, logout } = useAuth();
  const allowedModules = getAllowedModulesByRole(user?.nombreRol);
  const modules = allowedModules.map((key) => moduleCatalog[key]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="font-semibold tracking-tight">FlowManager</p>
              <p className="text-xs text-muted-foreground">Industrias Basán</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:px-6 md:py-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-tight text-muted-foreground">
                Módulos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.name}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      module.active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-transparent text-foreground hover:border-border hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{module.name}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">
                Hola, {user?.nombre}
              </CardTitle>
              <CardDescription>
                Tu sesión está activa. Aquí construiremos el panel operativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Correo: <span className="text-foreground">{user?.correo}</span>
              <br />
              Rol: <span className="text-foreground">{user?.nombreRol ?? "Sin rol asignado"}</span>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-tight text-muted-foreground">
                Módulos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={`mobile-${module.name}`}
                    type="button"
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      module.active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="truncate">{module.name}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </main>
      </div>

      <footer className="border-t border-border/70 bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>FlowManager · Plataforma Operativa</p>
          <p>Industrias Basán · Gestión de planta purificadora</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
