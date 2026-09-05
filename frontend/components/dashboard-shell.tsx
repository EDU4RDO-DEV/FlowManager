"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  X,
  Building2,
  BriefcaseBusiness,
  Car,
  CreditCard,
  Droplet,
  FileSpreadsheet,
  FileText,
  Fuel,
  LayoutDashboard,
  Menu,
  LogOut,
  PackageSearch,
  Receipt,
  ReceiptText,
  Route,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import {
  getAllowedModulesByRole,
  RBAC_PREVIEW_MODE,
} from "@/lib/rbac";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DashboardShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

type SidebarLinkItem = {
  id: string;
  name: string;
  path?: string;
  icon: typeof LayoutDashboard;
  available: boolean;
  isActive?: (currentPath: string) => boolean;
};

type SidebarEntry =
  | {
      type: "link";
      item: SidebarLinkItem;
    }
  | {
      type: "group";
      id: string;
      name: string;
      icon: typeof LayoutDashboard;
      children: SidebarLinkItem[];
    };

type SidebarSection = {
  id: string;
  title: string;
  items: SidebarEntry[];
};

function isPathActive(currentPath: string, modulePath: string): boolean {
  if (modulePath === "/") {
    return currentPath === "/";
  }

  return currentPath === modulePath || currentPath.startsWith(`${modulePath}/`);
}

function isInventoryStructureActive(currentPath: string): boolean {
  return currentPath === "/inventory/structure" || /^\/inventory\/\d+\/structure(?:\/|$)/.test(currentPath);
}

