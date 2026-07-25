import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type { ApiResponse } from '@/types/auth';

import { clearAuth, getToken } from './auth-storage';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Evento emitido cuando el backend responde 401 (sesión inválida/expirada),
// para que el AuthProvider limpie estado y redirija a /login.
export const UNAUTHORIZED_EVENT = 'flowmanager:unauthorized';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Request: adjunta el JWT como Bearer cuando existe.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Response: en 401 limpia la sesión y notifica a la app.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

// Extrae un mensaje de error legible desde una respuesta de Axios.
export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data?.message) return data.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
