"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ClientFormCard,
  type ClientFormValues,
} from "@/app/clients/_components/client-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { getClientById, updateClient, uploadClientImage } from "@/services/clients.service";

const EMPTY_FORM: ClientFormValues = {
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  telefono2: "",
  rutaImagen: "",
  nit: "",
  dpi: "",
};

export default function EditClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function loadData() {
      const clientId = Number(params.id);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        toast.error("ID de cliente invalido.");
        router.push("/clients");
        return;
      }

      setLoading(true);
      try {
        const clientData = await getClientById(clientId);
        setForm({
          nombreCompleto: clientData.entidad.nombreCompleto,
          correoElectronico: clientData.entidad.correoElectronico ?? "",
          telefono1: clientData.entidad.telefono1 ?? "",
          telefono2: clientData.entidad.telefono2 ?? "",
          rutaImagen: clientData.entidad.rutaImagen ?? "",
          nit: clientData.entidad.nit ?? "",
          dpi: clientData.entidad.dpi ?? "",
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el cliente."));
        router.push("/clients");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const clientId = Number(params.id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      toast.error("ID de cliente invalido.");
      return;
    }

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
      await updateClient(clientId, {
        idUsuarioModificador: user.id,
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

      toast.success("Cliente actualizado correctamente.");
      router.push("/clients");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el cliente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="clientes" action="update">
      <DashboardShell
        title="Editar Cliente"
        description="Submodulo para actualizar datos de cartera y contacto."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del cliente...
            </p>
          ) : (
            <ClientFormCard
              title={`Editar cliente #${params.id}`}
              form={form}
              saving={saving}
              uploadingImage={uploadingImage}
              onChange={setForm}
              onUploadImage={handleUploadImage}
              onCancel={() => router.push("/clients")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
