import { prisma } from '../../config/prisma';

type LogReportGenerationInput = {
  idUsuario: number;
  claveReporte: string;
  categoria: string;
  nombreReporte: string;
  parametros: Record<string, unknown>;
  totalRegistros: number;
  formatoExportado?: 'PDF' | 'EXCEL' | null;
};

// Auditoría del módulo de reportes (sección 16/17 del requerimiento): registra quién
// generó/exportó cada reporte, cuándo y con qué parámetros. No bloquea la respuesta del
// reporte si la escritura de auditoría falla; solo se registra el error.
export async function logReportGeneration(input: LogReportGenerationInput): Promise<void> {
  try {
    await prisma.reporteHistorial.create({
      data: {
        IdUsuario: input.idUsuario,
        ClaveReporte: input.claveReporte,
        Categoria: input.categoria,
        NombreReporte: input.nombreReporte,
        Parametros: JSON.stringify(input.parametros ?? {}),
        TotalRegistros: input.totalRegistros,
        FormatoExportado: input.formatoExportado ?? null,
      },
    });
  } catch (error) {
    console.error('No se pudo registrar el historial de reportes', error);
  }
}

export async function listReportHistory(params: { idUsuario?: number; claveReporte?: string; page?: number; limit?: number }) {
  const page = params.page ?? 1;
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const skip = (page - 1) * limit;

  const where = {
    ...(params.idUsuario ? { IdUsuario: params.idUsuario } : {}),
    ...(params.claveReporte ? { ClaveReporte: params.claveReporte } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.reporteHistorial.count({ where }),
    prisma.reporteHistorial.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: {
        Usuario: { select: { Id: true, Nombre: true, Correo: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.Id,
      claveReporte: row.ClaveReporte,
      categoria: row.Categoria,
      nombreReporte: row.NombreReporte,
      parametros: row.Parametros ? JSON.parse(row.Parametros) : {},
      totalRegistros: row.TotalRegistros,
      formatoExportado: row.FormatoExportado,
      fechaGeneracion: row.FechaGeneracion,
      usuario: row.Usuario ? { id: row.Usuario.Id, nombre: row.Usuario.Nombre, correo: row.Usuario.Correo } : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
