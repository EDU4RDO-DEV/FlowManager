import fs from 'fs';
import path from 'path';

import { prisma } from '../config/prisma';
import type { UpdateCompanySettingsInput } from '../validators/company.validators';
import { detectImageMimeFromBuffer, extensionFromMime } from '../utils/image-signature';
import { uploadsRootPath } from '../utils/paths';

export type CompanySettings = {
  id: number;
  nit: string;
  nombre: string;
  nombreComercial: string;
  direccion: string;
  telefono1: string | null;
  telefono2: string | null;
  correoElectronico: string | null;
  frase: string;
  rutaLogo: string | null;
  fechaInicioFel: string | null;
  fechaFinFel: string | null;
  regimenIsr: string;
};

async function getActiveCompanyOrThrow() {
  const empresa = await prisma.empresa.findFirst({
    where: { Anulado: false },
    orderBy: { Id: 'asc' },
    select: {
      Id: true,
      Nit: true,
      Nombre: true,
      NombreComercial: true,
      Direccion: true,
      Telefono1: true,
      Telefono2: true,
      CorreoElectronico: true,
      Frase: true,
      RutaLogo: true,
      FechaInicioFel: true,
      FechaFinFel: true,
      RegimenIsr: true,
    },
  });

  if (!empresa) {
    throw new Error('No existe configuración de empresa activa');
  }

  return empresa;
}

function toCompanySettings(empresa: Awaited<ReturnType<typeof getActiveCompanyOrThrow>>): CompanySettings {
  return {
    id: empresa.Id,
    nit: empresa.Nit,
    nombre: empresa.Nombre,
    nombreComercial: empresa.NombreComercial,
    direccion: empresa.Direccion,
    telefono1: empresa.Telefono1,
    telefono2: empresa.Telefono2,
    correoElectronico: empresa.CorreoElectronico,
    frase: empresa.Frase,
    rutaLogo: empresa.RutaLogo,
    fechaInicioFel: empresa.FechaInicioFel?.toISOString().slice(0, 10) ?? null,
    fechaFinFel: empresa.FechaFinFel?.toISOString().slice(0, 10) ?? null,
    regimenIsr: empresa.RegimenIsr,
  };
}

export async function getCompanySettings(): Promise<CompanySettings> {
  return toCompanySettings(await getActiveCompanyOrThrow());
}

export async function updateCompanySettings(
  input: UpdateCompanySettingsInput,
  modifiedByUserId: number,
): Promise<CompanySettings> {
  const empresa = await getActiveCompanyOrThrow();
  const updated = await prisma.empresa.update({
    where: { Id: empresa.Id },
    data: {
      Nit: input.nit,
      Nombre: input.nombre,
      NombreComercial: input.nombreComercial,
      Direccion: input.direccion,
      Telefono1: input.telefono1,
      Telefono2: input.telefono2,
      CorreoElectronico: input.correoElectronico,
      Frase: input.frase,
      FechaInicioFel: input.fechaInicioFel ? new Date(`${input.fechaInicioFel}T00:00:00.000Z`) : null,
      FechaFinFel: input.fechaFinFel ? new Date(`${input.fechaFinFel}T00:00:00.000Z`) : null,
      RegimenIsr: input.regimenIsr,
      IdUsuarioModificador: modifiedByUserId,
      FechaModificacion: new Date(),
    },
    select: {
      Id: true,
      Nit: true,
      Nombre: true,
      NombreComercial: true,
      Direccion: true,
      Telefono1: true,
      Telefono2: true,
      CorreoElectronico: true,
      Frase: true,
      RutaLogo: true,
      FechaInicioFel: true,
      FechaFinFel: true,
      RegimenIsr: true,
    },
  });

  return toCompanySettings(updated);
}

type UpdateCompanyLogoInput = {
  fileBuffer: Buffer;
  originalName: string;
  declaredMimeType: string;
  modifiedByUserId: number;
};

function sanitizeBaseName(originalName: string): string {
  return path
    .parse(originalName)
    .name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function resolveLogoAbsolutePath(rutaLogo: string | null): string | null {
  if (!rutaLogo) return null;

  const relativePath = rutaLogo.replace(/^\/?uploads\/?/, '');
  const absolutePath = path.resolve(uploadsRootPath, relativePath);
  return absolutePath.startsWith(uploadsRootPath) ? absolutePath : null;
}

export async function updateCompanyLogo(input: UpdateCompanyLogoInput): Promise<CompanySettings> {
  const detectedMime = detectImageMimeFromBuffer(input.fileBuffer);
  if (!detectedMime) {
    throw new Error('El archivo no contiene una imagen válida (PNG, JPG o WEBP)');
  }

  if (input.declaredMimeType && input.declaredMimeType !== detectedMime) {
    throw new Error('El tipo declarado no coincide con el contenido real de la imagen');
  }

  const empresa = await getActiveCompanyOrThrow();
  const logosDir = path.join(uploadsRootPath, 'company-logos');
  await fs.promises.mkdir(logosDir, { recursive: true });

  const extension = extensionFromMime(detectedMime);
  const baseName = sanitizeBaseName(input.originalName) || 'logo-empresa';
  const fileName = `${baseName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const nextRutaLogo = `/uploads/company-logos/${fileName}`;
  const nextAbsolutePath = path.join(logosDir, fileName);
  const previousAbsolutePath = resolveLogoAbsolutePath(empresa.RutaLogo);

  await fs.promises.writeFile(nextAbsolutePath, input.fileBuffer);
  try {
    const updated = await prisma.empresa.update({
      where: { Id: empresa.Id },
      data: {
        RutaLogo: nextRutaLogo,
        IdUsuarioModificador: input.modifiedByUserId,
        FechaModificacion: new Date(),
      },
      select: {
        Id: true,
        Nit: true,
        Nombre: true,
        NombreComercial: true,
        Direccion: true,
        Telefono1: true,
        Telefono2: true,
        CorreoElectronico: true,
        Frase: true,
        RutaLogo: true,
        FechaInicioFel: true,
        FechaFinFel: true,
        RegimenIsr: true,
      },
    });

    if (
      previousAbsolutePath &&
      previousAbsolutePath.startsWith(logosDir) &&
      previousAbsolutePath !== nextAbsolutePath
    ) {
      try {
        await fs.promises.unlink(previousAbsolutePath);
      } catch {
        // El archivo anterior pudo haberse eliminado manualmente.
      }
    }

    return toCompanySettings(updated);
  } catch (error) {
    try {
      await fs.promises.unlink(nextAbsolutePath);
    } catch {
      // Preserve the original database error.
    }
    throw error;
  }
}
