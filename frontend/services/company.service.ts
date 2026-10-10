import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type { CompanySettings, UpdateCompanySettings } from "@/types/company";

export async function getCompanySettings(): Promise<CompanySettings> {
  const { data } = await api.get<ApiResponse<CompanySettings>>("/api/company/settings");
  if (!data.data) {
    throw new Error(data.message || "No se pudo cargar la configuración de la empresa");
  }
  return data.data;
}

export async function updateCompanySettings(
  settings: UpdateCompanySettings,
): Promise<CompanySettings> {
  const { data } = await api.put<ApiResponse<CompanySettings>>("/api/company/settings", settings);
  if (!data.data) {
    throw new Error(data.message || "No se pudo guardar la configuración de la empresa");
  }
  return data.data;
}

export async function uploadCompanyLogo(file: File): Promise<CompanySettings> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ApiResponse<CompanySettings>>(
    "/api/company/logo",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!data.data) {
    throw new Error(data.message || "No se pudo actualizar el logotipo");
  }

  return data.data;
}