export function DashboardShell({ title, description, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    ventas: false,
    logistica: false,
    inventario: false,
    compras: false,
    rrhh: false,
    configuracion: false,
  });
  const allowedModules = getAllowedModulesByRole(user);
  const sections = useMemo<SidebarSection[]>(
    () => {
      const has = {
        resumen: allowedModules.includes("resumen"),
        sesiones: allowedModules.includes("sesiones"),
        clientes: allowedModules.includes("clientes"),
        logistica: allowedModules.includes("logistica"),
        inventario: allowedModules.includes("inventario"),
        proveedores: allowedModules.includes("proveedores"),
        compras: allowedModules.includes("compras"),
        empleados: allowedModules.includes("empleados"),
        planilla: allowedModules.includes("planilla"),
        usuarios: allowedModules.includes("usuarios"),
        roles: allowedModules.includes("roles"),
      };

      return [
        {
          id: "inicio",
          title: "INICIO",
          items: [
            {
              type: "link",
              item: {
                id: "dashboard",
                name: "Inicio / Dashboard",
                path: "/",
                icon: BarChart3,
                available: has.resumen,
                isActive: (currentPath: string) => currentPath === "/",
              },
            },
          ],
        },
        {
          id: "operaciones-ventas",
          title: "OPERACIONES Y VENTAS",
          items: [
            {
              type: "group",
              id: "ventas",
              name: "Ventas",
              icon: ShoppingCart,
              children: [
                {
                  id: "ventas-pagos",
                  name: "Pagos y Abonos",
                  icon: Wallet,
                  available: false,
                },
                {
                  id: "ventas-facturacion",
                  name: "Talonarios / Facturación",
                  icon: Receipt,
                  available: false,
                },
              ],
            },
            {
              type: "group",
              id: "logistica",
              name: "Logística y Flota",
              icon: Truck,
              children: [
                {
                  id: "logistica-rutas",
                  name: "Rutas y Distribución",
                  path: "/logistics/routes",
                  icon: Route,
                  available: has.logistica,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/logistics/routes"),
                },
                {
                  id: "logistica-vehiculos",
                  name: "Vehículos",
                  path: "/logistics/vehicles",
                  icon: Car,
                  available: has.logistica,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/logistics/vehicles"),
                },
                {
                  id: "logistica-gastos",
                  name: "Gastos de Vehículo",
                  path: "/logistics/expenses",
                  icon: Fuel,
                  available: has.logistica,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/logistics/expenses"),
                },
              ],
            },
            {
              type: "link",
              item: {
                id: "clientes",
                name: "Clientes",
                path: "/clients",
                icon: Building2,
                available: has.clientes,
                isActive: (currentPath: string) => isPathActive(currentPath, "/clients"),
              },
            },
          ],
        },
        {
          id: "inventario-compras",
          title: "INVENTARIO Y COMPRAS",
          items: [
            {
              type: "group",
              id: "inventario",
              name: "Inventario",
              icon: PackageSearch,
              children: [
                {
                  id: "inventario-catalogo",
                  name: "Catálogo de Productos",
                  path: "/inventory",
                  icon: Boxes,
                  available: has.inventario,
                  isActive: (currentPath: string) =>
                    currentPath === "/inventory" ||
                    currentPath.startsWith("/inventory/create") ||
                    currentPath.startsWith("/inventory/edit"),
                },
                {
                  id: "inventario-bom",
                  name: "Recetas",
                  path: "/inventory/structure",
                  icon: BookOpenText,
                  available: has.inventario,
                  isActive: (currentPath: string) => isInventoryStructureActive(currentPath),
                },
                {
                  id: "inventario-ajustes",
                  name: "Ajuste de Inventario",
                  path: "/inventory/adjustments",
                  icon: SlidersHorizontal,
                  available: has.inventario,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/inventory/adjustments"),
                },
                {
                  id: "inventario-kardex",
                  name: "Bitácora",
                  path: "/inventory/kardex",
                  icon: FileText,
                  available: has.inventario,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/inventory/kardex"),
                },
              ],
            },
            {
              type: "group",
              id: "compras",
              name: "Compras",
              icon: ShoppingBag,
              children: [
                {
                  id: "compras-registro",
                  name: "Registro de Compras",
                  path: "/purchases",
                  icon: ReceiptText,
                  available: has.compras,
                  isActive: (currentPath: string) => currentPath === "/purchases",
                },
                {
                  id: "compras-gastos",
                  name: "Gastos",
                  path: "/purchases/gastos",
                  icon: Wrench,
                  available: has.compras,
                  isActive: (currentPath: string) =>
                    isPathActive(currentPath, "/purchases/gastos"),
                },
                {
                  id: "compras-proveedores",
                  name: "Proveedores",
                  path: "/providers",
                  icon: Truck,
                  available: has.proveedores,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/providers"),
                },
              ],
            },
          ],
        },
        {
          id: "administracion-rrhh",
          title: "ADMINISTRACIÓN Y RRHH",
          items: [
            {
              type: "group",
              id: "rrhh",
              name: "Empleados y Planilla",
              icon: BriefcaseBusiness,
              children: [
                {
                  id: "rrhh-empleados",
                  name: "Gestión de Empleados",
                  path: "/employees",
                  icon: Users,
                  available: has.empleados,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/employees"),
                },
                {
                  id: "rrhh-planilla",
                  name: "Planilla Mensual",
                  path: "/payroll",
                  icon: FileSpreadsheet,
                  available: has.planilla,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/payroll"),
                },
                {
                  id: "rrhh-comisiones",
                  name: "Configuración de Comisiones",
                  path: "/commissions",
                  icon: SlidersHorizontal,
                  available: has.planilla,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/commissions"),
                },
              ],
            },
          ],
        },
        {
          id: "analisis-sistema",
          title: "ANÁLISIS Y SISTEMA",
          items: [
            {
              type: "link",
              item: {
                id: "reportes",
                name: "Reportes y Analítica",
                icon: BarChart3,
                available: false,
              },
            },
            {
              type: "group",
              id: "configuracion",
              name: "Administración",
              icon: ShieldCheck,
              children: [
                {
                  id: "config-usuarios",
                  name: "Usuarios",
                  path: "/users",
                  icon: Users,
                  available: has.usuarios,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/users"),
                },
                {
                  id: "config-roles",
                  name: "Roles y Permisos",
                  path: "/roles",
                  icon: ShieldCheck,
                  available: has.roles,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/roles"),
                },
                {
                  id: "config-sesiones",
                  name: "Sesiones de Caja y Ruta",
                  path: "/sessions",
                  icon: CreditCard,
                  available: has.sesiones,
                  isActive: (currentPath: string) => isPathActive(currentPath, "/sessions"),
                },
              ],
            },
          ],
        },
      ];
    },
    [allowedModules],
  );

  const collapsedQuickLinks = useMemo(() => {
    return sections
      .flatMap((section) =>
        section.items.flatMap((entry) => {
          if (entry.type === "link") {
            return [entry.item];
          }

          return entry.children;
        }),
      )
      .filter((item) => item.available && item.path)
      .slice(0, 8);
  }, [sections]);

  const visibleSections = useMemo<SidebarSection[]>(() => {
    return sections
      .map((section) => {
        const items = section.items
          .map((entry) => {
            if (entry.type === "link") {
              if (!entry.item.path || !entry.item.available) {
                return null;
              }
              return entry;
            }

            const visibleChildren = entry.children.filter(
              (child) => Boolean(child.path) && child.available,
            );

            if (visibleChildren.length === 0) {
              return null;
            }

            return {
              ...entry,
              children: visibleChildren,
            };
          })
          .filter((item): item is SidebarEntry => item !== null);

        return {
          ...section,
          items,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [sections]);

  function isLinkActive(item: SidebarLinkItem): boolean {
    if (item.isActive) {
      return item.isActive(pathname);
    }

    if (!item.path) {
      return false;
    }

    return isPathActive(pathname, item.path);
  }

  function toggleGroup(groupId: string): void {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? true),
    }));
  }

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
        className={`fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-background transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-76 xl:w-80"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-3">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className={`leading-tight ${sidebarCollapsed ? "hidden" : "block"}`}>
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-foreground">INDUSTRIA BASÁN</p>
              <p className="text-xs text-slate-600 dark:text-muted-foreground">FLOWMANAGER</p>
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
          <div className="rounded-xl border border-border bg-background/80 p-2 dark:border-slate-800 dark:bg-slate-950/60">
            {sidebarCollapsed ? (
              <nav className="space-y-1">
                {collapsedQuickLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item);

                  return (
                    <Link
                      key={item.id}
                      href={item.path!}
                      className={`group flex justify-center rounded-lg border px-2 py-2 text-sm transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                        active
                          ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                          : "border-transparent text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                    </Link>
                  );
                })}
              </nav>
            ) : (
              <nav className="space-y-3">
                {visibleSections.map((section) => (
                  <div key={section.id} className="space-y-1.5">
                    {section.items.map((entry) => {
                      if (entry.type === "link") {
                        const item = entry.item;
                        const Icon = item.icon;
                        const active = isLinkActive(item);

                        if (!item.path) {
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm text-slate-400 dark:text-muted-foreground/70"
                            >
                              <Icon className="size-4 shrink-0" />
                              <span className="truncate">{item.name}</span>
                              <span className="ml-auto rounded border border-amber-300/60 bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                                Próx.
                              </span>
                            </div>
                          );
                        }

                        if (!item.available) {
                          return null;
                        }

                        return (
                          <Link
                            key={item.id}
                            href={item.path}
                            className={`group flex items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                              active
                                ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                                : "border-transparent text-foreground"
                            }`}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      }

                      const isOpen = expandedGroups[entry.id] ?? true;
                      const hasActiveChild = entry.children.some((child) => isLinkActive(child));
                      const GroupIcon = entry.icon;

                      return (
                        <div key={entry.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleGroup(entry.id)}
                            className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                              hasActiveChild
                                ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                                : "border-transparent text-foreground"
                            }`}
                          >
                            <GroupIcon className="size-4 shrink-0" />
                            <span className="truncate text-left">{entry.name}</span>
                            <ChevronDown
                              className={`ml-auto size-4 text-slate-500 transition-transform duration-300 ease-out dark:text-muted-foreground ${
                                isOpen ? "rotate-180" : "rotate-0"
                              }`}
                            />
                          </button>

                          <div
                            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                              isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="min-h-0 overflow-hidden">
                              <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2 dark:border-slate-800">
                              {entry.children.map((child) => {
                                const ChildIcon = child.icon;
                                const childActive = isLinkActive(child);

                                if (!child.path) {
                                  return (
                                    <div
                                      key={child.id}
                                      className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs text-slate-400 dark:text-muted-foreground/70"
                                    >
                                      <ChildIcon className="size-3.5 shrink-0" />
                                      <span className="truncate">{child.name}</span>
                                    </div>
                                  );
                                }

                                if (!child.available) {
                                  return null;
                                }

                                return (
                                  <Link
                                    key={child.id}
                                    href={child.path}
                                    className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                                      childActive
                                        ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                                        : "border-transparent text-muted-foreground"
                                    }`}
                                  >
                                    <ChildIcon className="size-3.5 shrink-0" />
                                    <span className="truncate">{child.name}</span>
                                  </Link>
                                );
                              })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </div>

        <div className="border-t border-border p-3">
          <p className="px-2 text-xs text-muted-foreground">
            Usa el panel de usuario en el encabezado para cerrar sesion.
          </p>
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(22rem,92vw)] border-r border-border bg-background transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary">
              <Droplet className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-foreground">INDUSTRIA BASÁN</p>
              <p className="text-xs text-slate-600 dark:text-muted-foreground">FLOWMANAGER</p>
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
          <nav className="space-y-3">
            {visibleSections.map((section) => (
              <div key={`mobile-section-${section.id}`} className="space-y-1.5">
                {section.items.map((entry) => {
                  if (entry.type === "link") {
                    const item = entry.item;
                    const Icon = item.icon;
                    const active = isLinkActive(item);

                    if (!item.path) {
                      return (
                        <div
                          key={`mobile-${item.id}`}
                          className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm text-slate-400 dark:text-muted-foreground/70"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                      );
                    }

                    if (!item.available) {
                      return null;
                    }

                    return (
                      <Link
                        key={`mobile-${item.id}`}
                        href={item.path}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                          active
                            ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                            : "border-transparent text-foreground"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  }

                  const GroupIcon = entry.icon;
                  const isOpen = expandedGroups[entry.id] ?? true;
                  const hasActiveChild = entry.children.some((child) => isLinkActive(child));

                  return (
                    <div key={`mobile-${entry.id}`} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(entry.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                          hasActiveChild
                            ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                            : "border-transparent text-foreground"
                        }`}
                      >
                        <GroupIcon className="size-4 shrink-0" />
                        <span className="truncate text-left">{entry.name}</span>
                        <ChevronDown
                          className={`ml-auto size-4 text-slate-500 transition-transform duration-300 ease-out dark:text-muted-foreground ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>

                      <div
                        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="ml-5 mt-1 space-y-1 border-l border-border pl-2 dark:border-slate-800">
                          {entry.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isLinkActive(child);

                            if (!child.path) {
                              return (
                                <div
                                  key={`mobile-${child.id}`}
                                  className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs text-slate-400 dark:text-muted-foreground/70"
                                >
                                  <ChildIcon className="size-3.5 shrink-0" />
                                  <span className="truncate">{child.name}</span>
                                </div>
                              );
                            }

                            if (!child.available) {
                              return null;
                            }

                            return (
                              <Link
                                key={`mobile-${child.id}`}
                                href={child.path}
                                onClick={closeMobileMenu}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-muted/60 dark:hover:bg-slate-800/60 ${
                                  childActive
                                    ? "border-border bg-muted/60 text-foreground dark:border-slate-700 dark:bg-slate-800/60 dark:text-foreground"
                                    : "border-transparent text-muted-foreground"
                                }`}
                              >
                                <ChildIcon className="size-3.5 shrink-0" />
                                <span className="truncate">{child.name}</span>
                              </Link>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div
        className={`flex min-h-dvh min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-76 xl:pl-80"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/75">
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

        <footer className="border-t border-border bg-background/80 dark:border-slate-800 dark:bg-slate-900/85">
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
