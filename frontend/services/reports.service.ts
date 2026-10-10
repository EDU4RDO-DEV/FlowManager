import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  ReportCatalogEntry,
  ReportCatalogResponse,
  ReportResult,
} from "@/types/reports";

export async function getReportsCatalog(): Promise<ReportCatalogResponse> {
  const { data } = await api.get<ApiResponse<ReportCatalogResponse>>("/api/reports/catalog");
  return data.data ?? { categorias: [], reportes: [] };
}

export async function getReportsByCategory(categoria: string): Promise<ReportCatalogEntry[]> {
  const { data } = await api.get<ApiResponse<ReportCatalogEntry[]>>(`/api/reports/catalog/${categoria}`);
  return data.data ?? [];
}

export async function executeReport(
  id: string,
  params: Record<string, unknown>,
): Promise<ReportResult> {
  const { data } = await api.post<ApiResponse<ReportResult>>(`/api/reports/${id}/execute`, { params });
  if (!data.data) {
    throw new Error(data.message || "Respuesta inválida al generar el reporte");
  }
  return data.data;
}

function extractFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename="?([^"]+)"?/.exec(contentDisposition);
  return match?.[1] ?? fallback;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadReportPdf(id: string, params: Record<string, unknown>): Promise<void> {
  try {
    const response = await api.post(`/api/reports/${id}/export/pdf`, { params }, { responseType: "blob" });
    downloadBlob(response.data as Blob, extractFilename(response.headers["content-disposition"], `${id}.pdf`));
  } catch (error) {
    throw await toReadableBlobError(error);
  }
}

export async function downloadReportExcel(id: string, params: Record<string, unknown>): Promise<void> {
  try {
    const response = await api.post(`/api/reports/${id}/export/excel`, { params }, { responseType: "blob" });
    downloadBlob(response.data as Blob, extractFilename(response.headers["content-disposition"], `${id}.xlsx`));
  } catch (error) {
    throw await toReadableBlobError(error);
  }
}

// Cuando la exportación falla, el backend responde JSON pero axios ya pidió `blob`;
// esta función recupera el mensaje legible desde ese Blob en vez de "[object Blob]".
async function toReadableBlobError(error: unknown): Promise<Error> {
  const maybeBlob = (error as { response?: { data?: unknown } })?.response?.data;
  if (maybeBlob instanceof Blob) {
    try {
      const text = await maybeBlob.text();
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) {
        return new Error(parsed.message);
      }
    } catch {
      // Ignorar: el blob no contenía JSON legible.
    }
  }
  return error instanceof Error ? error : new Error("No se pudo generar el archivo del reporte");
}
