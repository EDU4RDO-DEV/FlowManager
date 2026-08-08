import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type { ApiResponse, LoginResponse } from '@/types/auth';

import {
  clearAuth,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setStoredUser,
  setToken,
} from './auth-storage';

const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? `http://${runtimeHost}:4000`;

// Evento emitido cuando el backend responde 401 (sesión inválida/expirada),
// para que el AuthProvider limpie estado y redirija a /login.
export const UNAUTHORIZED_EVENT = 'flowmanager:unauthorized';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function forceLogout(): void {
  clearAuth();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/logout')
  );
}

async function renewAccessToken(): Promise<string | null> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    return null;
  }

  const { data } = await axios.post<LoginResponse>(
    `${baseURL}/api/auth/refresh`,
    { refreshToken: currentRefreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (!data.data) {
    return null;
  }

  setToken(data.data.accessToken);
  setRefreshToken(data.data.refreshToken);
  setStoredUser(data.data.user);
  return data.data.accessToken;
}

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
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    if (originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
      forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = renewAccessToken();
      }

      const newAccessToken = await refreshPromise;
      refreshPromise = null;

      if (!newAccessToken) {
        forceLogout();
        return Promise.reject(error);
      }

      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return api.request(originalRequest);
    } catch {
      refreshPromise = null;
      forceLogout();
      return Promise.reject(error);
    }
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
