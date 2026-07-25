"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  X,
  Building2,
  BriefcaseBusiness,
  Droplet,
  Factory,
  LayoutDashboard,
  Menu,
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
import { ThemeToggle } from "@/components/theme-toggle";
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
  empleados: {
    key: "empleados",
    name: "Empleados",
    path: "/employees",
    icon: BriefcaseBusiness,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const allowedModules = getAllowedModulesByRole(user?.nombreRol);
  const modules = useMemo(
    () => allowedModules.map((key) => moduleCatalog[key]),
    [allowedModules],
  );

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}

      {userPanelOpen ? (
        <button
          type="button"
          aria-label="Cerrar panel de usuario"
          onClick={() => setUserPanelOpen(false)}
          className="fixed inset-0 z-40 bg-black/30"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-background/95 backdrop-blur-sm transition-all duration-300 lg:flex lg:flex-col ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-76 xl:w-80"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-3">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className={`leading-tight ${sidebarCollapsed ? "hidden" : "block"}`}>
              <p className="text-sm font-semibold tracking-tight">FlowManager</p>
              <p className="text-xs text-muted-foreground">Industrias Basan</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="hidden lg:inline-flex hover:bg-muted/50 transition-colors"
          >
            {sidebarCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="rounded-xl border border-border bg-background p-2">
            <p className={`mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground ${sidebarCollapsed ? "text-center" : ""}`}>
              {sidebarCollapsed ? "MOD" : "MODULOS"}
            </p>
            <nav className="space-y-1">
              {modules.map((module) => {
                const Icon = module.icon;
                const active = isPathActive(pathname, module.path);

                return (
                  <Link
                    key={module.key}
                    href={module.path}
                    className={`group flex items-center rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/50 ${
                      active
                        ? "border-sky-300/60 bg-sky-100/70 text-sky-700"
                        : "border-transparent text-foreground"
                    } ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className={`truncate ${sidebarCollapsed ? "hidden" : "block"}`}>
                      {module.name}
                    </span>
                    {!sidebarCollapsed ? (
                      <ChevronRight className="ml-auto size-3 text-muted-foreground group-hover:text-foreground" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="border-t border-border p-3">
          <p className="px-2 text-xs text-muted-foreground">
            Usa el panel de usuario en el encabezado para cerrar sesion.
          </p>
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(22rem,92vw)] border-r border-border bg-background/95 backdrop-blur-sm transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">FlowManager</p>
              <p className="text-xs text-muted-foreground">Industrias Basan</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeMobileMenu}
            className="hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <div className="h-[calc(100%-4rem)] overflow-y-auto p-4">
          <nav className="space-y-1">
            {modules.map((module) => {
              const Icon = module.icon;
              const active = isPathActive(pathname, module.path);

              return (
                <Link
                  key={`mobile-${module.key}`}
                  href={module.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 ${
                    active
                      ? "border-sky-300/60 bg-sky-100/70 text-sky-700"
                      : "border-transparent text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{module.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div
        className={`flex min-h-dvh min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-76 xl:pl-80"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-4 md:px-6 xl:px-8">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden hover:bg-muted/50 transition-colors"
            >
              <Menu className="size-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            </div>

            <button
              type="button"
              onClick={() => setUserPanelOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 transition-colors hover:bg-muted/70 sm:flex"
            >
              <CircleUserRound className="size-4 text-muted-foreground" />
              <div className="max-w-52 truncate text-right text-sm leading-tight">
                <p className="truncate font-medium text-foreground">{user?.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.nombreRol ?? "Sin rol"}</p>
              </div>
            </button>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setUserPanelOpen(true)}
              className="sm:hidden hover:bg-muted/50 transition-colors"
            >
              <CircleUserRound className="size-4" />
            </Button>

            <ThemeToggle compact />
          </div>
        </header>

        <main className="flex-1 min-w-0 w-full px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 xl:px-8">
          <section className="min-w-0">{children}</section>
        </main>

        <footer className="border-t border-border bg-background/80">
          <div className="flex h-12 w-full items-center justify-between gap-3 px-3 text-xs text-muted-foreground sm:px-4 md:px-6 xl:px-8">
            <p className="truncate">FlowManager · Plataforma Operativa</p>
            <p className="truncate text-right">Industrias Basan · Gestion de planta purificadora</p>
          </div>
        </footer>
      </div>

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[min(26rem,95vw)] border-l border-border bg-background shadow-xl transition-transform duration-300 ${
          userPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <CircleUserRound className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold tracking-tight">Sesion de usuario</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setUserPanelOpen(false)}
            className="hover:bg-muted/50 transition-colors"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <Card className="rounded-xl border border-border bg-background">
            <CardContent className="space-y-3 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuario</p>
                <p className="font-medium text-foreground">{user?.nombre ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Correo</p>
                <p className="break-all text-foreground">{user?.correo ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rol</p>
                <p className="text-foreground">{user?.nombreRol ?? "Sin rol asignado"}</p>
              </div>
              <div>
                {RBAC_PREVIEW_MODE ? (
                  <span className="inline-flex rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Modo vista previa activo
                  </span>
                ) : (
                  <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Permisos RBAC activos
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            onClick={logout}
            className="w-full justify-start hover:bg-muted/50 transition-colors"
          >
            <LogOut className="size-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>
    </div>
  );
}
