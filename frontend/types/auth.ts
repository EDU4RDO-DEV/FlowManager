// Tipos de autenticación alineados al backend FlowManager (Industrias Basán).
// Contrato de respuesta estándar del API: { ok, message, data }.

export interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data?: T;
}

export interface AuthUser {
  id: number;
  nombre: string;
  correo: string;
  idRol: number | null;
  nombreRol: string | null;
}

export interface LoginRequest {
  correo: string;
  clave: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export type LoginResponse = ApiResponse<LoginResult>;

export interface RegisterRequest {
  nombre: string;
  correo: string;
  clave: string;
  idRol?: number;
  idEntidad?: number;
}

export interface RegisteredUser {
  id: number;
  nombre: string;
  correo: string;
  idRol: number | null;
  idEntidad: number | null;
}

export type RegisterResponse = ApiResponse<RegisteredUser>;

export interface HealthStatus {
  ok: boolean;
  service: string;
  timestamp: string;
}
