import fs from 'fs';
import path from 'path';

import { prisma } from '../../../config/prisma';
import { uploadsRootPath } from '../../../utils/paths';

export type CompanyInfo = {
  nombre: string;
  nombreComercial: string;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  frase: string | null;
  logoPath: string | null;
};

// Resuelve la ruta absoluta del logo de la empresa guardado en BD (Empresa.RutaLogo,
// servido estáticamente desde /uploads). Si no existe configuración, el campo está vacío,
// o el archivo no se encuentra en disco, `logoPath` queda en null y el renderizador PDF
// dibuja un placeholder vectorial, para que un reporte NUNCA falle por falta de logo
// (sección 11 del requerimiento).
export async function resolveCompanyInfo(): Promise<CompanyInfo> {
  const empresa = await prisma.empresa.findFirst({
    where: { Anulado: false },
    orderBy: { Id: 'asc' },
    select: {
      Nombre: true,
      NombreComercial: true,
      Direccion: true,
      Telefono1: true,
      CorreoElectronico: true,
      Frase: true,
      RutaLogo: true,
    },
  });

  return {
    nombre: empresa?.Nombre ?? 'Empresa',
    nombreComercial: empresa?.NombreComercial ?? empresa?.Nombre ?? 'Empresa',
    direccion: empresa?.Direccion ?? null,
    telefono: empresa?.Telefono1 ?? null,
    correo: empresa?.CorreoElectronico ?? null,
    frase: empresa?.Frase ?? null,
    logoPath: resolveLogoAbsolutePath(empresa?.RutaLogo ?? null),
  };
}

function resolveLogoAbsolutePath(rutaLogo: string | null): string | null {
  if (!rutaLogo) {
    return null;
  }

  const relative = rutaLogo.replace(/^\/?uploads\/?/, '');
  const absolute = path.resolve(uploadsRootPath, relative);

  return absolute.startsWith(uploadsRootPath) && fs.existsSync(absolute) ? absolute : null;
}
