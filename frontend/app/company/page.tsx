"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import {
  DEFAULT_REPORTS_ACCENT,
  isReportsAccentKey,
  REPORTS_ACCENT_OPTIONS,
  reportsAccentStorageKey,
  type ReportsAccentKey,
} from "@/lib/reports-accent";
import { hasModulePermission } from "@/lib/rbac";
import { getCompanySettings, updateCompanySettings, uploadCompanyLogo } from "@/services/company.service";
import type { CompanySettings, UpdateCompanySettings } from "@/types/company";
import { useAuth } from "@/components/auth-provider";

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

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const canUpdateCompany = hasModulePermission(user, "empresa", "update");

  const [isCompanyLoading, setIsCompanyLoading] = useState(true);
  const [companyLoadFailed, setCompanyLoadFailed] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(null);
  const [accent, setAccent] = useState<ReportsAccentKey>(DEFAULT_REPORTS_ACCENT);

  async function loadCompanySettings() {
    setIsCompanyLoading(true);
    setCompanyLoadFailed(false);
    try {
      const data = await getCompanySettings();
      setCompanySettings(data);
    } catch (error) {
      setCompanyLoadFailed(true);
      toast.error(getApiErrorMessage(error, "No se pudo cargar la configuración empresarial."));
    } finally {
      setIsCompanyLoading(false);
    }
  }

  useEffect(() => {
    void loadCompanySettings();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const stored = window.localStorage.getItem(reportsAccentStorageKey(user.id));
    if (stored && isReportsAccentKey(stored)) {
      setAccent(stored);
    }
  }, [user?.id]);

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

    if (!canUpdateCompany) {
      toast.error("No tienes permisos para actualizar el logotipo.");
      return;
    }

    setIsSavingLogo(true);
    try {
      const updated = await uploadCompanyLogo(selectedLogoFile);
      setCompanySettings((current) => (current ? { ...current, rutaLogo: updated.rutaLogo } : updated));
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

  function updateCompanyField<Key extends keyof UpdateCompanySettings>(
    key: Key,
    value: UpdateCompanySettings[Key],
  ) {
    setCompanySettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSaveCompanySettings() {
    if (!companySettings) return;
    if (!canUpdateCompany) {
      toast.error("No tienes permisos para actualizar la configuración empresarial.");
      return;
    }

    const settings: UpdateCompanySettings = {
      nit: companySettings.nit,
      nombre: companySettings.nombre,
      nombreComercial: companySettings.nombreComercial,
      direccion: companySettings.direccion,
      telefono1: companySettings.telefono1,
      telefono2: companySettings.telefono2,
      correoElectronico: companySettings.correoElectronico,
      frase: companySettings.frase,
      fechaInicioFel: companySettings.fechaInicioFel,
      fechaFinFel: companySettings.fechaFinFel,
      regimenIsr: companySettings.regimenIsr,
    };

    setIsSavingCompany(true);
    try {
      setCompanySettings(await updateCompanySettings(settings));
      toast.success("Datos de la empresa actualizados correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la configuración empresarial."));
    } finally {
      setIsSavingCompany(false);
    }
  }

  function updateAccent(nextAccent: ReportsAccentKey) {
    setAccent(nextAccent);
    if (user?.id) {
      window.localStorage.setItem(reportsAccentStorageKey(user.id), nextAccent);
    }
    toast.success("Preferencia de color guardada.");
  }

  return (
    <RequireAuth moduleKey="empresa" action="read">
      <DashboardShell
        title="Configuración de empresa"
        description="Administra los datos institucionales, el logotipo y las preferencias visuales de reportes."
      >
        <div className="flex max-w-4xl flex-col gap-5">
          <Card className="rounded-xl border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Datos de la empresa</h2>
                <p className="text-xs text-muted-foreground">
                  Estos datos se utilizan en la administración y en los documentos del sistema.
                </p>
              </div>

              {isCompanyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando configuración empresarial...
                </div>
              ) : companyLoadFailed || !companySettings ? (
                <div className="space-y-3 text-sm">
                  <p className="text-destructive">No se pudo cargar la configuración de la empresa.</p>
                  <Button variant="outline" onClick={() => void loadCompanySettings()}>
                    Reintentar
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-nit">NIT</Label>
                    <Input id="company-nit" value={companySettings.nit} maxLength={20} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("nit", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-legal-name">Razón social</Label>
                    <Input id="company-legal-name" value={companySettings.nombre} maxLength={255} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("nombre", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-trade-name">Nombre comercial</Label>
                    <Input id="company-trade-name" value={companySettings.nombreComercial} maxLength={255} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("nombreComercial", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-regime">Régimen ISR</Label>
                    <Input id="company-regime" value={companySettings.regimenIsr} maxLength={255} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("regimenIsr", event.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-address">Dirección</Label>
                    <Input id="company-address" value={companySettings.direccion} maxLength={255} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("direccion", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone1">Teléfono principal</Label>
                    <Input id="company-phone1" value={companySettings.telefono1 ?? ""} maxLength={20} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("telefono1", event.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone2">Teléfono secundario</Label>
                    <Input id="company-phone2" value={companySettings.telefono2 ?? ""} maxLength={20} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("telefono2", event.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Correo electrónico</Label>
                    <Input id="company-email" type="email" value={companySettings.correoElectronico ?? ""} maxLength={100} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("correoElectronico", event.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phrase">Frase institucional</Label>
                    <Input id="company-phrase" value={companySettings.frase} maxLength={255} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("frase", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-fel-start">Inicio de vigencia FEL</Label>
                    <Input id="company-fel-start" type="date" value={companySettings.fechaInicioFel ?? ""} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("fechaInicioFel", event.target.value || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-fel-end">Fin de vigencia FEL</Label>
                    <Input id="company-fel-end" type="date" value={companySettings.fechaFinFel ?? ""} disabled={!canUpdateCompany} onChange={(event) => updateCompanyField("fechaFinFel", event.target.value || null)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                    <Button onClick={() => void handleSaveCompanySettings()} disabled={isSavingCompany || !canUpdateCompany}>
                      {isSavingCompany ? <Loader2 className="size-4 animate-spin" /> : null}
                      Guardar datos de la empresa
                    </Button>
                    {!canUpdateCompany ? (
                      <p className="text-xs text-muted-foreground">
                        Tu rol puede visualizar estos datos, pero no tiene permiso para modificarlos.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Logotipo de la empresa</h2>
                <p className="text-xs text-muted-foreground">
                  Este logotipo se usa automáticamente en la cabecera de los reportes PDF.
                </p>
              </div>

              {isCompanyLoading ? (
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
                        disabled={isSavingLogo || !canUpdateCompany}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          await handleSelectLogo(file);
                          event.target.value = "";
                        }}
                      />
                      <Button
                        onClick={() => void handleSaveLogo()}
                        disabled={!selectedLogoFile || isSavingLogo || !canUpdateCompany}
                      >
                        {isSavingLogo ? <Loader2 className="size-4 animate-spin" /> : null}
                        Guardar logo
                      </Button>
                    </div>
                    {!canUpdateCompany ? (
                      <p className="text-xs text-muted-foreground">
                        Tu rol puede visualizar este apartado, pero no tiene permisos para actualizar el logotipo.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-background">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Preferencia visual de reportes</h2>
                <p className="text-xs text-muted-foreground">
                  Esta preferencia aplica por usuario y se conserva entre sesiones en este navegador.
                </p>
              </div>

              <div className="grid gap-2 sm:max-w-sm">
                <Label htmlFor="accent-preference">Color de acento del módulo de reportes</Label>
                <Select value={accent} onValueChange={(value) => updateAccent(value as ReportsAccentKey)}>
                  <SelectTrigger id="accent-preference">
                    <SelectValue placeholder="Seleccionar color" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORTS_ACCENT_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
