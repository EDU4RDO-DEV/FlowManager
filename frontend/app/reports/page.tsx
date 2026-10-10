"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  FileBarChart,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  PackageOpen,
  RefreshCw,
  Receipt,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { getApiErrorMessage } from "@/lib/api";
import { hasModulePermission } from "@/lib/rbac";
import {
  getReportCompanySettings,
  getReportsCatalog,
  uploadReportCompanyLogo,
} from "@/services/reports.service";
import type {
  ReportCatalogEntry,
  ReportCategorySummary,
  ReportCompanySettings,
} from "@/types/reports";

import { ReportsEmptyState } from "./_components/reports-empty-state";
import { ReportCategoriesSkeleton, ReportListSkeleton } from "./_components/reports-skeletons";

const CATEGORY_ICONS: Record<string, typeof ShoppingCart> = {
  ventas: ShoppingCart,
  clientes: Users,
  creditos: CreditCard,
  facturacion: Receipt,
  envases: PackageOpen,
};

function getCategoryIcon(categoria: string) {
  return CATEGORY_ICONS[categoria] ?? FileSpreadsheet;
}

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function detectImageMimeFromBytes(bytes: Uint8Array): string | null {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return "image/png";

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return "image/jpeg";

  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (isWebp) return "image/webp";

  return null;
}

