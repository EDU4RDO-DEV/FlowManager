export interface CompanySettings {
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
}

export type UpdateCompanySettings = Omit<CompanySettings, "id" | "rutaLogo">;
