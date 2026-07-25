"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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

import {
  getAllowedModulesByRole,
  RBAC_PREVIEW_MODE,
  type AppModuleKey,
} from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

type ModuleItem = {
  key: AppModuleKey;
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
};

const moduleCatalog: Record<AppModuleKey, ModuleItem> = {
  resumen: {
    key: "resumen",
    name: "Resumen",
    path: "/",
    icon: LayoutDashboard,
  },
  usuarios: {
    key: "usuarios",
    name: "Usuarios",
    path: "/users",
    icon: Users,
  },
  roles: {
    key: "roles",
    name: "Roles y Permisos",
    path: "/roles",
    icon: ShieldCheck,
  },
  clientes: {
    key: "clientes",
    name: "Clientes",
    path: "/clients",
    icon: Building2,
  },
  proveedores: {
    key: "proveedores",
    name: "Proveedores",
    path: "/providers",
    icon: Truck,
  },
  sesiones: {
    key: "sesiones",
    name: "Sesiones de Ruta/Caja",
    path: "/sessions",
    icon: ReceiptText,
  },
  produccion: {
    key: "produccion",
    name: "Produccion",
    path: "/production",
    icon: Factory,
  },
  inventario: {
    key: "inventario",
    name: "Inventario",
    path: "/inventory",
    icon: PackageSearch,
  },
};

function isPathActive(currentPath: string, modulePath: string): boolean {
  if (modulePath === "/") {
    return currentPath === "/";
  }

  return currentPath === modulePath || currentPath.startsWith(`${modulePath}/`);
}

export function DashboardShell({ title, description, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const allowedModules = getAllowedModulesByRole(user?.nombreRol);
  const modules = allowedModules.map((key) => moduleCatalog[key]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="font-semibold tracking-tight">FlowManager</p>
              <p className="text-xs text-muted-foreground">Industrias Basan</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            Cerrar sesion
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:px-6 md:py-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-tight text-muted-foreground">
                Modulos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {modules.map((module) => {
                const Icon = module.icon;
                const active = isPathActive(pathname, module.path);

                return (
                  <Link
                    key={module.key}
                    href={module.path}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-transparent text-foreground hover:border-border hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{module.name}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Usuario: <span className="text-foreground">{user?.nombre}</span>
              <br />
              Correo: <span className="text-foreground">{user?.correo}</span>
              <br />
              Rol: <span className="text-foreground">{user?.nombreRol ?? "Sin rol asignado"}</span>
              {RBAC_PREVIEW_MODE ? (
                <>
                  <br />
                  <span className="inline-flex rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Modo vista previa: permisos del sidebar deshabilitados
                  </span>
                </>
              ) : null}
            </CardContent>
          </Card>

          {children}

          <Card className="border-border/70 shadow-sm lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-tight text-muted-foreground">
                Modulos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;
                const active = isPathActive(pathname, module.path);

                return (
                  <Link
                    key={`mobile-${module.key}`}
                    href={module.path}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="truncate">{module.name}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </main>
      </div>

      <footer className="border-t border-border/70 bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>FlowManager · Plataforma Operativa</p>
          <p>Industrias Basan · Gestion de planta purificadora</p>
        </div>
      </footer>
    </div>
  );
}
