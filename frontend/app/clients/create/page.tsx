"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ClientFormCard,
  type ClientFormValues,
} from "@/app/clients/_components/client-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { createClient, uploadClientImage } from "@/services/clients.service";

const EMPTY_FORM: ClientFormValues = {
  nombreCompleto: "",
  habilitadoCredito: false,
  correoElectronico: "",
  telefono1: "",
  telefono2: "",
  rutaImagen: "",
  nit: "",
  dpi: "",
};

export default function CreateClientPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<ClientFormValues>(EMPTY_FORM);

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    try {
      const uploaded = await uploadClientImage(file);
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
      toast.error("El nombre completo es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await createClient({
        idUsuario: user.id,
        habilitadoCredito: form.habilitadoCredito,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
          telefono2: form.telefono2.trim() || undefined,
          rutaImagen: form.rutaImagen.trim() || undefined,
          nit: form.nit.trim() || undefined,
          dpi: form.dpi.trim() || undefined,
        },
      });

      toast.success("Cliente creado correctamente.");
      router.push("/clients");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el cliente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="clientes" action="create">
      <DashboardShell
        title="Crear Cliente"
        description="Submodulo para registrar clientes y su informacion principal."
      >
        <div className="w-full">
          <ClientFormCard
            title="Nuevo cliente"
            form={form}
            saving={saving}
            uploadingImage={uploadingImage}
            onChange={setForm}
            onUploadImage={handleUploadImage}
            onCancel={() => router.push("/clients")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
