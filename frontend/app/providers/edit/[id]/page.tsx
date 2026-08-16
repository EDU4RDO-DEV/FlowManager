"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ProviderFormCard,
  type ProviderFormValues,
} from "@/app/providers/_components/provider-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { getProviderById, updateProvider, uploadProviderImage } from "@/services/providers.service";

const EMPTY_FORM: ProviderFormValues = {
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  rutaImagen: "",
  nit: "",
  dpi: "",
};

export default function EditProviderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<ProviderFormValues>(EMPTY_FORM);

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    try {
      const uploaded = await uploadProviderImage(file);
      setForm((prev) => ({ ...prev, rutaImagen: uploaded.rutaImagen }));
      toast.success("Imagen subida correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la imagen."));
    } finally {
      setUploadingImage(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      const providerId = Number(params.id);
      if (!Number.isInteger(providerId) || providerId <= 0) {
        toast.error("ID de proveedor invalido.");
        router.push("/providers");
        return;
      }

      setLoading(true);
      try {
        const providerData = await getProviderById(providerId);
        setForm({
          nombreCompleto: providerData.entidad.nombreCompleto,
          correoElectronico: providerData.entidad.correoElectronico ?? "",
          telefono1: providerData.entidad.telefono1 ?? "",
          rutaImagen: providerData.entidad.rutaImagen ?? "",
          nit: providerData.entidad.nit ?? "",
          dpi: providerData.entidad.dpi ?? "",
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el proveedor."));
        router.push("/providers");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const providerId = Number(params.id);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      toast.error("ID de proveedor invalido.");
      return;
    }

    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombreCompleto.trim()) {
      toast.error("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await updateProvider(providerId, {
        idUsuarioModificador: user.id,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          rutaImagen: form.rutaImagen.trim() || undefined,
          nit: form.nit.trim() || undefined,
          dpi: form.dpi.trim() || undefined,
        },
      });

      toast.success("Proveedor actualizado correctamente.");
      router.push("/providers");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el proveedor."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Editar Proveedor"
        description="Submodulo para actualizar datos comerciales y de contacto."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del proveedor...
            </p>
          ) : (
            <ProviderFormCard
              title={`Editar proveedor #${params.id}`}
              form={form}
              saving={saving}
              uploadingImage={uploadingImage}
              onChange={setForm}
              onUploadImage={handleUploadImage}
              onCancel={() => router.push("/providers")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