function resolveImagePreviewUrl(rutaLogo: string | null | undefined): string {
  if (!rutaLogo) return "";

  if (rutaLogo.startsWith("http://") || rutaLogo.startsWith("https://")) {
    return rutaLogo;
  }

  const configuredBase = process.env.NEXT_PUBLIC_API_URL;
  if (configuredBase) {
    return `${configuredBase}${rutaLogo}`;
  }

  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000${rutaLogo}`;
  }

  return rutaLogo;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const canUpdateCompanyLogo = hasModulePermission(user, "reportes", "update");
  const [categorias, setCategorias] = useState<ReportCategorySummary[]>([]);
  const [reportes, setReportes] = useState<ReportCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogoLoading, setIsLogoLoading] = useState(true);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [companySettings, setCompanySettings] = useState<ReportCompanySettings | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);

  async function loadCatalog() {
    setIsLoading(true);
    try {
      const data = await getReportsCatalog();
      setCategorias(data.categorias);
      setReportes(data.reportes);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el catálogo de reportes."));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCompanySettings() {
    setIsLogoLoading(true);
    try {
      const data = await getReportCompanySettings();
      setCompanySettings(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar el logotipo empresarial."));
    } finally {
      setIsLogoLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
    void loadCompanySettings();
  }, []);

  useEffect(() => {
    return () => {
      if (selectedLogoPreview) {
        URL.revokeObjectURL(selectedLogoPreview);
      }
    };
  }, [selectedLogoPreview]);

  async function handleSelectLogo(file: File) {
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("La imagen excede el tamaño máximo de 5MB.");
      return;
    }

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
      toast.error("Solo se permiten imágenes PNG, JPG o WEBP.");
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detectedMime = detectImageMimeFromBytes(bytes);

    if (!detectedMime || !ALLOWED_LOGO_MIME_TYPES.has(detectedMime)) {
      toast.error("El archivo no contiene una imagen válida.");
      return;
    }

    if (selectedLogoPreview) {
      URL.revokeObjectURL(selectedLogoPreview);
    }

    setSelectedLogoFile(file);
    setSelectedLogoPreview(URL.createObjectURL(file));
  }

  async function handleSaveLogo() {
    if (!selectedLogoFile) {
      toast.error("Selecciona una imagen antes de guardar.");
      return;
    }

    if (!canUpdateCompanyLogo) {
      toast.error("No tienes permisos para actualizar el logotipo.");
      return;
    }

    setIsSavingLogo(true);
    try {
      const updated = await uploadReportCompanyLogo(selectedLogoFile);
      setCompanySettings(updated);
      setSelectedLogoFile(null);
      if (selectedLogoPreview) {
        URL.revokeObjectURL(selectedLogoPreview);
      }
      setSelectedLogoPreview(null);
      toast.success("Logotipo actualizado correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el logotipo."));
    } finally {
      setIsSavingLogo(false);
    }
  }

  const filteredReportes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reportes.filter((report) => {
      if (selectedCategoria && report.categoria !== selectedCategoria) return false;
      if (normalizedQuery.length === 0) return true;
      return (
        report.nombre.toLowerCase().includes(normalizedQuery) ||
        report.descripcion.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [reportes, query, selectedCategoria]);

  return (
    <RequireAuth moduleKey="reportes" action="read">
      <DashboardShell
        title="Reportes"
        description="Centro de reportería: selecciona una categoría, configura los parámetros y genera información lista para decidir."
      >
        <div className="flex flex-col gap-6">
          <Card className="rounded-xl border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Logotipo de la empresa</h2>
                <p className="text-xs text-muted-foreground">
                  Este logotipo se usa automáticamente en la cabecera de los reportes PDF.
                </p>
              </div>

              {isLogoLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando configuración empresarial...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-background">
                    {selectedLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedLogoPreview} alt="Vista previa del logotipo" className="h-full w-full object-contain" />
                    ) : companySettings?.rutaLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImagePreviewUrl(companySettings.rutaLogo)}
                        alt="Logotipo de la empresa"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="size-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {selectedLogoFile
                        ? `Vista previa: ${selectedLogoFile.name}`
                        : companySettings?.rutaLogo
                          ? "Logotipo guardado en la empresa"
                          : "Aún no hay un logotipo cargado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos permitidos: PNG, JPG y WEBP. Tamaño máximo: 5MB.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <Label
                        htmlFor="company-logo-upload"
                        className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/60"
                      >
                        <RefreshCw className="size-4" />
                        {companySettings?.rutaLogo || selectedLogoFile ? "Reemplazar imagen" : "Seleccionar imagen"}
                      </Label>
                      <Input
                        id="company-logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isSavingLogo || !canUpdateCompanyLogo}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          await handleSelectLogo(file);
                          event.target.value = "";
                        }}
                      />
                      <Button
                        onClick={() => void handleSaveLogo()}
                        disabled={!selectedLogoFile || isSavingLogo || !canUpdateCompanyLogo}
                      >
                        {isSavingLogo ? <Loader2 className="size-4 animate-spin" /> : null}
                        Guardar logo
                      </Button>
                    </div>
                    {!canUpdateCompanyLogo ? (
                      <p className="text-xs text-muted-foreground">
                        Tu rol tiene acceso de lectura a reportes, pero no permisos para actualizar el logotipo.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar reporte..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>

          {isLoading ? (
            <ReportCategoriesSkeleton />
          ) : categorias.length === 0 ? (
            <ReportsEmptyState message="Aún no hay reportes configurados." onReload={() => void loadCatalog()} />
          ) : (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categorias.map((categoria) => {
                const Icon = getCategoryIcon(categoria.categoria);
                const isActive = selectedCategoria === categoria.categoria;
                return (
                  <button
                    key={categoria.categoria}
                    type="button"
                    onClick={() => setSelectedCategoria(isActive ? null : categoria.categoria)}
                    className="text-left"
                  >
                    <Card
                      className={`rounded-xl border bg-background transition-colors hover:border-sky-400 ${
                        isActive ? "border-sky-500 ring-2 ring-sky-200 dark:ring-sky-900" : "border-border"
                      }`}
                    >
                      <CardContent className="flex flex-col gap-2 p-4">
                        <span className="w-fit rounded-lg bg-sky-100 p-2 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          <Icon className="size-5" />
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {categoria.categoriaLabel}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {categoria.totalReportes} {categoria.totalReportes === 1 ? "reporte" : "reportes"}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </section>
          )}

          {isLoading ? (
            <ReportListSkeleton />
          ) : filteredReportes.length === 0 ? (
            <ReportsEmptyState onReload={() => void loadCatalog()} />
          ) : (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredReportes.map((report) => (
                <Link key={report.id} href={`/reports/${report.categoria}/${report.id}`}>
                  <Card className="h-full rounded-xl border border-border bg-background transition-colors hover:border-sky-400">
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="flex items-center gap-2">
                        <FileBarChart className="size-4 text-sky-600 dark:text-sky-300" />
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {report.nombre}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground">{report.descripcion}</p>
                      <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {report.categoriaLabel}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </section>
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
