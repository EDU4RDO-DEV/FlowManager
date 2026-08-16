"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ProviderFormCard,
  type ProviderFormValues,
} from "@/app/providers/_components/provider-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { createProvider, uploadProviderImage } from "@/services/providers.service";

const EMPTY_FORM: ProviderFormValues = {
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  rutaImagen: "",
  nit: "",
  dpi: "",
};

export default function CreateProviderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit() {
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
      await createProvider({
        idUsuario: user.id,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          rutaImagen: form.rutaImagen.trim() || undefined,
          nit: form.nit.trim() || undefined,
          dpi: form.dpi.trim() || undefined,
        },
      });

      toast.success("Proveedor creado correctamente.");
      router.push("/providers");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el proveedor."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Crear Proveedor"
        description="Submodulo para registrar proveedores y contactos de abastecimiento."
      >
        <div className="w-full">
          <ProviderFormCard
            title="Nuevo proveedor"
            form={form}
            saving={saving}
            uploadingImage={uploadingImage}
            onChange={setForm}
            onUploadImage={handleUploadImage}
            onCancel={() => router.push("/providers")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
