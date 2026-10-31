// Tipos y utilidades compartidos entre las pestañas del módulo de despacho y
// liquidación de rutas. No contienen reglas de negocio: son únicamente formas
// de datos de formulario y una función de formato reutilizadas por page.tsx
// y por cada pestaña.

export type DispatchDraft = {
  idInventarioItem: number;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "";
};

export type TransferDraft = {
  idInventarioItem: number;
  cantidad: string;
  estadoEnvase: "VACIO" | "LLENO" | "";
};

export type HandoffFormState = {
  idRuta: string;
  idVehiculo: string;
  idEmpleadoChofer: string;
  idEmpleadoVendedor: string;
  kmInicialEntrante: string;
  motivo: string;
};

export type ReturnDraft = {
  cantidadRecibida: string;
  cantidadDanada: string;
  cantidadEnvaseVacio: string;
  cantidadEnvaseLleno: string;
  estadoEnvaseDanado: "VACIO" | "LLENO" | "";
  observaciones: string;
  ubicacionDanada: "" | "CUARENTENA" | "OTRA";
  ubicacionDanadaDetalle: string;
};

export function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}
