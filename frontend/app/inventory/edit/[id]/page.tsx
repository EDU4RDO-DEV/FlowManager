"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ProductFormCard,
  type ProductFormValues,
} from "@/app/inventory/_components/product-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import { getProductById, updateProduct, uploadProductImage } from "@/services/products.service";
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

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);

  useEffect(() => {
    async function loadData() {
      const productId = Number(params.id);
      if (!Number.isInteger(productId) || productId <= 0) {
        toast.error("ID de producto invalido.");
        router.push("/inventory");
        return;
      }

      setLoading(true);
      try {
        const [productData, providerData] = await Promise.all([
          getProductById(productId),
          listProviders(),
        ]);

        setProviders(providerData);
        setForm({
          nombre: productData.nombre,
          categoria: productData.categoria,
          idProveedor: String(productData.idProveedor),
          costoPromedio: String(productData.costoPromedio),
          precioVenta: String(productData.precioVenta),
          esProductoFinal: productData.esProductoFinal,
          rutaImagen: productData.rutaImagen ?? "",
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el producto."));
        router.push("/inventory");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const productId = Number(params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      toast.error("ID de producto invalido.");
      return;
    }

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
      await updateProduct(productId, {
        idUsuarioModificador: user.id,
        idProveedor,
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        costoPromedio,
        precioVenta,
        esProductoFinal: form.esProductoFinal,
        rutaImagen: form.rutaImagen.trim() || undefined,
      });

      toast.success("Producto actualizado correctamente.");
      router.push("/inventory");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el producto."));
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
        title="Editar Producto"
        description="Submodulo para actualizar catalogo, costos y precios."
      >
        <div className="w-full">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del producto...
            </p>
          ) : (
            <ProductFormCard
              title={`Editar producto #${params.id}`}
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
