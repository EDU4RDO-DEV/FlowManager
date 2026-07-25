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
import { getProviderById, updateProvider } from "@/services/providers.service";

const EMPTY_FORM: ProviderFormValues = {
  nombre: "",
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  nit: "",
  dpi: "",
};

export default function EditProviderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProviderFormValues>(EMPTY_FORM);

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
          nombre: providerData.nombre,
          nombreCompleto: providerData.entidad.nombreCompleto,
          correoElectronico: providerData.entidad.correoElectronico ?? "",
          telefono1: providerData.entidad.telefono1 ?? "",
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

    if (!form.nombre.trim()) {
      toast.error("El nombre comercial es obligatorio.");
      return;
    }

    if (!form.nombreCompleto.trim()) {
      toast.error("El nombre de contacto es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await updateProvider(providerId, {
        nombre: form.nombre.trim(),
        idUsuarioModificador: user.id,
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
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
              onChange={setForm}
              onCancel={() => router.push("/providers")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
