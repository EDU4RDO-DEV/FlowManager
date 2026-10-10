import { z } from 'zod';

const nullableText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} demasiado largo`).nullable();

const nullableDate = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} inválida`)
    .refine(
      (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      },
      `${label} inválida`,
    )
    .nullable();

const companyFields = {
  nit: z.string().trim().min(1, 'NIT es obligatorio').max(20, 'NIT demasiado largo'),
  nombre: z.string().trim().min(1, 'Nombre es obligatorio').max(255, 'Nombre demasiado largo'),
  nombreComercial: z
    .string()
    .trim()
    .min(1, 'Nombre comercial es obligatorio')
    .max(255, 'Nombre comercial demasiado largo'),
  direccion: z.string().trim().min(1, 'Dirección es obligatoria').max(255, 'Dirección demasiado larga'),
  telefono1: nullableText(20, 'Teléfono 1'),
  telefono2: nullableText(20, 'Teléfono 2'),
  correoElectronico: z
    .union([z.string().trim().email('Correo electrónico inválido').max(100), z.literal('')])
    .nullable()
    .transform((value) => value || null),
  frase: z.string().trim().min(1, 'Frase es obligatoria').max(255, 'Frase demasiado larga'),
  fechaInicioFel: nullableDate('Fecha de inicio FEL'),
  fechaFinFel: nullableDate('Fecha de fin FEL'),
  regimenIsr: z.string().trim().min(1, 'Régimen ISR es obligatorio').max(255, 'Régimen ISR demasiado largo'),
};

export const updateCompanySettingsSchema = z.object(companyFields).strict();

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
