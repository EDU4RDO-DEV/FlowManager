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
import { createProvider } from "@/services/providers.service";

const EMPTY_FORM: ProviderFormValues = {
  nombre: "",
  nombreCompleto: "",
  correoElectronico: "",
  telefono1: "",
  nit: "",
  dpi: "",
};

export default function CreateProviderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProviderFormValues>(EMPTY_FORM);

  async function handleSubmit() {
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
      await createProvider({
        idUsuario: user.id,
        nombre: form.nombre.trim(),
        entidad: {
          nombreCompleto: form.nombreCompleto.trim(),
          correoElectronico: form.correoElectronico.trim() || undefined,
          telefono1: form.telefono1.trim() || undefined,
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
            onChange={setForm}
            onCancel={() => router.push("/providers")}
            onSubmit={handleSubmit}
          />
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
