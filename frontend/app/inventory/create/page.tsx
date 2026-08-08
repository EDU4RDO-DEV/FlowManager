"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ProductFormCard,
  type ProductFormValues,
} from "@/app/inventory/_components/product-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { createProduct, uploadProductImage } from "@/services/products.service";
import { listProviders } from "@/services/providers.service";
import type { ProviderDto } from "@/types/providers";

const EMPTY_FORM: ProductFormValues = {
  nombre: "",
  categoria: "PRODUCTO_TERMINADO",
  idProveedor: "",
  costoPromedio: "",
  precioVenta: "",
  esProductoFinal: true,
  rutaImagen: "",
};

export default function CreateProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadProviders() {
      setLoadingProviders(true);
      try {
        const data = await listProviders();
        setProviders(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar la lista de proveedores."));
      } finally {
        setLoadingProviders(false);
      }
    }

    void loadProviders();
  }, []);

  async function handleSubmit() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombre.trim()) {
      toast.error("El nombre del producto es obligatorio.");
      return;
    }

    const idProveedor = Number(form.idProveedor);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      toast.error("Debes seleccionar un proveedor valido.");
      return;
    }

    const costoPromedio = Number(form.costoPromedio);
    const precioVenta = Number(form.precioVenta);

    if (!Number.isFinite(costoPromedio) || costoPromedio <= 0) {
      toast.error("El costo promedio debe ser mayor a 0.");
      return;
    }

    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      toast.error("El precio de venta debe ser mayor a 0.");
      return;
    }

    if (precioVenta < costoPromedio) {
      toast.error("El precio de venta no puede ser menor al costo promedio.");
      return;
    }

    setSaving(true);
    try {
      await createProduct({
        idUsuario: user.id,
        idProveedor,
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        costoPromedio,
        precioVenta,
        esProductoFinal: form.esProductoFinal,
        rutaImagen: form.rutaImagen.trim() || undefined,
      });

      toast.success("Producto creado correctamente.");
      router.push("/inventory");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el producto."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    try {
      const uploaded = await uploadProductImage(file);
      setForm((prev) => ({ ...prev, rutaImagen: uploaded.rutaImagen }));
      toast.success("Imagen subida correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir la imagen."));
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <RequireAuth>
      <DashboardShell
        title="Crear Producto"
        description="Submodulo para registrar productos, costos y precios de venta."
      >
        <div className="w-full">
          {loadingProviders ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando proveedores...
            </p>
          ) : (
            <ProductFormCard
              title="Nuevo producto"
              form={form}
              providers={providers}
              saving={saving}
              uploadingImage={uploadingImage}
              onChange={setForm}
              onUploadImage={handleUploadImage}
              onCancel={() => router.push("/inventory")}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
